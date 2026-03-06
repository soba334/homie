use axum::extract::{Path, Query, State};
use axum::{Extension, Json};

use crate::errors::AppError;
use crate::models::*;
use crate::AppState;

#[derive(serde::Deserialize)]
pub struct SalaryQuery {
    pub year_month: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct PredictQuery {
    pub year_month: String,
    pub employment_id: String,
}

// ── Salary Prediction ──

pub async fn predict(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<PredictQuery>,
) -> Result<Json<SalaryPrediction>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let emp: Employment = sqlx::query_as(
        "SELECT id, user_id, home_id, name, type, hourly_rate, night_start_hour, night_end_hour, night_rate_multiplier, holiday_rate_multiplier, overtime_threshold_minutes, overtime_rate_multiplier, monthly_salary, transport_allowance, pay_day, social_insurance_rate, income_tax_rate, color, note, deposit_account_id, created_at FROM employments WHERE id = ? AND home_id = ?",
    )
    .bind(&query.employment_id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let shifts: Vec<Shift> = sqlx::query_as(
        "SELECT id, employment_id, user_id, home_id, date, start_time, end_time, break_minutes, is_holiday, note, created_at FROM shifts WHERE employment_id = ? AND home_id = ? AND date LIKE ? || '%' ORDER BY date",
    )
    .bind(&query.employment_id)
    .bind(home_id)
    .bind(&query.year_month)
    .fetch_all(&state.pool)
    .await?;

    let prediction = if emp.employment_type == "part_time" {
        predict_part_time(&emp, &shifts, &query.year_month)
    } else {
        predict_full_time(&emp, &shifts, &query.year_month)
    };

    Ok(Json(prediction))
}

fn predict_part_time(emp: &Employment, shifts: &[Shift], year_month: &str) -> SalaryPrediction {
    let hourly_rate = emp.hourly_rate.unwrap_or(0.0);
    let night_start = emp.night_start_hour.unwrap_or(22) as u32;
    let night_end = emp.night_end_hour.unwrap_or(5) as u32;
    let night_mul = emp.night_rate_multiplier.unwrap_or(1.25);
    let holiday_mul = emp.holiday_rate_multiplier.unwrap_or(1.35);
    let ot_threshold = emp.overtime_threshold_minutes.unwrap_or(480);
    let ot_mul = emp.overtime_rate_multiplier.unwrap_or(1.25);
    let transport = emp.transport_allowance.unwrap_or(0.0);
    let si_rate = emp.social_insurance_rate.unwrap_or(0.15);
    let tax_rate = emp.income_tax_rate.unwrap_or(0.05);

    let mut total_base = 0.0;
    let mut total_overtime = 0.0;
    let mut total_night = 0.0;
    let mut total_holiday = 0.0;
    let mut total_work_minutes = 0;
    let mut shift_details = Vec::new();

    for shift in shifts {
        let start_mins = parse_time_minutes(&shift.start_time);
        let end_mins = parse_time_minutes(&shift.end_time);

        let raw_work = if end_mins > start_mins {
            end_mins - start_mins
        } else {
            (24 * 60 - start_mins) + end_mins
        };
        let work_mins = raw_work - shift.break_minutes;
        total_work_minutes += work_mins;

        let normal_mins = work_mins.min(ot_threshold);
        let overtime_mins = (work_mins - ot_threshold).max(0);

        let night_mins = calc_night_minutes(start_mins, end_mins, night_start, night_end);
        let day_normal_mins = (normal_mins - night_mins.min(normal_mins)).max(0);

        let base = day_normal_mins as f64 * hourly_rate / 60.0;
        let night = night_mins as f64 * hourly_rate / 60.0 * night_mul;
        let overtime = overtime_mins as f64 * hourly_rate / 60.0 * ot_mul;
        let holiday = if shift.is_holiday {
            work_mins as f64 * hourly_rate / 60.0 * (holiday_mul - 1.0)
        } else {
            0.0
        };

        let pay = base + night + overtime + holiday;

        total_base += base;
        total_night += night;
        total_overtime += overtime;
        total_holiday += holiday;

        shift_details.push(ShiftPayDetail {
            shift_id: shift.id.clone(),
            date: shift.date.clone(),
            work_minutes: work_mins,
            normal_minutes: normal_mins,
            overtime_minutes: overtime_mins,
            night_minutes: night_mins,
            is_holiday: shift.is_holiday,
            pay,
        });
    }

    let total_transport = transport * shifts.len() as f64;
    let gross = total_base + total_overtime + total_night + total_holiday + total_transport;
    let social_insurance = gross * si_rate;
    let income_tax = (gross - social_insurance) * tax_rate;
    let total_deductions = social_insurance + income_tax;
    let net = gross - total_deductions;

    SalaryPrediction {
        employment_id: emp.id.clone(),
        employment_name: emp.name.clone(),
        year_month: year_month.to_string(),
        total_shifts: shifts.len() as u32,
        total_work_minutes,
        base_pay: total_base,
        overtime_pay: total_overtime,
        night_pay: total_night,
        holiday_pay: total_holiday,
        transport_allowance: total_transport,
        gross_amount: gross,
        social_insurance,
        income_tax,
        total_deductions,
        net_amount: net,
        shift_details,
    }
}

fn predict_full_time(emp: &Employment, shifts: &[Shift], year_month: &str) -> SalaryPrediction {
    let monthly_salary = emp.monthly_salary.unwrap_or(0.0);
    let transport = emp.transport_allowance.unwrap_or(0.0);
    let si_rate = emp.social_insurance_rate.unwrap_or(0.15);
    let tax_rate = emp.income_tax_rate.unwrap_or(0.05);

    let gross = monthly_salary + transport;
    let social_insurance = monthly_salary * si_rate;
    let income_tax = (monthly_salary - social_insurance) * tax_rate;
    let total_deductions = social_insurance + income_tax;
    let net = gross - total_deductions;

    let total_work_minutes: i32 = shifts.iter().map(|s| {
        let start = parse_time_minutes(&s.start_time);
        let end = parse_time_minutes(&s.end_time);
        let raw = if end > start { end - start } else { (24 * 60 - start) + end };
        raw - s.break_minutes
    }).sum();

    SalaryPrediction {
        employment_id: emp.id.clone(),
        employment_name: emp.name.clone(),
        year_month: year_month.to_string(),
        total_shifts: shifts.len() as u32,
        total_work_minutes,
        base_pay: monthly_salary,
        overtime_pay: 0.0,
        night_pay: 0.0,
        holiday_pay: 0.0,
        transport_allowance: transport,
        gross_amount: gross,
        social_insurance,
        income_tax,
        total_deductions,
        net_amount: net,
        shift_details: vec![],
    }
}

fn parse_time_minutes(time: &str) -> i32 {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() >= 2 {
        let h: i32 = parts[0].parse().unwrap_or(0);
        let m: i32 = parts[1].parse().unwrap_or(0);
        h * 60 + m
    } else {
        0
    }
}

fn calc_night_minutes(start: i32, end: i32, night_start_hour: u32, night_end_hour: u32) -> i32 {
    let night_start = night_start_hour as i32 * 60;
    let night_end = night_end_hour as i32 * 60;
    let total_day = 24 * 60;

    let mut night = 0;

    if end > start {
        // Same-day shift
        // Night period 1: night_start..24:00
        night += overlap(start, end, night_start, total_day);
        // Night period 2: 00:00..night_end
        night += overlap(start, end, 0, night_end);
    } else {
        // Overnight shift: start..24:00, 0:00..end
        night += overlap(start, total_day, night_start, total_day);
        night += overlap(0, end, 0, night_end);
        // Also check if midnight-crossing part hits night hours
        night += overlap(0, end, night_start, total_day); // unlikely but handle
        night += overlap(start, total_day, 0, night_end); // unlikely but handle
    }

    night
}

fn overlap(a_start: i32, a_end: i32, b_start: i32, b_end: i32) -> i32 {
    (a_end.min(b_end) - a_start.max(b_start)).max(0)
}

// ── Salary Records CRUD ──

pub async fn list_records(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<SalaryQuery>,
) -> Result<Json<Vec<SalaryRecord>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let records = if let Some(ym) = &query.year_month {
        sqlx::query_as::<_, SalaryRecord>(
            "SELECT id, user_id, home_id, employment_id, year_month, base_pay, overtime_pay, night_pay, holiday_pay, transport_allowance, other_allowances, gross_amount, social_insurance, income_tax, other_deductions, net_amount, paid_date, deposit_account_id, note, created_at FROM salary_records WHERE home_id = ? AND year_month = ? ORDER BY created_at",
        )
        .bind(home_id)
        .bind(ym)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, SalaryRecord>(
            "SELECT id, user_id, home_id, employment_id, year_month, base_pay, overtime_pay, night_pay, holiday_pay, transport_allowance, other_allowances, gross_amount, social_insurance, income_tax, other_deductions, net_amount, paid_date, deposit_account_id, note, created_at FROM salary_records WHERE home_id = ? ORDER BY year_month DESC",
        )
        .bind(home_id)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(records))
}

