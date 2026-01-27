//! Solana balance queries

use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BalanceError {
    #[error("RPC error: {0}")]
    RpcError(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("Token account not found")]
    TokenAccountNotFound,
}

/// Native SOL balance response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolBalance {
    pub address: String,
    pub lamports: u64,
    pub sol: f64,
}

/// SPL Token balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    pub mint: String,
    pub owner: String,
    pub token_account: String,
    pub amount: String,
    pub decimals: u8,
    pub ui_amount: f64,
    pub symbol: Option<String>,
    pub name: Option<String>,
}

/// Get native SOL balance
pub fn get_sol_balance(rpc_url: &str, address: &str) -> Result<SolBalance, BalanceError> {
    let client = RpcClient::new(rpc_url.to_string());
    let pubkey: Pubkey = address
        .parse()
        .map_err(|_| BalanceError::InvalidAddress(address.to_string()))?;

    let lamports = client
        .get_balance(&pubkey)
        .map_err(|e| BalanceError::RpcError(e.to_string()))?;

    Ok(SolBalance {
        address: address.to_string(),
        lamports,
        sol: lamports as f64 / 1_000_000_000.0,
    })
}

/// Get native SOL balance (async version)
pub async fn get_sol_balance_async(rpc_url: &str, address: &str) -> Result<SolBalance, BalanceError> {
    // Use tokio spawn_blocking for sync RPC call
    let rpc_url = rpc_url.to_string();
    let address = address.to_string();

    tokio::task::spawn_blocking(move || get_sol_balance(&rpc_url, &address))
        .await
        .map_err(|e| BalanceError::RpcError(e.to_string()))?
}

/// Get all SPL token balances for an address
pub fn get_token_balances(rpc_url: &str, owner: &str) -> Result<Vec<TokenBalance>, BalanceError> {
    let client = RpcClient::new(rpc_url.to_string());
    let owner_pubkey: Pubkey = owner
        .parse()
        .map_err(|_| BalanceError::InvalidAddress(owner.to_string()))?;

    // Get token accounts by owner
    let token_accounts = client
        .get_token_accounts_by_owner(
            &owner_pubkey,
            solana_client::rpc_request::TokenAccountsFilter::ProgramId(spl_token::id()),
        )
        .map_err(|e| BalanceError::RpcError(e.to_string()))?;

    let mut balances = Vec::new();

    for account in token_accounts {
        if let solana_account_decoder::UiAccountData::Json(parsed) = account.account.data {
            if let Some(info) = parsed.parsed.get("info") {
                let mint = info
                    .get("mint")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();

                let token_amount = info.get("tokenAmount").cloned().unwrap_or_default();
                let amount = token_amount
                    .get("amount")
                    .and_then(|v| v.as_str())
                    .unwrap_or("0")
                    .to_string();
                let decimals = token_amount
                    .get("decimals")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u8;
                let ui_amount = token_amount
                    .get("uiAmount")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);

                balances.push(TokenBalance {
                    mint,
                    owner: owner.to_string(),
                    token_account: account.pubkey,
                    amount,
                    decimals,
                    ui_amount,
                    symbol: None,
                    name: None,
                });
            }
        }
    }

    Ok(balances)
}

/// Get all SPL token balances (async version)
pub async fn get_token_balances_async(
    rpc_url: &str,
    owner: &str,
) -> Result<Vec<TokenBalance>, BalanceError> {
    let rpc_url = rpc_url.to_string();
    let owner = owner.to_string();

    tokio::task::spawn_blocking(move || get_token_balances(&rpc_url, &owner))
        .await
        .map_err(|e| BalanceError::RpcError(e.to_string()))?
}

/// Known token mints on mainnet/devnet
pub fn get_known_token_info(mint: &str) -> Option<(&'static str, &'static str)> {
    match mint {
        // USDC on devnet
        "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr" => Some(("USDC", "USD Coin")),
        // USDC on mainnet
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" => Some(("USDC", "USD Coin")),
        // Wrapped SOL
        "So11111111111111111111111111111111111111112" => Some(("wSOL", "Wrapped SOL")),
        _ => None,
    }
}
