use axum::extract::State;
use axum::response::{IntoResponse, Redirect, Response};
use axum::{Extension, Json};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::Cookie;
use jsonwebtoken::{EncodingKey, Header};
use uuid::Uuid;

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;

#[derive(serde::Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: String,
}

#[derive(serde::Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
}

#[derive(serde::Deserialize)]
struct GoogleUserInfo {
    id: String,
    email: String,
    name: String,
    picture: Option<String>,
}

fn google_client_id() -> String {
    std::env::var("GOOGLE_CLIENT_ID").expect("GOOGLE_CLIENT_ID must be set")
}

fn google_client_secret() -> String {
    std::env::var("GOOGLE_CLIENT_SECRET").expect("GOOGLE_CLIENT_SECRET must be set")
}

fn google_redirect_uri() -> String {
    std::env::var("GOOGLE_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3001/api/v1/auth/google/callback".to_string())
}

fn frontend_url() -> String {
    std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".to_string())
}

fn jwt_secret() -> String {
    std::env::var("JWT_SECRET").expect("JWT_SECRET must be set")
}

fn generate_jwt(user_id: &str) -> Result<String, AppError> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        iat: now,
        exp: now + 900, // 15 minutes
    };
    jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))
}

fn generate_state() -> String {
    use rand::Rng;
    let mut rng = rand::rng();
    (0..32)
        .map(|_| {
            let idx = rng.random_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect()
}

async fn try_auto_join(
    pool: &sqlx::SqlitePool,
    user_id: &str,
    email: &str,
) -> Result<(), AppError> {
    let pending_invite: Option<InviteCode> = sqlx::query_as(
        "SELECT id, home_id, code, created_by, expires_at, used_by, used_at, invited_email \
         FROM invite_codes WHERE invited_email = ? AND used_by IS NULL",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    if let Some(invite) = pending_invite {
        let expires_at = chrono::DateTime::parse_from_rfc3339(&invite.expires_at).ok();
        let not_expired = expires_at.is_none_or(|e| chrono::Utc::now() <= e);

        if not_expired {
            let member_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM members WHERE home_id = ?")
                    .bind(&invite.home_id)
                    .fetch_one(pool)
                    .await
                    .map_err(|e| AppError::Internal(e.to_string()))?;

            if member_count < 2 {
                let member_id = Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO members (id, home_id, user_id, role) VALUES (?, ?, ?, 'member')",
                )
                .bind(&member_id)
                .bind(&invite.home_id)
                .bind(user_id)
                .execute(pool)
                .await?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("UPDATE invite_codes SET used_by = ?, used_at = ? WHERE id = ?")
                    .bind(user_id)
                    .bind(&now)
                    .bind(&invite.id)
                    .execute(pool)
                    .await?;
            }
        }
    }

    Ok(())
}

pub async fn google_login(jar: CookieJar) -> impl IntoResponse {
    let state = generate_state();

    let is_secure = google_redirect_uri().starts_with("https://");

    let state_cookie = Cookie::build(("oauth_state", state.clone()))
        .http_only(true)
        .secure(is_secure)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/")
        .max_age(time::Duration::seconds(600))
        .build();

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&state={}&access_type=offline",
        google_client_id(),
        urlencoding::encode(&google_redirect_uri()),
        state
    );

    (jar.add(state_cookie), Redirect::temporary(&auth_url))
}

pub async fn google_callback(
    State(state): State<AppState>,
    jar: CookieJar,
    axum::extract::Query(query): axum::extract::Query<CallbackQuery>,
) -> Result<Response, AppError> {
    // Verify state
    let stored_state = jar
        .get("oauth_state")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::Unauthorized("Authentication failed".to_string()))?;

    if query.state != stored_state {
        return Err(AppError::Unauthorized("Authentication failed".to_string()));
    }

    // Exchange code for token
    let client = reqwest::Client::new();
    let token_resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", query.code.as_str()),
            ("client_id", &google_client_id()),
            ("client_secret", &google_client_secret()),
            ("redirect_uri", &google_redirect_uri()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Google token exchange failed: {e}")))?;

    if !token_resp.status().is_success() {
        return Err(AppError::Unauthorized("Authentication failed".to_string()));
    }

    let token_data: GoogleTokenResponse = token_resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Google token parse failed: {e}")))?;

    // Get user info
    let user_info: GoogleUserInfo = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(&token_data.access_token)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Google userinfo failed: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Google userinfo parse failed: {e}")))?;

    // Find or create user
    let existing_user: Option<User> =
        sqlx::query_as("SELECT id, google_id, email, name, avatar_url, display_name, created_at FROM users WHERE google_id = ?")
            .bind(&user_info.id)
            .fetch_optional(&state.pool)
            .await?;

    let user_id = if let Some(user) = existing_user {
        // Update user info
        sqlx::query("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?")
            .bind(&user_info.name)
            .bind(&user_info.picture)
            .bind(&user.id)
            .execute(&state.pool)
            .await?;

        // Check if existing user has no home and has a pending invite → auto-join
        let has_home: bool =
            sqlx::query_scalar("SELECT COUNT(*) > 0 FROM members WHERE user_id = ?")
                .bind(&user.id)
                .fetch_one(&state.pool)
                .await
                .unwrap_or(false);

        if !has_home {
            try_auto_join(&state.pool, &user.id, &user_info.email).await?;
        }

        user.id
    } else {
        // Create new user (no home yet — onboarding will handle it)
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO users (id, google_id, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&user_info.id)
        .bind(&user_info.email)
        .bind(&user_info.name)
        .bind(&user_info.picture)
        .execute(&state.pool)
        .await?;

        // Check for pending invite by email → auto-join
        try_auto_join(&state.pool, &id, &user_info.email).await?;

        id
    };

    // Generate tokens
    let access_token = generate_jwt(&user_id)?;
    let refresh_token = Uuid::new_v4().to_string();
    let expires_at = (chrono::Utc::now() + chrono::Duration::days(7)).to_rfc3339();

    // Save refresh token
    let rt_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)")
        .bind(&rt_id)
        .bind(&user_id)
        .bind(&refresh_token)
        .bind(&expires_at)
        .execute(&state.pool)
        .await?;

    // Set cookies
    let is_secure = google_redirect_uri().starts_with("https://");

    let access_cookie = Cookie::build(("access_token", access_token))
        .http_only(true)
        .secure(is_secure)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/")
        .max_age(time::Duration::seconds(900))
        .build();

    let refresh_cookie = Cookie::build(("refresh_token", refresh_token))
        .http_only(true)
        .secure(is_secure)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/api/v1/auth")
        .max_age(time::Duration::seconds(604800))
        .build();

    let remove_state = Cookie::build(("oauth_state", ""))
        .path("/")
        .max_age(time::Duration::ZERO)
        .build();

    let jar = jar.add(access_cookie).add(refresh_cookie).add(remove_state);

    Ok((jar, Redirect::temporary(&frontend_url())).into_response())
}

