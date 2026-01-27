//! Contact (address book) database model

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ContactRow {
    pub id: String,
    pub wallet_id: String,
    pub name: String,
    pub chain: String,
    pub address: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl ContactRow {
    pub fn new(
        wallet_id: String,
        name: String,
        chain: String,
        address: String,
        notes: Option<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            wallet_id,
            name,
            chain,
            address,
            notes,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Contact response for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactResponse {
    pub id: String,
    pub name: String,
    pub chain: String,
    pub address: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl From<ContactRow> for ContactResponse {
    fn from(row: ContactRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            chain: row.chain,
            address: row.address,
            notes: row.notes,
            created_at: row.created_at,
        }
    }
}