pub async fn create_record(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateSalaryRecord>,
) -> Result<Json<SalaryRecord>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    // Fall back to employment's deposit_account_id if not specified
    let mut input = input;
    if input.deposit_account_id.is_none() {
        if let Ok(emp) = sqlx::query_as::<_, Employment>(
            "SELECT id, user_id, home_id, name, type, hourly_rate, night_start_hour, night_end_hour, night_rate_multiplier, holiday_rate_multiplier, overtime_threshold_minutes, overtime_rate_multiplier, monthly_salary, transport_allowance, pay_day, social_insurance_rate, income_tax_rate, color, note, deposit_account_id, created_at FROM employments WHERE id = ? AND home_id = ?",
        )
        .bind(&input.employment_id)
        .bind(&home_id)
        .fetch_one(&state.pool)
        .await
        {
            input.deposit_account_id = emp.deposit_account_id;
        }
    }
    let record = SalaryRecord::new(auth.user_id.clone(), home_id, input);

    sqlx::query(
        "INSERT INTO salary_records (id, user_id, home_id, employment_id, year_month, base_pay, overtime_pay, night_pay, holiday_pay, transport_allowance, other_allowances, gross_amount, social_insurance, income_tax, other_deductions, net_amount, paid_date, deposit_account_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.id)
    .bind(&record.user_id)
    .bind(&record.home_id)
    .bind(&record.employment_id)
    .bind(&record.year_month)
    .bind(record.base_pay)
    .bind(record.overtime_pay)
    .bind(record.night_pay)
    .bind(record.holiday_pay)
    .bind(record.transport_allowance)
    .bind(record.other_allowances)
    .bind(record.gross_amount)
    .bind(record.social_insurance)
    .bind(record.income_tax)
    .bind(record.other_deductions)
    .bind(record.net_amount)
    .bind(&record.paid_date)
    .bind(&record.deposit_account_id)
    .bind(&record.note)
    .bind(&record.created_at)
    .execute(&state.pool)
    .await?;

    // Auto-create account transaction if deposit_account_id is set
    if let Some(account_id) = &record.deposit_account_id {
        let tx_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO account_transactions (id, account_id, home_id, amount, type, category, description, date, salary_record_id, created_at) VALUES (?, ?, ?, ?, 'income', '給料', ?, ?, ?, ?)",
        )
        .bind(&tx_id)
        .bind(account_id)
        .bind(&record.home_id)
        .bind(record.net_amount)
        .bind(format!("給料: {}", record.year_month))
        .bind(record.paid_date.as_deref().unwrap_or(&record.created_at))
        .bind(&record.id)
        .bind(&record.created_at)
        .execute(&state.pool)
        .await?;
    }

    Ok(Json(record))
}

