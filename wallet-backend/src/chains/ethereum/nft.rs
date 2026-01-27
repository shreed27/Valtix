//! Ethereum NFT operations (ERC-721/ERC-1155) - Simplified

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EthNftError {
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
pub struct EthereumNft {
    pub contract_address: String,
    pub token_id: String,
    pub token_standard: String, // "ERC721" or "ERC1155"
    pub name: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub token_uri: Option<String>,
    pub collection_name: Option<String>,
    pub attributes: Option<Vec<NftAttribute>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftAttribute {
    pub trait_type: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: &'static str,
    params: Vec<serde_json::Value>,
    id: u32,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    result: Option<String>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    message: String,
}

/// Get ERC-721 balance (number of NFTs owned)
pub async fn get_erc721_balance(
    rpc_url: &str,
    contract: &str,
    owner: &str,
) -> Result<u64, EthNftError> {
    let client = reqwest::Client::new();

    // balanceOf(address) selector: 0x70a08231
    let owner_padded = format!("000000000000000000000000{}", owner.trim_start_matches("0x"));
    let data = format!("0x70a08231{}", owner_padded);

    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            serde_json::json!({
                "to": contract,
                "data": data
            }),
            serde_json::Value::String("latest".to_string()),
        ],
        id: 1,
    };

    let response: JsonRpcResponse = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| EthNftError::RpcError(e.to_string()))?
        .json()
        .await
        .map_err(|e| EthNftError::RpcError(e.to_string()))?;

    if let Some(error) = response.error {
        return Err(EthNftError::RpcError(error.message));
    }

    let hex_balance = response.result.unwrap_or_else(|| "0x0".to_string());
    let balance = u64::from_str_radix(hex_balance.trim_start_matches("0x"), 16).unwrap_or(0);

    Ok(balance)
}

/// Get ERC-721 token URI
pub async fn get_erc721_token_uri(
    rpc_url: &str,
    contract: &str,
    token_id: u64,
) -> Result<String, EthNftError> {
    let client = reqwest::Client::new();

    // tokenURI(uint256) selector: 0xc87b56dd
    let token_id_hex = format!("{:064x}", token_id);
    let data = format!("0xc87b56dd{}", token_id_hex);

    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            serde_json::json!({
                "to": contract,
                "data": data
            }),
            serde_json::Value::String("latest".to_string()),
        ],
        id: 1,
    };

    let response: JsonRpcResponse = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| EthNftError::RpcError(e.to_string()))?
        .json()
        .await
        .map_err(|e| EthNftError::RpcError(e.to_string()))?;

    if let Some(error) = response.error {
        return Err(EthNftError::RpcError(error.message));
    }

    let hex_result = response.result.unwrap_or_default();

    // Decode ABI-encoded string (simplified)
    // In production, use proper ABI decoding
    let decoded = decode_string_from_hex(&hex_result)?;

    Ok(decoded)
}

/// Fetch off-chain NFT metadata from URI
pub async fn fetch_nft_metadata(uri: &str) -> Result<serde_json::Value, EthNftError> {
    // Handle IPFS URIs
    let http_uri = if uri.starts_with("ipfs://") {
        format!("https://ipfs.io/ipfs/{}", &uri[7..])
    } else if uri.starts_with("ar://") {
        format!("https://arweave.net/{}", &uri[5..])
    } else {
        uri.to_string()
    };

    let response = reqwest::get(&http_uri)
        .await
        .map_err(|e| EthNftError::MetadataError(e.to_string()))?;

    let metadata: serde_json::Value = response
        .json()
        .await
        .map_err(|e| EthNftError::MetadataError(e.to_string()))?;

    Ok(metadata)
}

/// Get NFT details including metadata
pub async fn get_nft_details(
    rpc_url: &str,
    contract: &str,
    token_id: u64,
    token_standard: &str,
) -> Result<EthereumNft, EthNftError> {
    // Get token URI
    let token_uri = match token_standard {
        "ERC721" => get_erc721_token_uri(rpc_url, contract, token_id).await.ok(),
        _ => None,
    };

    // Fetch off-chain metadata if URI is available
    let (name, description, image_url, attributes) = if let Some(ref uri) = token_uri {
        if let Ok(metadata) = fetch_nft_metadata(uri).await {
            (
                metadata.get("name").and_then(|v| v.as_str()).map(String::from),
                metadata.get("description").and_then(|v| v.as_str()).map(String::from),
                metadata.get("image").and_then(|v| v.as_str()).map(String::from),
                metadata.get("attributes").and_then(|v| {
                    v.as_array().map(|arr| {
                        arr.iter()
                            .filter_map(|attr| {
                                let trait_type = attr.get("trait_type")?.as_str()?.to_string();
                                let value = attr.get("value")?.clone();
                                Some(NftAttribute { trait_type, value })
                            })
                            .collect()
                    })
                }),
            )
        } else {
            (None, None, None, None)
        }
    } else {
        (None, None, None, None)
    };

    Ok(EthereumNft {
        contract_address: contract.to_string(),
        token_id: token_id.to_string(),
        token_standard: token_standard.to_string(),
        name,
        description,
        image_url,
        token_uri,
        collection_name: None,
        attributes,
    })
}

/// Decode ABI-encoded string from hex (simplified)
fn decode_string_from_hex(hex: &str) -> Result<String, EthNftError> {
    let bytes = hex::decode(hex.trim_start_matches("0x"))
        .map_err(|e| EthNftError::MetadataError(e.to_string()))?;

    if bytes.len() < 64 {
        return Err(EthNftError::MetadataError("Invalid ABI encoding".to_string()));
    }

    // Skip offset (32 bytes) and read length (32 bytes)
    let len_bytes: [u8; 8] = bytes[56..64].try_into().unwrap_or([0u8; 8]);
    let len = u64::from_be_bytes(len_bytes) as usize;

    if bytes.len() < 64 + len {
        return Err(EthNftError::MetadataError("String too short".to_string()));
    }

    String::from_utf8(bytes[64..64 + len].to_vec())
        .map_err(|e| EthNftError::MetadataError(e.to_string()))
}