pub async fn refresh(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    let token = jar
        .get("refresh_token")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::Unauthorized("Refresh token expired".to_string()))?;

    // Look up refresh token
    let rt: RefreshToken = sqlx::query_as(
        "SELECT id, user_id, token, expires_at, created_at FROM refresh_tokens WHERE token = ?",
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Refresh token expired".to_string()))?;

    // Check expiry
    let expires_at = chrono::DateTime::parse_from_rfc3339(&rt.expires_at)
        .map_err(|e| AppError::Internal(format!("Date parse error: {e}")))?;

    if chrono::Utc::now() > expires_at {
        // Delete expired token
        sqlx::query("DELETE FROM refresh_tokens WHERE id = ?")
            .bind(&rt.id)
            .execute(&state.pool)
            .await?;

        return Err(AppError::Unauthorized("Refresh token expired".to_string()));
    }

    // Delete old refresh token (rotation)
    sqlx::query("DELETE FROM refresh_tokens WHERE id = ?")
        .bind(&rt.id)
        .execute(&state.pool)
        .await?;

    // Generate new refresh token
    let new_refresh_token = Uuid::new_v4().to_string();
    let new_rt_id = Uuid::new_v4().to_string();
    let new_expires_at = (chrono::Utc::now() + chrono::Duration::days(7)).to_rfc3339();

    sqlx::query("INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)")
        .bind(&new_rt_id)
        .bind(&rt.user_id)
        .bind(&new_refresh_token)
        .bind(&new_expires_at)
        .execute(&state.pool)
        .await?;

    // Generate new access token
    let access_token = generate_jwt(&rt.user_id)?;
    let is_secure = std::env::var("GOOGLE_REDIRECT_URI")
        .unwrap_or_default()
        .starts_with("https://");

    let access_cookie = Cookie::build(("access_token", access_token))
        .http_only(true)
        .secure(is_secure)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/")
        .max_age(time::Duration::seconds(900))
        .build();

    let refresh_cookie = Cookie::build(("refresh_token", new_refresh_token))
        .http_only(true)
        .secure(is_secure)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/api/v1/auth")
        .max_age(time::Duration::seconds(604800))
        .build();

    Ok((
        jar.add(access_cookie).add(refresh_cookie),
        axum::http::StatusCode::OK,
    ))
}

