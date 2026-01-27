//! Jupiter swap integration for Solana

use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::wallet::SolanaKeypair;

#[derive(Debug, Error)]
pub enum SwapError {
    #[error("Quote API error: {0}")]
    QuoteError(String),
    #[error("Swap execution failed: {0}")]
    ExecutionFailed(String),
    #[error("Invalid token mint: {0}")]
    InvalidMint(String),
    #[error("Insufficient balance")]
    InsufficientBalance,
    #[error("Slippage exceeded")]
    SlippageExceeded,
}

/// Well-known token mints
pub mod mints {
    pub const SOL: &str = "So11111111111111111111111111111111111111112";
    pub const USDC_MAINNET: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    pub const USDC_DEVNET: &str = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
}

/// Jupiter quote request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteRequest {
    pub input_mint: String,
    pub output_mint: String,
    pub amount: u64,
    pub slippage_bps: u16, // 50 = 0.5%
}

/// Jupiter quote response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResponse {
    pub input_mint: String,
    pub in_amount: String,
    pub output_mint: String,
    pub out_amount: String,
    pub other_amount_threshold: String,
    pub swap_mode: String,
    pub slippage_bps: u16,
    pub price_impact_pct: String,
    pub route_plan: Vec<RoutePlanStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutePlanStep {
    pub swap_info: SwapInfo,
    pub percent: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapInfo {
    pub amm_key: String,
    pub label: Option<String>,
    pub input_mint: String,
    pub output_mint: String,
    pub in_amount: String,
    pub out_amount: String,
    pub fee_amount: String,
    pub fee_mint: String,
}

/// Swap request for execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapRequest {
    pub user_public_key: String,
    pub wrap_and_unwrap_sol: bool,
    pub use_shared_accounts: bool,
    pub fee_account: Option<String>,
    pub compute_unit_price_micro_lamports: Option<u64>,
    pub quote_response: QuoteResponse,
}

/// Swap execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapResult {
    pub signature: String,
    pub input_amount: String,
    pub output_amount: String,
}

const JUPITER_QUOTE_API: &str = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API: &str = "https://quote-api.jup.ag/v6/swap";

/// Get a swap quote from Jupiter
pub async fn get_quote(request: &QuoteRequest) -> Result<QuoteResponse, SwapError> {
    let url = format!(
        "{}?inputMint={}&outputMint={}&amount={}&slippageBps={}",
        JUPITER_QUOTE_API,
        request.input_mint,
        request.output_mint,
        request.amount,
        request.slippage_bps
    );

    let response = reqwest::get(&url)
        .await
        .map_err(|e| SwapError::QuoteError(e.to_string()))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(SwapError::QuoteError(error_text));
    }

    let quote: QuoteResponse = response
        .json()
        .await
        .map_err(|e| SwapError::QuoteError(e.to_string()))?;

    Ok(quote)
}

/// Execute a swap using Jupiter
pub async fn execute_swap(
    rpc_url: &str,
    keypair: &SolanaKeypair,
    quote: QuoteResponse,
) -> Result<SwapResult, SwapError> {
    let client = reqwest::Client::new();

    // Build swap request
    let swap_request = SwapRequest {
        user_public_key: keypair.address(),
        wrap_and_unwrap_sol: true,
        use_shared_accounts: true,
        fee_account: None,
        compute_unit_price_micro_lamports: Some(1000),
        quote_response: quote.clone(),
    };

    // Get swap transaction from Jupiter
    let response = client
        .post(JUPITER_SWAP_API)
        .json(&swap_request)
        .send()
        .await
        .map_err(|e| SwapError::ExecutionFailed(e.to_string()))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(SwapError::ExecutionFailed(error_text));
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SwapResponse {
        swap_transaction: String,
    }

    let swap_response: SwapResponse = response
        .json()
        .await
        .map_err(|e| SwapError::ExecutionFailed(e.to_string()))?;

    // Decode and sign the transaction
    use base64::Engine;
    let tx_bytes = base64::engine::general_purpose::STANDARD
        .decode(&swap_response.swap_transaction)
        .map_err(|e| SwapError::ExecutionFailed(e.to_string()))?;

    // Parse as versioned transaction
    let mut tx: solana_sdk::transaction::VersionedTransaction =
        bincode::deserialize(&tx_bytes)
            .map_err(|e| SwapError::ExecutionFailed(e.to_string()))?;

    // Sign the transaction
    tx.signatures[0] = keypair.sign(tx.message.serialize().as_slice());

    // Send transaction using versioned transaction support
    let rpc_client = solana_client::rpc_client::RpcClient::new(rpc_url.to_string());

    // Serialize the signed transaction back to bytes
    let signed_tx_bytes = bincode::serialize(&tx)
        .map_err(|e| SwapError::ExecutionFailed(e.to_string()))?;

    // Send raw transaction using send_transaction with proper config
    use solana_client::rpc_config::RpcSendTransactionConfig;

    let signature = rpc_client
        .send_transaction_with_config(
            &tx,
            RpcSendTransactionConfig {
                skip_preflight: false,
                ..Default::default()
            },
        )
        .map_err(|e: solana_client::client_error::ClientError| {
            SwapError::ExecutionFailed(e.to_string())
        })?;

    Ok(SwapResult {
        signature: signature.to_string(),
        input_amount: quote.in_amount,
        output_amount: quote.out_amount,
    })
}

/// Get a simple quote for SOL to USDC
pub async fn get_sol_to_usdc_quote(amount_lamports: u64, slippage_bps: u16) -> Result<QuoteResponse, SwapError> {
    get_quote(&QuoteRequest {
        input_mint: mints::SOL.to_string(),
        output_mint: mints::USDC_MAINNET.to_string(),
        amount: amount_lamports,
        slippage_bps,
    })
    .await
}

/// Get a simple quote for USDC to SOL
pub async fn get_usdc_to_sol_quote(amount_usdc: u64, slippage_bps: u16) -> Result<QuoteResponse, SwapError> {
    get_quote(&QuoteRequest {
        input_mint: mints::USDC_MAINNET.to_string(),
        output_mint: mints::SOL.to_string(),
        amount: amount_usdc,
        slippage_bps,
    })
    .await
}
