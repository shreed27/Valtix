//! Transaction service - orchestrates transaction operations

use std::sync::Arc;

use thiserror::Error;

use crate::chains::ethereum::{get_eth_balance, send_eth, send_erc20, EthereumWallet};
use crate::chains::solana::{
    get_sol_balance_async, get_token_balances_async, send_sol, send_token, SolanaKeypair,
};
use crate::services::wallet_service::{get_seed, WalletServiceError};
use crate::storage::models::{TransactionResponse, TransactionRow};
use crate::AppState;

#[derive(Debug, Error)]
pub enum TransactionServiceError {
    #[error("Wallet error: {0}")]
    WalletError(#[from] WalletServiceError),
    #[error("Invalid chain: {0}")]
    InvalidChain(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
    #[error("Insufficient balance")]
    InsufficientBalance,
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Balance response
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BalanceResponse {
    pub chain: String,
    pub address: String,
    pub native_balance: String,
    pub native_symbol: String,
    pub tokens: Vec<TokenBalanceResponse>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TokenBalanceResponse {
    pub address: String,
    pub symbol: Option<String>,
    pub name: Option<String>,
    pub balance: String,
    pub decimals: u8,
    pub ui_amount: f64,
}

/// Get balance for an address
pub async fn get_balance(
    state: &Arc<AppState>,
    chain: &str,
    address: &str,
) -> Result<BalanceResponse, TransactionServiceError> {
    match chain.to_lowercase().as_str() {
        "solana" => {
            let sol_balance = get_sol_balance_async(&state.solana_rpc_url, address)
                .await
                .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?;

            let token_balances = get_token_balances_async(&state.solana_rpc_url, address)
                .await
                .unwrap_or_default();

            Ok(BalanceResponse {
                chain: "solana".to_string(),
                address: address.to_string(),
                native_balance: sol_balance.sol.to_string(),
                native_symbol: "SOL".to_string(),
                tokens: token_balances
                    .into_iter()
                    .map(|t| TokenBalanceResponse {
                        address: t.mint,
                        symbol: t.symbol,
                        name: t.name,
                        balance: t.amount,
                        decimals: t.decimals,
                        ui_amount: t.ui_amount,
                    })
                    .collect(),
            })
        }
        "ethereum" => {
            let eth_balance = get_eth_balance(&state.eth_rpc_url, address)
                .await
                .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?;

            // Note: For Ethereum, token balances require knowing which tokens to check
            // In production, use an indexer like Alchemy or Etherscan API

            Ok(BalanceResponse {
                chain: "ethereum".to_string(),
                address: address.to_string(),
                native_balance: eth_balance.eth.to_string(),
                native_symbol: "ETH".to_string(),
                tokens: vec![],
            })
        }
        _ => Err(TransactionServiceError::InvalidChain(chain.to_string())),
    }
}

/// Send request
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SendRequest {
    pub chain: String,
    pub from_address: String,
    pub to_address: String,
    pub amount: String,
    pub token_address: Option<String>,
}

/// Send response
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SendResponse {
    pub tx_hash: String,
    pub status: String,
}

/// Send transaction
pub async fn send_transaction(
    state: &Arc<AppState>,
    request: SendRequest,
) -> Result<SendResponse, TransactionServiceError> {
    let seed = get_seed(state).await?;

    // Get account from database to find derivation index
    let account = state
        .db
        .get_account_by_address(&request.chain, &request.from_address)
        .await
        .map_err(|e| TransactionServiceError::DatabaseError(e.to_string()))?;

    match request.chain.to_lowercase().as_str() {
        "solana" => {
            let keypair = SolanaKeypair::derive(&seed, account.derivation_index as u32)
                .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?;

            let token_address_clone = request.token_address.clone();
            let result = if let Some(ref token_mint) = request.token_address {
                let amount: u64 = request
                    .amount
                    .parse()
                    .map_err(|_| TransactionServiceError::TransactionFailed("Invalid amount".to_string()))?;

                // Get token decimals (default to 9 for SPL tokens)
                let decimals = 9u8;

                send_token(
                    &state.solana_rpc_url,
                    &keypair,
                    &request.to_address,
                    token_mint,
                    amount,
                    decimals,
                )
                .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?
            } else {
                let amount: f64 = request
                    .amount
                    .parse()
                    .map_err(|_| TransactionServiceError::TransactionFailed("Invalid amount".to_string()))?;

                send_sol(&state.solana_rpc_url, &keypair, &request.to_address, amount)
                    .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?
            };

            // Store transaction in history
            let tx_row = TransactionRow::new(
                account.id,
                "solana".to_string(),
                result.signature.clone(),
                "send".to_string(),
                Some(request.from_address),
                Some(request.to_address),
                Some(request.amount),
                token_address_clone,
                result.status.clone(),
                None,
                Some(chrono::Utc::now().to_rfc3339()),
            );

            let _ = state.db.upsert_transaction(&tx_row).await;

            Ok(SendResponse {
                tx_hash: result.signature,
                status: result.status,
            })
        }
        "ethereum" => {
            let wallet = EthereumWallet::derive(&seed, account.derivation_index as u32)
                .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?;

            let token_address_clone = request.token_address.clone();
            let result = if let Some(ref token_address) = request.token_address {
                let amount: u128 = request
                    .amount
                    .parse()
                    .map_err(|_| TransactionServiceError::TransactionFailed("Invalid amount".to_string()))?;

                send_erc20(
                    &state.eth_rpc_url,
                    &wallet,
                    token_address,
                    &request.to_address,
                    amount,
                )
                .await
                .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?
            } else {
                let amount: f64 = request
                    .amount
                    .parse()
                    .map_err(|_| TransactionServiceError::TransactionFailed("Invalid amount".to_string()))?;

                send_eth(&state.eth_rpc_url, &wallet, &request.to_address, amount)
                    .await
                    .map_err(|e| TransactionServiceError::TransactionFailed(e.to_string()))?
            };

            // Store transaction in history
            let tx_row = TransactionRow::new(
                account.id,
                "ethereum".to_string(),
                result.tx_hash.clone(),
                "send".to_string(),
                Some(request.from_address),
                Some(request.to_address),
                Some(request.amount),
                token_address_clone,
                result.status.clone(),
                None,
                Some(chrono::Utc::now().to_rfc3339()),
            );

            let _ = state.db.upsert_transaction(&tx_row).await;

            Ok(SendResponse {
                tx_hash: result.tx_hash,
                status: result.status,
            })
        }
        _ => Err(TransactionServiceError::InvalidChain(request.chain)),
    }
}

/// Get transaction history
pub async fn get_transaction_history(
    state: &Arc<AppState>,
    chain: &str,
    address: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<TransactionResponse>, TransactionServiceError> {
    // Get account
    let account = state
        .db
        .get_account_by_address(chain, address)
        .await
        .map_err(|e| TransactionServiceError::DatabaseError(e.to_string()))?;

    // Get cached transactions
    let mut transactions: Vec<TransactionResponse> = state
        .db
        .get_transactions(&account.id, limit, offset)
        .await
        .map_err(|e| TransactionServiceError::DatabaseError(e.to_string()))?
        .into_iter()
        .map(TransactionResponse::from)
        .collect();

    // Try to fetch from chain if Ethereum (best effort)
    if chain.to_lowercase() == "ethereum" {
        if let Ok(chain_txs) = crate::chains::ethereum::get_transaction_history(
            &state.eth_rpc_url,
            address,
            limit as usize,
        )
        .await
        {
            for tx in chain_txs {
                // Deduplicate by hash
                if !transactions
                    .iter()
                    .any(|t| t.signature.to_lowercase() == tx.hash.to_lowercase())
                {
                    transactions.push(TransactionResponse {
                        id: uuid::Uuid::new_v4().to_string(), // Ephemeral ID
                        chain: "ethereum".to_string(),
                        signature: tx.hash,
                        tx_type: "external".to_string(),
                        from_address: Some(tx.from),
                        to_address: tx.to,
                        amount: Some(tx.value),
                        token_address: None,
                        status: tx.status,
                        block_number: tx.block_number.map(|b| b as i64),
                        timestamp: tx.timestamp.map(|ts| {
                            chrono::DateTime::from_timestamp(ts as i64, 0)
                                .map(|dt| dt.to_rfc3339())
                                .unwrap_or_default()
                        }),
                    });
                }
            }
            
            // Re-sort by timestamp descending
            transactions.sort_by(|a, b| {
                b.timestamp
                    .as_deref()
                    .unwrap_or("")
                    .cmp(a.timestamp.as_deref().unwrap_or(""))
            });
        }
    }

    Ok(transactions)
}
