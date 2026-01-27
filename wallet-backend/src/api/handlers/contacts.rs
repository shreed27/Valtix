//! Contact (address book) handlers

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use qrcode::{QrCode, render::svg};
use serde::{Deserialize, Serialize};

use crate::storage::models::{ContactResponse, ContactRow};
use crate::AppState;

/// List all contacts
pub async fn list_contacts(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ContactResponse>>, (StatusCode, String)> {
    let wallet = state
        .db
        .get_primary_wallet()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "No wallet found".to_string()))?;

    let contacts = state
        .db
        .get_contacts(&wallet.id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(contacts.into_iter().map(ContactResponse::from).collect()))
}

/// Create contact request
#[derive(Debug, Deserialize)]
pub struct CreateContactRequest {
    pub name: String,
    pub chain: String,
    pub address: String,
    pub notes: Option<String>,
}

/// Create new contact
pub async fn create_contact(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateContactRequest>,
) -> Result<Json<ContactResponse>, (StatusCode, String)> {
    let wallet = state
        .db
        .get_primary_wallet()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "No wallet found".to_string()))?;

    let contact = ContactRow::new(
        wallet.id,
        request.name,
        request.chain.to_lowercase(),
        request.address,
        request.notes,
    );

    state
        .db
        .create_contact(&contact)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ContactResponse::from(contact)))
}

/// Get single contact
pub async fn get_contact(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ContactResponse>, (StatusCode, String)> {
    let contact = state
        .db
        .get_contact(&id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Contact not found".to_string()))?;

    Ok(Json(ContactResponse::from(contact)))
}

/// Update contact request
#[derive(Debug, Deserialize)]
pub struct UpdateContactRequest {
    pub name: String,
    pub notes: Option<String>,
}

/// Update contact
pub async fn update_contact(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<UpdateContactRequest>,
) -> Result<Json<ContactResponse>, (StatusCode, String)> {
    state
        .db
        .update_contact(&id, &request.name, request.notes.as_deref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let contact = state
        .db
        .get_contact(&id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Contact not found".to_string()))?;

    Ok(Json(ContactResponse::from(contact)))
}

/// Delete contact
pub async fn delete_contact(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state
        .db
        .delete_contact(&id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// QR code response
#[derive(Debug, Serialize)]
pub struct QrCodeResponse {
    pub chain: String,
    pub address: String,
    pub qr_svg: String,
    pub qr_data_url: String,
}

/// Generate QR code for an address
pub async fn generate_qr(
    Path((chain, address)): Path<(String, String)>,
) -> Result<Json<QrCodeResponse>, (StatusCode, String)> {
    // Create payment URI based on chain
    let uri = match chain.to_lowercase().as_str() {
        "solana" => format!("solana:{}", address),
        "ethereum" => format!("ethereum:{}", address),
        _ => address.clone(),
    };

    // Generate QR code
    let code = QrCode::new(uri.as_bytes())
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Render as SVG
    let svg_string = code.render::<svg::Color>()
        .min_dimensions(200, 200)
        .max_dimensions(300, 300)
        .build();

    // Also create a data URL for embedding
    let svg_base64 = STANDARD.encode(svg_string.as_bytes());
    let data_url = format!("data:image/svg+xml;base64,{}", svg_base64);

    Ok(Json(QrCodeResponse {
        chain,
        address,
        qr_svg: svg_string,
        qr_data_url: data_url,
    }))
}
