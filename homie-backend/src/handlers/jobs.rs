use axum::extract::{Path, State};
use axum::{Extension, Json};

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;

pub async fn get_job(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<BackgroundJob>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();
    let job: BackgroundJob = sqlx::query_as(
        "SELECT id, home_id, type, status, input, result, error, created_at, completed_at FROM background_jobs WHERE id = ? AND home_id = ?"
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound,
        other => AppError::Internal(other.to_string()),
    })?;
    Ok(Json(job))
}
