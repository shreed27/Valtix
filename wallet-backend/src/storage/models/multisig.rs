//! Multi-signature wallet database models

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MultisigWalletRow {
    pub id: String,
    pub wallet_id: String,
    pub name: String,
    pub chain: String,
    pub address: String,
    pub threshold: i64,
    pub owner_count: i64,
    pub created_at: String,
}

impl MultisigWalletRow {
    pub fn new(
        wallet_id: String,
        name: String,
        chain: String,
        address: String,
        threshold: u32,
        owner_count: u32,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            wallet_id,
            name,
            chain,
            address,
            threshold: threshold as i64,
            owner_count: owner_count as i64,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MultisigOwnerRow {
    pub id: String,
    pub multisig_id: String,
    pub owner_address: String,
    pub owner_name: Option<String>,
}

impl MultisigOwnerRow {
    pub fn new(multisig_id: String, owner_address: String, owner_name: Option<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            multisig_id,
            owner_address,
            owner_name,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MultisigTransactionRow {
    pub id: String,
    pub multisig_id: String,
    pub to_address: String,
    pub amount: Option<String>,
    pub data: Option<String>,
    pub approvals: String,
    pub status: String,
    pub created_at: String,
    pub executed_at: Option<String>,
}

impl MultisigTransactionRow {
    pub fn new(
        multisig_id: String,
        to_address: String,
        amount: Option<String>,
        data: Option<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            multisig_id,
            to_address,
            amount,
            data,
            approvals: "[]".to_string(),
            status: "pending".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            executed_at: None,
        }
    }
}

/// Multi-sig wallet response for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigWalletResponse {
    pub id: String,
    pub name: String,
    pub chain: String,
    pub address: String,
    pub threshold: u32,
    pub owner_count: u32,
    pub owners: Vec<MultisigOwnerResponse>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigOwnerResponse {
    pub address: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigTransactionResponse {
    pub id: String,
    pub multisig_id: String,
    pub to_address: String,
    pub amount: Option<String>,
    pub data: Option<String>,
    pub approvals: Vec<String>,
    pub status: String,
    pub created_at: String,
    pub executed_at: Option<String>,
}

impl From<MultisigTransactionRow> for MultisigTransactionResponse {
    fn from(row: MultisigTransactionRow) -> Self {
        let approvals: Vec<String> = serde_json::from_str(&row.approvals).unwrap_or_default();
        Self {
            id: row.id,
            multisig_id: row.multisig_id,
            to_address: row.to_address,
            amount: row.amount,
            data: row.data,
            approvals,
            status: row.status,
            created_at: row.created_at,
            executed_at: row.executed_at,
        }
    }
}
