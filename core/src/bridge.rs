use anyhow::Result;
use flutter_rust_bridge::frb;
use futures_lite::StreamExt;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use crate::{ClipboardPayload, DeviceTrustStore, EncryptedPayload, FlickGossipNode, FlickKeypair, PairedDevice};
use iroh::net::Endpoint;
use iroh_gossip::net::{Gossip, GossipEvent, GossipSender};

#[derive(Clone)]
struct RegisteredNode {
    device_id: String,
    device_name: String,
    node_id: iroh::net::NodeId,
    node_addr: iroh::net::NodeAddr,
    keypair: FlickKeypair,
    trust_store: Arc<Mutex<DeviceTrustStore>>,
    topic_seed: [u8; 32],
    sender_slot: Arc<Mutex<Option<Arc<GossipSender>>>>,
}

static ACTIVE_NODES: OnceLock<Mutex<HashMap<String, RegisteredNode>>> = OnceLock::new();
static INCOMING_TX: OnceLock<tokio::sync::broadcast::Sender<String>> = OnceLock::new();

fn active_nodes_map() -> &'static Mutex<HashMap<String, RegisteredNode>> {
    ACTIVE_NODES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_active_node(
    device_id: &str,
    device_name: &str,
    node_id: iroh::net::NodeId,
    node_addr: iroh::net::NodeAddr,
    keypair: FlickKeypair,
    trust_store: Arc<Mutex<DeviceTrustStore>>,
    topic_seed: [u8; 32],
    sender_slot: Arc<Mutex<Option<Arc<GossipSender>>>>,
) {
    let mut map = active_nodes_map().lock().unwrap();
    map.insert(
        device_id.to_string(),
        RegisteredNode {
            device_id: device_id.to_string(),
            device_name: device_name.to_string(),
            node_id,
            node_addr,
            keypair,
            trust_store,
            topic_seed,
            sender_slot,
        },
    );
}

#[frb(opaque)]
pub struct FlickNodeHandle;

#[frb(sync)]
pub fn generate_keypair() -> String {
    FlickKeypair::generate().public_key_hex()
}

