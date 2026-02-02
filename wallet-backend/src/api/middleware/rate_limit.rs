use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use once_cell::sync::Lazy;

// Simple in-memory rate limiter: IP -> (count, reset_time)
// Limit: 100 requests per minute
const MAX_REQUESTS: u32 = 100;
const WINDOW_DURATION: Duration = Duration::from_secs(60);

type RateLimitStore = Arc<Mutex<HashMap<IpAddr, (u32, Instant)>>>;

static RATE_LIMITER: Lazy<RateLimitStore> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

pub async fn rate_limit_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = addr.ip();
    let mut store = RATE_LIMITER.lock().unwrap();

    let now = Instant::now();
    let (count, reset_time) = store.entry(ip).or_insert((0, now + WINDOW_DURATION));

    if now > *reset_time {
        *count = 0;
        *reset_time = now + WINDOW_DURATION;
    }

    if *count >= MAX_REQUESTS {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    *count += 1;

    // Release lock before awaiting
    drop(store);

    Ok(next.run(request).await)
}
