//! Wallet database model

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WalletRow {
    pub id: String,
    pub encrypted_seed: Vec<u8>,
    pub salt: Vec<u8>,
    pub nonce: Vec<u8>,
    pub created_at: String,
}

impl WalletRow {
    pub fn new(
        id: String,
        encrypted_seed: Vec<u8>,
        salt: Vec<u8>,
        nonce: Vec<u8>,
    ) -> Self {
        Self {
            id,
            encrypted_seed,
            salt,
            nonce,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}
