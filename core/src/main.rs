use anyhow::Result;
use flick_core::{ClipboardPayload, DeviceTrustStore, EncryptedPayload, FlickGossipNode, FlickKeypair, PairedDevice, PairingTicket};
use futures_lite::StreamExt;
use iroh::net::{Endpoint, NodeAddr, NodeId};
use iroh_gossip::net::{Gossip, GossipEvent};
use std::env;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use tokio::io::{self, AsyncBufReadExt};

#[tokio::main]
async fn main() -> Result<()> {
    // Quiet tracing logs
    tracing_subscriber::fmt().with_max_level(tracing::Level::WARN).init();

    let args: Vec<String> = env::args().collect();
    let device_name = args.get(1).cloned().unwrap_or_else(|| "TestDevice-1".to_string());
    let peer_node_id_arg = args.iter().skip(2).find(|s| !s.trim().is_empty());
    let peer_relay_arg = args.iter().skip(3).find(|s| !s.trim().is_empty());

    println!("⚡ FLICK P2P Node starting for [{}]...", device_name);

    // Generate local Ed25519 identity keypair
    let keypair = FlickKeypair::generate();
    let trust_store = Arc::new(Mutex::new(DeviceTrustStore::new()));

    let endpoint = Endpoint::builder()
        .alpns(vec![b"/iroh-gossip/0".to_vec()])
        .bind()
        .await?;
    let my_addr = endpoint.node_addr().await?;

    let gossip = Gossip::from_endpoint(endpoint.clone(), Default::default(), &Default::default());

    let device_id = format!("dev_{}", &my_addr.node_id.to_string()[..8]);

    println!("📍 Node ID: {}", my_addr.node_id);
    println!("🔑 Public Key (Ed25519): {}", keypair.public_key_hex());
    if let Some(relay) = my_addr.relay_url() {
        println!("🌐 Home Relay: {}", relay);
    }

    let topic_seed = [42u8; 32];
    let topic = FlickGossipNode::create_topic(&topic_seed);

    // Create pairing QR code ticket
    let ticket = PairingTicket::new(
        &topic_seed,
        my_addr.node_id.to_string(),
        device_id.clone(),
        device_name.clone(),
        keypair.public_key_hex(),
        my_addr.relay_url().map(|r| r.to_string()),
    );
    println!("\n📱 QR Pairing Ticket: {}", ticket.to_qr_string()?);

    // Spawn background task to handle incoming QUIC connections
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

    let mut bootstrap_peers = vec![];
    if let Some(peer_str) = peer_node_id_arg {
        if let Ok(peer_id) = NodeId::from_str(peer_str) {
            println!("\n🤝 Bootstrapping connection to peer ID: {}", peer_id);

            let relay_str = peer_relay_arg.cloned().unwrap_or_else(|| "https://use1-1.relay.iroh.network./".to_string());
            if let Ok(relay_url) = relay_str.parse() {
                let peer_addr = NodeAddr::from_parts(peer_id, Some(relay_url), vec![]);
                let _ = endpoint.add_node_addr(peer_addr);
            }
            bootstrap_peers.push(peer_id);
        }
    }

    let (sender, mut receiver) = gossip.join(topic, bootstrap_peers).await?.split();

    let _gossip_handle = Arc::new(gossip);
    let keypair_clone = keypair.clone();
    let trust_store_clone = trust_store.clone();

    // Background listener for incoming encrypted P2P flicks
    tokio::spawn(async move {
        while let Some(Ok(event)) = receiver.next().await {
            if let iroh_gossip::net::Event::Gossip(GossipEvent::Received(msg)) = event {
                if let Ok(encrypted_payload) = serde_json::from_slice::<EncryptedPayload>(&msg.content) {
                    {
                        let mut ts = trust_store_clone.lock().unwrap();
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
                    let ts = trust_store_clone.lock().unwrap();
                    match encrypted_payload.decrypt_and_verify(&keypair_clone, &ts, &topic_seed) {
                        Ok(payload) => {
                            println!("\n📥 [INCOMING FLICK from {}]:", payload.from_device_name);
                            if payload.sensitive {
                                println!("   🔒 Preview: {}", payload.preview);
                                println!("   (Tap/Confirm to reveal full sensitive payload)");
                            } else {
                                println!("   📋 Content: {}", payload.content);
                            }
                            println!("   ⏰ Time: {}", payload.ts);
                            print!("> ");
                            use std::io::Write;
                            std::io::stdout().flush().ok();
                        }
                        Err(e) => {
                            // Decryption or signature failure
                            eprintln!("\n⚠️ Ignored flick: {}", e);
                            print!("> ");
                            use std::io::Write;
                            std::io::stdout().flush().ok();
                        }
                    }
                }
            }
        }
    });

    println!("\n✅ Node ready! Type any text and press Enter to flick encrypted payload.");
    print!("> ");
    use std::io::Write;
    std::io::stdout().flush().ok();

    let mut lines = io::BufReader::new(io::stdin()).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            print!("> ");
            use std::io::Write;
            std::io::stdout().flush().ok();
            continue;
        }
        let payload = ClipboardPayload::new(line.clone(), device_id.clone(), device_name.clone());
        let encrypted_payload = EncryptedPayload::encrypt_and_sign(&payload, &keypair, &topic_seed)?;

        FlickGossipNode::broadcast_encrypted_payload(&sender, &encrypted_payload).await?;
        println!("📤 Encrypted & Signed Flick sent: \"{}\"", payload.preview);
        print!("> ");
        use std::io::Write;
        std::io::stdout().flush().ok();
    }

    Ok(())
}
