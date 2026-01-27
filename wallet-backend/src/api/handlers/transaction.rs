//! Transaction handlers

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use crate::services::transaction_service::{self, SendRequest, SendResponse};
use crate::services::wallet_service;
use crate::storage::models::TransactionResponse;
use crate::AppState;

/// Send transaction
pub async fn send(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SendRequest>,
) -> Result<Json<SendResponse>, (StatusCode, String)> {
    // Check if unlocked
    if !wallet_service::is_unlocked(&state).await {
        return Err((StatusCode::UNAUTHORIZED, "Wallet is locked".to_string()));
    }

    let result = transaction_service::send_transaction(&state, request)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(result))
}

/// History query params
#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Get transaction history
pub async fn get_history(
    State(state): State<Arc<AppState>>,
    Path((chain, address)): Path<(String, String)>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<TransactionResponse>>, (StatusCode, String)> {
    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    let history = transaction_service::get_transaction_history(&state, &chain, &address, limit, offset)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(history))
}
