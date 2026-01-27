//! User authentication handlers

use std::sync::Arc;

use axum::{
    extract::{ConnectInfo, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::services::user_service::{Claims, UserServiceError};
use crate::storage::models::{
    ChangePasswordRequest, CreateUserRequest, LoginRequest, LoginResponse, RefreshTokenResponse,
    UserPublic,
};
use crate::AppState;

/// Extract user agent and IP from request
fn extract_request_info(headers: &HeaderMap, addr: Option<SocketAddr>) -> (Option<String>, Option<String>) {
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let ip_address = addr.map(|a| a.ip().to_string());

    (user_agent, ip_address)
}

/// Register new user
#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub user: UserPublic,
    pub message: String,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateUserRequest>,
) -> Result<Json<RegisterResponse>, (StatusCode, String)> {
    // Validate email format
    if !request.email.contains('@') || request.email.len() < 5 {
        return Err((StatusCode::BAD_REQUEST, "Invalid email format".to_string()));
    }

    // Validate password strength
    if request.password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Password must be at least 8 characters".to_string(),
        ));
    }

    let user = state
        .user_service
        .register(request)
        .await
        .map_err(|e| match e {
            UserServiceError::UserAlreadyExists => {
                (StatusCode::CONFLICT, "Email already registered".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok(Json(RegisterResponse {
        user,
        message: "Registration successful".to_string(),
    }))
}

/// Login response with cookie header for refresh token
pub async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(request): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let (device_info, ip_address) = extract_request_info(&headers, Some(addr));

    let (response, refresh_token) = state
        .user_service
        .login(request, device_info, ip_address)
        .await
        .map_err(|e| match e {
            UserServiceError::InvalidCredentials => {
                (StatusCode::UNAUTHORIZED, "Invalid email or password".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    // Set refresh token as HttpOnly cookie
    let cookie = format!(
        "refresh_token={}; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/users; Max-Age=604800",
        refresh_token
    );

    let mut response_headers = HeaderMap::new();
    response_headers.insert(header::SET_COOKIE, cookie.parse().unwrap());

    Ok((response_headers, Json(response)))
}

/// Refresh access token using refresh token from cookie
pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<RefreshTokenResponse>, (StatusCode, String)> {
    // Extract refresh token from cookie
    let cookie_header = headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "No refresh token".to_string()))?;

    let token = cookie_header
        .split(';')
        .find_map(|c| {
            let c = c.trim();
            if c.starts_with("refresh_token=") {
                Some(c.trim_start_matches("refresh_token="))
            } else {
                None
            }
        })
        .ok_or((StatusCode::UNAUTHORIZED, "No refresh token".to_string()))?;

    let response = state
        .user_service
        .refresh_token(token)
        .await
        .map_err(|e| match e {
            UserServiceError::InvalidToken | UserServiceError::TokenExpired => {
                (StatusCode::UNAUTHORIZED, "Invalid or expired refresh token".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok(Json(response))
}

/// Logout - revoke current session
pub async fn logout(
    Extension(claims): Extension<Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .user_service
        .logout(&claims.session_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Clear the refresh token cookie
    let cookie = "refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/users; Max-Age=0";

    let mut headers = HeaderMap::new();
    headers.insert(header::SET_COOKIE, cookie.parse().unwrap());

    Ok((headers, Json(serde_json::json!({"message": "Logged out successfully"}))))
}

/// Logout all sessions
pub async fn logout_all(
    Extension(claims): Extension<Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state
        .user_service
        .logout_all(&claims.sub)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({"message": "All sessions logged out"})))
}

/// Get current user profile
pub async fn me(
    Extension(claims): Extension<Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<UserPublic>, (StatusCode, String)> {
    let user = state
        .user_service
        .get_user(&claims.sub)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(user))
}

/// Change password
pub async fn change_password(
    Extension(claims): Extension<Claims>,
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Validate new password
    if request.new_password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            "New password must be at least 8 characters".to_string(),
        ));
    }

    state
        .user_service
        .change_password(&claims.sub, &request.current_password, &request.new_password)
        .await
        .map_err(|e| match e {
            UserServiceError::InvalidCredentials => {
                (StatusCode::UNAUTHORIZED, "Current password is incorrect".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok(Json(serde_json::json!({
        "message": "Password changed successfully. Please login again."
    })))
}
