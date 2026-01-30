//! Ethereum transaction operations using ethers-rs

use ethers::core::types::{Address, TransactionRequest};
use ethers::middleware::SignerMiddleware;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use thiserror::Error;

use super::wallet::EthereumWallet;

#[derive(Debug, Error)]
pub enum EthTxError {
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
    #[error("Signing error: {0}")]
    SigningError(String),
    #[error("Internal error: {0}")]
    InternalError(String),
}

/// Transaction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthTxResult {
    pub tx_hash: String,
    pub status: String,
}

/// Transaction info from history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthTransactionInfo {
    pub hash: String,
    pub from: String,
    pub to: Option<String>,
    pub value: String,
    pub gas_price: String,
    pub gas_used: Option<String>,
    pub block_number: Option<u64>,
    pub timestamp: Option<u64>,
    pub status: String,
}

/// Send native ETH
pub async fn send_eth(
    rpc_url: &str,
    wallet: &EthereumWallet,
    to: &str,
    amount_eth: f64,
) -> Result<EthTxResult, EthTxError> {
    // 1. Connect to the Ethereum node
    let provider = Provider::<Http>::try_from(rpc_url)
        .map_err(|e| EthTxError::RpcError(e.to_string()))?;

    // 2. Parse recipient address
    let to_address = Address::from_str(to)
        .map_err(|_| EthTxError::InvalidAddress(to.to_string()))?;

    // 3. Parse amount
    let value = ethers::utils::parse_ether(amount_eth)
        .map_err(|_| EthTxError::InvalidAmount)?;

    // 4. Create signer wallet from the private key
    let chain_id = provider.get_chainid().await
        .map_err(|e| EthTxError::RpcError(e.to_string()))?
        .as_u64();
        
    let signer_wallet = LocalWallet::from(wallet.signing_key())
        .with_chain_id(chain_id);

    // 5. Build the transaction
    let tx = TransactionRequest::new()
        .to(to_address)
        .value(value);

    // 6. Create client with signer middleware
    let client = SignerMiddleware::new(provider, signer_wallet);

    // 7. Send the transaction and get the pending transaction
    let pending_tx = client
        .send_transaction(tx, None)
        .await
        .map_err(|e| EthTxError::TransactionFailed(e.to_string()))?;

    let tx_hash = format!("0x{:x}", pending_tx.tx_hash());

    Ok(EthTxResult {
        tx_hash,
        status: "pending".to_string(),
    })
}


/// Send ERC-20 tokens (simplified - returns placeholder for demo)
pub async fn send_erc20(
    _rpc_url: &str,
    wallet: &EthereumWallet,
    token_address: &str,
    to: &str,
    amount: u128,
) -> Result<EthTxResult, EthTxError> {
    // Validate addresses
    if !super::wallet::validate_address(to) {
        return Err(EthTxError::InvalidAddress(to.to_string()));
    }
    if !super::wallet::validate_address(token_address) {
        return Err(EthTxError::InvalidAddress(token_address.to_string()));
    }

    // For a real implementation, we would build the ERC-20 transfer call data
    // and sign/send the transaction using `ethers-rs`. This is a much more involved
    // process than native ETH transfer as it requires ABI encoding.
    //
    // Example steps would be:
    // 1. Define the ERC20 ABI.
    // 2. Create a `Contract` instance.
    // 3. Build the `transfer` function call.
    // 4. Send the transaction via the signer middleware.

    let tx_hash = format!(
        "0x{}",
        hex::encode(sha2::Sha256::digest(
            format!(
                "{}{}{}{}",
                wallet.address_string(),
                token_address,
                to,
                amount,
            )
            .as_bytes()
        ))
    );

    Ok(EthTxResult {
        tx_hash,
        status: "pending_placeholder".to_string(),
    })
}

/// Get transaction history for an address (simplified)
pub async fn get_transaction_history(
    _rpc_url: &str,
    _address: &str,
    _limit: usize,
) -> Result<Vec<EthTransactionInfo>, EthTxError> {
    // Note: Standard Ethereum JSON-RPC doesn't have a direct way to get transaction history.
    // In production, you would use an indexer like Etherscan API, The Graph, or Alchemy.
    // For this demo, we return an empty list.
    Ok(vec![])
}

/// Convert Wei to Gwei
pub fn wei_to_gwei(wei: u128) -> f64 {
    wei as f64 / 1e9
}

/// Convert Gwei to Wei
pub fn gwei_to_wei(gwei: f64) -> u128 {
    (gwei * 1e9) as u128
}

use sha2::Digest;
