//! API route definitions

use std::sync::Arc;

use axum::{
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Router,
};

use crate::AppState;
use crate::api;

use super::handlers::{
    accounts, auth, balance, contacts, multisig, nft, swap, transaction, user_auth,
};
use super::middleware::auth::{require_auth, require_auth_and_unlocked};

/// Create all API routes
pub fn create_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Public routes - no authentication required
    let public_routes = Router::new()
        // User authentication
        .route("/users/register", post(user_auth::register))
        .route("/users/login", post(user_auth::login))
        .route("/users/refresh", post(user_auth::refresh_token))
        // Legacy wallet auth (for backwards compatibility)
        .route("/auth/status", get(auth::status))
        // Public balance queries (read-only, no auth needed)
        .route("/balances/:chain/:address", get(balance::get_balance))
        .route("/tokens/:chain/:address", get(balance::get_tokens))
        // Public NFT queries
        .route("/nfts/:chain/:address", get(nft::list_nfts))
        .route("/nfts/:chain/:address/:id", get(nft::get_nft))
        // Swap quotes (read-only)
        .route("/swap/quote", get(swap::get_quote))
        // Wallet management - PUBLIC (init/auth)
        .route("/auth/unlock", post(auth::unlock))
        .route("/auth/lock", post(auth::lock))
        .route("/auth/reset", post(auth::reset))
        .route("/wallet/create", post(auth::create_wallet))
        .route("/wallet/import", post(auth::import_wallet))
        // Accounts
        .route("/accounts", get(accounts::list_accounts))
        .route("/accounts", post(accounts::create_account))
        .route("/accounts/:id", delete(accounts::delete_account))
        // Address Book
        .route("/contacts", get(contacts::list_contacts))
        .route("/contacts", post(contacts::create_contact))
        .route("/contacts/:id", get(contacts::get_contact))
        .route("/contacts/:id", post(contacts::update_contact))
        .route("/contacts/:id/delete", post(contacts::delete_contact))
        .route("/qr/:chain/:address", get(contacts::generate_qr))
        // Multi-sig
        .route("/multisig", get(multisig::list_multisigs))
        .route("/multisig/create", post(multisig::create_multisig))
        .route("/multisig/:id", get(multisig::get_multisig))
        .route(
            "/multisig/:id/transactions",
            get(multisig::get_transactions),
        );

    // Protected routes - require JWT authentication
    let auth_routes = Router::new()
        // User profile
        .route("/users/me", get(user_auth::me))
        .route("/users/logout", post(user_auth::logout))
        .route("/users/logout-all", post(user_auth::logout_all))
        .route("/users/change-password", post(user_auth::change_password))
        .layer(from_fn_with_state(state.clone(), require_auth));

    // Protected routes that also require wallet to be unlocked
    let wallet_routes = Router::new()
        // Transactions (requires signing)
        .route("/transactions/send", post(transaction::send))
        .route(
            "/transactions/:chain/:address",
            get(transaction::get_history),
        )
        // Swap execution (requires signing)
        .route("/swap/execute", post(swap::execute_swap))
        // Multi-sig operations
        .route("/multisig/:id/propose", post(multisig::propose_transaction))
        .route(
            "/multisig/:id/approve/:tx_id",
            post(multisig::approve_transaction),
        )
        .route(
            "/multisig/:id/execute/:tx_id",
            post(multisig::execute_transaction),
        )
        .layer(from_fn_with_state(state.clone(), require_auth_and_unlocked));

    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(auth_routes)
        .merge(wallet_routes)
        .layer(axum::middleware::from_fn(api::middleware::rate_limit::rate_limit_middleware))
}
