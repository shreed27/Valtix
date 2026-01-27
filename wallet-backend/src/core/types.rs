//! Core types used throughout the wallet

use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

/// Supported blockchain networks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Solana,
    Ethereum,
}

impl std::fmt::Display for Chain {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Chain::Solana => write!(f, "solana"),
            Chain::Ethereum => write!(f, "ethereum"),
        }
    }
}

impl std::str::FromStr for Chain {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "solana" => Ok(Chain::Solana),
            "ethereum" => Ok(Chain::Ethereum),
            _ => Err(format!("Unknown chain: {}", s)),
        }
    }
}

/// Encrypted seed data stored in database
#[derive(Debug, Clone)]
pub struct EncryptedSeed {
    pub ciphertext: Vec<u8>,
    pub salt: [u8; 16],
    pub nonce: [u8; 12],
}

/// Derived account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DerivedAccount {
    pub chain: Chain,
    pub derivation_path: String,
    pub derivation_index: u32,
    pub public_key: String,
    pub address: String,
}

/// 64-byte seed that can be securely zeroed
#[derive(Clone, Zeroize)]
#[zeroize(drop)]
pub struct SecureSeed(pub [u8; 64]);

impl SecureSeed {
    pub fn new(bytes: [u8; 64]) -> Self {
        Self(bytes)
    }

    pub fn as_bytes(&self) -> &[u8; 64] {
        &self.0
    }
}

impl AsRef<[u8]> for SecureSeed {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// Transaction types for history
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionType {
    Send,
    Receive,
    Swap,
    NftTransfer,
    ContractInteraction,
    Unknown,
}

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
}

/// Multi-sig transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MultisigTxStatus {
    Pending,
    Ready,
    Executed,
    Cancelled,
}
