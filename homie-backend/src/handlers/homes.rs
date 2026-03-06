use axum::extract::{Path, State};
use axum::{Extension, Json};
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::*;
use crate::AppState;

fn generate_invite_code() -> String {
    use rand::Rng;
    // Exclude confusing characters: 0/O, 1/I/L
    const CHARS: &[u8] = b"23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let mut rng = rand::rng();
    (0..8)
        .map(|_| CHARS[rng.random_range(0..CHARS.len())] as char)
        .collect()
}

/// Create a new home (called during onboarding)
pub async fn create_home(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateHomeRequest>,
) -> Result<Json<JoinResponse>, AppError> {
    // Must not already belong to a home
    if auth.home_id.is_some() {
        return Err(AppError::BadRequest(
            "Already a member of a home".to_string(),
        ));
    }

    let home_name = input
        .name
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("My Home");

    let home_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO homes (id, name) VALUES (?, ?)")
        .bind(&home_id)
        .bind(home_name)
        .execute(&state.pool)
        .await?;

    let member_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO members (id, home_id, user_id, role) VALUES (?, ?, ?, 'owner')")
        .bind(&member_id)
        .bind(&home_id)
        .bind(&auth.user_id)
        .execute(&state.pool)
        .await?;

    Ok(Json(JoinResponse {
        home_id,
        home_name: home_name.to_string(),
    }))
}

/// Invite partner by email
pub async fn invite(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(home_id): Path<String>,
    Json(input): Json<InviteRequest>,
) -> Result<Json<InviteResponse>, AppError> {
    // Verify user belongs to this home
    let user_home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?;

    if user_home_id != home_id {
        return Err(AppError::Forbidden("Not a member of this home".to_string()));
    }

    // Check member count
    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM members WHERE home_id = ?")
            .bind(&home_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

    if member_count >= 2 {
        return Err(AppError::BadRequest(
            "パートナーは既に参加しています".to_string(),
        ));
    }

    // Validate email
    let email = input.email.trim().to_lowercase();
    if !email.contains('@') {
        return Err(AppError::BadRequest(
            "メールアドレスの形式が正しくありません".into(),
        ));
    }

    // Delete any previous unused invites for this home
    sqlx::query("DELETE FROM invite_codes WHERE home_id = ? AND used_by IS NULL")
        .bind(&home_id)
        .execute(&state.pool)
        .await?;

    let code = generate_invite_code();
    let expires_at = (chrono::Utc::now() + chrono::Duration::days(7)).to_rfc3339();
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO invite_codes (id, home_id, code, created_by, expires_at, invited_email) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&home_id)
    .bind(&code)
    .bind(&auth.user_id)
    .bind(&expires_at)
    .bind(&email)
    .execute(&state.pool)
    .await?;

    Ok(Json(InviteResponse {
        code,
        expires_at,
    }))
}

/// Join a home using invite code
pub async fn join(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<JoinRequest>,
) -> Result<Json<JoinResponse>, AppError> {
    // User must not already belong to a home
    if auth.home_id.is_some() {
        return Err(AppError::BadRequest(
            "Already a member of a home".to_string(),
        ));
    }

    // Find valid invite code (case-insensitive)
    let invite: InviteCode = sqlx::query_as(
        "SELECT id, home_id, code, created_by, expires_at, used_by, used_at, invited_email \
         FROM invite_codes WHERE UPPER(code) = UPPER(?)",
    )
    .bind(input.code.trim())
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("招待コードが無効です".to_string()))?;

    // Check if already used
    if invite.used_by.is_some() {
        return Err(AppError::BadRequest("招待コードは既に使用されています".to_string()));
    }

    // Check expiry
    let expires_at = chrono::DateTime::parse_from_rfc3339(&invite.expires_at)
        .map_err(|e| AppError::Internal(format!("Date parse error: {e}")))?;

    if chrono::Utc::now() > expires_at {
        return Err(AppError::BadRequest("招待コードの有効期限が切れています".to_string()));
    }

    // Check home member count
    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM members WHERE home_id = ?")
            .bind(&invite.home_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

    if member_count >= 2 {
        return Err(AppError::BadRequest(
            "パートナーは既に参加しています".to_string(),
        ));
    }

    // Add member
    let member_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO members (id, home_id, user_id, role) VALUES (?, ?, ?, 'member')")
        .bind(&member_id)
        .bind(&invite.home_id)
        .bind(&auth.user_id)
        .execute(&state.pool)
        .await?;

    // Mark invite code as used
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE invite_codes SET used_by = ?, used_at = ? WHERE id = ?")
        .bind(&auth.user_id)
        .bind(&now)
        .bind(&invite.id)
        .execute(&state.pool)
        .await?;

    // Get home name
    let home: Home =
        sqlx::query_as("SELECT id, name, created_at FROM homes WHERE id = ?")
            .bind(&invite.home_id)
            .fetch_one(&state.pool)
            .await?;

    Ok(Json(JoinResponse {
        home_id: home.id,
        home_name: home.name,
    }))
}
