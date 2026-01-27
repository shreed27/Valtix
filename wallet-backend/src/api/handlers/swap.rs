//! Swap handlers (Jupiter integration)

use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::chains::solana::{
    get_quote as jupiter_get_quote, execute_swap as jupiter_execute_swap,
    QuoteRequest, QuoteResponse, SolanaKeypair,
};
use crate::services::wallet_service::{self, get_seed};
use crate::AppState;

/// Quote query params
#[derive(Debug, Deserialize)]
pub struct QuoteQuery {
    pub input_mint: String,
    pub output_mint: String,
    pub amount: u64,
    pub slippage_bps: Option<u16>,
}

/// Get swap quote
pub async fn get_quote(
    Query(query): Query<QuoteQuery>,
) -> Result<Json<QuoteResponse>, (StatusCode, String)> {
    let request = QuoteRequest {
        input_mint: query.input_mint,
        output_mint: query.output_mint,
        amount: query.amount,
        slippage_bps: query.slippage_bps.unwrap_or(50),
    };

    let quote = jupiter_get_quote(&request)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(quote))
}

/// Execute swap request
#[derive(Debug, Deserialize)]
pub struct ExecuteSwapRequest {
    pub from_address: String,
    pub quote: QuoteResponse,
}

/// Execute swap response
#[derive(Debug, Serialize)]
pub struct ExecuteSwapResponse {
    pub signature: String,
    pub input_amount: String,
    pub output_amount: String,
}

/// Execute swap
pub async fn execute_swap(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ExecuteSwapRequest>,
) -> Result<Json<ExecuteSwapResponse>, (StatusCode, String)> {
    // Check if unlocked
    if !wallet_service::is_unlocked(&state).await {
        return Err((StatusCode::UNAUTHORIZED, "Wallet is locked".to_string()));
    }

    let seed = get_seed(&state)
        .await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))?;

    // Get account derivation index
    let account = state
        .db
        .get_account_by_address("solana", &request.from_address)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let keypair = SolanaKeypair::derive(&seed, account.derivation_index as u32)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = jupiter_execute_swap(&state.solana_rpc_url, &keypair, request.quote)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ExecuteSwapResponse {
        signature: result.signature,
        input_amount: result.input_amount,
        output_amount: result.output_amount,
    }))
}
