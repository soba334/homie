use axum::extract::{Path, State};
use axum::{Extension, Json};

use crate::errors::AppError;
use crate::models::*;
use crate::AppState;

// ── Categories ──

pub async fn list_categories(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<GarbageCategory>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let mut categories: Vec<GarbageCategory> =
        sqlx::query_as("SELECT id, home_id, name, color, description FROM garbage_categories WHERE home_id = ?")
            .bind(home_id)
            .fetch_all(&state.pool)
            .await?;

    for cat in &mut categories {
        let items: Vec<(String,)> =
            sqlx::query_as("SELECT item FROM garbage_category_items WHERE category_id = ?")
                .bind(&cat.id)
                .fetch_all(&state.pool)
                .await?;
        cat.items = items.into_iter().map(|(item,)| item).collect();
    }

    Ok(Json(categories))
}

pub async fn create_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateGarbageCategory>,
) -> Result<Json<GarbageCategory>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    let category = GarbageCategory::new(home_id, input);

    sqlx::query("INSERT INTO garbage_categories (id, home_id, name, color, description) VALUES (?, ?, ?, ?, ?)")
        .bind(&category.id)
        .bind(&category.home_id)
        .bind(&category.name)
        .bind(&category.color)
        .bind(&category.description)
        .execute(&state.pool)
        .await?;

    for item in &category.items {
        sqlx::query("INSERT INTO garbage_category_items (category_id, item) VALUES (?, ?)")
            .bind(&category.id)
            .bind(item)
            .execute(&state.pool)
            .await?;
    }

    Ok(Json(category))
}

pub async fn update_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateGarbageCategory>,
) -> Result<Json<GarbageCategory>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: GarbageCategory =
        sqlx::query_as("SELECT id, home_id, name, color, description FROM garbage_categories WHERE id = ? AND home_id = ?")
            .bind(&id)
            .bind(home_id)
            .fetch_one(&state.pool)
            .await?;

    let name = input.name.unwrap_or(existing.name);
    let color = input.color.unwrap_or(existing.color);
    let description = input.description.unwrap_or(existing.description);

    sqlx::query("UPDATE garbage_categories SET name = ?, color = ?, description = ? WHERE id = ? AND home_id = ?")
        .bind(&name)
        .bind(&color)
        .bind(&description)
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;

    let items = if let Some(new_items) = input.items {
        sqlx::query("DELETE FROM garbage_category_items WHERE category_id = ?")
            .bind(&id)
            .execute(&state.pool)
            .await?;
        for item in &new_items {
            sqlx::query("INSERT INTO garbage_category_items (category_id, item) VALUES (?, ?)")
                .bind(&id)
                .bind(item)
                .execute(&state.pool)
                .await?;
        }
        new_items
    } else {
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT item FROM garbage_category_items WHERE category_id = ?")
                .bind(&id)
                .fetch_all(&state.pool)
                .await?;
        rows.into_iter().map(|(item,)| item).collect()
    };

    Ok(Json(GarbageCategory {
        id,
        home_id: home_id.to_string(),
        name,
        color,
        description,
        items,
    }))
}

