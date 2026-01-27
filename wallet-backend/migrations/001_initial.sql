-- Initial schema for multi-chain wallet

-- Encrypted wallet seed
CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    encrypted_seed BLOB NOT NULL,
    salt BLOB NOT NULL,
    nonce BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Derived accounts (Solana + Ethereum)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    chain TEXT NOT NULL CHECK (chain IN ('solana', 'ethereum')),
    derivation_path TEXT NOT NULL,
    derivation_index INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(wallet_id, chain, derivation_index)
);

-- Address book
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    chain TEXT NOT NULL CHECK (chain IN ('solana', 'ethereum')),
    address TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(wallet_id, chain, address)
);

-- Transaction history cache
CREATE TABLE IF NOT EXISTS transaction_history (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain TEXT NOT NULL CHECK (chain IN ('solana', 'ethereum')),
    signature TEXT NOT NULL,
    tx_type TEXT NOT NULL CHECK (tx_type IN ('send', 'receive', 'swap', 'nft_transfer', 'contract_interaction', 'unknown')),
    from_address TEXT,
    to_address TEXT,
    amount TEXT,
    token_address TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
    block_number INTEGER,
    timestamp TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(chain, signature)
);

-- Multi-sig wallets
CREATE TABLE IF NOT EXISTS multisig_wallets (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    chain TEXT NOT NULL CHECK (chain IN ('solana', 'ethereum')),
    address TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    owner_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(chain, address)
);

-- Multi-sig owners
CREATE TABLE IF NOT EXISTS multisig_owners (
    id TEXT PRIMARY KEY,
    multisig_id TEXT NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
    owner_address TEXT NOT NULL,
    owner_name TEXT,
    UNIQUE(multisig_id, owner_address)
);

-- Pending multi-sig transactions
CREATE TABLE IF NOT EXISTS multisig_transactions (
    id TEXT PRIMARY KEY,
    multisig_id TEXT NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
    to_address TEXT NOT NULL,
    amount TEXT,
    data TEXT,
    approvals TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'executed', 'cancelled')) DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    executed_at TEXT
);

-- NFT cache
CREATE TABLE IF NOT EXISTS nft_cache (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain TEXT NOT NULL CHECK (chain IN ('solana', 'ethereum')),
    token_address TEXT NOT NULL,
    token_id TEXT NOT NULL,
    name TEXT,
    description TEXT,
    image_url TEXT,
    metadata_json TEXT,
    collection_name TEXT,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(chain, token_address, token_id, account_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_accounts_wallet ON accounts(wallet_id);
CREATE INDEX IF NOT EXISTS idx_accounts_address ON accounts(address);
CREATE INDEX IF NOT EXISTS idx_contacts_wallet ON contacts(wallet_id);
CREATE INDEX IF NOT EXISTS idx_tx_history_account ON transaction_history(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_history_timestamp ON transaction_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_multisig_wallet ON multisig_wallets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_nft_account ON nft_cache(account_id);
