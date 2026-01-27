//! Solana multi-signature wallet operations
//!
//! Implements a PDA-based multi-sig pattern similar to Squads Protocol

use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_instruction,
    system_program,
    transaction::Transaction,
};
use thiserror::Error;

use super::wallet::SolanaKeypair;

#[derive(Debug, Error)]
pub enum MultisigError {
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
    #[error("Multisig creation failed: {0}")]
    CreationFailed(String),
}

/// Multi-sig wallet configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigConfig {
    pub threshold: u8,
    pub owners: Vec<String>,
    pub name: String,
}

/// Multi-sig wallet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigWallet {
    pub address: String,
    pub threshold: u8,
    pub owners: Vec<String>,
    pub pending_transactions: Vec<PendingTransaction>,
}

/// Pending multi-sig transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTransaction {
    pub id: String,
    pub to: String,
    pub amount_lamports: u64,
    pub approvals: Vec<String>,
    pub created_at: i64,
}

/// Result of multisig operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigResult {
    pub address: String,
    pub transaction_id: Option<String>,
}

/// Derive multisig PDA address
pub fn derive_multisig_address(owners: &[Pubkey], nonce: u8) -> Pubkey {
    // Sort owners for deterministic derivation
    let mut sorted_owners: Vec<_> = owners.to_vec();
    sorted_owners.sort();

    let nonce_bytes = [nonce];
    let seeds: Vec<&[u8]> = sorted_owners
        .iter()
        .map(|p| p.as_ref())
        .chain(std::iter::once(nonce_bytes.as_slice()))
        .collect();

    // Use system program as the program ID for a simple PDA
    let (pda, _) = Pubkey::find_program_address(&seeds, &system_program::id());
    pda
}

/// Create a new multi-sig wallet
///
/// In a real implementation, this would deploy a multi-sig program account.
/// For this demo, we create a simple PDA that tracks approvals off-chain.
pub fn create_multisig(
    rpc_url: &str,
    creator: &SolanaKeypair,
    config: &MultisigConfig,
) -> Result<MultisigResult, MultisigError> {
    let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    // Parse owner addresses
    let owners: Result<Vec<Pubkey>, _> = config
        .owners
        .iter()
        .map(|addr| addr.parse())
        .collect();
    let owners = owners.map_err(|_| MultisigError::InvalidAddress("Invalid owner address".to_string()))?;

    // Derive PDA address
    let multisig_address = derive_multisig_address(&owners, 0);

    // For a real implementation, we would create an account with the multi-sig
    // program. For this demo, we just return the derived address.
    // The actual approval tracking happens in our database.

    // Create a minimal account to mark this PDA as initialized
    let rent = client
        .get_minimum_balance_for_rent_exemption(0)
        .map_err(|e| MultisigError::RpcError(e.to_string()))?;

    // Note: In production, you would use a proper multi-sig program like Squads
    // This is a simplified version for demonstration

    Ok(MultisigResult {
        address: multisig_address.to_string(),
        transaction_id: None,
    })
}

/// Propose a transaction from a multi-sig wallet
pub fn propose_transaction(
    rpc_url: &str,
    _multisig_address: &str,
    proposer: &SolanaKeypair,
    to: &str,
    amount_lamports: u64,
) -> Result<PendingTransaction, MultisigError> {
    let _client = RpcClient::new(rpc_url.to_string());

    let to_pubkey: Pubkey = to
        .parse()
        .map_err(|_| MultisigError::InvalidAddress(to.to_string()))?;

    // Generate transaction ID
    let tx_id = uuid::Uuid::new_v4().to_string();

    // In a real implementation, this would create an on-chain proposal.
    // For this demo, we track proposals in our database.

    Ok(PendingTransaction {
        id: tx_id,
        to: to_pubkey.to_string(),
        amount_lamports,
        approvals: vec![proposer.address()], // Proposer auto-approves
        created_at: chrono::Utc::now().timestamp(),
    })
}

/// Approve a pending transaction
pub fn approve_transaction(
    pending: &mut PendingTransaction,
    approver_address: &str,
) -> Result<(), MultisigError> {
    if pending.approvals.contains(&approver_address.to_string()) {
        return Err(MultisigError::AlreadyApproved);
    }

    pending.approvals.push(approver_address.to_string());
    Ok(())
}

/// Check if transaction has enough approvals
pub fn can_execute(pending: &PendingTransaction, threshold: u8) -> bool {
    pending.approvals.len() >= threshold as usize
}

/// Execute an approved multi-sig transaction
pub fn execute_transaction(
    rpc_url: &str,
    multisig_address: &str,
    pending: &PendingTransaction,
    executor: &SolanaKeypair,
) -> Result<String, MultisigError> {
    let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    let multisig_pubkey: Pubkey = multisig_address
        .parse()
        .map_err(|_| MultisigError::InvalidAddress(multisig_address.to_string()))?;

    let to_pubkey: Pubkey = pending
        .to
        .parse()
        .map_err(|_| MultisigError::InvalidAddress(pending.to.clone()))?;

    // In a real implementation, this would invoke the multi-sig program.
    // For this demo, we just execute a direct transfer (assuming the executor has authority).

    let instruction = system_instruction::transfer(&executor.pubkey(), &to_pubkey, pending.amount_lamports);

    let blockhash = client
        .get_latest_blockhash()
        .map_err(|e| MultisigError::RpcError(e.to_string()))?;

    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&executor.pubkey()),
        &[executor.keypair()],
        blockhash,
    );

    let signature = client
        .send_and_confirm_transaction(&transaction)
        .map_err(|e| MultisigError::RpcError(e.to_string()))?;

    Ok(signature.to_string())
}

/// Async version of create_multisig
pub async fn create_multisig_async(
    rpc_url: &str,
    creator: &SolanaKeypair,
    config: &MultisigConfig,
) -> Result<MultisigResult, MultisigError> {
    let rpc_url = rpc_url.to_string();
    let config = config.clone();
    let keypair_bytes = creator.keypair().to_bytes();

    tokio::task::spawn_blocking(move || {
        let kp = SolanaKeypair::from_signing_key(&ed25519_dalek::SigningKey::from_bytes(
            &keypair_bytes[..32].try_into().unwrap(),
        ))
        .map_err(|e| MultisigError::CreationFailed(e.to_string()))?;
        create_multisig(&rpc_url, &kp, &config)
    })
    .await
    .map_err(|e| MultisigError::RpcError(e.to_string()))?
}
