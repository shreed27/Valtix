//! NFT service - orchestrates NFT operations

use std::sync::Arc;

use thiserror::Error;

use crate::chains::ethereum::get_nft_details;
use crate::chains::solana::get_nfts_for_owner_async;
use crate::storage::models::{NftCacheRow, NftResponse};
use crate::AppState;

#[derive(Debug, Error)]
pub enum NftServiceError {
    #[error("Invalid chain: {0}")]
    InvalidChain(String),
    #[error("NFT fetch failed: {0}")]
    FetchFailed(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Get NFTs for an address
pub async fn get_nfts(
    state: &Arc<AppState>,
    chain: &str,
    address: &str,
) -> Result<Vec<NftResponse>, NftServiceError> {
    // First check cache
    let account = state
        .db
        .get_account_by_address(chain, address)
        .await
        .ok();

    if let Some(ref acc) = account {
        let cached = state
            .db
            .get_nfts(&acc.id)
            .await
            .map_err(|e| NftServiceError::DatabaseError(e.to_string()))?;

        if !cached.is_empty() {
            return Ok(cached.into_iter().map(NftResponse::from).collect());
        }
    }

    // Fetch fresh NFTs
    match chain.to_lowercase().as_str() {
        "solana" => {
            let nfts = get_nfts_for_owner_async(&state.solana_rpc_url, address)
                .await
                .map_err(|e| NftServiceError::FetchFailed(e.to_string()))?;

            let responses: Vec<NftResponse> = nfts
                .into_iter()
                .map(|nft| NftResponse {
                    id: uuid::Uuid::new_v4().to_string(),
                    chain: "solana".to_string(),
                    token_address: nft.mint,
                    token_id: "1".to_string(),
                    name: Some(nft.name),
                    description: nft.description,
                    image_url: nft.image_url,
                    collection_name: nft.collection.map(|c| c.name),
                    metadata: None,
                })
                .collect();

            // Cache NFTs if we have an account
            if let Some(acc) = account {
                for nft in &responses {
                    let cache_row = NftCacheRow::new(
                        acc.id.clone(),
                        "solana".to_string(),
                        nft.token_address.clone(),
                        nft.token_id.clone(),
                        nft.name.clone(),
                        nft.description.clone(),
                        nft.image_url.clone(),
                        None,
                        nft.collection_name.clone(),
                    );
                    let _ = state.db.upsert_nft(&cache_row).await;
                }
            }

            Ok(responses)
        }
        "ethereum" => {
            // Ethereum NFT fetching requires knowing which contracts to check
            // In production, use an indexer like Alchemy, OpenSea, or Reservoir

            // Return cached NFTs or empty list
            if let Some(acc) = account {
                let cached = state
                    .db
                    .get_nfts(&acc.id)
                    .await
                    .map_err(|e| NftServiceError::DatabaseError(e.to_string()))?;

                return Ok(cached.into_iter().map(NftResponse::from).collect());
            }

            Ok(vec![])
        }
        _ => Err(NftServiceError::InvalidChain(chain.to_string())),
    }
}

/// Get single NFT details
pub async fn get_nft_detail(
    state: &Arc<AppState>,
    chain: &str,
    token_address: &str,
    token_id: &str,
) -> Result<NftResponse, NftServiceError> {
    // Check cache first
    if let Ok(cached) = state.db.get_nft(chain, token_address, token_id).await {
        return Ok(NftResponse::from(cached));
    }

    match chain.to_lowercase().as_str() {
        "solana" => {
            // For Solana, the token_address is the mint
            Err(NftServiceError::FetchFailed("NFT not found in cache".to_string()))
        }
        "ethereum" => {
            let token_id_u64: u64 = token_id
                .parse()
                .map_err(|_| NftServiceError::FetchFailed("Invalid token ID".to_string()))?;

            let nft = get_nft_details(&state.eth_rpc_url, token_address, token_id_u64, "ERC721")
                .await
                .map_err(|e| NftServiceError::FetchFailed(e.to_string()))?;

            Ok(NftResponse {
                id: uuid::Uuid::new_v4().to_string(),
                chain: "ethereum".to_string(),
                token_address: nft.contract_address,
                token_id: nft.token_id,
                name: nft.name,
                description: nft.description,
                image_url: nft.image_url,
                collection_name: nft.collection_name,
                metadata: None,
            })
        }
        _ => Err(NftServiceError::InvalidChain(chain.to_string())),
    }
}
