use axum::extract::{Path, Query, State};
use axum::{Extension, Json};

use crate::errors::AppError;
use crate::models::*;
use crate::AppState;

#[derive(serde::Deserialize)]
pub struct MonthlyBudgetQuery {
    pub year_month: String,
}

pub async fn list_budgets(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<MonthlyBudgetQuery>,
) -> Result<Json<Vec<BudgetVsActual>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();
    let ym = &query.year_month;

    let budgets: Vec<MonthlyBudget> = sqlx::query_as(
        "SELECT id, home_id, category, amount, year_month FROM monthly_budgets WHERE home_id = ? AND year_month = ?",
    )
    .bind(home_id)
    .bind(ym)
    .fetch_all(&state.pool)
    .await?;

    let mut result = Vec::with_capacity(budgets.len());
    for budget in &budgets {
        let actual: Option<f64> = sqlx::query_scalar(
            "SELECT SUM(amount) FROM budget_entries WHERE home_id = ? AND category = ? AND date LIKE ? || '%'",
        )
        .bind(home_id)
        .bind(&budget.category)
        .bind(ym)
        .fetch_one(&state.pool)
        .await?;

        let actual_amount = actual.unwrap_or(0.0);
        let remaining = budget.amount - actual_amount;
        let usage_rate = if budget.amount > 0.0 {
            actual_amount / budget.amount
        } else {
            0.0
        };

        result.push(BudgetVsActual {
            category: budget.category.clone(),
            budget_amount: budget.amount,
            actual_amount,
            remaining,
            usage_rate,
            over_budget: actual_amount > budget.amount,
        });
    }

    Ok(Json(result))
}

pub async fn upsert_budget(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateMonthlyBudget>,
) -> Result<Json<MonthlyBudget>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();

    let existing: Option<MonthlyBudget> = sqlx::query_as(
        "SELECT id, home_id, category, amount, year_month FROM monthly_budgets WHERE home_id = ? AND category = ? AND year_month = ?",
    )
    .bind(&home_id)
    .bind(&input.category)
    .bind(&input.year_month)
    .fetch_optional(&state.pool)
    .await?;

    if let Some(existing) = existing {
        sqlx::query("UPDATE monthly_budgets SET amount = ? WHERE id = ?")
            .bind(input.amount)
            .bind(&existing.id)
            .execute(&state.pool)
            .await?;

        Ok(Json(MonthlyBudget {
            amount: input.amount,
            ..existing
        }))
    } else {
        let budget = MonthlyBudget::new(home_id, input);

        sqlx::query(
            "INSERT INTO monthly_budgets (id, home_id, category, amount, year_month) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&budget.id)
        .bind(&budget.home_id)
        .bind(&budget.category)
        .bind(budget.amount)
        .bind(&budget.year_month)
        .execute(&state.pool)
        .await?;

        Ok(Json(budget))
    }
}

pub async fn delete_budget(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM monthly_budgets WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}
