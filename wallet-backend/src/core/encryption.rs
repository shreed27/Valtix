//! Password-based encryption using Argon2id + ChaCha20-Poly1305
//!
//! Security model:
//! - Argon2id for key derivation (OWASP recommended parameters)
//! - ChaCha20-Poly1305 for authenticated encryption
//! - Random salt and nonce for each encryption

use argon2::{
    password_hash::SaltString, Algorithm, Argon2, Params, Version,
};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use rand::RngCore;
use thiserror::Error;
use zeroize::Zeroizing;

use super::{EncryptedSeed, SecureSeed};

/// Argon2id parameters (OWASP recommended)
const ARGON2_MEMORY_COST: u32 = 65536; // 64 MiB
const ARGON2_TIME_COST: u32 = 3;
const ARGON2_PARALLELISM: u32 = 4;
const ARGON2_OUTPUT_LEN: usize = 32;

#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: invalid password or corrupted data")]
    DecryptionFailed,
    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),
    #[error("Invalid data format")]
    InvalidFormat,
}

/// Encrypt a 64-byte seed with a password
pub fn encrypt_seed(seed: &SecureSeed, password: &str) -> Result<EncryptedSeed, EncryptionError> {
    // Generate random salt and nonce
    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce);

    // Derive encryption key using Argon2id
    let key = derive_key(password, &salt)?;

    // Encrypt with ChaCha20-Poly1305
    let cipher = ChaCha20Poly1305::new_from_slice(key.as_ref())
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    let nonce_obj = Nonce::from_slice(&nonce);
    let ciphertext = cipher
        .encrypt(nonce_obj, seed.as_ref())
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    Ok(EncryptedSeed {
        ciphertext,
        salt,
        nonce,
    })
}

/// Decrypt an encrypted seed with a password
pub fn decrypt_seed(
    encrypted: &EncryptedSeed,
    password: &str,
) -> Result<SecureSeed, EncryptionError> {
    // Derive decryption key
    let key = derive_key(password, &encrypted.salt)?;

    // Decrypt with ChaCha20-Poly1305
    let cipher = ChaCha20Poly1305::new_from_slice(key.as_ref())
        .map_err(|_| EncryptionError::DecryptionFailed)?;

    let nonce = Nonce::from_slice(&encrypted.nonce);
    let plaintext = cipher
        .decrypt(nonce, encrypted.ciphertext.as_ref())
        .map_err(|_| EncryptionError::DecryptionFailed)?;

    if plaintext.len() != 64 {
        return Err(EncryptionError::InvalidFormat);
    }

    let mut seed_bytes = [0u8; 64];
    seed_bytes.copy_from_slice(&plaintext);

    Ok(SecureSeed::new(seed_bytes))
}

/// Derive a 256-bit key from password using Argon2id
fn derive_key(password: &str, salt: &[u8; 16]) -> Result<Zeroizing<[u8; 32]>, EncryptionError> {
    let params = Params::new(
        ARGON2_MEMORY_COST,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(ARGON2_OUTPUT_LEN),
    )
    .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = Zeroizing::new([0u8; 32]);
    argon2
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;

    Ok(key)
}

/// Verify a password against an encrypted seed without fully decrypting
/// (Attempts decryption but discards result - useful for password validation)
pub fn verify_password(encrypted: &EncryptedSeed, password: &str) -> bool {
    decrypt_seed(encrypted, password).is_ok()
}

/// Generate a secure random password (for testing or suggestions)
pub fn generate_random_password(length: usize) -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let mut password = String::with_capacity(length);
    let mut rng = rand::thread_rng();

    for _ in 0..length {
        let idx = (rng.next_u32() as usize) % CHARSET.len();
        password.push(CHARSET[idx] as char);
    }

    password
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::seed::{generate_mnemonic, mnemonic_to_seed};

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let mnemonic = generate_mnemonic().unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");
        let password = "test_password_123";

        let encrypted = encrypt_seed(&seed, password).unwrap();
        let decrypted = decrypt_seed(&encrypted, password).unwrap();

        assert_eq!(seed.as_bytes(), decrypted.as_bytes());
    }

    #[test]
    fn test_wrong_password_fails() {
        let mnemonic = generate_mnemonic().unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");
        let password = "correct_password";
        let wrong_password = "wrong_password";

        let encrypted = encrypt_seed(&seed, password).unwrap();
        let result = decrypt_seed(&encrypted, wrong_password);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), EncryptionError::DecryptionFailed));
    }

    #[test]
    fn test_verify_password() {
        let mnemonic = generate_mnemonic().unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");
        let password = "test_password";

        let encrypted = encrypt_seed(&seed, password).unwrap();

        assert!(verify_password(&encrypted, password));
        assert!(!verify_password(&encrypted, "wrong"));
    }

    #[test]
    fn test_unique_salt_and_nonce() {
        let mnemonic = generate_mnemonic().unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");
        let password = "same_password";

        let encrypted1 = encrypt_seed(&seed, password).unwrap();
        let encrypted2 = encrypt_seed(&seed, password).unwrap();

        // Salt and nonce should be different each time
        assert_ne!(encrypted1.salt, encrypted2.salt);
        assert_ne!(encrypted1.nonce, encrypted2.nonce);
        // Ciphertext should also differ due to different nonce
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext);
    }

    #[test]
    fn test_generate_random_password() {
        let password = generate_random_password(32);
        assert_eq!(password.len(), 32);

        // Should be different each time
        let password2 = generate_random_password(32);
        assert_ne!(password, password2);
    }
}
