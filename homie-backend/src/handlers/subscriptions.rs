use axum::extract::{Path, State};
use axum::{Extension, Json};
use chrono::{Datelike, FixedOffset, NaiveDate, Utc};

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;
use crate::validation::*;

const SUB_SELECT: &str = "SELECT id, home_id, name, amount, category, paid_by, account_id, billing_cycle, billing_day, next_billing_date, is_active, note, created_at, google_event_id, sync_to_calendar FROM subscriptions";

pub async fn list_subscriptions(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<Subscription>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let subs: Vec<Subscription> = sqlx::query_as(&format!(
        "{SUB_SELECT} WHERE home_id = ? ORDER BY is_active DESC, next_billing_date ASC"
    ))
    .bind(home_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(subs))
}

pub async fn create_subscription(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateSubscription>,
) -> Result<Json<Subscription>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    validate_name(&input.name, "name")?;
    validate_amount(input.amount, "amount")?;
    validate_enum(
        &input.billing_cycle,
        &["monthly", "yearly", "weekly"],
        "billingCycle",
    )?;
    validate_day_of_month(input.billing_day, "billingDay")?;
    validate_name(&input.category, "category")?;
    let mut sub = Subscription::new(home_id, input);

    sqlx::query(
        "INSERT INTO subscriptions (id, home_id, name, amount, category, paid_by, account_id, billing_cycle, billing_day, next_billing_date, is_active, note, created_at, google_event_id, sync_to_calendar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&sub.id)
    .bind(&sub.home_id)
    .bind(&sub.name)
    .bind(sub.amount)
    .bind(&sub.category)
    .bind(&sub.paid_by)
    .bind(&sub.account_id)
    .bind(&sub.billing_cycle)
    .bind(sub.billing_day)
    .bind(&sub.next_billing_date)
    .bind(sub.is_active)
    .bind(&sub.note)
    .bind(&sub.created_at)
    .bind(&sub.google_event_id)
    .bind(sub.sync_to_calendar)
    .execute(&state.pool)
    .await?;

    if sub.sync_to_calendar
        && let Ok(Some(event_id)) = crate::handlers::google_calendar::push_subscription_to_google(
            &state.pool,
            &auth.user_id,
            &sub,
        )
        .await
    {
        sqlx::query("UPDATE subscriptions SET google_event_id = ? WHERE id = ?")
            .bind(&event_id)
            .bind(&sub.id)
            .execute(&state.pool)
            .await?;
        sub.google_event_id = Some(event_id);
    }

    Ok(Json(sub))
}

pub async fn update_subscription(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSubscription>,
) -> Result<Json<Subscription>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: Subscription =
        sqlx::query_as(&format!("{SUB_SELECT} WHERE id = ? AND home_id = ?"))
            .bind(&id)
            .bind(home_id)
            .fetch_one(&state.pool)
            .await?;

    let mut updated = Subscription {
        id: id.clone(),
        home_id: home_id.to_string(),
        name: input.name.unwrap_or(existing.name.clone()),
        amount: input.amount.unwrap_or(existing.amount),
        category: input.category.unwrap_or(existing.category.clone()),
        paid_by: input.paid_by.unwrap_or(existing.paid_by),
        account_id: input.account_id.or(existing.account_id),
        billing_cycle: input.billing_cycle.unwrap_or(existing.billing_cycle),
        billing_day: input.billing_day.unwrap_or(existing.billing_day),
        next_billing_date: input
            .next_billing_date
            .unwrap_or(existing.next_billing_date),
        is_active: input.is_active.unwrap_or(existing.is_active),
        note: input.note.or(existing.note),
        created_at: existing.created_at,
        google_event_id: existing.google_event_id.clone(),
        sync_to_calendar: input.sync_to_calendar.unwrap_or(existing.sync_to_calendar),
    };

    sqlx::query(
        "UPDATE subscriptions SET name = ?, amount = ?, category = ?, paid_by = ?, account_id = ?, billing_cycle = ?, billing_day = ?, next_billing_date = ?, is_active = ?, note = ?, google_event_id = ?, sync_to_calendar = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&updated.name)
    .bind(updated.amount)
    .bind(&updated.category)
    .bind(&updated.paid_by)
    .bind(&updated.account_id)
    .bind(&updated.billing_cycle)
    .bind(updated.billing_day)
    .bind(&updated.next_billing_date)
    .bind(updated.is_active)
    .bind(&updated.note)
    .bind(&updated.google_event_id)
    .bind(updated.sync_to_calendar)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    // Handle Google Calendar sync
    let sync_to_cal = updated.sync_to_calendar;
    let had_event = existing.google_event_id.is_some();

    if !sync_to_cal || !updated.is_active {
        // Remove calendar event if sync disabled or subscription deactivated
        if let Some(ref event_id) = updated.google_event_id {
            crate::handlers::google_calendar::delete_event_on_google(
                &state.pool,
                &auth.user_id,
                event_id,
            )
            .await;
            sqlx::query("UPDATE subscriptions SET google_event_id = NULL WHERE id = ?")
                .bind(&id)
                .execute(&state.pool)
                .await?;
            updated.google_event_id = None;
        }
    } else if had_event {
        // Update existing calendar event
        crate::handlers::google_calendar::update_subscription_on_google(
            &state.pool,
            &auth.user_id,
            &updated,
        )
        .await;
    } else {
        // Create new calendar event
        if let Ok(Some(event_id)) = crate::handlers::google_calendar::push_subscription_to_google(
            &state.pool,
            &auth.user_id,
            &updated,
        )
        .await
        {
            sqlx::query("UPDATE subscriptions SET google_event_id = ? WHERE id = ?")
                .bind(&event_id)
                .bind(&id)
                .execute(&state.pool)
                .await?;
            updated.google_event_id = Some(event_id);
        }
    }

    Ok(Json(updated))
}

