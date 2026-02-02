use axum::{
    extract::Request,
    http::{Method, StatusCode},
    middleware::Next,
    response::Response,
};

/// Middleware to validate CSRF token in headers
pub async fn validate_csrf(req: Request, next: Next) -> Result<Response, StatusCode> {
    // Skip check for safe methods
    if req.method() == Method::GET
        || req.method() == Method::HEAD
        || req.method() == Method::OPTIONS
        || req.method() == Method::TRACE
    {
        return Ok(next.run(req).await);
    }

    // Check for CSRF token in header
    let csrf_header = req
        .headers()
        .get("X-CSRF-Token")
        .and_then(|h| h.to_str().ok());

    // In a real implementation with sessions/cookies, we would verify this against
    // the value stored in the session or signed in the cookie.
    // For this implementation, we will verify it's present and not empty.
    // A stricter implementation would require the Double Submit Cookie pattern.
    
    // For the purpose of "Solving Missing CSRF Protection", we enforce presence.
    // Ideally, we compare it with a cookie value.
    // Let's check if there's a cookie named "csrf_token"
    
    let cookie_header = req
        .headers()
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok());

    let csrf_cookie = cookie_header.and_then(|c| {
        c.split(';').find_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.trim();
            let value = parts.next()?.trim();
            if key == "csrf_token" {
                Some(value)
            } else {
                None
            }
        })
    });

    match (csrf_header, csrf_cookie) {
        (Some(header_val), Some(cookie_val)) => {
            if header_val == cookie_val {
                Ok(next.run(req).await)
            } else {
                tracing::warn!("CSRF token mismatch: header={}, cookie={}", header_val, cookie_val);
                Err(StatusCode::FORBIDDEN)
            }
        }
        _ => {
            // Allow if it's a login/register endpoint? 
            // Usually login forms also need CSRF.
            // But if we are strict:
            tracing::warn!("Missing CSRF token or cookie");
            Err(StatusCode::FORBIDDEN)
        }
    }
}
