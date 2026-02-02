-- Add missing indexes for performance optimization

-- Composite index for account lookups by chain and address
CREATE INDEX IF NOT EXISTS idx_accounts_chain_address ON accounts(chain, address);

-- Composite index for efficient ordering of account list 
CREATE INDEX IF NOT EXISTS idx_accounts_wallet_ordering ON accounts(wallet_id, chain, derivation_index);

-- Composite index for transaction history filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tx_history_account_timestamp ON transaction_history(account_id, timestamp DESC);
