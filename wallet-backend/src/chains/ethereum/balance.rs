//! Ethereum balance queries using JSON-RPC

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EthBalanceError {
    #[error("RPC error: {0}")]
    RpcError(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
}

/// Native ETH balance response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthBalance {
    pub address: String,
    pub wei: String,
    pub eth: f64,
}

/// ERC-20 token balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Erc20Balance {
    pub token_address: String,
    pub owner: String,
    pub balance: String,
    pub decimals: u8,
    pub ui_amount: f64,
    pub symbol: Option<String>,
    pub name: Option<String>,
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
    result: Option<String>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    message: String,
}

/// Get native ETH balance
pub async fn get_eth_balance(rpc_url: &str, address: &str) -> Result<EthBalance, EthBalanceError> {
    let client = reqwest::Client::new();

    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: vec![
            serde_json::Value::String(address.to_string()),
            serde_json::Value::String("latest".to_string()),
        ],
        id: 1,
    };

    let response: JsonRpcResponse = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| EthBalanceError::RpcError(e.to_string()))?
        .json()
        .await
        .map_err(|e| EthBalanceError::RpcError(e.to_string()))?;

    if let Some(error) = response.error {
        return Err(EthBalanceError::RpcError(error.message));
    }

    let hex_balance = response.result.unwrap_or_else(|| "0x0".to_string());
    let wei = u128::from_str_radix(hex_balance.trim_start_matches("0x"), 16).unwrap_or(0);
    let eth = wei as f64 / 1e18;

    Ok(EthBalance {
        address: address.to_string(),
        wei: wei.to_string(),
        eth,
    })
}

/// Get ERC-20 token balance
pub async fn get_erc20_balance(
    rpc_url: &str,
    token_address: &str,
    owner: &str,
) -> Result<Erc20Balance, EthBalanceError> {
    let client = reqwest::Client::new();

    // balanceOf(address) function selector: 0x70a08231
    // Plus the address padded to 32 bytes
    let owner_padded = format!("000000000000000000000000{}", owner.trim_start_matches("0x"));
    let data = format!("0x70a08231{}", owner_padded);

    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            serde_json::json!({
                "to": token_address,
                "data": data
            }),
            serde_json::Value::String("latest".to_string()),
        ],
        id: 1,
    };

    let response: JsonRpcResponse = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| EthBalanceError::RpcError(e.to_string()))?
        .json()
        .await
        .map_err(|e| EthBalanceError::RpcError(e.to_string()))?;

    if let Some(error) = response.error {
        return Err(EthBalanceError::RpcError(error.message));
    }

    let hex_balance = response.result.unwrap_or_else(|| "0x0".to_string());
    let balance = u128::from_str_radix(hex_balance.trim_start_matches("0x"), 16).unwrap_or(0);

    // Get decimals (default to 18)
    let decimals = get_erc20_decimals(rpc_url, token_address).await.unwrap_or(18);
    let ui_amount = balance as f64 / 10f64.powi(decimals as i32);

    Ok(Erc20Balance {
        token_address: token_address.to_string(),
        owner: owner.to_string(),
        balance: balance.to_string(),
        decimals,
        ui_amount,
        symbol: None,
        name: None,
    })
}

/// Get ERC-20 decimals
async fn get_erc20_decimals(rpc_url: &str, token_address: &str) -> Result<u8, EthBalanceError> {
    let client = reqwest::Client::new();

    // decimals() selector: 0x313ce567
    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            serde_json::json!({
                "to": token_address,
                "data": "0x313ce567"
            }),
            serde_json::Value::String("latest".to_string()),
        ],
        id: 1,
    };

    let response: JsonRpcResponse = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| EthBalanceError::RpcError(e.to_string()))?
        .json()
        .await
        .map_err(|e| EthBalanceError::RpcError(e.to_string()))?;

    let hex_result = response.result.unwrap_or_else(|| "0x12".to_string());
    let decimals = u8::from_str_radix(hex_result.trim_start_matches("0x"), 16).unwrap_or(18);

    Ok(decimals)
}

/// Known ERC-20 tokens on mainnet/testnets
pub fn get_known_token_info(token_address: &str) -> Option<(&'static str, &'static str, u8)> {
    match token_address.to_lowercase().as_str() {
        // USDC on mainnet
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" => Some(("USDC", "USD Coin", 6)),
        // USDT on mainnet
        "0xdac17f958d2ee523a2206206994597c13d831ec7" => Some(("USDT", "Tether USD", 6)),
        // DAI on mainnet
        "0x6b175474e89094c44da98b954eedeac495271d0f" => Some(("DAI", "Dai Stablecoin", 18)),
        // WETH on mainnet
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" => Some(("WETH", "Wrapped Ether", 18)),
        _ => None,
    }
}
