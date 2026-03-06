use axum::extract::{Path, State};
use axum::{Extension, Json};

use crate::errors::AppError;
use crate::models::*;
use crate::validation::*;
use crate::AppState;

pub async fn list_employments(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<Employment>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let employments: Vec<Employment> = sqlx::query_as(
        "SELECT id, user_id, home_id, name, type, hourly_rate, night_start_hour, night_end_hour, night_rate_multiplier, holiday_rate_multiplier, overtime_threshold_minutes, overtime_rate_multiplier, monthly_salary, transport_allowance, pay_day, social_insurance_rate, income_tax_rate, color, note, deposit_account_id, created_at FROM employments WHERE home_id = ? ORDER BY created_at",
    )
    .bind(home_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(employments))
}

pub async fn create_employment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateEmployment>,
) -> Result<Json<Employment>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    validate_name(&input.name, "name")?;
    validate_enum(&input.employment_type, &["part_time", "full_time"], "type")?;
    if let Some(rate) = input.hourly_rate {
        validate_amount(rate, "hourlyRate")?;
    }
    if let Some(salary) = input.monthly_salary {
        validate_amount(salary, "monthlySalary")?;
    }
    if let Some(h) = input.night_start_hour {
        validate_hour(h, "nightStartHour")?;
    }
    if let Some(h) = input.night_end_hour {
        validate_hour(h, "nightEndHour")?;
    }
    let emp = Employment::new(auth.user_id.clone(), home_id, input);

    sqlx::query(
        "INSERT INTO employments (id, user_id, home_id, name, type, hourly_rate, night_start_hour, night_end_hour, night_rate_multiplier, holiday_rate_multiplier, overtime_threshold_minutes, overtime_rate_multiplier, monthly_salary, transport_allowance, pay_day, social_insurance_rate, income_tax_rate, color, note, deposit_account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&emp.id)
    .bind(&emp.user_id)
    .bind(&emp.home_id)
    .bind(&emp.name)
    .bind(&emp.employment_type)
    .bind(emp.hourly_rate)
    .bind(emp.night_start_hour)
    .bind(emp.night_end_hour)
    .bind(emp.night_rate_multiplier)
    .bind(emp.holiday_rate_multiplier)
    .bind(emp.overtime_threshold_minutes)
    .bind(emp.overtime_rate_multiplier)
    .bind(emp.monthly_salary)
    .bind(emp.transport_allowance)
    .bind(emp.pay_day)
    .bind(emp.social_insurance_rate)
    .bind(emp.income_tax_rate)
    .bind(&emp.color)
    .bind(&emp.note)
    .bind(&emp.deposit_account_id)
    .bind(&emp.created_at)
    .execute(&state.pool)
    .await?;

    Ok(Json(emp))
}

pub async fn update_employment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateEmployment>,
) -> Result<Json<Employment>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: Employment = sqlx::query_as(
        "SELECT id, user_id, home_id, name, type, hourly_rate, night_start_hour, night_end_hour, night_rate_multiplier, holiday_rate_multiplier, overtime_threshold_minutes, overtime_rate_multiplier, monthly_salary, transport_allowance, pay_day, social_insurance_rate, income_tax_rate, color, note, deposit_account_id, created_at FROM employments WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let updated = Employment {
        id: id.clone(),
        user_id: existing.user_id,
        home_id: home_id.to_string(),
        name: input.name.unwrap_or(existing.name),
        employment_type: existing.employment_type,
        hourly_rate: input.hourly_rate.or(existing.hourly_rate),
        night_start_hour: input.night_start_hour.or(existing.night_start_hour),
        night_end_hour: input.night_end_hour.or(existing.night_end_hour),
        night_rate_multiplier: input.night_rate_multiplier.or(existing.night_rate_multiplier),
        holiday_rate_multiplier: input.holiday_rate_multiplier.or(existing.holiday_rate_multiplier),
        overtime_threshold_minutes: input.overtime_threshold_minutes.or(existing.overtime_threshold_minutes),
        overtime_rate_multiplier: input.overtime_rate_multiplier.or(existing.overtime_rate_multiplier),
        monthly_salary: input.monthly_salary.or(existing.monthly_salary),
        transport_allowance: input.transport_allowance.or(existing.transport_allowance),
        pay_day: input.pay_day.or(existing.pay_day),
        social_insurance_rate: input.social_insurance_rate.or(existing.social_insurance_rate),
        income_tax_rate: input.income_tax_rate.or(existing.income_tax_rate),
        color: input.color.or(existing.color),
        note: input.note.or(existing.note),
        deposit_account_id: input.deposit_account_id.or(existing.deposit_account_id),
        created_at: existing.created_at,
    };

    sqlx::query(
        "UPDATE employments SET name = ?, hourly_rate = ?, night_start_hour = ?, night_end_hour = ?, night_rate_multiplier = ?, holiday_rate_multiplier = ?, overtime_threshold_minutes = ?, overtime_rate_multiplier = ?, monthly_salary = ?, transport_allowance = ?, pay_day = ?, social_insurance_rate = ?, income_tax_rate = ?, color = ?, note = ?, deposit_account_id = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&updated.name)
    .bind(updated.hourly_rate)
    .bind(updated.night_start_hour)
    .bind(updated.night_end_hour)
    .bind(updated.night_rate_multiplier)
    .bind(updated.holiday_rate_multiplier)
    .bind(updated.overtime_threshold_minutes)
    .bind(updated.overtime_rate_multiplier)
    .bind(updated.monthly_salary)
    .bind(updated.transport_allowance)
    .bind(updated.pay_day)
    .bind(updated.social_insurance_rate)
    .bind(updated.income_tax_rate)
    .bind(&updated.color)
    .bind(&updated.note)
    .bind(&updated.deposit_account_id)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    Ok(Json(updated))
}

pub async fn delete_employment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM employments WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}
