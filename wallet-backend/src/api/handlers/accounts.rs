//! Account handlers

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::core::Chain;
use crate::services::wallet_service;
use crate::storage::models::AccountResponse;
use crate::AppState;

/// List all accounts
pub async fn list_accounts(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AccountResponse>>, (StatusCode, String)> {
    let accounts = wallet_service::list_accounts(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(accounts))
}

/// Create account request
#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub chain: String,
    pub name: Option<String>,
}

/// Create new account
pub async fn create_account(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateAccountRequest>,
) -> Result<Json<AccountResponse>, (StatusCode, String)> {
    // Check if unlocked
    if !wallet_service::is_unlocked(&state).await {
        return Err((StatusCode::UNAUTHORIZED, "Wallet is locked".to_string()));
    }

    let chain: Chain = request
        .chain
        .parse()
        .map_err(|e: String| (StatusCode::BAD_REQUEST, e))?;

    let account = wallet_service::derive_new_account(&state, chain, request.name)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(account))
}

/// Delete account
pub async fn delete_account(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check if unlocked
    if !wallet_service::is_unlocked(&state).await {
        return Err((StatusCode::UNAUTHORIZED, "Wallet is locked".to_string()));
    }

    tracing::info!("Deleting account: {}", id);

    wallet_service::delete_account(&state, &id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete account {}: {}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    tracing::info!("Account deleted successfully: {}", id);
    Ok(StatusCode::NO_CONTENT)
}
