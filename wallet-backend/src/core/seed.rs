//! BIP39 seed phrase generation and handling

use bip39::{Language, Mnemonic};
use thiserror::Error;

use super::SecureSeed;

#[derive(Debug, Error)]
pub enum SeedError {
    #[error("Invalid mnemonic phrase: {0}")]
    InvalidMnemonic(String),
    #[error("Failed to generate entropy")]
    EntropyError,
}

/// Generate a new 24-word BIP39 mnemonic phrase
pub fn generate_mnemonic() -> Result<Mnemonic, SeedError> {
    // Generate 256 bits of entropy for 24 words
    let mut entropy = [0u8; 32];
    getrandom::getrandom(&mut entropy).map_err(|_| SeedError::EntropyError)?;

    Mnemonic::from_entropy(&entropy)
        .map_err(|e| SeedError::InvalidMnemonic(e.to_string()))
}

/// Parse a mnemonic phrase from string
pub fn parse_mnemonic(phrase: &str) -> Result<Mnemonic, SeedError> {
    Mnemonic::parse_in_normalized(Language::English, phrase)
        .map_err(|e| SeedError::InvalidMnemonic(e.to_string()))
}

/// Convert mnemonic to 64-byte seed using optional passphrase
pub fn mnemonic_to_seed(mnemonic: &Mnemonic, passphrase: &str) -> SecureSeed {
    let seed_bytes = mnemonic.to_seed(passphrase);
    SecureSeed::new(seed_bytes)
}

/// Validate a mnemonic phrase
pub fn validate_mnemonic(phrase: &str) -> bool {
    Mnemonic::parse_in_normalized(Language::English, phrase).is_ok()
}

/// Get the word list for BIP39
pub fn get_wordlist() -> Vec<&'static str> {
    Language::English.word_list().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_mnemonic() {
        let mnemonic = generate_mnemonic().unwrap();
        let words: Vec<&str> = mnemonic.word_iter().collect();
        assert_eq!(words.len(), 24);
    }

    #[test]
    fn test_parse_mnemonic() {
        let test_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
        let mnemonic = parse_mnemonic(test_phrase).unwrap();
        assert!(mnemonic.word_iter().count() == 24);
    }

    #[test]
    fn test_mnemonic_to_seed() {
        let test_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
        let mnemonic = parse_mnemonic(test_phrase).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, "");
        assert_eq!(seed.as_bytes().len(), 64);
    }

    #[test]
    fn test_validate_mnemonic() {
        let valid = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let invalid = "invalid mnemonic phrase";

        assert!(validate_mnemonic(valid));
        assert!(!validate_mnemonic(invalid));
    }
}
