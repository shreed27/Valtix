//! Account database model

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AccountRow {
    pub id: String,
    pub wallet_id: String,
    pub name: String,
    pub chain: String,
    pub derivation_path: String,
    pub derivation_index: i64,
    pub public_key: String,
    pub address: String,
    pub created_at: String,
}

impl AccountRow {
    pub fn new(
        wallet_id: String,
        name: String,
        chain: String,
        derivation_path: String,
        derivation_index: u32,
        public_key: String,
        address: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            wallet_id,
            name,
            chain,
            derivation_path,
            derivation_index: derivation_index as i64,
            public_key,
            address,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Account response for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountResponse {
    pub id: String,
    pub name: String,
    pub chain: String,
    pub derivation_path: String,
    pub derivation_index: u32,
    pub public_key: String,
    pub address: String,
    pub created_at: String,
}

impl From<AccountRow> for AccountResponse {
    fn from(row: AccountRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            chain: row.chain,
            derivation_path: row.derivation_path,
            derivation_index: row.derivation_index as u32,
            public_key: row.public_key,
            address: row.address,
            created_at: row.created_at,
        }
    }
}
