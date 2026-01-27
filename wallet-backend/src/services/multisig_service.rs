//! Multi-sig service - orchestrates multi-sig operations

use std::sync::Arc;

use thiserror::Error;

use crate::chains::solana::{
    create_multisig as create_solana_multisig, MultisigConfig as SolanaMultisigConfig,
    SolanaKeypair,
};
use crate::chains::ethereum::compute_safe_address;
use crate::services::wallet_service::{get_seed, WalletServiceError};
use crate::storage::models::{
    MultisigOwnerResponse, MultisigOwnerRow, MultisigTransactionResponse,
    MultisigTransactionRow, MultisigWalletResponse, MultisigWalletRow,
};
use crate::AppState;

#[derive(Debug, Error)]
pub enum MultisigServiceError {
    #[error("Wallet error: {0}")]
    WalletError(#[from] WalletServiceError),
    #[error("Invalid chain: {0}")]
    InvalidChain(String),
    #[error("Creation failed: {0}")]
    CreationFailed(String),
    #[error("Multi-sig not found")]
    NotFound,
    #[error("Transaction not found")]
    TransactionNotFound,
    #[error("Already approved")]
    AlreadyApproved,
    #[error("Insufficient approvals")]
    InsufficientApprovals,
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Create multi-sig request
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreateMultisigRequest {
    pub chain: String,
    pub name: String,
    pub threshold: u8,
    pub owners: Vec<String>,
}

/// Create a new multi-sig wallet
pub async fn create_multisig(
    state: &Arc<AppState>,
    request: CreateMultisigRequest,
) -> Result<MultisigWalletResponse, MultisigServiceError> {
    let seed = get_seed(state).await?;

    // Get wallet ID
    let wallet = state
        .db
        .get_primary_wallet()
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?
        .ok_or_else(|| MultisigServiceError::WalletError(WalletServiceError::NoWalletFound))?;

    let address = match request.chain.to_lowercase().as_str() {
        "solana" => {
            let keypair = SolanaKeypair::derive(&seed, 0)
                .map_err(|e| MultisigServiceError::CreationFailed(e.to_string()))?;

            let config = SolanaMultisigConfig {
                threshold: request.threshold,
                owners: request.owners.clone(),
                name: request.name.clone(),
            };

            let result = create_solana_multisig(&state.solana_rpc_url, &keypair, &config)
                .map_err(|e| MultisigServiceError::CreationFailed(e.to_string()))?;

            result.address
        }
        "ethereum" => {
            // Compute Safe address using default Sepolia factory addresses
            const SAFE_PROXY_FACTORY: &str = "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2";
            const SAFE_SINGLETON: &str = "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552";

            compute_safe_address(
                SAFE_PROXY_FACTORY,
                SAFE_SINGLETON,
                &request.owners,
                request.threshold,
                chrono::Utc::now().timestamp() as u64,
            )
            .map_err(|e| MultisigServiceError::CreationFailed(e.to_string()))?
        }
        _ => return Err(MultisigServiceError::InvalidChain(request.chain)),
    };

    // Store in database
    let multisig_row = MultisigWalletRow::new(
        wallet.id.clone(),
        request.name.clone(),
        request.chain.to_lowercase(),
        address.clone(),
        request.threshold as u32,
        request.owners.len() as u32,
    );

    state
        .db
        .create_multisig(&multisig_row)
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    // Store owners
    for (i, owner) in request.owners.iter().enumerate() {
        let owner_row = MultisigOwnerRow::new(
            multisig_row.id.clone(),
            owner.clone(),
            Some(format!("Owner {}", i + 1)),
        );

        state
            .db
            .add_multisig_owner(&owner_row)
            .await
            .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;
    }

    // Get owners for response
    let owners = state
        .db
        .get_multisig_owners(&multisig_row.id)
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    Ok(MultisigWalletResponse {
        id: multisig_row.id,
        name: request.name,
        chain: request.chain.to_lowercase(),
        address,
        threshold: request.threshold as u32,
        owner_count: request.owners.len() as u32,
        owners: owners
            .into_iter()
            .map(|o| MultisigOwnerResponse {
                address: o.owner_address,
                name: o.owner_name,
            })
            .collect(),
        created_at: multisig_row.created_at,
    })
}

/// List multi-sig wallets
pub async fn list_multisigs(
    state: &Arc<AppState>,
) -> Result<Vec<MultisigWalletResponse>, MultisigServiceError> {
    let wallet = state
        .db
        .get_primary_wallet()
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?
        .ok_or_else(|| MultisigServiceError::WalletError(WalletServiceError::NoWalletFound))?;

    let multisigs = state
        .db
        .get_multisig_wallets(&wallet.id)
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    let mut responses = Vec::new();
    for ms in multisigs {
        let owners = state
            .db
            .get_multisig_owners(&ms.id)
            .await
            .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

        responses.push(MultisigWalletResponse {
            id: ms.id,
            name: ms.name,
            chain: ms.chain,
            address: ms.address,
            threshold: ms.threshold as u32,
            owner_count: ms.owner_count as u32,
            owners: owners
                .into_iter()
                .map(|o| MultisigOwnerResponse {
                    address: o.owner_address,
                    name: o.owner_name,
                })
                .collect(),
            created_at: ms.created_at,
        });
    }

    Ok(responses)
}

/// Propose transaction request
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProposeTransactionRequest {
    pub to_address: String,
    pub amount: Option<String>,
    pub data: Option<String>,
}

/// Propose a new multi-sig transaction
pub async fn propose_transaction(
    state: &Arc<AppState>,
    multisig_id: &str,
    request: ProposeTransactionRequest,
) -> Result<MultisigTransactionResponse, MultisigServiceError> {
    // Verify multisig exists
    let _multisig = state
        .db
        .get_multisig(multisig_id)
        .await
        .map_err(|_| MultisigServiceError::NotFound)?;

    let tx_row = MultisigTransactionRow::new(
        multisig_id.to_string(),
        request.to_address,
        request.amount,
        request.data,
    );

    state
        .db
        .create_multisig_tx(&tx_row)
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    Ok(MultisigTransactionResponse::from(tx_row))
}

/// Approve a multi-sig transaction
pub async fn approve_transaction(
    state: &Arc<AppState>,
    multisig_id: &str,
    tx_id: &str,
    approver_address: &str,
) -> Result<MultisigTransactionResponse, MultisigServiceError> {
    // Get multisig and transaction
    let multisig = state
        .db
        .get_multisig(multisig_id)
        .await
        .map_err(|_| MultisigServiceError::NotFound)?;

    let tx = state
        .db
        .get_multisig_tx(tx_id)
        .await
        .map_err(|_| MultisigServiceError::TransactionNotFound)?;

    // Parse current approvals
    let mut approvals: Vec<String> = serde_json::from_str(&tx.approvals).unwrap_or_default();

    // Check if already approved
    if approvals.contains(&approver_address.to_string()) {
        return Err(MultisigServiceError::AlreadyApproved);
    }

    // Add approval
    approvals.push(approver_address.to_string());

    // Check if ready for execution
    let status = if approvals.len() >= multisig.threshold as usize {
        "ready"
    } else {
        "pending"
    };

    // Update in database
    let approvals_json = serde_json::to_string(&approvals)
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    state
        .db
        .update_multisig_tx(tx_id, &approvals_json, status)
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    // Fetch updated transaction
    let updated_tx = state
        .db
        .get_multisig_tx(tx_id)
        .await
        .map_err(|_| MultisigServiceError::TransactionNotFound)?;

    Ok(MultisigTransactionResponse::from(updated_tx))
}

/// Execute a multi-sig transaction
pub async fn execute_transaction(
    state: &Arc<AppState>,
    multisig_id: &str,
    tx_id: &str,
) -> Result<String, MultisigServiceError> {
    let multisig = state
        .db
        .get_multisig(multisig_id)
        .await
        .map_err(|_| MultisigServiceError::NotFound)?;

    let tx = state
        .db
        .get_multisig_tx(tx_id)
        .await
        .map_err(|_| MultisigServiceError::TransactionNotFound)?;

    // Check if ready
    let approvals: Vec<String> = serde_json::from_str(&tx.approvals).unwrap_or_default();
    if approvals.len() < multisig.threshold as usize {
        return Err(MultisigServiceError::InsufficientApprovals);
    }

    // Execute based on chain
    let signature = match multisig.chain.as_str() {
        "solana" => {
            // In production, execute via Squads or custom multi-sig program
            format!("simulated_solana_tx_{}", tx_id)
        }
        "ethereum" => {
            // In production, execute via Safe transaction service
            format!("simulated_eth_tx_{}", tx_id)
        }
        _ => return Err(MultisigServiceError::InvalidChain(multisig.chain)),
    };

    // Mark as executed
    state
        .db
        .mark_multisig_tx_executed(tx_id)
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    Ok(signature)
}

/// Get pending transactions for a multi-sig
pub async fn get_pending_transactions(
    state: &Arc<AppState>,
    multisig_id: &str,
) -> Result<Vec<MultisigTransactionResponse>, MultisigServiceError> {
    let transactions = state
        .db
        .get_multisig_transactions(multisig_id)
        .await
        .map_err(|e| MultisigServiceError::DatabaseError(e.to_string()))?;

    Ok(transactions
        .into_iter()
        .map(MultisigTransactionResponse::from)
        .collect())
}
