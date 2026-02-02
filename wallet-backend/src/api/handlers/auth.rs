//! Authentication handlers

use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::services::wallet_service;
use crate::AppState;

/// Wallet status response
#[derive(Debug, Serialize)]
pub struct StatusResponse {
    pub has_wallet: bool,
    pub is_unlocked: bool,
}

/// Get wallet status
pub async fn status(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    let has_wallet = state.db.wallet_exists().await.unwrap_or(false);
    let is_unlocked = wallet_service::is_unlocked(&state).await;

    Json(StatusResponse {
        has_wallet,
        is_unlocked,
    })
}

/// Unlock request
#[derive(Debug, Deserialize)]
pub struct UnlockRequest {
    pub password: String,
}

/// Unlock wallet
pub async fn unlock(
    State(state): State<Arc<AppState>>,
    Json(request): Json<UnlockRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    wallet_service::unlock_wallet(&state, &request.password)
        .await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))?;

    Ok(Json(StatusResponse {
        has_wallet: true,
        is_unlocked: true,
    }))
}

/// Lock wallet
pub async fn lock(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    wallet_service::lock_wallet(&state).await;

    Json(StatusResponse {
        has_wallet: true,
        is_unlocked: false,
    })
}

/// Create wallet request
#[derive(Debug, Deserialize)]
pub struct CreateWalletRequest {
    pub password: String,
}

/// Create wallet response
#[derive(Debug, Serialize)]
pub struct CreateWalletResponse {
    pub wallet_id: String,
    pub mnemonic: Vec<String>,
}

/// Create new wallet
pub async fn create_wallet(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateWalletRequest>,
) -> Result<Json<CreateWalletResponse>, (StatusCode, String)> {
    let (wallet_id, mnemonic) = wallet_service::create_wallet(&state, &request.password)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(CreateWalletResponse { wallet_id, mnemonic }))
}

/// Import wallet request
#[derive(Debug, Deserialize)]
pub struct ImportWalletRequest {
    pub mnemonic: String,
    pub password: String,
}

/// Import wallet response
#[derive(Debug, Serialize)]
pub struct ImportWalletResponse {
    pub wallet_id: String,
}

/// Import existing wallet
pub async fn import_wallet(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ImportWalletRequest>,
) -> Result<Json<ImportWalletResponse>, (StatusCode, String)> {
    let wallet_id = wallet_service::import_wallet(&state, &request.mnemonic, &request.password)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ImportWalletResponse { wallet_id }))
}

/// Reset wallet (Debug/Dev only - wipes whole DB)
pub async fn reset(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    tracing::info!("Resetting wallet database...");

    state.db.reset_database().await.map_err(|e| {
        tracing::error!("Failed to reset database: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    // Lock memory
    wallet_service::lock_wallet(&state).await;

    tracing::info!("Wallet reset complete");

    Ok(Json(StatusResponse {
        has_wallet: false,
        is_unlocked: false,
    }))
}

/// CSRF Token response
#[derive(Debug, Serialize)]
pub struct CsrfResponse {
    pub token: String,
}

/// Generate CSRF token and set cookie
pub async fn get_csrf_token() -> (axum::http::HeaderMap, Json<CsrfResponse>) {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        axum::http::header::SET_COOKIE,
        format!("csrf_token={}; Path=/; SameSite=Lax", token)
            .parse()
            .unwrap(),
    );

    (headers, Json(CsrfResponse { token }))
}
