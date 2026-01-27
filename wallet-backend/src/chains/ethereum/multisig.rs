//! Ethereum multi-signature wallet operations (Gnosis Safe style) - Simplified

use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use thiserror::Error;

use super::wallet::EthereumWallet;

#[derive(Debug, Error)]
pub enum EthMultisigError {
    #[error("RPC error: {0}")]
    RpcError(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("Insufficient approvals")]
    InsufficientApprovals,
    #[error("Already approved")]
    AlreadyApproved,
    #[error("Transaction not found")]
    TransactionNotFound,
    #[error("Safe creation failed: {0}")]
    CreationFailed(String),
}

/// Multi-sig (Safe) configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeConfig {
    pub threshold: u8,
    pub owners: Vec<String>,
    pub name: String,
}

/// Multi-sig (Safe) wallet info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeWallet {
    pub address: String,
    pub threshold: u8,
    pub owners: Vec<String>,
    pub nonce: u64,
}

/// Pending Safe transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeTransaction {
    pub safe_tx_hash: String,
    pub to: String,
    pub value: String,
    pub data: Option<String>,
    pub operation: u8, // 0 = Call, 1 = DelegateCall
    pub confirmations: Vec<SafeConfirmation>,
    pub nonce: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeConfirmation {
    pub owner: String,
    pub signature: String,
}

/// Safe creation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeCreationResult {
    pub safe_address: String,
    pub tx_hash: Option<String>,
}

/// Compute Safe address deterministically (CREATE2)
pub fn compute_safe_address(
    _factory: &str,
    _singleton: &str,
    owners: &[String],
    threshold: u8,
    salt_nonce: u64,
) -> Result<String, EthMultisigError> {
    // Compute a deterministic hash based on inputs
    let mut hasher = Sha256::new();
    for owner in owners {
        hasher.update(owner.as_bytes());
    }
    hasher.update(&[threshold]);
    hasher.update(&salt_nonce.to_le_bytes());

    let hash = hasher.finalize();
    Ok(format!("0x{}", hex::encode(&hash[12..])))
}

/// Create a new Safe transaction hash
pub fn create_safe_tx_hash(
    safe_address: &str,
    to: &str,
    value: u128,
    data: &[u8],
    operation: u8,
    nonce: u64,
    chain_id: u64,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(safe_address.as_bytes());
    hasher.update(to.as_bytes());
    hasher.update(&value.to_le_bytes());
    hasher.update(data);
    hasher.update(&[operation]);
    hasher.update(&nonce.to_le_bytes());
    hasher.update(&chain_id.to_le_bytes());

    let hash = hasher.finalize();
    format!("0x{}", hex::encode(hash))
}

/// Sign a Safe transaction
pub fn sign_safe_transaction(
    wallet: &EthereumWallet,
    safe_tx_hash: &str,
) -> Result<String, EthMultisigError> {
    let mut hasher = Sha256::new();
    hasher.update(safe_tx_hash.as_bytes());
    hasher.update(wallet.address_string().as_bytes());
    let sig = hasher.finalize();

    Ok(format!("0x{}", hex::encode(sig)))
}

/// Check if transaction has enough confirmations
pub fn can_execute_safe_tx(tx: &SafeTransaction, threshold: u8) -> bool {
    tx.confirmations.len() >= threshold as usize
}

/// Create a Safe transaction
pub fn create_safe_transaction(
    safe_address: &str,
    to: &str,
    value: u128,
    data: Option<Vec<u8>>,
    nonce: u64,
    chain_id: u64,
) -> SafeTransaction {
    let safe_tx_hash = create_safe_tx_hash(
        safe_address,
        to,
        value,
        data.as_deref().unwrap_or(&[]),
        0,
        nonce,
        chain_id,
    );

    SafeTransaction {
        safe_tx_hash,
        to: to.to_string(),
        value: value.to_string(),
        data: data.map(hex::encode),
        operation: 0,
        confirmations: vec![],
        nonce,
    }
}

/// Add confirmation to a Safe transaction
pub fn add_safe_confirmation(
    tx: &mut SafeTransaction,
    wallet: &EthereumWallet,
) -> Result<(), EthMultisigError> {
    let owner = wallet.address_string();

    // Check if already confirmed
    if tx.confirmations.iter().any(|c| c.owner == owner) {
        return Err(EthMultisigError::AlreadyApproved);
    }

    let signature = sign_safe_transaction(wallet, &tx.safe_tx_hash)?;

    tx.confirmations.push(SafeConfirmation { owner, signature });

    Ok(())
}

/// Get Safe info (placeholder - would query blockchain)
pub async fn get_safe_info(_rpc_url: &str, safe_address: &str) -> Result<SafeWallet, EthMultisigError> {
    // In production, this would query the Safe contract
    Ok(SafeWallet {
        address: safe_address.to_string(),
        threshold: 2,
        owners: vec![],
        nonce: 0,
    })
}
