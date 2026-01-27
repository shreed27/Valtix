//! NFT handlers

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::services::nft_service;
use crate::storage::models::NftResponse;
use crate::AppState;

/// List NFTs for an address
pub async fn list_nfts(
    State(state): State<Arc<AppState>>,
    Path((chain, address)): Path<(String, String)>,
) -> Result<Json<Vec<NftResponse>>, (StatusCode, String)> {
    let nfts = nft_service::get_nfts(&state, &chain, &address)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(nfts))
}

/// Get single NFT details
pub async fn get_nft(
    State(state): State<Arc<AppState>>,
    Path((chain, address, id)): Path<(String, String, String)>,
) -> Result<Json<NftResponse>, (StatusCode, String)> {
    let nft = nft_service::get_nft_detail(&state, &chain, &address, &id)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;

    Ok(Json(nft))
}
