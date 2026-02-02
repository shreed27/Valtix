# Comprehensive Fixes and Improvements PR

## 1. Missing Database Indexes
**Problem**: Certain database queries were inefficient due to missing indexes, potentially causing slow lookups as data grows.
**Solution**: 
Added a migration file `003_add_indexes.sql` creating:
- `idx_accounts_chain_address`: Speeds up account lookups by chain and address.
- `idx_accounts_wallet_ordering`: Optimizes sorting account lists.
- `idx_tx_history_account_timestamp`: Improves transaction history fetch performance.

## 2. Race Condition in Database Reset
**Problem**: The `reset_database` function executed multiple independent SQL DELETE commands. If one failed or if a concurrent read happened, the database could be left in an inconsistent state.
**Solution**:
Modified `wallet-backend/src/storage/database.rs` to wrap all delete operations within a single SQL transaction.
- Using `tx = self.pool.begin().await?`
- All `DELETE` operations use `&mut *tx`.
- `tx.commit().await?` ensures atomicity.

## 3. Form Input Validation
**Problem**: The frontend allowed invalid inputs for sending funds and importing mnemonics, leading to failed transactions or corrupted wallet states.
**Solution**:
- **Send Page (`src/app/send/page.tsx`)**: Refactored to use `react-hook-form` + `zod`.
  - Validates recipient address format specifically for Solana (Base58) or Ethereum (Hex).
  - Ensures amount is a positive number and strictly less than available balance.
- **Setup Page (`src/app/setup/page.tsx`)**: Added `zod` validation.
  - Mnemonic import now verifies word count (12, 15, 18, 21, 24).
  - Password must be at least 8 characters.

## 4. Backend Build & Syntax Fixes
**Problem**: 
1. `cargo check` failed due to an unclosed brace in `wallet-backend/src/core/derivation.rs`.
2. `cargo check` failed due to system temporary directory permission errors (`os error 1`).

**Solution**:
- **Syntax**: Fixed the missing closing brace in `test_deterministic_derivation` test in `src/core/derivation.rs`.
- **Environment**: Verified the build by using a local temporary directory:
  ```bash
  mkdir -p wallet-backend/tmp_build
  export TMPDIR=$(pwd)/wallet-backend/tmp_build
  cd wallet-backend && cargo check
  ```
  This bypasses the system permission issue.

## Verification
- **Frontend**: `npx tsc --noEmit` checks passed.
- **Backend**: `cargo check` passed (with local TMPDIR).
- **Database**: New migration file added.

This PR ensures the application is more robust, secure, and performant.