pub async fn update_record(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSalaryRecord>,
) -> Result<Json<SalaryRecord>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: SalaryRecord = sqlx::query_as(
        "SELECT id, user_id, home_id, employment_id, year_month, base_pay, overtime_pay, night_pay, holiday_pay, transport_allowance, other_allowances, gross_amount, social_insurance, income_tax, other_deductions, net_amount, paid_date, deposit_account_id, note, created_at FROM salary_records WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let updated = SalaryRecord {
        id: id.clone(),
        user_id: existing.user_id,
        home_id: home_id.to_string(),
        employment_id: existing.employment_id,
        year_month: existing.year_month,
        base_pay: input.base_pay.unwrap_or(existing.base_pay),
        overtime_pay: input.overtime_pay.unwrap_or(existing.overtime_pay),
        night_pay: input.night_pay.unwrap_or(existing.night_pay),
        holiday_pay: input.holiday_pay.unwrap_or(existing.holiday_pay),
        transport_allowance: input.transport_allowance.unwrap_or(existing.transport_allowance),
        other_allowances: input.other_allowances.unwrap_or(existing.other_allowances),
        gross_amount: input.gross_amount.unwrap_or(existing.gross_amount),
        social_insurance: input.social_insurance.unwrap_or(existing.social_insurance),
        income_tax: input.income_tax.unwrap_or(existing.income_tax),
        other_deductions: input.other_deductions.unwrap_or(existing.other_deductions),
        net_amount: input.net_amount.unwrap_or(existing.net_amount),
        paid_date: input.paid_date.or(existing.paid_date),
        deposit_account_id: input.deposit_account_id.or(existing.deposit_account_id),
        note: input.note.or(existing.note),
        created_at: existing.created_at,
    };

    sqlx::query(
        "UPDATE salary_records SET base_pay = ?, overtime_pay = ?, night_pay = ?, holiday_pay = ?, transport_allowance = ?, other_allowances = ?, gross_amount = ?, social_insurance = ?, income_tax = ?, other_deductions = ?, net_amount = ?, paid_date = ?, deposit_account_id = ?, note = ? WHERE id = ? AND home_id = ?",
    )
    .bind(updated.base_pay)
    .bind(updated.overtime_pay)
    .bind(updated.night_pay)
    .bind(updated.holiday_pay)
    .bind(updated.transport_allowance)
    .bind(updated.other_allowances)
    .bind(updated.gross_amount)
    .bind(updated.social_insurance)
    .bind(updated.income_tax)
    .bind(updated.other_deductions)
    .bind(updated.net_amount)
    .bind(&updated.paid_date)
    .bind(&updated.deposit_account_id)
    .bind(&updated.note)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    Ok(Json(updated))
}

pub async fn delete_record(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    // Also delete associated account transaction
    sqlx::query("DELETE FROM account_transactions WHERE salary_record_id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;

    sqlx::query("DELETE FROM salary_records WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}
