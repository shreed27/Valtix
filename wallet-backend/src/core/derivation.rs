//! HD wallet key derivation for Solana and Ethereum
//!
//! Implements BIP44 derivation paths:
//! - Solana: m/44'/501'/index'/0' (Ed25519, SLIP-0010)
//! - Ethereum: m/44'/60'/0'/0/index (secp256k1, BIP32)

use ed25519_dalek::{SigningKey as Ed25519SigningKey, VerifyingKey as Ed25519VerifyingKey};
use hmac::{Hmac, Mac};
use k256::{
    ecdsa::SigningKey as Secp256k1SigningKey,
    elliptic_curve::sec1::ToEncodedPoint,
};
use sha2::Sha512;
use thiserror::Error;
use tiny_keccak::{Hasher, Keccak};

use super::{Chain, DerivedAccount, SecureSeed};

#[derive(Debug, Error)]
pub enum DerivationError {
    #[error("Invalid derivation path: {0}")]
    InvalidPath(String),
    #[error("Key derivation failed: {0}")]
    DerivationFailed(String),
    #[error("Invalid seed length")]
    InvalidSeedLength,
}

type HmacSha512 = Hmac<Sha512>;

/// Extended private key for BIP32/SLIP-0010
#[derive(Clone)]
struct ExtendedKey {
    key: [u8; 32],
    chain_code: [u8; 32],
}

/// Derive a Solana keypair from seed at given index
/// Path: m/44'/501'/index'/0'
pub fn derive_solana_keypair(
    seed: &SecureSeed,
    index: u32,
) -> Result<(Ed25519SigningKey, String), DerivationError> {
    let path = format!("m/44'/501'/{}'/0'", index);
    derive_solana_from_path(seed, &path)
}

/// Derive a Solana keypair from seed with custom path
pub fn derive_solana_from_path(
    seed: &SecureSeed,
    path: &str,
) -> Result<(Ed25519SigningKey, String), DerivationError> {
    // Use SLIP-0010 for Ed25519
    let extended = derive_slip0010_ed25519(seed.as_bytes(), path)?;

    let signing_key = Ed25519SigningKey::from_bytes(&extended.key);
    let verifying_key: Ed25519VerifyingKey = (&signing_key).into();
    let address = bs58::encode(verifying_key.as_bytes()).into_string();

    Ok((signing_key, address))
}

/// Derive an Ethereum keypair from seed at given index
/// Path: m/44'/60'/0'/0/index
pub fn derive_ethereum_keypair(
    seed: &SecureSeed,
    index: u32,
) -> Result<(Secp256k1SigningKey, String), DerivationError> {
    let path = format!("m/44'/60'/0'/0/{}", index);
    derive_ethereum_from_path(seed, &path)
}

/// Derive an Ethereum keypair from seed with custom path
pub fn derive_ethereum_from_path(
    seed: &SecureSeed,
    path: &str,
) -> Result<(Secp256k1SigningKey, String), DerivationError> {
    // Use BIP32 for secp256k1
    let extended = derive_bip32_secp256k1(seed.as_bytes(), path)?;

    let signing_key = Secp256k1SigningKey::from_bytes((&extended.key).into())
        .map_err(|e| DerivationError::DerivationFailed(e.to_string()))?;

    // Get uncompressed public key (65 bytes: 0x04 || x || y)
    let verifying_key = signing_key.verifying_key();
    let public_key_point = verifying_key.to_encoded_point(false);
    let public_key_bytes = public_key_point.as_bytes();

    // Ethereum address = last 20 bytes of Keccak256(public_key[1..])
    let mut hasher = Keccak::v256();
    hasher.update(&public_key_bytes[1..]); // Skip the 0x04 prefix
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);

    let address = format!("0x{}", hex::encode(&hash[12..]));

    Ok((signing_key, address))
}

/// Derive account for specified chain
pub fn derive_account(
    seed: &SecureSeed,
    chain: Chain,
    index: u32,
) -> Result<DerivedAccount, DerivationError> {
    match chain {
        Chain::Solana => {
            let path = format!("m/44'/501'/{}'/0'", index);
            let (signing_key, address) = derive_solana_keypair(seed, index)?;
            let verifying_key: Ed25519VerifyingKey = (&signing_key).into();

            Ok(DerivedAccount {
                chain,
                derivation_path: path,
                derivation_index: index,
                public_key: bs58::encode(verifying_key.as_bytes()).into_string(),
                address,
            })
        }
        Chain::Ethereum => {
            let path = format!("m/44'/60'/0'/0/{}", index);
            let (signing_key, address) = derive_ethereum_keypair(seed, index)?;
            let verifying_key = signing_key.verifying_key();
            let public_key_point = verifying_key.to_encoded_point(false);

            Ok(DerivedAccount {
                chain,
                derivation_path: path,
                derivation_index: index,
                public_key: hex::encode(public_key_point.as_bytes()),
                address,
            })
        }
    }
}