pub async fn start_node(device_name: String) -> Result<String> {
    #[cfg(target_os = "android")]
    {
        android_logger::init_once(
            android_logger::Config::default()
                .with_max_level(log::LevelFilter::Debug)
                .with_tag("FlickRust"),
        );
    }

    #[cfg(target_os = "android")]
    log::error!("🔵 [flick] start_node called: {}", device_name);

    let keypair = FlickKeypair::generate();
    let trust_store = Arc::new(Mutex::new(DeviceTrustStore::new()));
    let topic_seed = [42u8; 32];

    use tokio::time::{timeout, Duration};

    let bind_fut = Endpoint::builder()
        .alpns(vec![b"/iroh-gossip/0".to_vec()])
        .relay_mode(iroh_net::relay::RelayMode::Default)
        .bind();

    let endpoint = match timeout(Duration::from_secs(8), bind_fut).await {
        Ok(res) => res?,
        Err(_) => {
            Endpoint::builder()
                .alpns(vec![b"/iroh-gossip/0".to_vec()])
                .relay_mode(iroh_net::relay::RelayMode::Default)
                .bind()
                .await?
        }
    };
    let node_addr = endpoint.node_addr().await?;
    let node_id = node_addr.node_id;
    let node_id_str = node_id.to_string();
    let device_id = format!("dev_{}", &node_id_str[..8.min(node_id_str.len())]);

    // Add existing nodes' addresses to endpoint and gather bootstrap peers
    let (bootstrap_peers, existing_addrs): (Vec<iroh::net::NodeId>, Vec<iroh::net::NodeAddr>) = {
        let map = active_nodes_map().lock().unwrap();
        (
            map.values().map(|n| n.node_id).collect(),
            map.values().map(|n| n.node_addr.clone()).collect(),
        )
    };

    for addr in existing_addrs {
        let _ = endpoint.add_node_addr(addr);
    }

    let gossip = Gossip::from_endpoint(endpoint.clone(), Default::default(), &Default::default());
    let topic = FlickGossipNode::create_topic(&topic_seed);

    let endpoint_clone = endpoint.clone();
    let gossip_clone = gossip.clone();
    tokio::spawn(async move {
        while let Some(incoming) = endpoint_clone.accept().await {
            let gossip = gossip_clone.clone();
            tokio::spawn(async move {
                if let Ok(connecting) = incoming.accept() {
                    if let Ok(connection) = connecting.await {
                        let _ = gossip.handle_connection(connection).await;
                    }
                }
            });
        }
    });

    let (tx, _) = tokio::sync::broadcast::channel::<String>(32);
    let _ = INCOMING_TX.set(tx);

    let sender_slot = Arc::new(Mutex::new(None));

    register_active_node(
        &device_id,
        &device_name,
        node_id,
        node_addr,
        keypair.clone(),
        trust_store.clone(),
        topic_seed,
        sender_slot.clone(),
    );

    // Reconnect Watchdog background task (handles initial join + automatic reconnects)
    let gossip_watchdog = gossip.clone();
    let keypair_watchdog = keypair.clone();
    let trust_store_watchdog = trust_store.clone();

    tokio::spawn(async move {
        let mut backoff_ms = 500u64;
        loop {
            match gossip_watchdog.join(topic, bootstrap_peers.clone()).await {
                Ok(topic_handle) => {
                    let (sender, mut receiver) = topic_handle.split();
                    {
                        let mut slot = sender_slot.lock().unwrap();
                        *slot = Some(Arc::new(sender));
                    }

                    backoff_ms = 500;

                    while let Some(event_res) = receiver.next().await {
                        match event_res {
                            Ok(iroh_gossip::net::Event::Gossip(GossipEvent::Received(msg))) => {
                                if let Ok(encrypted_payload) = serde_json::from_slice::<EncryptedPayload>(&msg.content) {
                                    {
                                        let mut ts = trust_store_watchdog.lock().unwrap();
                                        if !ts.is_trusted(&encrypted_payload.sender_device_id) {
                                            ts.trusted_devices.insert(
                                                encrypted_payload.sender_device_id.clone(),
                                                PairedDevice {
                                                    device_id: encrypted_payload.sender_device_id.clone(),
                                                    device_name: encrypted_payload.sender_device_name.clone(),
                                                    public_key_hex: encrypted_payload.sender_public_key_hex.clone(),
                                                    paired_at: chrono::Utc::now().timestamp(),
                                                },
                                            );
                                        }
                                    }
                                    let ts = trust_store_watchdog.lock().unwrap();
                                    match encrypted_payload.decrypt_and_verify(&keypair_watchdog, &ts, &topic_seed) {
                                        Ok(payload) => {
                                            crate::broadcast_incoming_flick(payload.clone());
                                            if let Ok(json_str) = serde_json::to_string(&payload) {
                                                if let Some(tx) = INCOMING_TX.get() {
                                                    let _ = tx.send(json_str);
                                                }
                                            }
                                        }
                                        Err(_e) => {
                                            #[cfg(target_os = "android")]
                                            log::error!("⚠️ [flick] Decryption error: {:?}", _e);
                                        }
                                    }
                                }
                            }
                            Ok(_) => {}
                            Err(e) => {
                                eprintln!("⚠️ Gossip stream error: {:?}. Watchdog reconnecting...", e);
                                break;
                            }
                        }
                    }

                    eprintln!("⚠️ Gossip subscription stream ended. Re-subscribing in {}ms...", backoff_ms);
                }
                Err(e) => {
                    eprintln!("⚠️ Gossip join retry failed: {:?}. Retrying in {}ms...", e, backoff_ms);
                }
            }

            tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
            backoff_ms = (backoff_ms * 2).min(30_000);
        }
    });

    Ok(node_id_str)
}

pub async fn send_flick(content: String, device_id: String, _device_name: String) -> Result<bool> {
    let mut attempts = 0;
    loop {
        let node = {
            let map = active_nodes_map().lock().unwrap();
            map.get(&device_id).or_else(|| map.values().next()).cloned()
        };

        if let Some(node) = node {
            let maybe_sender = {
                let slot = node.sender_slot.lock().unwrap();
                slot.clone()
            };

            if let Some(sender) = maybe_sender {
                let payload = ClipboardPayload::new(content, node.device_id.clone(), node.device_name.clone());
                let encrypted_payload = EncryptedPayload::encrypt_and_sign(&payload, &node.keypair, &node.topic_seed)?;
                FlickGossipNode::broadcast_encrypted_payload(&sender, &encrypted_payload).await?;
                return Ok(true);
            }
        }

        attempts += 1;
        if attempts >= 60 { // Up to 15 seconds waiting for relay connection + join
            return Ok(false);
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
    }
}

use crate::frb_generated::StreamSink;

pub async fn incoming_flicks_stream(sink: StreamSink<String>) -> Result<()> {
    let rx = INCOMING_TX
        .get()
        .expect("Node not started — call start_node first")
        .subscribe();
    let mut stream = tokio_stream::wrappers::BroadcastStream::new(rx);
    while let Some(Ok(msg)) = stream.next().await {
        if sink.add(msg).is_err() {
            break; // Dart side closed the stream
        }
    }
    Ok(())
}
