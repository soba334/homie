use axum::extract::{Path, State};
use axum::{Extension, Json};
use chrono::Datelike;

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;
use crate::validation::*;

pub async fn list_goals(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<SavingsGoalWithProgress>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let goals: Vec<SavingsGoal> = sqlx::query_as(
        "SELECT id, home_id, name, target_amount, current_amount, target_date, account_id, note, created_at FROM savings_goals WHERE home_id = ? ORDER BY created_at",
    )
    .bind(home_id)
    .fetch_all(&state.pool)
    .await?;

    let result: Vec<SavingsGoalWithProgress> = goals
        .into_iter()
        .map(|goal| {
            let progress_rate = if goal.target_amount > 0.0 {
                (goal.current_amount / goal.target_amount).min(1.0)
            } else {
                0.0
            };

            let monthly_required = calc_monthly_required(&goal);

            SavingsGoalWithProgress {
                goal,
                progress_rate,
                monthly_required,
            }
        })
        .collect();

    Ok(Json(result))
}

pub async fn create_goal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateSavingsGoal>,
) -> Result<Json<SavingsGoalWithProgress>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    validate_name(&input.name, "name")?;
    validate_amount(input.target_amount, "targetAmount")?;
    if let Some(current) = input.current_amount {
        validate_amount(current, "currentAmount")?;
    }
    let goal = SavingsGoal::new(home_id, input);

    sqlx::query(
        "INSERT INTO savings_goals (id, home_id, name, target_amount, current_amount, target_date, account_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&goal.id)
    .bind(&goal.home_id)
    .bind(&goal.name)
    .bind(goal.target_amount)
    .bind(goal.current_amount)
    .bind(&goal.target_date)
    .bind(&goal.account_id)
    .bind(&goal.note)
    .bind(&goal.created_at)
    .execute(&state.pool)
    .await?;

    let progress_rate = if goal.target_amount > 0.0 {
        (goal.current_amount / goal.target_amount).min(1.0)
    } else {
        0.0
    };
    let monthly_required = calc_monthly_required(&goal);

    Ok(Json(SavingsGoalWithProgress {
        goal,
        progress_rate,
        monthly_required,
    }))
}

pub async fn update_goal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSavingsGoal>,
) -> Result<Json<SavingsGoalWithProgress>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: SavingsGoal = sqlx::query_as(
        "SELECT id, home_id, name, target_amount, current_amount, target_date, account_id, note, created_at FROM savings_goals WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let updated = SavingsGoal {
        id: id.clone(),
        home_id: home_id.to_string(),
        name: input.name.unwrap_or(existing.name),
        target_amount: input.target_amount.unwrap_or(existing.target_amount),
        current_amount: input.current_amount.unwrap_or(existing.current_amount),
        target_date: input.target_date.or(existing.target_date),
        account_id: input.account_id.or(existing.account_id),
        note: input.note.or(existing.note),
        created_at: existing.created_at,
    };

    sqlx::query(
        "UPDATE savings_goals SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, account_id = ?, note = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&updated.name)
    .bind(updated.target_amount)
    .bind(updated.current_amount)
    .bind(&updated.target_date)
    .bind(&updated.account_id)
    .bind(&updated.note)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    let progress_rate = if updated.target_amount > 0.0 {
        (updated.current_amount / updated.target_amount).min(1.0)
    } else {
        0.0
    };
    let monthly_required = calc_monthly_required(&updated);

    Ok(Json(SavingsGoalWithProgress {
        goal: updated,
        progress_rate,
        monthly_required,
    }))
}

pub async fn delete_goal(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM savings_goals WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

fn calc_monthly_required(goal: &SavingsGoal) -> Option<f64> {
    let target_date = goal.target_date.as_ref()?;
    let target = chrono::NaiveDate::parse_from_str(target_date, "%Y-%m-%d").ok()?;
    let today = chrono::Utc::now().date_naive();

    if target <= today {
        return None;
    }

    let remaining = goal.target_amount - goal.current_amount;
    if remaining <= 0.0 {
        return Some(0.0);
    }

    let months_diff =
        (target.year() - today.year()) * 12 + (target.month() as i32 - today.month() as i32);
    if months_diff <= 0 {
        return Some(remaining);
    }

    Some(remaining / months_diff as f64)
}
