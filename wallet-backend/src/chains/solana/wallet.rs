//! Solana wallet operations

use ed25519_dalek::SigningKey;
use solana_sdk::{
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
};
use thiserror::Error;

use crate::core::{derive_solana_keypair, SecureSeed};

#[derive(Debug, Error)]
pub enum SolanaWalletError {
    #[error("Key derivation failed: {0}")]
    DerivationFailed(String),
    #[error("Invalid keypair")]
    InvalidKeypair,
}

/// Solana keypair wrapper
pub struct SolanaKeypair {
    keypair: Keypair,
}

impl SolanaKeypair {
    /// Create from signing key
    pub fn from_signing_key(signing_key: &SigningKey) -> Result<Self, SolanaWalletError> {
        // Convert ed25519-dalek key to solana Keypair
        // Solana Keypair expects 64 bytes: [secret_key(32) || public_key(32)]
        let secret_bytes = signing_key.to_bytes();
        let public_bytes = signing_key.verifying_key().to_bytes();

        let mut keypair_bytes = [0u8; 64];
        keypair_bytes[..32].copy_from_slice(&secret_bytes);
        keypair_bytes[32..].copy_from_slice(&public_bytes);

        let keypair = Keypair::from_bytes(&keypair_bytes)
            .map_err(|_| SolanaWalletError::InvalidKeypair)?;

        Ok(Self { keypair })
    }

    /// Derive keypair from seed at index
    pub fn derive(seed: &SecureSeed, index: u32) -> Result<Self, SolanaWalletError> {
        let (signing_key, _) = derive_solana_keypair(seed, index)
            .map_err(|e| SolanaWalletError::DerivationFailed(e.to_string()))?;

        Self::from_signing_key(&signing_key)
    }

    /// Get public key
    pub fn pubkey(&self) -> Pubkey {
        self.keypair.pubkey()
    }

    /// Get address as base58 string
    pub fn address(&self) -> String {
        self.keypair.pubkey().to_string()
    }

    /// Get inner keypair reference
    pub fn keypair(&self) -> &Keypair {
        &self.keypair
    }

    /// Sign a message
    pub fn sign(&self, message: &[u8]) -> solana_sdk::signature::Signature {
        self.keypair.sign_message(message)
    }
}

/// Validate a Solana address
pub fn validate_address(address: &str) -> bool {
    address.parse::<Pubkey>().is_ok()
}

/// Parse a Solana address
pub fn parse_address(address: &str) -> Result<Pubkey, SolanaWalletError> {
    address
        .parse::<Pubkey>()
        .map_err(|_| SolanaWalletError::InvalidKeypair)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::seed::{mnemonic_to_seed, parse_mnemonic};

    const TEST_MNEMONIC: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

    #[test]
    fn test_derive_keypair() {
        let mnemonic = parse_mnemonic(TEST_MNEMONIC).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");

        let keypair = SolanaKeypair::derive(&seed, 0).unwrap();
        let address = keypair.address();

        assert!(validate_address(&address));
    }

    #[test]
    fn test_deterministic_derivation() {
        let mnemonic = parse_mnemonic(TEST_MNEMONIC).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");

        let keypair1 = SolanaKeypair::derive(&seed, 0).unwrap();
        let keypair2 = SolanaKeypair::derive(&seed, 0).unwrap();

        assert_eq!(keypair1.address(), keypair2.address());
    }
}
