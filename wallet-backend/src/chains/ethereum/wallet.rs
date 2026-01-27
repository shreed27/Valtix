//! Ethereum wallet operations

use k256::ecdsa::{SigningKey as Secp256k1SigningKey, VerifyingKey};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use thiserror::Error;
use tiny_keccak::{Hasher, Keccak};

use crate::core::{derive_ethereum_keypair, SecureSeed};

#[derive(Debug, Error)]
pub enum EthWalletError {
    #[error("Key derivation failed: {0}")]
    DerivationFailed(String),
    #[error("Invalid private key")]
    InvalidPrivateKey,
    #[error("Signing error: {0}")]
    SigningError(String),
}

/// Ethereum wallet wrapper
pub struct EthereumWallet {
    signing_key: Secp256k1SigningKey,
    address: String,
}

impl EthereumWallet {
    /// Create from k256 signing key
    pub fn from_signing_key(signing_key: Secp256k1SigningKey) -> Result<Self, EthWalletError> {
        // Get uncompressed public key
        let verifying_key = VerifyingKey::from(&signing_key);
        let public_key_point = verifying_key.to_encoded_point(false);
        let public_key_bytes = public_key_point.as_bytes();

        // Ethereum address = last 20 bytes of Keccak256(public_key[1..])
        let mut hasher = Keccak::v256();
        hasher.update(&public_key_bytes[1..]); // Skip the 0x04 prefix
        let mut hash = [0u8; 32];
        hasher.finalize(&mut hash);

        let address = format!("0x{}", hex::encode(&hash[12..]));

        Ok(Self {
            signing_key,
            address,
        })
    }

    /// Derive wallet from seed at index
    pub fn derive(seed: &SecureSeed, index: u32) -> Result<Self, EthWalletError> {
        let (signing_key, _) = derive_ethereum_keypair(seed, index)
            .map_err(|e| EthWalletError::DerivationFailed(e.to_string()))?;

        Self::from_signing_key(signing_key)
    }

    /// Get address as hex string (with 0x prefix)
    pub fn address_string(&self) -> String {
        self.address.clone()
    }

    /// Get the signing key bytes
    pub fn signing_key_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes().into()
    }

    /// Sign a message hash (32 bytes)
    pub fn sign_hash(&self, hash: &[u8; 32]) -> Result<(Vec<u8>, u8), EthWalletError> {
        use k256::ecdsa::{signature::Signer, Signature};

        let signature: Signature = self.signing_key.sign(hash);
        let sig_bytes = signature.to_bytes();

        // Recovery ID calculation (simplified - in production use proper recovery)
        let recovery_id = 27u8;

        Ok((sig_bytes.to_vec(), recovery_id))
    }
}

/// Validate an Ethereum address
pub fn validate_address(address: &str) -> bool {
    // Remove 0x prefix if present
    let addr = address.strip_prefix("0x").unwrap_or(address);

    // Check length (40 hex chars = 20 bytes)
    if addr.len() != 40 {
        return false;
    }

    // Check if all characters are valid hex
    addr.chars().all(|c| c.is_ascii_hexdigit())
}

/// Checksum an Ethereum address (EIP-55)
pub fn checksum_address(address: &str) -> String {
    let addr = address.strip_prefix("0x").unwrap_or(address).to_lowercase();

    // Hash the lowercase address
    let mut hasher = Keccak::v256();
    hasher.update(addr.as_bytes());
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);

    // Apply checksum
    let mut result = String::from("0x");
    for (i, c) in addr.chars().enumerate() {
        if c.is_ascii_digit() {
            result.push(c);
        } else {
            let hash_nibble = if i % 2 == 0 {
                hash[i / 2] >> 4
            } else {
                hash[i / 2] & 0x0f
            };

            if hash_nibble >= 8 {
                result.push(c.to_ascii_uppercase());
            } else {
                result.push(c);
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::seed::{mnemonic_to_seed, parse_mnemonic};

    const TEST_MNEMONIC: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

    #[test]
    fn test_derive_wallet() {
        let mnemonic = parse_mnemonic(TEST_MNEMONIC).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");

        let wallet = EthereumWallet::derive(&seed, 0).unwrap();
        let address = wallet.address_string();

        assert!(address.starts_with("0x"));
        assert_eq!(address.len(), 42);
    }

    #[test]
    fn test_validate_address() {
        assert!(validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f3fE70"));
        assert!(validate_address("742d35Cc6634C0532925a3b844Bc9e7595f3fE70"));
        assert!(!validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f3fE7")); // Too short
        assert!(!validate_address("0xGGGd35Cc6634C0532925a3b844Bc9e7595f3fE70")); // Invalid hex
    }
}
