use axum::extract::State;
use axum::{Extension, Json};

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;

pub async fn subscribe(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreatePushSubscription>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET user_id = ?, p256dh = ?, auth = ?",
    )
    .bind(&id)
    .bind(&auth.user_id)
    .bind(&input.endpoint)
    .bind(&input.keys.p256dh)
    .bind(&input.keys.auth)
    .bind(&auth.user_id)
    .bind(&input.keys.p256dh)
    .bind(&input.keys.auth)
    .execute(&state.pool)
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn unsubscribe(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<UnsubscribePush>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
        .bind(&input.endpoint)
        .bind(&auth.user_id)
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn get_preferences(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<NotificationPreferences>, AppError> {
    let prefs: Option<NotificationPreferences> = sqlx::query_as(
        "SELECT user_id, garbage_enabled, garbage_timing, subscription_enabled, subscription_days_before, updated_at
         FROM notification_preferences WHERE user_id = ?",
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.pool)
    .await?;

    Ok(Json(prefs.unwrap_or(NotificationPreferences {
        user_id: auth.user_id.clone(),
        garbage_enabled: true,
        garbage_timing: "both".to_string(),
        subscription_enabled: true,
        subscription_days_before: 1,
        updated_at: chrono::Utc::now().to_rfc3339(),
    })))
}

pub async fn update_preferences(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<UpdateNotificationPreferences>,
) -> Result<Json<NotificationPreferences>, AppError> {
    let existing = get_preferences_inner(&state.pool, &auth.user_id).await;

    let updated = NotificationPreferences {
        user_id: auth.user_id.clone(),
        garbage_enabled: input.garbage_enabled.unwrap_or(existing.garbage_enabled),
        garbage_timing: input.garbage_timing.unwrap_or(existing.garbage_timing),
        subscription_enabled: input
            .subscription_enabled
            .unwrap_or(existing.subscription_enabled),
        subscription_days_before: input
            .subscription_days_before
            .unwrap_or(existing.subscription_days_before),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    sqlx::query(
        "INSERT INTO notification_preferences (user_id, garbage_enabled, garbage_timing, subscription_enabled, subscription_days_before, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET garbage_enabled = ?, garbage_timing = ?, subscription_enabled = ?, subscription_days_before = ?, updated_at = ?",
    )
    .bind(&updated.user_id)
    .bind(updated.garbage_enabled)
    .bind(&updated.garbage_timing)
    .bind(updated.subscription_enabled)
    .bind(updated.subscription_days_before)
    .bind(&updated.updated_at)
    .bind(updated.garbage_enabled)
    .bind(&updated.garbage_timing)
    .bind(updated.subscription_enabled)
    .bind(updated.subscription_days_before)
    .bind(&updated.updated_at)
    .execute(&state.pool)
    .await?;

    Ok(Json(updated))
}

async fn get_preferences_inner(pool: &sqlx::SqlitePool, user_id: &str) -> NotificationPreferences {
    sqlx::query_as(
        "SELECT user_id, garbage_enabled, garbage_timing, subscription_enabled, subscription_days_before, updated_at
         FROM notification_preferences WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or(NotificationPreferences {
        user_id: user_id.to_string(),
        garbage_enabled: true,
        garbage_timing: "both".to_string(),
        subscription_enabled: true,
        subscription_days_before: 1,
        updated_at: chrono::Utc::now().to_rfc3339(),
    })
}
