//! Authentication middleware

use std::sync::Arc;

use axum::{
    body::Body,
    extract::State,
    http::{header, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::services::user_service::Claims;
use crate::services::wallet_service::is_unlocked;
use crate::AppState;

/// Require valid JWT authentication
pub async fn require_auth(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, impl IntoResponse> {
    // Extract token from Authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Missing or invalid Authorization header",
            ))
        }
    };

    // Validate token
    let claims = match state.user_service.validate_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Err((StatusCode::UNAUTHORIZED, "Invalid or expired token"));
        }
    };

    // Add claims to request extensions for handlers to use
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

/// Optional JWT authentication - doesn't fail if no token provided
pub async fn optional_auth(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    // Try to extract and validate token
    if let Some(auth_header) = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
    {
        if auth_header.starts_with("Bearer ") {
            let token = &auth_header[7..];
            if let Ok(claims) = state.user_service.validate_token(token) {
                request.extensions_mut().insert(claims);
            }
        }
    }

    next.run(request).await
}

/// Require wallet to be unlocked (legacy - for wallet-level operations)
pub async fn require_unlocked(
    State(state): State<Arc<AppState>>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    if !is_unlocked(&state).await {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(request).await)
}

/// Combined: Require both user auth and wallet unlocked
pub async fn require_auth_and_unlocked(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, impl IntoResponse> {
    // First check JWT auth
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Missing or invalid Authorization header",
            ))
        }
    };

    let claims = match state.user_service.validate_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Err((StatusCode::UNAUTHORIZED, "Invalid or expired token"));
        }
    };

    // Then check wallet is unlocked
    if !is_unlocked(&state).await {
        return Err((StatusCode::UNAUTHORIZED, "Wallet is locked"));
    }

    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

/// Extract authenticated user claims from request
pub fn get_user_claims(request: &Request<Body>) -> Option<&Claims> {
    request.extensions().get::<Claims>()
}
