//! Multi-sig handlers

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use crate::services::multisig_service::{
    self, CreateMultisigRequest, ProposeTransactionRequest,
};
use crate::services::wallet_service;
use crate::storage::models::{MultisigTransactionResponse, MultisigWalletResponse};
use crate::AppState;

/// List all multi-sig wallets
pub async fn list_multisigs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<MultisigWalletResponse>>, (StatusCode, String)> {
    let multisigs = multisig_service::list_multisigs(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(multisigs))
}

/// Create multi-sig wallet
pub async fn create_multisig(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateMultisigRequest>,
) -> Result<Json<MultisigWalletResponse>, (StatusCode, String)> {
    // Check if unlocked
    if !wallet_service::is_unlocked(&state).await {
        return Err((StatusCode::UNAUTHORIZED, "Wallet is locked".to_string()));
    }

    let multisig = multisig_service::create_multisig(&state, request)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(multisig))
}

/// Get single multi-sig
pub async fn get_multisig(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<MultisigWalletResponse>, (StatusCode, String)> {
    let multisigs = multisig_service::list_multisigs(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let multisig = multisigs
        .into_iter()
        .find(|m| m.id == id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Multi-sig not found".to_string()))?;

    Ok(Json(multisig))
}

/// Propose transaction
pub async fn propose_transaction(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<ProposeTransactionRequest>,
) -> Result<Json<MultisigTransactionResponse>, (StatusCode, String)> {
    let tx = multisig_service::propose_transaction(&state, &id, request)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(tx))
}

/// Approve transaction request
#[derive(Debug, Deserialize)]
pub struct ApproveRequest {
    pub approver_address: String,
}

/// Approve transaction
pub async fn approve_transaction(
    State(state): State<Arc<AppState>>,
    Path((id, tx_id)): Path<(String, String)>,
    Json(request): Json<ApproveRequest>,
) -> Result<Json<MultisigTransactionResponse>, (StatusCode, String)> {
    let tx = multisig_service::approve_transaction(&state, &id, &tx_id, &request.approver_address)
        .await
        .map_err(|e| match e {
            multisig_service::MultisigServiceError::AlreadyApproved => {
                (StatusCode::BAD_REQUEST, "Already approved".to_string())
            }
            multisig_service::MultisigServiceError::NotFound => {
                (StatusCode::NOT_FOUND, "Multi-sig not found".to_string())
            }
            multisig_service::MultisigServiceError::TransactionNotFound => {
                (StatusCode::NOT_FOUND, "Transaction not found".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok(Json(tx))
}

/// Execute transaction response
#[derive(Debug, serde::Serialize)]
pub struct ExecuteResponse {
    pub signature: String,
}

/// Execute transaction
pub async fn execute_transaction(
    State(state): State<Arc<AppState>>,
    Path((id, tx_id)): Path<(String, String)>,
) -> Result<Json<ExecuteResponse>, (StatusCode, String)> {
    // Check if unlocked
    if !wallet_service::is_unlocked(&state).await {
        return Err((StatusCode::UNAUTHORIZED, "Wallet is locked".to_string()));
    }

    let signature = multisig_service::execute_transaction(&state, &id, &tx_id)
        .await
        .map_err(|e| match e {
            multisig_service::MultisigServiceError::InsufficientApprovals => {
                (StatusCode::BAD_REQUEST, "Insufficient approvals".to_string())
            }
            multisig_service::MultisigServiceError::NotFound => {
                (StatusCode::NOT_FOUND, "Multi-sig not found".to_string())
            }
            multisig_service::MultisigServiceError::TransactionNotFound => {
                (StatusCode::NOT_FOUND, "Transaction not found".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok(Json(ExecuteResponse { signature }))
}

/// Get pending transactions
pub async fn get_transactions(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<MultisigTransactionResponse>>, (StatusCode, String)> {
    let transactions = multisig_service::get_pending_transactions(&state, &id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(transactions))
}
