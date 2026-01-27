//! NFT cache database model

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NftCacheRow {
    pub id: String,
    pub account_id: String,
    pub chain: String,
    pub token_address: String,
    pub token_id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub metadata_json: Option<String>,
    pub collection_name: Option<String>,
    pub last_updated: String,
}

impl NftCacheRow {
    pub fn new(
        account_id: String,
        chain: String,
        token_address: String,
        token_id: String,
        name: Option<String>,
        description: Option<String>,
        image_url: Option<String>,
        metadata_json: Option<String>,
        collection_name: Option<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            account_id,
            chain,
            token_address,
            token_id,
            name,
            description,
            image_url,
            metadata_json,
            collection_name,
            last_updated: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// NFT response for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftResponse {
    pub id: String,
    pub chain: String,
    pub token_address: String,
    pub token_id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub collection_name: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

impl From<NftCacheRow> for NftResponse {
    fn from(row: NftCacheRow) -> Self {
        let metadata = row
            .metadata_json
            .as_ref()
            .and_then(|json| serde_json::from_str(json).ok());

        Self {
            id: row.id,
            chain: row.chain,
            token_address: row.token_address,
            token_id: row.token_id,
            name: row.name,
            description: row.description,
            image_url: row.image_url,
            collection_name: row.collection_name,
            metadata,
        }
    }
}