pub async fn delete_category(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM garbage_categories WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

// ── Schedules ──

pub async fn list_schedules(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<GarbageSchedule>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let mut schedules: Vec<GarbageSchedule> =
        sqlx::query_as("SELECT id, home_id, category_id, location, note FROM garbage_schedules WHERE home_id = ?")
            .bind(home_id)
            .fetch_all(&state.pool)
            .await?;

    for s in &mut schedules {
        let days: Vec<(i32,)> =
            sqlx::query_as("SELECT day_of_week FROM garbage_schedule_days WHERE schedule_id = ?")
                .bind(&s.id)
                .fetch_all(&state.pool)
                .await?;
        s.day_of_week = days.into_iter().map(|(d,)| d).collect();

        let weeks: Vec<(i32,)> =
            sqlx::query_as("SELECT week_of_month FROM garbage_schedule_weeks WHERE schedule_id = ?")
                .bind(&s.id)
                .fetch_all(&state.pool)
                .await?;
        s.week_of_month = if weeks.is_empty() {
            None
        } else {
            Some(weeks.into_iter().map(|(w,)| w).collect())
        };
    }

    Ok(Json(schedules))
}

pub async fn create_schedule(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateGarbageSchedule>,
) -> Result<Json<GarbageSchedule>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    let schedule = GarbageSchedule::new(home_id, input);

    sqlx::query("INSERT INTO garbage_schedules (id, home_id, category_id, location, note) VALUES (?, ?, ?, ?, ?)")
        .bind(&schedule.id)
        .bind(&schedule.home_id)
        .bind(&schedule.category_id)
        .bind(&schedule.location)
        .bind(&schedule.note)
        .execute(&state.pool)
        .await?;

    for day in &schedule.day_of_week {
        sqlx::query("INSERT INTO garbage_schedule_days (schedule_id, day_of_week) VALUES (?, ?)")
            .bind(&schedule.id)
            .bind(day)
            .execute(&state.pool)
            .await?;
    }

    if let Some(ref weeks) = schedule.week_of_month {
        for week in weeks {
            sqlx::query("INSERT INTO garbage_schedule_weeks (schedule_id, week_of_month) VALUES (?, ?)")
                .bind(&schedule.id)
                .bind(week)
                .execute(&state.pool)
                .await?;
        }
    }

    Ok(Json(schedule))
}

pub async fn update_schedule(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateGarbageSchedule>,
) -> Result<Json<GarbageSchedule>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: GarbageSchedule =
        sqlx::query_as("SELECT id, home_id, category_id, location, note FROM garbage_schedules WHERE id = ? AND home_id = ?")
            .bind(&id)
            .bind(home_id)
            .fetch_one(&state.pool)
            .await?;

    let category_id = input.category_id.unwrap_or(existing.category_id);
    let location = input.location.or(existing.location);
    let note = input.note.or(existing.note);

    sqlx::query("UPDATE garbage_schedules SET category_id = ?, location = ?, note = ? WHERE id = ? AND home_id = ?")
        .bind(&category_id)
        .bind(&location)
        .bind(&note)
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;

    let day_of_week = if let Some(days) = input.day_of_week {
        sqlx::query("DELETE FROM garbage_schedule_days WHERE schedule_id = ?")
            .bind(&id)
            .execute(&state.pool)
            .await?;
        for day in &days {
            sqlx::query("INSERT INTO garbage_schedule_days (schedule_id, day_of_week) VALUES (?, ?)")
                .bind(&id)
                .bind(day)
                .execute(&state.pool)
                .await?;
        }
        days
    } else {
        let rows: Vec<(i32,)> =
            sqlx::query_as("SELECT day_of_week FROM garbage_schedule_days WHERE schedule_id = ?")
                .bind(&id)
                .fetch_all(&state.pool)
                .await?;
        rows.into_iter().map(|(d,)| d).collect()
    };

    let week_of_month = if let Some(weeks) = input.week_of_month {
        sqlx::query("DELETE FROM garbage_schedule_weeks WHERE schedule_id = ?")
            .bind(&id)
            .execute(&state.pool)
            .await?;
        for week in &weeks {
            sqlx::query("INSERT INTO garbage_schedule_weeks (schedule_id, week_of_month) VALUES (?, ?)")
                .bind(&id)
                .bind(week)
                .execute(&state.pool)
                .await?;
        }
        if weeks.is_empty() { None } else { Some(weeks) }
    } else {
        let rows: Vec<(i32,)> =
            sqlx::query_as("SELECT week_of_month FROM garbage_schedule_weeks WHERE schedule_id = ?")
                .bind(&id)
                .fetch_all(&state.pool)
                .await?;
        if rows.is_empty() { None } else { Some(rows.into_iter().map(|(w,)| w).collect()) }
    };

    Ok(Json(GarbageSchedule {
        id,
        home_id: home_id.to_string(),
        category_id,
        day_of_week,
        week_of_month,
        location,
        note,
    }))
}

pub async fn delete_all(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    // CASCADE handles schedule_days, schedule_weeks, category_items
    sqlx::query("DELETE FROM garbage_schedules WHERE home_id = ?")
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    sqlx::query("DELETE FROM garbage_categories WHERE home_id = ?")
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

pub async fn delete_schedule(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM garbage_schedules WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}
