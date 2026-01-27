//! Ethereum transaction operations using JSON-RPC

use serde::{Deserialize, Serialize};
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

#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: &'static str,
    params: Vec<serde_json::Value>,
    id: u32,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    message: String,
}

/// Send native ETH (simplified - returns placeholder for demo)
pub async fn send_eth(
    rpc_url: &str,
    wallet: &EthereumWallet,
    to: &str,
    amount_eth: f64,
) -> Result<EthTxResult, EthTxError> {
    // Validate addresses
    if !super::wallet::validate_address(to) {
        return Err(EthTxError::InvalidAddress(to.to_string()));
    }

    let wei = (amount_eth * 1e18) as u128;
    if wei == 0 {
        return Err(EthTxError::InvalidAmount);
    }

    // Get nonce
    let nonce = get_transaction_count(rpc_url, &wallet.address_string()).await?;

    // Get gas price
    let gas_price = get_gas_price(rpc_url).await?;

    // For a real implementation, we would:
    // 1. Build the transaction
    // 2. Sign it with the wallet
    // 3. Send the raw transaction
    //
    // This is simplified for the demo
    let tx_hash = format!(
        "0x{}",
        hex::encode(&sha2::Sha256::digest(
            format!("{}{}{}{}", wallet.address_string(), to, wei, nonce).as_bytes()
        ))
    );

    Ok(EthTxResult {
        tx_hash,
        status: "pending".to_string(),
    })
}

/// Send ERC-20 tokens (simplified - returns placeholder for demo)
pub async fn send_erc20(
    rpc_url: &str,
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

    // Get nonce
    let nonce = get_transaction_count(rpc_url, &wallet.address_string()).await?;

    // For a real implementation, we would build the ERC-20 transfer call data
    // and sign/send the transaction

    let tx_hash = format!(
        "0x{}",
        hex::encode(&sha2::Sha256::digest(
            format!(
                "{}{}{}{}{}",
                wallet.address_string(),
                token_address,
                to,
                amount,
                nonce
            )
            .as_bytes()
        ))
    );

    Ok(EthTxResult {
        tx_hash,
        status: "pending".to_string(),
    })
}

/// Get transaction count (nonce) for an address
async fn get_transaction_count(rpc_url: &str, address: &str) -> Result<u64, EthTxError> {
    let client = reqwest::Client::new();

    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_getTransactionCount",
        params: vec![
            serde_json::Value::String(address.to_string()),
            serde_json::Value::String("pending".to_string()),
        ],
        id: 1,
    };

    let response: JsonRpcResponse = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| EthTxError::RpcError(e.to_string()))?
        .json()
        .await
        .map_err(|e| EthTxError::RpcError(e.to_string()))?;

    if let Some(error) = response.error {
        return Err(EthTxError::RpcError(error.message));
    }

    let hex_count = response
        .result
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "0x0".to_string());

    let count = u64::from_str_radix(hex_count.trim_start_matches("0x"), 16).unwrap_or(0);

    Ok(count)
}

/// Get current gas price
pub async fn get_gas_price(rpc_url: &str) -> Result<u128, EthTxError> {
    let client = reqwest::Client::new();

    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: vec![],
        id: 1,
    };

    let response: JsonRpcResponse = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| EthTxError::RpcError(e.to_string()))?
        .json()
        .await
        .map_err(|e| EthTxError::RpcError(e.to_string()))?;

    if let Some(error) = response.error {
        return Err(EthTxError::RpcError(error.message));
    }

    let hex_price = response
        .result
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "0x0".to_string());

    let price = u128::from_str_radix(hex_price.trim_start_matches("0x"), 16).unwrap_or(0);

    Ok(price)
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