pub async fn logout(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    // Delete refresh tokens for this user
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = ?")
        .bind(&auth.user_id)
        .execute(&state.pool)
        .await?;

    let remove_access = Cookie::build(("access_token", ""))
        .path("/")
        .max_age(time::Duration::ZERO)
        .build();
    let remove_refresh = Cookie::build(("refresh_token", ""))
        .path("/api/v1/auth")
        .max_age(time::Duration::ZERO)
        .build();

    Ok((
        jar.add(remove_access).add(remove_refresh),
        axum::http::StatusCode::OK,
    ))
}

pub async fn me(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<MeResponse>, AppError> {
    let user: User = sqlx::query_as(
        "SELECT id, google_id, email, name, avatar_url, display_name, created_at FROM users WHERE id = ?",
    )
    .bind(&auth.user_id)
    .fetch_one(&state.pool)
    .await?;

    let home = if let Some(home_id) = &auth.home_id {
        let home: Home = sqlx::query_as("SELECT id, name, created_at FROM homes WHERE id = ?")
            .bind(home_id)
            .fetch_one(&state.pool)
            .await?;

        let members: Vec<Member> =
            sqlx::query_as("SELECT id, home_id, user_id, role FROM members WHERE home_id = ?")
                .bind(home_id)
                .fetch_all(&state.pool)
                .await?;

        let mut member_infos = Vec::new();
        for m in &members {
            let u: User = sqlx::query_as(
                "SELECT id, google_id, email, name, avatar_url, display_name, created_at FROM users WHERE id = ?",
            )
            .bind(&m.user_id)
            .fetch_one(&state.pool)
            .await?;

            member_infos.push(MemberInfo {
                id: u.id,
                name: u.name.clone(),
                display_name: u.display_name,
                email: u.email,
                avatar_url: u.avatar_url,
                role: m.role.clone(),
            });
        }

        Some(HomeWithMembers {
            id: home.id,
            name: home.name,
            members: member_infos,
        })
    } else {
        None
    };

    Ok(Json(MeResponse {
        id: user.id,
        email: user.email,
        name: user.name.clone(),
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        home,
    }))
}

pub async fn update_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<UpdateProfile>,
) -> Result<Json<serde_json::Value>, AppError> {
    let trimmed = input.display_name.trim();
    if trimmed.is_empty() || trimmed.len() > 30 {
        return Err(AppError::BadRequest(
            "ニックネームは1〜30文字で入力してください".into(),
        ));
    }

    sqlx::query("UPDATE users SET display_name = ? WHERE id = ?")
        .bind(trimmed)
        .bind(&auth.user_id)
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