pub async fn delete_subscription(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let sub: Option<Subscription> =
        sqlx::query_as(&format!("{SUB_SELECT} WHERE id = ? AND home_id = ?"))
            .bind(&id)
            .bind(home_id)
            .fetch_optional(&state.pool)
            .await?;

    if let Some(ref sub) = sub
        && let Some(ref event_id) = sub.google_event_id
    {
        crate::handlers::google_calendar::delete_event_on_google(
            &state.pool,
            &auth.user_id,
            event_id,
        )
        .await;
    }

    sqlx::query("DELETE FROM subscriptions WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

/// Process due subscriptions: create budget entries for any that are past due.
pub async fn process_due_subscriptions(
    pool: &sqlx::SqlitePool,
    home_id: &str,
) -> Result<(), AppError> {
    let jst = FixedOffset::east_opt(9 * 3600).unwrap();
    let today = Utc::now()
        .with_timezone(&jst)
        .format("%Y-%m-%d")
        .to_string();

    let due_subs: Vec<Subscription> = sqlx::query_as(&format!(
        "{SUB_SELECT} WHERE home_id = ? AND is_active = 1 AND next_billing_date <= ?"
    ))
    .bind(home_id)
    .bind(&today)
    .fetch_all(pool)
    .await?;

    for sub in due_subs {
        let mut current_date = NaiveDate::parse_from_str(&sub.next_billing_date, "%Y-%m-%d")
            .map_err(|e| AppError::Internal(format!("Invalid date: {e}")))?;
        let today_date = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
            .map_err(|e| AppError::Internal(format!("Invalid date: {e}")))?;

        while current_date <= today_date {
            let entry_id = uuid::Uuid::new_v4().to_string();
            let date_str = current_date.format("%Y-%m-%d").to_string();
            let description = format!("【定期】{}", sub.name);

            sqlx::query(
                "INSERT INTO budget_entries (id, home_id, date, amount, category, description, paid_by, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&entry_id)
            .bind(&sub.home_id)
            .bind(&date_str)
            .bind(sub.amount)
            .bind(&sub.category)
            .bind(&description)
            .bind(&sub.paid_by)
            .bind(&sub.account_id)
            .execute(pool)
            .await?;

            current_date = advance_date(current_date, &sub.billing_cycle);
        }

        let next_date = current_date.format("%Y-%m-%d").to_string();
        sqlx::query("UPDATE subscriptions SET next_billing_date = ? WHERE id = ?")
            .bind(&next_date)
            .bind(&sub.id)
            .execute(pool)
            .await?;
    }

    Ok(())
}

fn advance_date(date: NaiveDate, cycle: &str) -> NaiveDate {
    match cycle {
        "weekly" => date + chrono::Duration::weeks(1),
        "yearly" => date
            .with_year(date.year() + 1)
            .unwrap_or(date + chrono::Duration::days(365)),
        _ => {
            // monthly
            let (y, m) = if date.month() == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), date.month() + 1)
            };
            NaiveDate::from_ymd_opt(y, m, date.day())
                .or_else(|| {
                    let last_day = last_day_of_month(y, m);
                    NaiveDate::from_ymd_opt(y, m, last_day)
                })
                .unwrap_or(date + chrono::Duration::days(30))
        }
    }
}

fn last_day_of_month(year: i32, month: u32) -> u32 {
    if month == 12 {
        31
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap()
            .pred_opt()
            .unwrap()
            .day()
    }
}
