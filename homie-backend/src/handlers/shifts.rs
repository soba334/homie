use axum::extract::{Path, Query, State};
use axum::{Extension, Json};

use crate::errors::AppError;
use crate::models::*;
use crate::AppState;

#[derive(serde::Deserialize)]
pub struct ShiftQuery {
    pub year_month: Option<String>,
    pub user_id: Option<String>,
}

pub async fn list_shifts(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<ShiftQuery>,
) -> Result<Json<Vec<Shift>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let shifts = match (&query.year_month, &query.user_id) {
        (Some(ym), Some(uid)) => {
            sqlx::query_as::<_, Shift>(
                "SELECT id, employment_id, user_id, home_id, date, start_time, end_time, break_minutes, is_holiday, note, created_at FROM shifts WHERE home_id = ? AND user_id = ? AND date LIKE ? || '%' ORDER BY date, start_time",
            )
            .bind(home_id)
            .bind(uid)
            .bind(ym)
            .fetch_all(&state.pool)
            .await?
        }
        (Some(ym), None) => {
            sqlx::query_as::<_, Shift>(
                "SELECT id, employment_id, user_id, home_id, date, start_time, end_time, break_minutes, is_holiday, note, created_at FROM shifts WHERE home_id = ? AND date LIKE ? || '%' ORDER BY date, start_time",
            )
            .bind(home_id)
            .bind(ym)
            .fetch_all(&state.pool)
            .await?
        }
        (None, Some(uid)) => {
            sqlx::query_as::<_, Shift>(
                "SELECT id, employment_id, user_id, home_id, date, start_time, end_time, break_minutes, is_holiday, note, created_at FROM shifts WHERE home_id = ? AND user_id = ? ORDER BY date, start_time",
            )
            .bind(home_id)
            .bind(uid)
            .fetch_all(&state.pool)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, Shift>(
                "SELECT id, employment_id, user_id, home_id, date, start_time, end_time, break_minutes, is_holiday, note, created_at FROM shifts WHERE home_id = ? ORDER BY date, start_time",
            )
            .bind(home_id)
            .fetch_all(&state.pool)
            .await?
        }
    };

    Ok(Json(shifts))
}

pub async fn create_shift(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateShift>,
) -> Result<Json<Shift>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    let shift = Shift::new(auth.user_id.clone(), home_id, input);

    sqlx::query(
        "INSERT INTO shifts (id, employment_id, user_id, home_id, date, start_time, end_time, break_minutes, is_holiday, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&shift.id)
    .bind(&shift.employment_id)
    .bind(&shift.user_id)
    .bind(&shift.home_id)
    .bind(&shift.date)
    .bind(&shift.start_time)
    .bind(&shift.end_time)
    .bind(shift.break_minutes)
    .bind(shift.is_holiday)
    .bind(&shift.note)
    .bind(&shift.created_at)
    .execute(&state.pool)
    .await?;

    Ok(Json(shift))
}

pub async fn update_shift(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateShift>,
) -> Result<Json<Shift>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: Shift = sqlx::query_as(
        "SELECT id, employment_id, user_id, home_id, date, start_time, end_time, break_minutes, is_holiday, note, created_at FROM shifts WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let updated = Shift {
        id: id.clone(),
        employment_id: input.employment_id.unwrap_or(existing.employment_id),
        user_id: existing.user_id,
        home_id: home_id.to_string(),
        date: input.date.unwrap_or(existing.date),
        start_time: input.start_time.unwrap_or(existing.start_time),
        end_time: input.end_time.unwrap_or(existing.end_time),
        break_minutes: input.break_minutes.unwrap_or(existing.break_minutes),
        is_holiday: input.is_holiday.unwrap_or(existing.is_holiday),
        note: input.note.or(existing.note),
        created_at: existing.created_at,
    };

    sqlx::query(
        "UPDATE shifts SET employment_id = ?, date = ?, start_time = ?, end_time = ?, break_minutes = ?, is_holiday = ?, note = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&updated.employment_id)
    .bind(&updated.date)
    .bind(&updated.start_time)
    .bind(&updated.end_time)
    .bind(updated.break_minutes)
    .bind(updated.is_holiday)
    .bind(&updated.note)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    Ok(Json(updated))
}

pub async fn delete_shift(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM shifts WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}
