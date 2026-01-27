//! Solana NFT operations (Metaplex)

use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum NftError {
    #[error("RPC error: {0}")]
    RpcError(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("NFT not found")]
    NftNotFound,
    #[error("Metadata error: {0}")]
    MetadataError(String),
}

/// NFT metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaNft {
    pub mint: String,
    pub token_account: String,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub collection: Option<NftCollection>,
    pub attributes: Option<Vec<NftAttribute>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftCollection {
    pub name: String,
    pub family: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftAttribute {
    pub trait_type: String,
    pub value: String,
}

/// Metaplex metadata PDA
const METADATA_PREFIX: &[u8] = b"metadata";

/// Get metadata PDA for a mint
pub fn get_metadata_pda(mint: &Pubkey) -> Pubkey {
    let metadata_program_id: Pubkey = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        .parse()
        .unwrap();

    let (pda, _) = Pubkey::find_program_address(
        &[METADATA_PREFIX, metadata_program_id.as_ref(), mint.as_ref()],
        &metadata_program_id,
    );
    pda
}

/// Get all NFTs owned by an address
pub fn get_nfts_for_owner(rpc_url: &str, owner: &str) -> Result<Vec<SolanaNft>, NftError> {
    let client = RpcClient::new(rpc_url.to_string());

    let owner_pubkey: Pubkey = owner
        .parse()
        .map_err(|_| NftError::InvalidAddress(owner.to_string()))?;

    // Get all token accounts
    let token_accounts = client
        .get_token_accounts_by_owner(
            &owner_pubkey,
            solana_client::rpc_request::TokenAccountsFilter::ProgramId(spl_token::id()),
        )
        .map_err(|e| NftError::RpcError(e.to_string()))?;

    let mut nfts = Vec::new();

    for account in token_accounts {
        // Parse account data
        if let solana_account_decoder::UiAccountData::Json(parsed) = &account.account.data {
            if let Some(info) = parsed.parsed.get("info") {
                // Check if it's an NFT (amount = 1, decimals = 0)
                if let Some(token_amount) = info.get("tokenAmount") {
                    let amount = token_amount
                        .get("amount")
                        .and_then(|v| v.as_str())
                        .unwrap_or("0");
                    let decimals = token_amount
                        .get("decimals")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    if amount == "1" && decimals == 0 {
                        // This is likely an NFT
                        let mint = info
                            .get("mint")
                            .and_then(|v| v.as_str())
                            .unwrap_or_default()
                            .to_string();

                        // Get metadata
                        if let Ok(metadata) = get_nft_metadata(rpc_url, &mint) {
                            nfts.push(SolanaNft {
                                mint: mint.clone(),
                                token_account: account.pubkey.clone(),
                                name: metadata.name,
                                symbol: metadata.symbol,
                                uri: metadata.uri,
                                image_url: metadata.image_url,
                                description: metadata.description,
                                collection: metadata.collection,
                                attributes: metadata.attributes,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(nfts)
}

/// Get all NFTs owned by an address (async version)
pub async fn get_nfts_for_owner_async(rpc_url: &str, owner: &str) -> Result<Vec<SolanaNft>, NftError> {
    let rpc_url = rpc_url.to_string();
    let owner = owner.to_string();

    tokio::task::spawn_blocking(move || get_nfts_for_owner(&rpc_url, &owner))
        .await
        .map_err(|e| NftError::RpcError(e.to_string()))?
}

/// NFT metadata response (partial)
#[derive(Debug, Clone)]
struct NftMetadata {
    name: String,
    symbol: String,
    uri: String,
    image_url: Option<String>,
    description: Option<String>,
    collection: Option<NftCollection>,
    attributes: Option<Vec<NftAttribute>>,
}

/// Get NFT metadata from on-chain data
fn get_nft_metadata(rpc_url: &str, mint: &str) -> Result<NftMetadata, NftError> {
    let client = RpcClient::new(rpc_url.to_string());

    let mint_pubkey: Pubkey = mint
        .parse()
        .map_err(|_| NftError::InvalidAddress(mint.to_string()))?;

    let metadata_pda = get_metadata_pda(&mint_pubkey);

    // Fetch metadata account
    let account = client
        .get_account(&metadata_pda)
        .map_err(|_| NftError::NftNotFound)?;

    // Parse Metaplex metadata
    // The metadata account has a specific structure
    let data = &account.data;
    if data.len() < 100 {
        return Err(NftError::MetadataError("Invalid metadata".to_string()));
    }

    // Skip discriminator and update authority
    let mut offset = 1 + 32 + 32;

    // Read name (32 bytes max, 4 byte length prefix)
    let name_len = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap()) as usize;
    offset += 4;
    let name = String::from_utf8_lossy(&data[offset..offset + name_len.min(32)])
        .trim_end_matches('\0')
        .to_string();
    offset += 32;

    // Read symbol (10 bytes max, 4 byte length prefix)
    let symbol_len = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap()) as usize;
    offset += 4;
    let symbol = String::from_utf8_lossy(&data[offset..offset + symbol_len.min(10)])
        .trim_end_matches('\0')
        .to_string();
    offset += 10;

    // Read URI (200 bytes max, 4 byte length prefix)
    let uri_len = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap()) as usize;
    offset += 4;
    let uri = String::from_utf8_lossy(&data[offset..offset + uri_len.min(200)])
        .trim_end_matches('\0')
        .to_string();

    Ok(NftMetadata {
        name,
        symbol,
        uri,
        image_url: None,
        description: None,
        collection: None,
        attributes: None,
    })
}

/// Fetch off-chain metadata from URI
pub async fn fetch_off_chain_metadata(uri: &str) -> Result<serde_json::Value, NftError> {
    // Handle IPFS URIs
    let http_uri = if uri.starts_with("ipfs://") {
        format!("https://ipfs.io/ipfs/{}", &uri[7..])
    } else {
        uri.to_string()
    };

    let response = reqwest::get(&http_uri)
        .await
        .map_err(|e| NftError::MetadataError(e.to_string()))?;

    let metadata: serde_json::Value = response
        .json()
        .await
        .map_err(|e| NftError::MetadataError(e.to_string()))?;

    Ok(metadata)
}
