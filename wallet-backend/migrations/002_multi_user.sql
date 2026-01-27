-- Multi-user support migration

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    email_verified INTEGER NOT NULL DEFAULT 0
);

-- User sessions for JWT refresh tokens
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);

-- Add user_id to wallets table
ALTER TABLE wallets ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE wallets ADD COLUMN name TEXT NOT NULL DEFAULT 'My Wallet';
ALTER TABLE wallets ADD COLUMN wallet_type TEXT NOT NULL DEFAULT 'software'
    CHECK (wallet_type IN ('software', 'ledger', 'imported'));
ALTER TABLE wallets ADD COLUMN ledger_device_id TEXT;

-- Add user_id to contacts for user-level address book
ALTER TABLE contacts ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '["read"]',
    last_used_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Connected dApps tracking
CREATE TABLE IF NOT EXISTS connected_dapps (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    origin TEXT NOT NULL,
    name TEXT,
    icon_url TEXT,
    permissions TEXT NOT NULL DEFAULT '["sign_transaction"]',
    connected_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    UNIQUE(wallet_id, origin)
);

-- Indexes for multi-user queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_dapps_user ON connected_dapps(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_dapps_wallet ON connected_dapps(wallet_id);
