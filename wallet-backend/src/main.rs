//! Multi-Chain Cryptocurrency Wallet Backend
//!
//! A production-grade wallet supporting Solana and Ethereum with:
//! - HD wallet derivation (BIP39/BIP44)
//! - Secure seed encryption (Argon2id + ChaCha20-Poly1305)
//! - Transaction history, NFT gallery, address book
//! - Multi-signature wallet support
//! - Multi-user authentication with JWT

mod api;
mod chains;
mod core;
mod services;
mod storage;

use std::{net::SocketAddr, sync::Arc, time::Duration};

use axum::Router;
use sqlx::sqlite::SqlitePoolOptions;
use tokio::sync::RwLock;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::services::user_service::UserService;
use crate::storage::database::Database;

pub struct AppState {
    /// Database connection pool
    pub db: Database,
    /// User authentication service
    pub user_service: UserService,
    /// Encrypted seed in memory (encrypted with session_key)
    pub unlocked_seed: RwLock<Option<Vec<u8>>>,
    /// Ephemeral session key for memory encryption
    pub session_key: [u8; 32],
    /// Solana RPC URL
    pub solana_rpc_url: String,
    /// Ethereum RPC URL
    pub eth_rpc_url: String,
}



#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "wallet_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./wallet.db?mode=rwc".to_string());
    let solana_rpc_url = std::env::var("SOLANA_RPC_URL")
        .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());
    let eth_rpc_url = std::env::var("ETH_RPC_URL")
        .unwrap_or_else(|_| "https://ethereum-sepolia-rpc.publicnode.com".to_string());
    let cors_origins_str = std::env::var("CORS_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:3000,https://valtix.vercel.app".to_string());
    
    let cors_origins: Vec<axum::http::HeaderValue> = cors_origins_str
        .split(',')
        .map(|s| s.trim().parse::<axum::http::HeaderValue>().unwrap())
        .collect();

    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    // Create database connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&database_url)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    tracing::info!("Database migrations completed");

    // Create user service
    let user_service = UserService::new(pool.clone(), jwt_secret);

    // Generate ephemeral session key
    let mut session_key = [0u8; 32];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut session_key);

    // Create application state
    let state = Arc::new(AppState {
        db: Database::new(pool),
        user_service,
        unlocked_seed: RwLock::new(None),
        session_key,
        solana_rpc_url,
        eth_rpc_url,
    });

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(cors_origins)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::COOKIE,
        ])
        .allow_credentials(true);

    // Build router
    let app = Router::new()
        .nest("/api/v1", api::routes::create_routes(state.clone()))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start server
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid number");
        
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
