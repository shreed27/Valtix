//! Wallet service - orchestrates wallet operations

use std::sync::Arc;

use thiserror::Error;
use zeroize::Zeroizing;

use crate::core::{
    decrypt_seed, derive_account, encrypt_seed, generate_mnemonic, mnemonic_to_seed,
    parse_mnemonic, Chain, EncryptedSeed, SecureSeed,
};
use crate::storage::models::{AccountResponse, AccountRow, WalletRow};
use crate::storage::Database;
use crate::AppState;

#[derive(Debug, Error)]
pub enum WalletServiceError {
    #[error("Wallet already exists")]
    WalletAlreadyExists,
    #[error("No wallet found")]
    NoWalletFound,
    #[error("Wallet is locked")]
    WalletLocked,
    #[error("Invalid password")]
    InvalidPassword,
    #[error("Invalid mnemonic: {0}")]
    InvalidMnemonic(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Derivation error: {0}")]
    DerivationError(String),
}

/// Create a new wallet with generated mnemonic
pub async fn create_wallet(
    state: &Arc<AppState>,
    password: &str,
) -> Result<(String, Vec<String>), WalletServiceError> {
    // Check if wallet already exists
    if state
        .db
        .wallet_exists()
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?
    {
        return Err(WalletServiceError::WalletAlreadyExists);
    }

    // Generate new mnemonic
    let mnemonic = generate_mnemonic()
        .map_err(|e| WalletServiceError::InvalidMnemonic(e.to_string()))?;

    let words: Vec<String> = mnemonic.word_iter().map(String::from).collect();

    // Convert to seed
    let seed = mnemonic_to_seed(&mnemonic, "");

    // Encrypt seed
    let encrypted = encrypt_seed(&seed, password)
        .map_err(|e| WalletServiceError::InvalidPassword)?;

    // Store wallet
    let wallet_id = uuid::Uuid::new_v4().to_string();
    let wallet = WalletRow::new(
        wallet_id.clone(),
        encrypted.ciphertext,
        encrypted.salt.to_vec(),
        encrypted.nonce.to_vec(),
    );

    state
        .db
        .create_wallet(&wallet)
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?;

    // Store seed in memory (unlocked state)
    {
        let mut unlocked = state.unlocked_seed.write().await;
        *unlocked = Some(Zeroizing::new(*seed.as_bytes()));
    }

    // Create default accounts for both chains
    create_default_accounts(state, &wallet_id, &seed).await?;

    Ok((wallet_id, words))
}

/// Import wallet from mnemonic
pub async fn import_wallet(
    state: &Arc<AppState>,
    mnemonic_phrase: &str,
    password: &str,
) -> Result<String, WalletServiceError> {
    // Check if wallet already exists
    if state
        .db
        .wallet_exists()
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?
    {
        return Err(WalletServiceError::WalletAlreadyExists);
    }

    // Parse mnemonic
    let mnemonic = parse_mnemonic(mnemonic_phrase)
        .map_err(|e| WalletServiceError::InvalidMnemonic(e.to_string()))?;

    // Convert to seed
    let seed = mnemonic_to_seed(&mnemonic, "");

    // Encrypt seed
    let encrypted = encrypt_seed(&seed, password)
        .map_err(|e| WalletServiceError::InvalidPassword)?;

    // Store wallet
    let wallet_id = uuid::Uuid::new_v4().to_string();
    let wallet = WalletRow::new(
        wallet_id.clone(),
        encrypted.ciphertext,
        encrypted.salt.to_vec(),
        encrypted.nonce.to_vec(),
    );

    state
        .db
        .create_wallet(&wallet)
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?;

    // Store seed in memory (unlocked state)
    {
        let mut unlocked = state.unlocked_seed.write().await;
        *unlocked = Some(Zeroizing::new(*seed.as_bytes()));
    }

    // Create default accounts for both chains
    create_default_accounts(state, &wallet_id, &seed).await?;

    Ok(wallet_id)
}

/// Unlock wallet with password
pub async fn unlock_wallet(state: &Arc<AppState>, password: &str) -> Result<(), WalletServiceError> {
    // Get wallet from database
    let wallet = state
        .db
        .get_primary_wallet()
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?
        .ok_or(WalletServiceError::NoWalletFound)?;

    // Reconstruct encrypted seed
    let salt: [u8; 16] = wallet.salt.try_into().map_err(|_| WalletServiceError::InvalidPassword)?;
    let nonce: [u8; 12] = wallet.nonce.try_into().map_err(|_| WalletServiceError::InvalidPassword)?;

    let encrypted = EncryptedSeed {
        ciphertext: wallet.encrypted_seed,
        salt,
        nonce,
    };

    // Decrypt seed
    let seed = decrypt_seed(&encrypted, password)
        .map_err(|_| WalletServiceError::InvalidPassword)?;

    // Store in memory
    {
        let mut unlocked = state.unlocked_seed.write().await;
        *unlocked = Some(Zeroizing::new(*seed.as_bytes()));
    }

    Ok(())
}

/// Lock wallet (clear seed from memory)
pub async fn lock_wallet(state: &Arc<AppState>) {
    let mut unlocked = state.unlocked_seed.write().await;
    *unlocked = None;
}

/// Check if wallet is unlocked
pub async fn is_unlocked(state: &Arc<AppState>) -> bool {
    let unlocked = state.unlocked_seed.read().await;
    unlocked.is_some()
}

/// Get unlocked seed
pub async fn get_seed(state: &Arc<AppState>) -> Result<SecureSeed, WalletServiceError> {
    let unlocked = state.unlocked_seed.read().await;
    let seed_bytes = unlocked.as_ref().ok_or(WalletServiceError::WalletLocked)?;
    Ok(SecureSeed::new(**seed_bytes))
}

/// Create default accounts for Solana and Ethereum
async fn create_default_accounts(
    state: &Arc<AppState>,
    wallet_id: &str,
    seed: &SecureSeed,
) -> Result<(), WalletServiceError> {
    // Create Solana account
    let sol_account = derive_account(seed, Chain::Solana, 0)
        .map_err(|e| WalletServiceError::DerivationError(e.to_string()))?;

    let sol_row = AccountRow::new(
        wallet_id.to_string(),
        "Solana Account 1".to_string(),
        "solana".to_string(),
        sol_account.derivation_path,
        sol_account.derivation_index,
        sol_account.public_key,
        sol_account.address,
    );

    state
        .db
        .create_account(&sol_row)
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?;

    // Create Ethereum account
    let eth_account = derive_account(seed, Chain::Ethereum, 0)
        .map_err(|e| WalletServiceError::DerivationError(e.to_string()))?;

    let eth_row = AccountRow::new(
        wallet_id.to_string(),
        "Ethereum Account 1".to_string(),
        "ethereum".to_string(),
        eth_account.derivation_path,
        eth_account.derivation_index,
        eth_account.public_key,
        eth_account.address,
    );

    state
        .db
        .create_account(&eth_row)
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?;

    Ok(())
}

/// Derive a new account
pub async fn derive_new_account(
    state: &Arc<AppState>,
    chain: Chain,
    name: Option<String>,
) -> Result<AccountResponse, WalletServiceError> {
    let seed = get_seed(state).await?;

    // Get wallet ID
    let wallet = state
        .db
        .get_primary_wallet()
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?
        .ok_or(WalletServiceError::NoWalletFound)?;

    // Get next index
    let chain_str = chain.to_string();
    let index = state
        .db
        .get_next_derivation_index(&wallet.id, &chain_str)
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?;

    // Derive account
    let derived = derive_account(&seed, chain, index)
        .map_err(|e| WalletServiceError::DerivationError(e.to_string()))?;

    let account_name = name.unwrap_or_else(|| {
        format!(
            "{} Account {}",
            match chain {
                Chain::Solana => "Solana",
                Chain::Ethereum => "Ethereum",
            },
            index + 1
        )
    });

    let row = AccountRow::new(
        wallet.id,
        account_name,
        chain_str,
        derived.derivation_path,
        derived.derivation_index,
        derived.public_key,
        derived.address,
    );

    state
        .db
        .create_account(&row)
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?;

    Ok(AccountResponse::from(row))
}

/// List all accounts
pub async fn list_accounts(state: &Arc<AppState>) -> Result<Vec<AccountResponse>, WalletServiceError> {
    let wallet = state
        .db
        .get_primary_wallet()
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?
        .ok_or(WalletServiceError::NoWalletFound)?;

    let accounts = state
        .db
        .get_accounts(&wallet.id)
        .await
        .map_err(|e| WalletServiceError::DatabaseError(e.to_string()))?;

    Ok(accounts.into_iter().map(AccountResponse::from).collect())
}
