//! User authentication and management service

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use thiserror::Error;
use uuid::Uuid;

use crate::storage::models::{
    CreateUserRequest, LoginRequest, LoginResponse, RefreshTokenResponse, User, UserPublic,
    UserSession,
};

#[derive(Debug, Error)]
pub enum UserServiceError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("User already exists")]
    UserAlreadyExists,
    #[error("User not found")]
    UserNotFound,
    #[error("Invalid token")]
    InvalidToken,
    #[error("Token expired")]
    TokenExpired,
    #[error("Session revoked")]
    SessionRevoked,
    #[error("Password hashing error")]
    PasswordHash,
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // user_id
    pub email: String,
    pub session_id: String,
    pub exp: usize,         // expiration timestamp
    pub iat: usize,         // issued at
}

pub struct UserService {
    pool: SqlitePool,
    jwt_secret: String,
    access_token_expiry: Duration,
    refresh_token_expiry: Duration,
}

impl UserService {
    pub fn new(pool: SqlitePool, jwt_secret: String) -> Self {
        Self {
            pool,
            jwt_secret,
            access_token_expiry: Duration::minutes(15),
            refresh_token_expiry: Duration::days(7),
        }
    }

    pub async fn register(&self, req: CreateUserRequest) -> Result<UserPublic, UserServiceError> {
        // Check if user already exists
        let existing: Option<User> = sqlx::query_as(
            "SELECT * FROM users WHERE email = ? LIMIT 1"
        )
        .bind(&req.email.to_lowercase())
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(UserServiceError::UserAlreadyExists);
        }

        // Hash password with Argon2id
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(req.password.as_bytes(), &salt)
            .map_err(|_| UserServiceError::PasswordHash)?
            .to_string();

        let user_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO users (id, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&user_id)
        .bind(&req.email.to_lowercase())
        .bind(&password_hash)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(UserPublic {
            id: user_id,
            email: req.email.to_lowercase(),
            created_at: now,
            email_verified: false,
        })
    }

    pub async fn login(
        &self,
        req: LoginRequest,
        device_info: Option<String>,
        ip_address: Option<String>,
    ) -> Result<(LoginResponse, String), UserServiceError> {
        // Find user by email
        let user: User = sqlx::query_as("SELECT * FROM users WHERE email = ? AND is_active = 1")
            .bind(&req.email.to_lowercase())
            .fetch_optional(&self.pool)
            .await?
            .ok_or(UserServiceError::InvalidCredentials)?;

        // Verify password
        let parsed_hash =
            PasswordHash::new(&user.password_hash).map_err(|_| UserServiceError::PasswordHash)?;
        Argon2::default()
            .verify_password(req.password.as_bytes(), &parsed_hash)
            .map_err(|_| UserServiceError::InvalidCredentials)?;

        // Create session
        let session_id = Uuid::new_v4().to_string();
        let refresh_token = Uuid::new_v4().to_string();
        let refresh_token_hash = self.hash_token(&refresh_token);
        let now = Utc::now();
        let expires_at = now + self.refresh_token_expiry;

        sqlx::query(
            r#"
            INSERT INTO user_sessions (id, user_id, refresh_token_hash, device_info, ip_address, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&session_id)
        .bind(&user.id)
        .bind(&refresh_token_hash)
        .bind(&device_info)
        .bind(&ip_address)
        .bind(now.to_rfc3339())
        .bind(expires_at.to_rfc3339())
        .execute(&self.pool)
        .await?;

        // Update last login
        sqlx::query("UPDATE users SET last_login_at = ? WHERE id = ?")
            .bind(now.to_rfc3339())
            .bind(&user.id)
            .execute(&self.pool)
            .await?;

        // Generate access token
        let access_token = self.generate_access_token(&user, &session_id)?;

        Ok((
            LoginResponse {
                access_token,
                token_type: "Bearer".to_string(),
                expires_in: self.access_token_expiry.num_seconds(),
                user: user.into(),
            },
            refresh_token,
        ))
    }

    pub async fn refresh_token(
        &self,
        refresh_token: &str,
    ) -> Result<RefreshTokenResponse, UserServiceError> {
        let refresh_token_hash = self.hash_token(refresh_token);

        // Find session
        let session: UserSession = sqlx::query_as(
            "SELECT * FROM user_sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL",
        )
        .bind(&refresh_token_hash)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(UserServiceError::InvalidToken)?;

        // Check if expired
        let expires_at = chrono::DateTime::parse_from_rfc3339(&session.expires_at)
            .map_err(|_| UserServiceError::InvalidToken)?;
        if Utc::now() > expires_at {
            return Err(UserServiceError::TokenExpired);
        }

        // Get user
        let user: User = sqlx::query_as("SELECT * FROM users WHERE id = ? AND is_active = 1")
            .bind(&session.user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(UserServiceError::UserNotFound)?;

        // Generate new access token
        let access_token = self.generate_access_token(&user, &session.id)?;

        Ok(RefreshTokenResponse {
            access_token,
            token_type: "Bearer".to_string(),
            expires_in: self.access_token_expiry.num_seconds(),
        })
    }

    pub async fn logout(&self, session_id: &str) -> Result<(), UserServiceError> {
        sqlx::query("UPDATE user_sessions SET revoked_at = ? WHERE id = ?")
            .bind(Utc::now().to_rfc3339())
            .bind(session_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn logout_all(&self, user_id: &str) -> Result<(), UserServiceError> {
        sqlx::query("UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
            .bind(Utc::now().to_rfc3339())
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_user(&self, user_id: &str) -> Result<UserPublic, UserServiceError> {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(UserServiceError::UserNotFound)?;
        Ok(user.into())
    }

    pub async fn change_password(
        &self,
        user_id: &str,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), UserServiceError> {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(UserServiceError::UserNotFound)?;

        // Verify current password
        let parsed_hash =
            PasswordHash::new(&user.password_hash).map_err(|_| UserServiceError::PasswordHash)?;
        Argon2::default()
            .verify_password(current_password.as_bytes(), &parsed_hash)
            .map_err(|_| UserServiceError::InvalidCredentials)?;

        // Hash new password
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let new_password_hash = argon2
            .hash_password(new_password.as_bytes(), &salt)
            .map_err(|_| UserServiceError::PasswordHash)?
            .to_string();

        // Update password
        sqlx::query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
            .bind(&new_password_hash)
            .bind(Utc::now().to_rfc3339())
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        // Revoke all sessions
        self.logout_all(user_id).await?;

        Ok(())
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, UserServiceError> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &Validation::default(),
        )?;
        Ok(token_data.claims)
    }

    fn generate_access_token(
        &self,
        user: &User,
        session_id: &str,
    ) -> Result<String, UserServiceError> {
        let now = Utc::now();
        let exp = now + self.access_token_expiry;

        let claims = Claims {
            sub: user.id.clone(),
            email: user.email.clone(),
            session_id: session_id.to_string(),
            exp: exp.timestamp() as usize,
            iat: now.timestamp() as usize,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )?;

        Ok(token)
    }

    fn hash_token(&self, token: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        hex::encode(hasher.finalize())
    }
}