/// SLIP-0010 Ed25519 derivation (hardened only)
fn derive_slip0010_ed25519(seed: &[u8], path: &str) -> Result<ExtendedKey, DerivationError> {
    // Parse path
    let components = parse_derivation_path(path)?;

    // Master key from seed
    let mut mac = HmacSha512::new_from_slice(b"ed25519 seed")
        .map_err(|e| DerivationError::DerivationFailed(e.to_string()))?;
    mac.update(seed);
    let result = mac.finalize().into_bytes();

    let mut extended = ExtendedKey {
        key: result[..32].try_into().unwrap(),
        chain_code: result[32..].try_into().unwrap(),
    };

    // Derive each component (all hardened for Ed25519)
    for component in components {
        extended = derive_ed25519_child(&extended, component)?;
    }

    Ok(extended)
}

/// BIP32 secp256k1 derivation
fn derive_bip32_secp256k1(seed: &[u8], path: &str) -> Result<ExtendedKey, DerivationError> {
    // Parse path
    let components = parse_derivation_path(path)?;

    // Master key from seed
    let mut mac = HmacSha512::new_from_slice(b"Bitcoin seed")
        .map_err(|e| DerivationError::DerivationFailed(e.to_string()))?;
    mac.update(seed);
    let result = mac.finalize().into_bytes();

    let mut extended = ExtendedKey {
        key: result[..32].try_into().unwrap(),
        chain_code: result[32..].try_into().unwrap(),
    };

    // Derive each component
    for component in components {
        extended = derive_secp256k1_child(&extended, component)?;
    }

    Ok(extended)
}

/// Parse BIP44 derivation path into components
fn parse_derivation_path(path: &str) -> Result<Vec<u32>, DerivationError> {
    let path = path.trim();
    if !path.starts_with("m/") {
        return Err(DerivationError::InvalidPath(
            "Path must start with 'm/'".to_string(),
        ));
    }

    let mut components = Vec::new();

    for part in path[2..].split('/') {
        if part.is_empty() {
            return Err(DerivationError::InvalidPath(
                "Path contains empty component (double slash)".to_string(),
            ));
        }

        let (num_str, hardened) = if part.ends_with('\'') || part.ends_with('h') {
            (&part[..part.len() - 1], true)
        } else {
            (part, false)
        };

        let index: u32 = num_str
            .parse()
            .map_err(|_| DerivationError::InvalidPath(format!("Invalid index: {}", part)))?;

        let component = if hardened {
            index | 0x80000000
        } else {
            index
        };

        components.push(component);
    }

    Ok(components)
}

/// Derive Ed25519 child key (always hardened)
fn derive_ed25519_child(parent: &ExtendedKey, index: u32) -> Result<ExtendedKey, DerivationError> {
    // Ed25519 only supports hardened derivation
    if index < 0x80000000 {
        return Err(DerivationError::InvalidPath(
            "Ed25519 requires hardened derivation".to_string(),
        ));
    }

    let mut data = vec![0u8];
    data.extend_from_slice(&parent.key);
    data.extend_from_slice(&index.to_be_bytes());

    let mut mac = HmacSha512::new_from_slice(&parent.chain_code)
        .map_err(|e| DerivationError::DerivationFailed(e.to_string()))?;
    mac.update(&data);
    let result = mac.finalize().into_bytes();

    Ok(ExtendedKey {
        key: result[..32].try_into().unwrap(),
        chain_code: result[32..].try_into().unwrap(),
    })
}

