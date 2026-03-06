use axum::extract::{Path, Query, State};
use axum::{Extension, Json};

use crate::errors::AppError;
use crate::models::*;
use crate::validation::*;
use crate::AppState;

#[derive(serde::Deserialize)]
pub struct BudgetQuery {
    pub year_month: Option<String>,
}

pub async fn list_entries(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<BudgetQuery>,
) -> Result<Json<Vec<BudgetEntry>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    // Process any due subscriptions before listing
    if let Err(e) = super::subscriptions::process_due_subscriptions(&state.pool, home_id).await {
        tracing::warn!("Failed to process subscriptions: {e:?}");
    }

    let entries = if let Some(ym) = &query.year_month {
        sqlx::query_as::<_, BudgetEntry>(
            "SELECT id, home_id, date, amount, category, description, paid_by, receipt_image_url, account_id FROM budget_entries WHERE home_id = ? AND date LIKE ? || '%' ORDER BY date DESC",
        )
        .bind(home_id)
        .bind(ym)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, BudgetEntry>(
            "SELECT id, home_id, date, amount, category, description, paid_by, receipt_image_url, account_id FROM budget_entries WHERE home_id = ? ORDER BY date DESC",
        )
        .bind(home_id)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(entries))
}

pub async fn create_entry(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateBudgetEntry>,
) -> Result<Json<BudgetEntry>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    validate_amount(input.amount, "amount")?;
    validate_name(&input.category, "category")?;
    validate_description(&input.description, "description")?;
    let entry = BudgetEntry::new(home_id, input);

    sqlx::query(
        "INSERT INTO budget_entries (id, home_id, date, amount, category, description, paid_by, receipt_image_url, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&entry.id)
    .bind(&entry.home_id)
    .bind(&entry.date)
    .bind(entry.amount)
    .bind(&entry.category)
    .bind(&entry.description)
    .bind(&entry.paid_by)
    .bind(&entry.receipt_image_url)
    .bind(&entry.account_id)
    .execute(&state.pool)
    .await?;

    Ok(Json(entry))
}

pub async fn update_entry(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateBudgetEntry>,
) -> Result<Json<BudgetEntry>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: BudgetEntry = sqlx::query_as(
        "SELECT id, home_id, date, amount, category, description, paid_by, receipt_image_url, account_id FROM budget_entries WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let updated = BudgetEntry {
        id: id.clone(),
        home_id: home_id.to_string(),
        date: input.date.unwrap_or(existing.date),
        amount: input.amount.unwrap_or(existing.amount),
        category: input.category.unwrap_or(existing.category),
        description: input.description.unwrap_or(existing.description),
        paid_by: input.paid_by.unwrap_or(existing.paid_by),
        receipt_image_url: input.receipt_image_url.or(existing.receipt_image_url),
        account_id: input.account_id.or(existing.account_id),
    };

    sqlx::query(
        "UPDATE budget_entries SET date = ?, amount = ?, category = ?, description = ?, paid_by = ?, receipt_image_url = ?, account_id = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&updated.date)
    .bind(updated.amount)
    .bind(&updated.category)
    .bind(&updated.description)
    .bind(&updated.paid_by)
    .bind(&updated.receipt_image_url)
    .bind(&updated.account_id)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    Ok(Json(updated))
}

pub async fn delete_entry(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM budget_entries WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

pub async fn summary(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<BudgetQuery>,
) -> Result<Json<BudgetSummary>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let ym = query.year_month.unwrap_or_else(|| {
        let now = chrono::Utc::now();
        format!("{}-{:02}", now.format("%Y"), now.format("%m"))
    });

    let entries: Vec<BudgetEntry> = sqlx::query_as(
        "SELECT id, home_id, date, amount, category, description, paid_by, receipt_image_url, account_id FROM budget_entries WHERE home_id = ? AND date LIKE ? || '%'",
    )
    .bind(home_id)
    .bind(&ym)
    .fetch_all(&state.pool)
    .await?;

    let monthly_total: f64 = entries.iter().map(|e| e.amount).sum();

    let mut by_person = std::collections::HashMap::new();
    for entry in &entries {
        *by_person.entry(entry.paid_by.clone()).or_insert(0.0) += entry.amount;
    }

    let mut by_category = std::collections::HashMap::new();
    for entry in &entries {
        *by_category.entry(entry.category.clone()).or_insert(0.0) += entry.amount;
    }

    Ok(Json(BudgetSummary {
        monthly_total,
        by_person,
        by_category,
    }))
}
