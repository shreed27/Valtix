//! Solana transaction operations

use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    signature::Signature,
    system_instruction,
    transaction::Transaction,
};
use spl_associated_token_account::get_associated_token_address;
use spl_token::instruction as token_instruction;
use thiserror::Error;

use super::wallet::SolanaKeypair;

#[derive(Debug, Error)]
pub enum TransactionError {
    #[error("RPC error: {0}")]
    RpcError(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("Insufficient balance")]
    InsufficientBalance,
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
    #[error("Invalid amount")]
    InvalidAmount,
}

/// Transaction send request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendSolRequest {
    pub to: String,
    pub amount_sol: f64,
}

/// Transaction send request for SPL tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendTokenRequest {
    pub to: String,
    pub mint: String,
    pub amount: u64,
    pub decimals: u8,
}

/// Transaction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResult {
    pub signature: String,
    pub status: String,
}

/// Send SOL to another address
pub fn send_sol(
    rpc_url: &str,
    keypair: &SolanaKeypair,
    to: &str,
    amount_sol: f64,
) -> Result<TransactionResult, TransactionError> {
    let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    let to_pubkey: Pubkey = to
        .parse()
        .map_err(|_| TransactionError::InvalidAddress(to.to_string()))?;

    let lamports = (amount_sol * LAMPORTS_PER_SOL as f64) as u64;
    if lamports == 0 {
        return Err(TransactionError::InvalidAmount);
    }

    // Create transfer instruction
    let instruction = system_instruction::transfer(&keypair.pubkey(), &to_pubkey, lamports);

    // Get recent blockhash
    let blockhash = client
        .get_latest_blockhash()
        .map_err(|e| TransactionError::RpcError(e.to_string()))?;

    // Create and sign transaction
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&keypair.pubkey()),
        &[keypair.keypair()],
        blockhash,
    );

    // Send and confirm
    let signature = client
        .send_and_confirm_transaction(&transaction)
        .map_err(|e| TransactionError::TransactionFailed(e.to_string()))?;

    Ok(TransactionResult {
        signature: signature.to_string(),
        status: "confirmed".to_string(),
    })
}

/// Send SOL (async version)
pub async fn send_sol_async(
    rpc_url: &str,
    keypair: &SolanaKeypair,
    to: &str,
    amount_sol: f64,
) -> Result<TransactionResult, TransactionError> {
    let rpc_url = rpc_url.to_string();
    let to = to.to_string();

    // Clone keypair bytes for the closure
    let keypair_bytes: [u8; 64] = keypair.keypair().to_bytes();

    tokio::task::spawn_blocking(move || {
        let kp = solana_sdk::signature::Keypair::from_bytes(&keypair_bytes)
            .map_err(|_| TransactionError::TransactionFailed("Invalid keypair".to_string()))?;
        let wrapped = SolanaKeypair::from_signing_key(&ed25519_dalek::SigningKey::from_bytes(
            &keypair_bytes[..32].try_into().unwrap(),
        ))
        .map_err(|e| TransactionError::TransactionFailed(e.to_string()))?;
        send_sol(&rpc_url, &wrapped, &to, amount_sol)
    })
    .await
    .map_err(|e| TransactionError::RpcError(e.to_string()))?
}

/// Send SPL tokens to another address
pub fn send_token(
    rpc_url: &str,
    keypair: &SolanaKeypair,
    to: &str,
    mint: &str,
    amount: u64,
    decimals: u8,
) -> Result<TransactionResult, TransactionError> {
    let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    let to_pubkey: Pubkey = to
        .parse()
        .map_err(|_| TransactionError::InvalidAddress(to.to_string()))?;
    let mint_pubkey: Pubkey = mint
        .parse()
        .map_err(|_| TransactionError::InvalidAddress(mint.to_string()))?;

    // Get associated token accounts
    let from_ata = get_associated_token_address(&keypair.pubkey(), &mint_pubkey);
    let to_ata = get_associated_token_address(&to_pubkey, &mint_pubkey);

    let mut instructions = Vec::new();

    // Check if recipient's ATA exists, if not create it
    if client.get_account(&to_ata).is_err() {
        instructions.push(
            spl_associated_token_account::instruction::create_associated_token_account(
                &keypair.pubkey(),
                &to_pubkey,
                &mint_pubkey,
                &spl_token::id(),
            ),
        );
    }

    // Add transfer instruction
    instructions.push(
        token_instruction::transfer_checked(
            &spl_token::id(),
            &from_ata,
            &mint_pubkey,
            &to_ata,
            &keypair.pubkey(),
            &[],
            amount,
            decimals,
        )
        .map_err(|e| TransactionError::TransactionFailed(e.to_string()))?,
    );

    // Get recent blockhash
    let blockhash = client
        .get_latest_blockhash()
        .map_err(|e| TransactionError::RpcError(e.to_string()))?;

    // Create and sign transaction
    let transaction = Transaction::new_signed_with_payer(
        &instructions,
        Some(&keypair.pubkey()),
        &[keypair.keypair()],
        blockhash,
    );

    // Send and confirm
    let signature = client
        .send_and_confirm_transaction(&transaction)
        .map_err(|e| TransactionError::TransactionFailed(e.to_string()))?;

    Ok(TransactionResult {
        signature: signature.to_string(),
        status: "confirmed".to_string(),
    })
}

/// Get transaction history for an address
pub fn get_transaction_history(
    rpc_url: &str,
    address: &str,
    limit: usize,
) -> Result<Vec<TransactionInfo>, TransactionError> {
    let client = RpcClient::new(rpc_url.to_string());

    let pubkey: Pubkey = address
        .parse()
        .map_err(|_| TransactionError::InvalidAddress(address.to_string()))?;

    let signatures = client
        .get_signatures_for_address(&pubkey)
        .map_err(|e| TransactionError::RpcError(e.to_string()))?;

    let mut history = Vec::new();

    for sig_info in signatures.into_iter().take(limit) {
        let status = if sig_info.err.is_some() {
            "failed"
        } else {
            "confirmed"
        };

        history.push(TransactionInfo {
            signature: sig_info.signature,
            slot: sig_info.slot,
            block_time: sig_info.block_time,
            status: status.to_string(),
            memo: sig_info.memo,
        });
    }

    Ok(history)
}

/// Get transaction history (async version)
pub async fn get_transaction_history_async(
    rpc_url: &str,
    address: &str,
    limit: usize,
) -> Result<Vec<TransactionInfo>, TransactionError> {
    let rpc_url = rpc_url.to_string();
    let address = address.to_string();

    tokio::task::spawn_blocking(move || get_transaction_history(&rpc_url, &address, limit))
        .await
        .map_err(|e| TransactionError::RpcError(e.to_string()))?
}

/// Transaction info from history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInfo {
    pub signature: String,
    pub slot: u64,
    pub block_time: Option<i64>,
    pub status: String,
    pub memo: Option<String>,
}

/// Estimate transaction fee
pub fn estimate_fee(rpc_url: &str) -> Result<u64, TransactionError> {
    let client = RpcClient::new(rpc_url.to_string());

    // Get fee for a simple transfer (5000 lamports is typical)
    let fee = client
        .get_fee_for_message(&solana_sdk::message::Message::default())
        .unwrap_or(5000);

    Ok(fee)
}