/// Derive secp256k1 child key (hardened or normal)
fn derive_secp256k1_child(parent: &ExtendedKey, index: u32) -> Result<ExtendedKey, DerivationError> {
    let data = if index >= 0x80000000 {
        // Hardened: 0x00 || key || index
        let mut d = vec![0u8];
        d.extend_from_slice(&parent.key);
        d.extend_from_slice(&index.to_be_bytes());
        d
    } else {
        // Normal: compressed_pubkey || index
        let signing_key = Secp256k1SigningKey::from_bytes((&parent.key).into())
            .map_err(|e| DerivationError::DerivationFailed(e.to_string()))?;
        let verifying_key = signing_key.verifying_key();
        let point = verifying_key.to_encoded_point(true);
        let mut d = point.as_bytes().to_vec();
        d.extend_from_slice(&index.to_be_bytes());
        d
    };

    let mut mac = HmacSha512::new_from_slice(&parent.chain_code)
        .map_err(|e| DerivationError::DerivationFailed(e.to_string()))?;
    mac.update(&data);
    let result = mac.finalize().into_bytes();

    // Add parent key to derived key (mod n)
    let il: [u8; 32] = result[..32].try_into().unwrap();
    let child_key = add_scalars_secp256k1(&il, &parent.key)?;

    Ok(ExtendedKey {
        key: child_key,
        chain_code: result[32..].try_into().unwrap(),
    })
}

/// Add two secp256k1 scalars modulo n
fn add_scalars_secp256k1(a: &[u8; 32], b: &[u8; 32]) -> Result<[u8; 32], DerivationError> {
    use k256::elliptic_curve::ops::Reduce;
    use k256::{NonZeroScalar, Scalar, U256};

    let a_scalar = <Scalar as Reduce<U256>>::reduce_bytes(a.into());
    let b_scalar = <Scalar as Reduce<U256>>::reduce_bytes(b.into());
    let sum = a_scalar + b_scalar;

    // Ensure result is not zero
    let _ = Option::<NonZeroScalar>::from(NonZeroScalar::new(sum))
        .ok_or_else(|| DerivationError::DerivationFailed("Derived key is zero".to_string()))?;

    Ok(sum.to_bytes().into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::seed::{mnemonic_to_seed, parse_mnemonic};

    const TEST_MNEMONIC: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

    #[test]
    fn test_derive_solana() {
        let mnemonic = parse_mnemonic(TEST_MNEMONIC).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");
        let (_, address) = derive_solana_keypair(&seed, 0).unwrap();

        // Verify address is valid base58
        assert!(bs58::decode(&address).into_vec().is_ok());
        assert_eq!(bs58::decode(&address).into_vec().unwrap().len(), 32);
    }

    #[test]
    fn test_derive_ethereum() {
        let mnemonic = parse_mnemonic(TEST_MNEMONIC).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");
        let (_, address) = derive_ethereum_keypair(&seed, 0).unwrap();

        // Verify address format
        assert!(address.starts_with("0x"));
        assert_eq!(address.len(), 42);
    }

    #[test]
    fn test_derive_account() {
        let mnemonic = parse_mnemonic(TEST_MNEMONIC).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");

        let sol_account = derive_account(&seed, Chain::Solana, 0).unwrap();
        assert_eq!(sol_account.chain, Chain::Solana);
        assert_eq!(sol_account.derivation_index, 0);

        let eth_account = derive_account(&seed, Chain::Ethereum, 0).unwrap();
        assert_eq!(eth_account.chain, Chain::Ethereum);
        assert!(eth_account.address.starts_with("0x"));
    }

    #[test]
    fn test_deterministic_derivation() {
        let mnemonic = parse_mnemonic(TEST_MNEMONIC).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");

        let (_, addr1) = derive_solana_keypair(&seed, 0).unwrap();
        let (_, addr2) = derive_solana_keypair(&seed, 0).unwrap();
        assert_eq!(addr1, addr2);

        let (_, addr3) = derive_ethereum_keypair(&seed, 0).unwrap();
        let (_, addr4) = derive_ethereum_keypair(&seed, 0).unwrap();
        assert_eq!(addr3, addr4);
    }
    fn test_invalid_path_no_panic() {
        // These should return Err, not panic
        assert!(parse_derivation_path("").is_err());
        assert!(parse_derivation_path("m").is_err());
        assert!(parse_derivation_path("invalid").is_err());
        assert!(parse_derivation_path("m/invalid").is_err());
        // "m/" returns Ok with empty vector
        assert!(parse_derivation_path("m/").is_ok()); 
        
        // Edge cases that might panic
        assert!(parse_derivation_path("m//").is_err()); // empty component now errors
        assert!(parse_derivation_path("m/ ").is_err()); // parse error on " "
        
        // Unicode check (m/ + unicode)
        // ensure path[2..] doesn't panic
        assert!(parse_derivation_path("m/👍").is_err()); // "👍" cannot parse as u32
    }
}
