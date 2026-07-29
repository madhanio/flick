mod frb_generated;
pub mod payload;
pub mod gossip;
pub mod pairing;
pub mod bridge;

use std::any::Any;
use std::hash::{Hash, Hasher};
use std::panic::AssertUnwindSafe;
use std::sync::{Mutex, OnceLock};
use futures_lite::FutureExt;
use tokio::sync::broadcast;

pub use payload::{ClipboardPayload, EncryptedPayload, FlickPayload};
pub use gossip::FlickGossipNode;
pub use pairing::{FlickKeypair, PairingTicket, DeviceTrustStore, PairedDevice};

static INCOMING_BROADCAST: OnceLock<broadcast::Sender<FlickPayload>> = OnceLock::new();
static LAST_ACCEPTED: OnceLock<Mutex<Option<(i64, u64)>>> = OnceLock::new();

fn panic_to_string(err: Box<dyn Any + Send>) -> String {
    if let Some(s) = err.downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = err.downcast_ref::<String>() {
        s.clone()
    } else {
        "Unknown panic occurred".to_string()
    }
}

fn content_hash(text: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    text.hash(&mut hasher);
    hasher.finish()
}

/// Returns a broadcast receiver for incoming FlickPayloads
pub fn incoming_receiver() -> broadcast::Receiver<FlickPayload> {
    let tx = INCOMING_BROADCAST.get_or_init(|| {
        let (tx, _) = broadcast::channel(64);
        tx
    });
    tx.subscribe()
}

/// Internal helper to broadcast received FlickPayload to all subscribers
/// Includes timestamp dedup guard: drops payload if ts is older than last accepted ts AND content matches
pub fn broadcast_incoming_flick(payload: FlickPayload) {
    let lock = LAST_ACCEPTED.get_or_init(|| Mutex::new(None));
    let mut guard = lock.lock().unwrap();
    let current_hash = content_hash(&payload.content);

    if let Some((last_ts, last_hash)) = *guard {
        if payload.ts < last_ts && current_hash == last_hash {
            // Drop stale duplicate payload silently
            return;
        }
    }

    *guard = Some((payload.ts, current_hash));
    drop(guard);

    let tx = INCOMING_BROADCAST.get_or_init(|| {
        let (tx, _) = broadcast::channel(64);
        tx
    });
    let _ = tx.send(payload);
}

/// Register a callback closure for incoming FlickPayloads with catch-unwind protection
pub async fn set_incoming_handler(handler: impl Fn(FlickPayload) + Send + 'static) -> Result<(), String> {
    let res = AssertUnwindSafe(async move {
        let mut rx = incoming_receiver();
        tokio::spawn(async move {
            while let Ok(payload) = rx.recv().await {
                handler(payload);
            }
        });
        Ok(())
    })
    .catch_unwind()
    .await;

    match res {
        Ok(inner_res) => inner_res,
        Err(panic_err) => Err(format!("Panic caught in set_incoming_handler: {}", panic_to_string(panic_err))),
    }
}

/// Initialize the iroh-gossip node with catch-unwind protection
pub async fn start_node(device_name: String) -> Result<String, String> {
    let res = AssertUnwindSafe(async move {
        bridge::start_node(device_name).await.map_err(|e| e.to_string())
    })
    .catch_unwind()
    .await;

    match res {
        Ok(inner_res) => inner_res,
        Err(panic_err) => Err(format!("Panic caught in start_node: {}", panic_to_string(panic_err))),
    }
}

/// Broadcast a flick payload to paired devices with catch-unwind protection
pub async fn send_flick(content: String, device_id: String, device_name: String) -> Result<(), String> {
    let res = AssertUnwindSafe(async move {
        match bridge::send_flick(content, device_id, device_name).await {
            Ok(true) => Ok(()),
            Ok(false) => Err("Gossip node is not initialized".to_string()),
            Err(e) => Err(e.to_string()),
        }
    })
    .catch_unwind()
    .await;

    match res {
        Ok(inner_res) => inner_res,
        Err(panic_err) => Err(format!("Panic caught in send_flick: {}", panic_to_string(panic_err))),
    }
}

