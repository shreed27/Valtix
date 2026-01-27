//! Transaction history database model

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TransactionRow {
    pub id: String,
    pub account_id: String,
    pub chain: String,
    pub signature: String,
    pub tx_type: String,
    pub from_address: Option<String>,
    pub to_address: Option<String>,
    pub amount: Option<String>,
    pub token_address: Option<String>,
    pub status: String,
    pub block_number: Option<i64>,
    pub timestamp: Option<String>,
    pub created_at: String,
}

impl TransactionRow {
    pub fn new(
        account_id: String,
        chain: String,
        signature: String,
        tx_type: String,
        from_address: Option<String>,
        to_address: Option<String>,
        amount: Option<String>,
        token_address: Option<String>,
        status: String,
        block_number: Option<i64>,
        timestamp: Option<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            account_id,
            chain,
            signature,
            tx_type,
            from_address,
            to_address,
            amount,
            token_address,
            status,
            block_number,
            timestamp,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Transaction response for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResponse {
    pub id: String,
    pub chain: String,
    pub signature: String,
    pub tx_type: String,
    pub from_address: Option<String>,
    pub to_address: Option<String>,
    pub amount: Option<String>,
    pub token_address: Option<String>,
    pub status: String,
    pub block_number: Option<i64>,
    pub timestamp: Option<String>,
}

impl From<TransactionRow> for TransactionResponse {
    fn from(row: TransactionRow) -> Self {
        Self {
            id: row.id,
            chain: row.chain,
            signature: row.signature,
            tx_type: row.tx_type,
            from_address: row.from_address,
            to_address: row.to_address,
            amount: row.amount,
            token_address: row.token_address,
            status: row.status,
            block_number: row.block_number,
            timestamp: row.timestamp,
        }
    }
}
