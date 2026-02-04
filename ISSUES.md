# Valtix Wallet - Issue Tracker

This document lists all the critical, high, and medium priority issues identified in the codebase.

## Phase 1: Critical Fixes (Must Fix)
- [x] **`is_unlocked()` Always Returns False:** The wallet state check is broken and almost always reports the wallet as locked.
- [x] **Ethereum Transactions Return Fake Hashes:** Users are shown a fake transaction hash, but no transaction is actually sent.
- [x] **Mobile Navigation Hidden:** The main application navigation is not visible on mobile devices, making it unusable.
- [x] **No Address Validation Before Send:** Users can send funds to invalid addresses, resulting in permanent loss of funds.
- [x] **Default JWT Secret in Code:** A hardcoded JWT secret allows anyone to forge authentication tokens.

## Phase 2: Security & Stability (High Priority)
- [x] **Panic on Invalid Derivation Path:** The backend panics and crashes if an invalid derivation path is used.
- [x] **Panic on Network Errors:** The backend panics when encountering unexpected data from external APIs (e.g., Solana NFT metadata).
- [x] **Insecure Mnemonic Storage:** The 12-word recovery phrase is stored in plaintext in `localStorage`, making it vulnerable to theft.
- [x] **Missing CSRF Protection:** The application is vulnerable to Cross-Site Request Forgery attacks.
- [x] **No API Rate Limiting:** The backend is vulnerable to brute-force and denial-of-service attacks.
- [x] **Unencrypted Seed Phrase in Memory:** The seed phrase is held in memory unencrypted, posing a security risk.
- [x] **Incomplete Ethereum Transaction History:** The app does not display any transaction history for Ethereum accounts.
- [x] **Race Condition in Account Creation:** The frontend can enter a broken state where a wallet is created but the first account is not.
- [x] **Poor API Error Handling:** Frontend does not interpret backend errors correctly, showing generic failure messages to the user.
- [x] **Major Accessibility Gaps:** The application is not accessible to users with disabilities (missing ARIA labels, no focus management).

## Phase 3: UX & Enhancements (Medium Priority)
- [x] **Missing Database Indexes:** Certain database queries are inefficient due to missing indexes.
- [x] **Race Condition in Database Reset:** The database reset logic can fail and leave the DB in a corrupt state.
- [x] **No Form Input Validation:** Forms for sending funds or importing mnemonics lack proper validation.
- [x] **No Transaction Fee Display:** Users are not shown the estimated network fee before sending a transaction.
- [x] **No Balance Display on Dashboard:** The main dashboard does not show the balance for each account.
- [x] **Missing Settings Page:** There is no interface for users to change their password, export their wallet, or manage preferences.
- [x] **No Transaction History Pagination:** The app tries to load the entire transaction history at once, which is inefficient.
- [x] **Unoptimized NFT Image Loading:** NFT images are not optimized, leading to slow load times.
