use anyhow::Result;
use bytes::Bytes;
use iroh_gossip::net::GossipSender;
use iroh_gossip::proto::TopicId;
use tracing::info;

use crate::payload::EncryptedPayload;

pub struct FlickGossipNode;

impl FlickGossipNode {
    pub fn create_topic(secret_seed: &[u8; 32]) -> TopicId {
        TopicId::from_bytes(*secret_seed)
    }

    pub async fn broadcast_encrypted_payload(sender: &GossipSender, payload: &EncryptedPayload) -> Result<()> {
        let json_data = serde_json::to_vec(payload)?;
        sender.broadcast(Bytes::from(json_data)).await?;
        info!("Broadcasted encrypted flick payload");
        Ok(())
    }
}
