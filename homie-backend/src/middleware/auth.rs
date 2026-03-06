use axum::body::Body;
use axum::extract::State;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use axum_extra::extract::CookieJar;
use jsonwebtoken::{DecodingKey, Validation};

use crate::AppState;
use crate::errors::AppError;
use crate::models::{AuthUser, Claims};

pub async fn require_auth(
    State(state): State<AppState>,
    jar: CookieJar,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    let token = jar
        .get("access_token")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::Unauthorized("Unauthorized".to_string()))?;

    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    let token_data = jsonwebtoken::decode::<Claims>(
        &token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized("Unauthorized".to_string()))?;

    let user_id = token_data.claims.sub;

    let home_id: Option<String> =
        sqlx::query_scalar("SELECT home_id FROM members WHERE user_id = ? LIMIT 1")
            .bind(&user_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

    req.extensions_mut().insert(AuthUser { user_id, home_id });

    Ok(next.run(req).await)
}

pub async fn require_home(req: Request<Body>, next: Next) -> Result<Response, AppError> {
    let auth = req
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Unauthorized".to_string()))?;

    if auth.home_id.is_none() {
        return Err(AppError::Forbidden("No home membership".to_string()));
    }

    Ok(next.run(req).await)
}
