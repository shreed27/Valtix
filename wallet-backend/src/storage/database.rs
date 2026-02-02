//! Database operations using SQLx

use sqlx::{Pool, Sqlite};
use thiserror::Error;

use super::models::*;

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("Database error: {0}")]
    SqlxError(#[from] sqlx::Error),
    #[error("Record not found")]
    NotFound,
    #[error("Record already exists")]
    AlreadyExists,
}

/// Database wrapper with connection pool
#[derive(Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    // ==================== Wallet Operations ====================

    pub async fn create_wallet(&self, wallet: &WalletRow) -> Result<(), DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO wallets (id, encrypted_seed, salt, nonce, created_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&wallet.id)
        .bind(&wallet.encrypted_seed)
        .bind(&wallet.salt)
        .bind(&wallet.nonce)
        .bind(&wallet.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_wallet(&self, id: &str) -> Result<WalletRow, DatabaseError> {
        sqlx::query_as::<_, WalletRow>("SELECT * FROM wallets WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(DatabaseError::NotFound)
    }

    pub async fn get_primary_wallet(&self) -> Result<Option<WalletRow>, DatabaseError> {
        Ok(
            sqlx::query_as::<_, WalletRow>("SELECT * FROM wallets ORDER BY created_at ASC LIMIT 1")
                .fetch_optional(&self.pool)
                .await?,
        )
    }

    pub async fn wallet_exists(&self) -> Result<bool, DatabaseError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM wallets")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0 > 0)
    }

    // ==================== Account Operations ====================

    pub async fn create_account(&self, account: &AccountRow) -> Result<(), DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO accounts (id, wallet_id, name, chain, derivation_path, derivation_index, public_key, address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&account.id)
        .bind(&account.wallet_id)
        .bind(&account.name)
        .bind(&account.chain)
        .bind(&account.derivation_path)
        .bind(account.derivation_index)
        .bind(&account.public_key)
        .bind(&account.address)
        .bind(&account.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_accounts(&self, wallet_id: &str) -> Result<Vec<AccountRow>, DatabaseError> {
        Ok(sqlx::query_as::<_, AccountRow>(
            "SELECT * FROM accounts WHERE wallet_id = ? ORDER BY chain, derivation_index",
        )
        .bind(wallet_id)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn get_account(&self, id: &str) -> Result<AccountRow, DatabaseError> {
        sqlx::query_as::<_, AccountRow>("SELECT * FROM accounts WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(DatabaseError::NotFound)
    }

    pub async fn get_account_by_address(
        &self,
        chain: &str,
        address: &str,
    ) -> Result<AccountRow, DatabaseError> {
        sqlx::query_as::<_, AccountRow>(
            "SELECT * FROM accounts WHERE chain = ? AND address = ?",
        )
        .bind(chain)
        .bind(address)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(DatabaseError::NotFound)
    }

    pub async fn get_next_derivation_index(
        &self,
        wallet_id: &str,
        chain: &str,
    ) -> Result<u32, DatabaseError> {
        let result: Option<(Option<i64>,)> = sqlx::query_as(
            "SELECT MAX(derivation_index) FROM accounts WHERE wallet_id = ? AND chain = ?",
        )
        .bind(wallet_id)
        .bind(chain)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.and_then(|r| r.0.map(|i| (i + 1) as u32)).unwrap_or(0))
    }

    pub async fn delete_account(&self, id: &str) -> Result<(), DatabaseError> {
        tracing::debug!("Deleting account from database: {}", id);

        // Delete related data first to avoid FK constraint violations
        // Use unwrap_or_default to handle cases where tables might not have data
        let _ = sqlx::query("DELETE FROM transaction_history WHERE account_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| tracing::warn!("Error deleting transaction_history for account {}: {}", id, e));

        let _ = sqlx::query("DELETE FROM nft_cache WHERE account_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| tracing::warn!("Error deleting nft_cache for account {}: {}", id, e));

        // Finally delete the account - this one must succeed
        let result = sqlx::query("DELETE FROM accounts WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            tracing::warn!("No account found with id: {}", id);
            return Err(DatabaseError::NotFound);
        }

        tracing::debug!("Successfully deleted account: {}", id);
        Ok(())
    }

    // ==================== Contact Operations ====================

    pub async fn create_contact(&self, contact: &ContactRow) -> Result<(), DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO contacts (id, wallet_id, name, chain, address, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&contact.id)
        .bind(&contact.wallet_id)
        .bind(&contact.name)
        .bind(&contact.chain)
        .bind(&contact.address)
        .bind(&contact.notes)
        .bind(&contact.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_contacts(&self, wallet_id: &str) -> Result<Vec<ContactRow>, DatabaseError> {
        Ok(
            sqlx::query_as::<_, ContactRow>(
                "SELECT * FROM contacts WHERE wallet_id = ? ORDER BY name",
            )
            .bind(wallet_id)
            .fetch_all(&self.pool)
            .await?,
        )
    }

    pub async fn get_contact(&self, id: &str) -> Result<ContactRow, DatabaseError> {
        sqlx::query_as::<_, ContactRow>("SELECT * FROM contacts WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(DatabaseError::NotFound)
    }

    pub async fn update_contact(
        &self,
        id: &str,
        name: &str,
        notes: Option<&str>,
    ) -> Result<(), DatabaseError> {
        sqlx::query("UPDATE contacts SET name = ?, notes = ? WHERE id = ?")
            .bind(name)
            .bind(notes)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_contact(&self, id: &str) -> Result<(), DatabaseError> {
        sqlx::query("DELETE FROM contacts WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ==================== Transaction History Operations ====================

    pub async fn upsert_transaction(&self, tx: &TransactionRow) -> Result<(), DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO transaction_history
            (id, account_id, chain, signature, tx_type, from_address, to_address, amount, token_address, status, block_number, timestamp, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(chain, signature) DO UPDATE SET
                status = excluded.status,
                block_number = excluded.block_number
            "#,
        )
        .bind(&tx.id)
        .bind(&tx.account_id)
        .bind(&tx.chain)
        .bind(&tx.signature)
        .bind(&tx.tx_type)
        .bind(&tx.from_address)
        .bind(&tx.to_address)
        .bind(&tx.amount)
        .bind(&tx.token_address)
        .bind(&tx.status)
        .bind(tx.block_number)
        .bind(&tx.timestamp)
        .bind(&tx.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_transactions(
        &self,
        account_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TransactionRow>, DatabaseError> {
        Ok(sqlx::query_as::<_, TransactionRow>(
            "SELECT * FROM transaction_history WHERE account_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
        )
        .bind(account_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?)
    }

    // ==================== Multi-sig Operations ====================

    pub async fn create_multisig(&self, multisig: &MultisigWalletRow) -> Result<(), DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO multisig_wallets (id, wallet_id, name, chain, address, threshold, owner_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&multisig.id)
        .bind(&multisig.wallet_id)
        .bind(&multisig.name)
        .bind(&multisig.chain)
        .bind(&multisig.address)
        .bind(multisig.threshold)
        .bind(multisig.owner_count)
        .bind(&multisig.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn add_multisig_owner(&self, owner: &MultisigOwnerRow) -> Result<(), DatabaseError> {
        sqlx::query(
            "INSERT INTO multisig_owners (id, multisig_id, owner_address, owner_name) VALUES (?, ?, ?, ?)",
        )
        .bind(&owner.id)
        .bind(&owner.multisig_id)
        .bind(&owner.owner_address)
        .bind(&owner.owner_name)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_multisig_wallets(
        &self,
        wallet_id: &str,
    ) -> Result<Vec<MultisigWalletRow>, DatabaseError> {
        Ok(sqlx::query_as::<_, MultisigWalletRow>(
            "SELECT * FROM multisig_wallets WHERE wallet_id = ? ORDER BY created_at DESC",
        )
        .bind(wallet_id)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn get_multisig(&self, id: &str) -> Result<MultisigWalletRow, DatabaseError> {
        sqlx::query_as::<_, MultisigWalletRow>("SELECT * FROM multisig_wallets WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(DatabaseError::NotFound)
    }

    pub async fn get_multisig_owners(
        &self,
        multisig_id: &str,
    ) -> Result<Vec<MultisigOwnerRow>, DatabaseError> {
        Ok(sqlx::query_as::<_, MultisigOwnerRow>(
            "SELECT * FROM multisig_owners WHERE multisig_id = ?",
        )
        .bind(multisig_id)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn create_multisig_tx(
        &self,
        tx: &MultisigTransactionRow,
    ) -> Result<(), DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO multisig_transactions (id, multisig_id, to_address, amount, data, approvals, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&tx.id)
        .bind(&tx.multisig_id)
        .bind(&tx.to_address)
        .bind(&tx.amount)
        .bind(&tx.data)
        .bind(&tx.approvals)
        .bind(&tx.status)
        .bind(&tx.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_multisig_transactions(
        &self,
        multisig_id: &str,
    ) -> Result<Vec<MultisigTransactionRow>, DatabaseError> {
        Ok(sqlx::query_as::<_, MultisigTransactionRow>(
            "SELECT * FROM multisig_transactions WHERE multisig_id = ? ORDER BY created_at DESC",
        )
        .bind(multisig_id)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn get_multisig_tx(&self, id: &str) -> Result<MultisigTransactionRow, DatabaseError> {
        sqlx::query_as::<_, MultisigTransactionRow>(
            "SELECT * FROM multisig_transactions WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(DatabaseError::NotFound)
    }

    pub async fn update_multisig_tx(
        &self,
        id: &str,
        approvals: &str,
        status: &str,
    ) -> Result<(), DatabaseError> {
        sqlx::query("UPDATE multisig_transactions SET approvals = ?, status = ? WHERE id = ?")
            .bind(approvals)
            .bind(status)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn mark_multisig_tx_executed(&self, id: &str) -> Result<(), DatabaseError> {
        sqlx::query(
            "UPDATE multisig_transactions SET status = 'executed', executed_at = datetime('now') WHERE id = ?",
        )
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // ==================== NFT Cache Operations ====================

    pub async fn upsert_nft(&self, nft: &NftCacheRow) -> Result<(), DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO nft_cache (id, account_id, chain, token_address, token_id, name, description, image_url, metadata_json, collection_name, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(chain, token_address, token_id, account_id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                image_url = excluded.image_url,
                metadata_json = excluded.metadata_json,
                collection_name = excluded.collection_name,
                last_updated = excluded.last_updated
            "#,
        )
        .bind(&nft.id)
        .bind(&nft.account_id)
        .bind(&nft.chain)
        .bind(&nft.token_address)
        .bind(&nft.token_id)
        .bind(&nft.name)
        .bind(&nft.description)
        .bind(&nft.image_url)
        .bind(&nft.metadata_json)
        .bind(&nft.collection_name)
        .bind(&nft.last_updated)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_nfts(&self, account_id: &str) -> Result<Vec<NftCacheRow>, DatabaseError> {
        Ok(
            sqlx::query_as::<_, NftCacheRow>("SELECT * FROM nft_cache WHERE account_id = ?")
                .bind(account_id)
                .fetch_all(&self.pool)
                .await?,
        )
    }

    pub async fn get_nft(
        &self,
        chain: &str,
        token_address: &str,
        token_id: &str,
    ) -> Result<NftCacheRow, DatabaseError> {
        sqlx::query_as::<_, NftCacheRow>(
            "SELECT * FROM nft_cache WHERE chain = ? AND token_address = ? AND token_id = ?",
        )
        .bind(chain)
        .bind(token_address)
        .bind(token_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(DatabaseError::NotFound)
    }

    pub async fn delete_nft(&self, account_id: &str, chain: &str, token_address: &str, token_id: &str) -> Result<(), DatabaseError> {
        sqlx::query(
            "DELETE FROM nft_cache WHERE account_id = ? AND chain = ? AND token_address = ? AND token_id = ?",
        )
        .bind(account_id)
        .bind(chain)
        .bind(token_address)
        .bind(token_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn reset_database(&self) -> Result<(), DatabaseError> {
        tracing::info!("Starting database reset...");

        let mut tx = self.pool.begin().await?;

        // Delete in order to respect foreign keys
        // 1. Clear cache and history data first (these reference accounts)
        tracing::debug!("Clearing transaction history...");
        sqlx::query("DELETE FROM transaction_history")
            .execute(&mut *tx)
            .await?;

        tracing::debug!("Clearing NFT cache...");
        sqlx::query("DELETE FROM nft_cache")
            .execute(&mut *tx)
            .await?;

        // 2. Clear Application Data
        tracing::debug!("Clearing accounts...");
        sqlx::query("DELETE FROM accounts")
            .execute(&mut *tx)
            .await?;

        tracing::debug!("Clearing contacts...");
        sqlx::query("DELETE FROM contacts")
            .execute(&mut *tx)
            .await?;

        // 3. Clear Multisig Data (these tables might not exist in all schemas but should in production)
        tracing::debug!("Clearing multisig data...");
        // valid tables from migration 001
        sqlx::query("DELETE FROM multisig_owners")
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM multisig_transactions")
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM multisig_wallets")
            .execute(&mut *tx)
            .await?;

        // 4. Clear Core Wallet Data
        tracing::debug!("Clearing wallets...");
        sqlx::query("DELETE FROM wallets")
            .execute(&mut *tx)
            .await?;

        // Commit the transaction
        tx.commit().await?;

        tracing::info!("Database reset complete");
        Ok(())
    }
}
