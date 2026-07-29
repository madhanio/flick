use anyhow::{anyhow, Result};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use iroh_gossip::proto::TopicId;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Device Ed25519 Keypair wrapper for cryptographic identity & signing
#[derive(Clone)]
pub struct FlickKeypair {
    pub signing_key: SigningKey,
}

impl FlickKeypair {
    /// Generate a fresh random Ed25519 keypair
    pub fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        Self { signing_key }
    }

    /// Create keypair from 32 secret key bytes
    pub fn from_bytes(bytes: &[u8; 32]) -> Self {
        let signing_key = SigningKey::from_bytes(bytes);
        Self { signing_key }
    }

    /// Get verifying (public) key
    pub fn public_key(&self) -> VerifyingKey {
        self.signing_key.verifying_key()
    }

    /// Public key in hex string format
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public_key().to_bytes())
    }

    /// Secret key bytes for local secure storage
    pub fn secret_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes()
    }

    /// Derive TopicId from Ed25519 public key bytes
    pub fn topic_id(&self) -> TopicId {
        TopicId::from_bytes(self.public_key().to_bytes())
    }

    /// Sign arbitrary bytes with this keypair
    pub fn sign(&self, message: &[u8]) -> Signature {
        self.signing_key.sign(message)
    }

    /// Verify signature using a peer's public key hex
    pub fn verify_signature(public_key_hex: &str, message: &[u8], signature_bytes: &[u8]) -> Result<()> {
        let pk_bytes = hex::decode(public_key_hex).map_err(|e| anyhow!("Invalid public key hex: {}", e))?;
        if pk_bytes.len() != 32 {
            return Err(anyhow!("Invalid public key byte length"));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&pk_bytes);
        let verifying_key = VerifyingKey::from_bytes(&arr).map_err(|e| anyhow!("Invalid verifying key: {}", e))?;
        
        let sig_arr: [u8; 64] = signature_bytes
            .try_into()
            .map_err(|_| anyhow!("Invalid signature length (expected 64 bytes)"))?;
        let signature = Signature::from_bytes(&sig_arr);

        verifying_key.verify(message, &signature).map_err(|e| anyhow!("Signature verification failed: {}", e))
    }
}

/// Pairing ticket payload encoded inside QR codes for 1-tap device pairing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingTicket {
    pub version: u32,
    pub topic_id: String,
    pub topic_seed_hex: String,
    pub endpoint_id: String,
    pub device_id: String,
    pub device_name: String,
    pub public_key_hex: String,
    pub relay_hint: Option<String>,
}

impl PairingTicket {
    pub fn new(
        topic_seed: &[u8; 32],
        endpoint_id: String,
        device_id: String,
        device_name: String,
        public_key_hex: String,
        relay_hint: Option<String>,
    ) -> Self {
        let topic_id = hex::encode(topic_seed);
        Self {
            version: 1,
            topic_id: topic_id.clone(),
            topic_seed_hex: topic_id,
            endpoint_id,
            device_id,
            device_name,
            public_key_hex,
            relay_hint,
        }
    }

    /// Serialize ticket to JSON payload for QR code generation
    pub fn to_qr_string(&self) -> Result<String> {
        serde_json::to_string(self).map_err(|e| anyhow!("Failed to serialize QR pairing ticket: {}", e))
    }

    /// Parse QR code string back into a PairingTicket
    pub fn from_qr_string(qr_str: &str) -> Result<Self> {
        let ticket: Self = serde_json::from_str(qr_str.trim())
            .map_err(|e| anyhow!("Invalid QR code pairing ticket format: {}", e))?;
        Ok(ticket)
    }

    /// Get raw 32-byte topic seed
    pub fn get_topic_seed(&self) -> Result<[u8; 32]> {
        let bytes = hex::decode(&self.topic_seed_hex)?;
        if bytes.len() != 32 {
            return Err(anyhow!("Invalid topic seed length"));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(arr)
    }
}

/// Represents a trusted paired device entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedDevice {
    pub device_id: String,
    pub device_name: String,
    pub public_key_hex: String,
    pub paired_at: i64,
}

/// Local device trust store managing trusted peer keys & paired devices
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeviceTrustStore {
    pub trusted_devices: HashMap<String, PairedDevice>,
}

impl DeviceTrustStore {
    pub fn new() -> Self {
        Self {
            trusted_devices: HashMap::new(),
        }
    }

    /// Add a new device to the trusted paired devices list
    pub fn add_device(&mut self, ticket: &PairingTicket) -> PairedDevice {
        let device = PairedDevice {
            device_id: ticket.device_id.clone(),
            device_name: ticket.device_name.clone(),
            public_key_hex: ticket.public_key_hex.clone(),
            paired_at: chrono::Utc::now().timestamp(),
        };
        self.trusted_devices.insert(ticket.device_id.clone(), device.clone());
        device
    }

    /// Check if a device ID is trusted
    pub fn is_trusted(&self, device_id: &str) -> bool {
        self.trusted_devices.contains_key(device_id)
    }

    /// Get a device's public key hex by device ID
    pub fn get_public_key(&self, device_id: &str) -> Option<&str> {
        self.trusted_devices.get(device_id).map(|d| d.public_key_hex.as_str())
    }

    /// Remove a device from trusted list
    pub fn remove_device(&mut self, device_id: &str) -> bool {
        self.trusted_devices.remove(device_id).is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation_and_signing() {
        let keypair = FlickKeypair::generate();
        let pub_hex = keypair.public_key_hex();
        assert_eq!(pub_hex.len(), 64);

        let message = b"Hello Flick Security";
        let sig = keypair.sign(message);

        let verify_res = FlickKeypair::verify_signature(&pub_hex, message, &sig.to_bytes());
        assert!(verify_res.is_ok());
    }

    #[test]
    fn test_pairing_ticket_qr_roundtrip() {
        let topic_seed = [7u8; 32];
        let ticket = PairingTicket::new(
            &topic_seed,
            "node_12345".to_string(),
            "dev_macbook".to_string(),
            "MacBook Pro".to_string(),
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string(),
            Some("https://aps1-1.relay.iroh.network./".to_string()),
        );

        let qr_str = ticket.to_qr_string().unwrap();
        let parsed_ticket = PairingTicket::from_qr_string(&qr_str).unwrap();

        assert_eq!(parsed_ticket.device_id, "dev_macbook");
        assert_eq!(parsed_ticket.device_name, "MacBook Pro");
        assert_eq!(parsed_ticket.endpoint_id, "node_12345");
        assert_eq!(parsed_ticket.get_topic_seed().unwrap(), topic_seed);
    }
}

