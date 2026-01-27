//! Balance handlers

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::services::transaction_service::{self, BalanceResponse, TokenBalanceResponse};
use crate::AppState;

/// Get balance for address
pub async fn get_balance(
    State(state): State<Arc<AppState>>,
    Path((chain, address)): Path<(String, String)>,
) -> Result<Json<BalanceResponse>, (StatusCode, String)> {
    let balance = transaction_service::get_balance(&state, &chain, &address)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(balance))
}

/// Get token balances for address
pub async fn get_tokens(
    State(state): State<Arc<AppState>>,
    Path((chain, address)): Path<(String, String)>,
) -> Result<Json<Vec<TokenBalanceResponse>>, (StatusCode, String)> {
    let balance = transaction_service::get_balance(&state, &chain, &address)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(balance.tokens))
}
