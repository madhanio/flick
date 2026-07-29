use anyhow::{anyhow, Result};
use chacha20poly1305::aead::{Aead, AeadCore, KeyInit, OsRng};
use chacha20poly1305::{ChaCha20Poly1305, Nonce};
use serde::{Deserialize, Serialize};

use crate::pairing::{DeviceTrustStore, FlickKeypair};

/// Wire format JSON for clipboard items
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlickPayload {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub content: String,
    pub preview: String,
    pub sensitive: bool,
    pub from_device_id: String,
    pub from_device_name: String,
    pub ts: i64,
}

pub type ClipboardPayload = FlickPayload;

impl FlickPayload {
    pub fn new(content: String, device_id: String, device_name: String) -> Self {
        let sensitive = Self::detect_sensitive(&content);
        let preview = if sensitive {
            "🔒 Sensitive content — tap to reveal".to_string()
        } else if content.chars().count() > 60 {
            format!("{}...", content.chars().take(60).collect::<String>())
        } else {
            content.clone()
        };

        Self {
            msg_type: "clipboard".to_string(),
            content,
            preview,
            sensitive,
            from_device_id: device_id,
            from_device_name: device_name,
            ts: chrono::Utc::now().timestamp(),
        }
    }

    pub fn detect_sensitive(text: &str) -> bool {
        let trimmed = text.trim();
        if trimmed.len() >= 16
            && !trimmed.contains(' ')
            && (trimmed.chars().any(|c| c.is_ascii_digit()) && trimmed.chars().any(|c| c.is_ascii_uppercase()))
        {
            return true;
        }
        if trimmed.starts_with("ghp_")
            || trimmed.starts_with("eyJ")
            || trimmed.starts_with("sk-")
            || trimmed.starts_with("bearer ")
            || trimmed.starts_with("ssh-rsa")
            || trimmed.starts_with("-----BEGIN")
        {
            return true;
        }
        false
    }
}

/// Encrypted & Digitally Signed P2P Wire Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 12],
    pub signature_bytes: Vec<u8>,
    pub sender_device_id: String,
    pub sender_device_name: String,
    pub sender_public_key_hex: String,
    pub timestamp: i64,
}

impl EncryptedPayload {
    /// Encrypt FlickPayload JSON with ChaCha20Poly1305 using shared topic key and sign with Ed25519 keypair
    pub fn encrypt_and_sign(
        payload: &FlickPayload,
        keypair: &FlickKeypair,
        topic_seed: &[u8; 32],
    ) -> Result<Self> {
        let json_bytes = serde_json::to_vec(payload)?;

        let cipher = ChaCha20Poly1305::new_from_slice(topic_seed)
            .map_err(|e| anyhow!("Failed to initialize cipher: {}", e))?;

        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, json_bytes.as_ref())
            .map_err(|e| anyhow!("Payload encryption failed: {}", e))?;

        // Sign the ciphertext with Ed25519 private key
        let signature = keypair.sign(&ciphertext);

        Ok(Self {
            ciphertext,
            nonce: nonce.into(),
            signature_bytes: signature.to_bytes().to_vec(),
            sender_device_id: payload.from_device_id.clone(),
            sender_device_name: payload.from_device_name.clone(),
            sender_public_key_hex: keypair.public_key_hex(),
            timestamp: payload.ts,
        })
    }

    /// Verify Ed25519 signature and decrypt ChaCha20Poly1305 payload using shared topic key
    pub fn decrypt_and_verify(
        &self,
        _keypair: &FlickKeypair,
        _trust_store: &DeviceTrustStore,
        topic_seed: &[u8; 32],
    ) -> Result<FlickPayload> {
        // Verify Ed25519 signature against sender's public key
        FlickKeypair::verify_signature(
            &self.sender_public_key_hex,
            &self.ciphertext,
            &self.signature_bytes,
        )?;

        let cipher = ChaCha20Poly1305::new_from_slice(topic_seed)
            .map_err(|e| anyhow!("Failed to initialize cipher: {}", e))?;

        let nonce = Nonce::from_slice(&self.nonce);
        let decrypted_bytes = cipher
            .decrypt(nonce, self.ciphertext.as_ref())
            .map_err(|e| anyhow!("Payload decryption failed (invalid key or tampered data): {}", e))?;

        let payload: FlickPayload = serde_json::from_slice(&decrypted_bytes)?;
        Ok(payload)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pairing::{FlickKeypair, PairingTicket};

    #[test]
    fn test_payload_encryption_decryption_roundtrip() {
        let sender_keypair = FlickKeypair::generate();
        let receiver_keypair = FlickKeypair::generate();
        let mut trust_store = DeviceTrustStore::new();
        let topic_seed = [42u8; 32];

        let ticket = PairingTicket::new(
            &topic_seed,
            "node_12345".to_string(),
            "dev_phone".to_string(),
            "Android Phone".to_string(),
            sender_keypair.public_key_hex(),
            None,
        );
        trust_store.add_device(&ticket);

        let original_payload = FlickPayload::new(
            "https://github.com/madhanio/flick".to_string(),
            "dev_phone".to_string(),
            "Android Phone".to_string(),
        );

        let encrypted = EncryptedPayload::encrypt_and_sign(&original_payload, &sender_keypair, &topic_seed).unwrap();
        let decrypted = encrypted.decrypt_and_verify(&receiver_keypair, &trust_store, &topic_seed).unwrap();

        assert_eq!(decrypted.content, "https://github.com/madhanio/flick");
        assert_eq!(decrypted.from_device_name, "Android Phone");
        assert_eq!(decrypted.msg_type, "clipboard");
        assert!(!decrypted.sensitive);
    }
}

