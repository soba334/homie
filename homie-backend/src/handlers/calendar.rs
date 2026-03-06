use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{Datelike, NaiveDate, Weekday};
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::*;
use crate::AppState;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarQuery {
    pub date: Option<String>,
    pub month: Option<String>,
    pub start: Option<String>,
    pub end: Option<String>,
}

// ── Recurrence expansion ──

fn expand_recurrence(
    start_date: &str,
    rule: &str,
    interval: i32,
    recurrence_end: Option<&str>,
    range_start: NaiveDate,
    range_end: NaiveDate,
) -> Vec<NaiveDate> {
    let Ok(event_start) = NaiveDate::parse_from_str(start_date, "%Y-%m-%d") else {
        return vec![];
    };
    let rec_end = recurrence_end
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .unwrap_or(range_end);
    let effective_end = rec_end.min(range_end);
    let interval = interval.max(1) as u32;

    let mut dates = Vec::new();
    let mut current = event_start;

    while current <= effective_end {
        if current >= range_start {
            dates.push(current);
        }
        current = match rule {
            "weekly" => current + chrono::Duration::weeks(interval as i64),
            "monthly" => advance_months(current, interval),
            "yearly" => advance_months(current, interval * 12),
            _ => break,
        };
    }
    dates
}

fn advance_months(date: NaiveDate, months: u32) -> NaiveDate {
    let total_months = date.year() as u32 * 12 + date.month0() + months;
    let new_year = (total_months / 12) as i32;
    let new_month = total_months % 12 + 1;
    let max_day = days_in_month(new_year, new_month);
    let new_day = date.day().min(max_day);
    NaiveDate::from_ymd_opt(new_year, new_month, new_day).unwrap_or(date)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    NaiveDate::from_ymd_opt(
        if month == 12 { year + 1 } else { year },
        if month == 12 { 1 } else { month + 1 },
        1,
    )
    .unwrap()
    .pred_opt()
    .unwrap()
    .day()
}

// ── Garbage schedule expansion ──

fn weekday_to_chrono(day: i32) -> Option<Weekday> {
    match day {
        0 => Some(Weekday::Sun),
        1 => Some(Weekday::Mon),
        2 => Some(Weekday::Tue),
        3 => Some(Weekday::Wed),
        4 => Some(Weekday::Thu),
        5 => Some(Weekday::Fri),
        6 => Some(Weekday::Sat),
        _ => None,
    }
}

fn week_of_month(date: NaiveDate) -> u32 {
    (date.day() - 1) / 7 + 1
}

fn expand_garbage_schedule(
    schedule: &GarbageSchedule,
    category_name: &str,
    category_color: &str,
    range_start: NaiveDate,
    range_end: NaiveDate,
    home_id: &str,
) -> Vec<ExpandedCalendarEvent> {
    let mut events = Vec::new();
    let mut current = range_start;

    let weekdays: Vec<Weekday> = schedule
        .day_of_week
        .iter()
        .filter_map(|&d| weekday_to_chrono(d))
        .collect();

    while current <= range_end {
        if weekdays.contains(&current.weekday()) {
            let matches_week = match &schedule.week_of_month {
                None => true,
                Some(weeks) => weeks.contains(&(week_of_month(current) as i32)),
            };
            if matches_week {
                let date_str = current.format("%Y-%m-%d").to_string();
                events.push(ExpandedCalendarEvent {
                    id: format!("{}:{}", schedule.id, date_str),
                    home_id: home_id.to_string(),
                    title: category_name.to_string(),
                    date: date_str.clone(),
                    end_date: None,
                    all_day: true,
                    event_type: "garbage".to_string(),
                    assignee: None,
                    completed: None,
                    color: Some(category_color.to_string()),
                    description: schedule.note.clone(),
                    google_event_id: None,
                    recurrence_rule: None,
                    recurrence_interval: None,
                    recurrence_end: None,
                    is_recurrence_instance: true,
                    original_event_id: None,
                    occurrence_date: Some(date_str),
                    garbage_schedule_id: Some(schedule.id.clone()),
                    google_calendar_id: None,
                    created_by: None,
                });
            }
        }
        current += chrono::Duration::days(1);
    }
    events
}

const CALENDAR_SELECT: &str = "SELECT id, home_id, title, date, end_date, all_day, type, assignee, completed, color, description, google_event_id, recurrence_rule, recurrence_interval, recurrence_end, google_calendar_id, created_by FROM calendar_events";

/// shared/garbage types are collaborative (anyone can edit), others are owner-only
fn is_collaborative(event_type: &str) -> bool {
    matches!(event_type, "shared" | "garbage")
}

fn check_edit_permission(event: &CalendarEvent, user_id: &str) -> Result<(), AppError> {
    if is_collaborative(&event.event_type) {
        return Ok(());
    }
    if event.created_by.as_deref() == Some(user_id) || event.created_by.is_none() {
        return Ok(());
    }
    Err(AppError::Forbidden("この予定は編集できません".to_string()))
}

pub async fn list_events(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<CalendarQuery>,
) -> Result<Json<Vec<ExpandedCalendarEvent>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    // Expanded mode: start/end specified
    if let (Some(start_str), Some(end_str)) = (&query.start, &query.end) {
        let range_start = NaiveDate::parse_from_str(start_str, "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest("Invalid start date format".to_string()))?;
        let range_end = NaiveDate::parse_from_str(end_str, "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest("Invalid end date format".to_string()))?;

        // Max 3 months
        if range_end - range_start > chrono::Duration::days(93) {
            return Err(AppError::BadRequest(
                "Date range must not exceed 3 months".to_string(),
            ));
        }

        let mut result: Vec<ExpandedCalendarEvent> = Vec::new();

        // 1. Non-recurring events in range
        let regular_events: Vec<CalendarEvent> = sqlx::query_as(&format!(
            "{} WHERE home_id = ? AND recurrence_rule IS NULL AND date >= ? AND date <= ? ORDER BY date",
            CALENDAR_SELECT
        ))
        .bind(home_id)
        .bind(start_str)
        .bind(end_str)
        .fetch_all(&state.pool)
        .await?;

        for event in &regular_events {
            result.push(event.to_expanded(false, None));
        }

        // 2. Recurring events (start date <= range_end)
        let recurring_events: Vec<CalendarEvent> = sqlx::query_as(&format!(
            "{} WHERE home_id = ? AND recurrence_rule IS NOT NULL AND date <= ?",
            CALENDAR_SELECT
        ))
        .bind(home_id)
        .bind(end_str)
        .fetch_all(&state.pool)
        .await?;

        for event in &recurring_events {
            let rule = event.recurrence_rule.as_deref().unwrap_or("");
            let interval = event.recurrence_interval.unwrap_or(1);
            let dates = expand_recurrence(
                &event.date,
                rule,
                interval,
                event.recurrence_end.as_deref(),
                range_start,
                range_end,
            );

            // Load exceptions for this event
            let exceptions: Vec<CalendarEventException> = sqlx::query_as(
                "SELECT id, event_id, original_date, is_deleted, title, date, end_date, all_day, assignee, color, description FROM calendar_event_exceptions WHERE event_id = ?",
            )
            .bind(&event.id)
            .fetch_all(&state.pool)
            .await?;

            for occ_date in dates {
                let date_str = occ_date.format("%Y-%m-%d").to_string();

                // Check for exception on this date
                if let Some(exc) = exceptions.iter().find(|e| e.original_date == date_str) {
                    if exc.is_deleted {
                        continue; // Skip deleted occurrence
                    }
                    // Apply exception overrides
                    let mut expanded = event.to_expanded(true, Some(date_str));
                    if let Some(ref t) = exc.title {
                        expanded.title = t.clone();
                    }
                    if let Some(ref d) = exc.date {
                        expanded.date = d.clone();
                    }
                    if let Some(ref ed) = exc.end_date {
                        expanded.end_date = Some(ed.clone());
                    }
                    if let Some(ad) = exc.all_day {
                        expanded.all_day = ad;
                    }
                    if let Some(ref a) = exc.assignee {
                        expanded.assignee = Some(a.clone());
                    }
                    if let Some(ref c) = exc.color {
                        expanded.color = Some(c.clone());
                    }
                    if let Some(ref d) = exc.description {
                        expanded.description = Some(d.clone());
                    }
                    result.push(expanded);
                } else {
                    result.push(event.to_expanded(true, Some(date_str)));
                }
            }
        }

        // 3. Garbage calendar (dynamic from schedules)
        let schedules: Vec<GarbageSchedule> = sqlx::query_as(
            "SELECT id, home_id, category_id, location, note FROM garbage_schedules WHERE home_id = ?",
        )
        .bind(home_id)
        .fetch_all(&state.pool)
        .await?;

        for schedule in &schedules {
            // Load day_of_week
            let days: Vec<(i32,)> = sqlx::query_as(
                "SELECT day_of_week FROM garbage_schedule_days WHERE schedule_id = ?",
            )
            .bind(&schedule.id)
            .fetch_all(&state.pool)
            .await?;
            let mut schedule = schedule.clone();
            schedule.day_of_week = days.into_iter().map(|(d,)| d).collect();

            // Load week_of_month
            let weeks: Vec<(i32,)> = sqlx::query_as(
                "SELECT week_of_month FROM garbage_schedule_weeks WHERE schedule_id = ?",
            )
            .bind(&schedule.id)
            .fetch_all(&state.pool)
            .await?;
            schedule.week_of_month = if weeks.is_empty() {
                None
            } else {
                Some(weeks.into_iter().map(|(w,)| w).collect())
            };

            // Get category info
            let cat: Option<GarbageCategory> = sqlx::query_as(
                "SELECT id, home_id, name, color, description FROM garbage_categories WHERE id = ?",
            )
            .bind(&schedule.category_id)
            .fetch_optional(&state.pool)
            .await?;

            if let Some(cat) = cat {
                let garbage_events = expand_garbage_schedule(
                    &schedule,
                    &cat.name,
                    &cat.color,
                    range_start,
                    range_end,
                    home_id,
                );
                result.extend(garbage_events);
            }
        }

        // Sort by date
        result.sort_by(|a, b| a.date.cmp(&b.date));

        return Ok(Json(result));
    }

    // Legacy mode: date/month filter (no expansion)
    let events = if let Some(date) = &query.date {
        sqlx::query_as::<_, CalendarEvent>(&format!(
            "{} WHERE home_id = ? AND date = ? ORDER BY date",
            CALENDAR_SELECT
        ))
        .bind(home_id)
        .bind(date)
        .fetch_all(&state.pool)
        .await?
    } else if let Some(month) = &query.month {
        sqlx::query_as::<_, CalendarEvent>(&format!(
            "{} WHERE home_id = ? AND date LIKE ? || '%' ORDER BY date",
            CALENDAR_SELECT
        ))
        .bind(home_id)
        .bind(month)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, CalendarEvent>(&format!(
            "{} WHERE home_id = ? ORDER BY date",
            CALENDAR_SELECT
        ))
        .bind(home_id)
        .fetch_all(&state.pool)
        .await?
    };

    let result: Vec<ExpandedCalendarEvent> = events
        .iter()
        .map(|e| e.to_expanded(false, None))
        .collect();

    Ok(Json(result))
}

fn validate_recurrence(rule: Option<&str>, interval: Option<i32>) -> Result<(), AppError> {
    if let Some(rule) = rule
        && !["weekly", "monthly", "yearly"].contains(&rule)
    {
        return Err(AppError::BadRequest(
            "recurrenceRule must be weekly, monthly, or yearly".to_string(),
        ));
    }
    if let Some(interval) = interval
        && interval < 1
    {
        return Err(AppError::BadRequest(
            "recurrenceInterval must be >= 1".to_string(),
        ));
    }
    Ok(())
}

pub async fn create_event(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateCalendarEvent>,
) -> Result<Json<CalendarEvent>, AppError> {
    validate_recurrence(input.recurrence_rule.as_deref(), input.recurrence_interval)?;

    let home_id = auth.home_id.as_deref().unwrap().to_string();
    let event = CalendarEvent::new(home_id, auth.user_id.clone(), input);

    sqlx::query(
        "INSERT INTO calendar_events (id, home_id, title, date, end_date, all_day, type, assignee, completed, color, description, google_event_id, recurrence_rule, recurrence_interval, recurrence_end, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&event.id)
    .bind(&event.home_id)
    .bind(&event.title)
    .bind(&event.date)
    .bind(&event.end_date)
    .bind(event.all_day)
    .bind(&event.event_type)
    .bind(&event.assignee)
    .bind(event.completed)
    .bind(&event.color)
    .bind(&event.description)
    .bind(&event.google_event_id)
    .bind(&event.recurrence_rule)
    .bind(event.recurrence_interval)
    .bind(&event.recurrence_end)
    .bind(&event.created_by)
    .execute(&state.pool)
    .await?;

    // Push to Google Calendar if connected
    if event.google_event_id.is_none()
        && event.recurrence_rule.is_none()
        && let Ok(Some(gid)) = crate::handlers::google_calendar::push_event_to_google(
            &state.pool,
            &auth.user_id,
            &event,
        )
        .await
    {
        sqlx::query("UPDATE calendar_events SET google_event_id = ? WHERE id = ?")
            .bind(&gid)
            .bind(&event.id)
            .execute(&state.pool)
            .await?;
    }

    Ok(Json(event))
}

pub async fn update_event(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateCalendarEvent>,
) -> Result<Json<CalendarEvent>, AppError> {
    validate_recurrence(input.recurrence_rule.as_deref(), input.recurrence_interval)?;

    let home_id = auth.home_id.as_deref().unwrap();

    let existing: CalendarEvent = sqlx::query_as(&format!(
        "{} WHERE id = ? AND home_id = ?",
        CALENDAR_SELECT
    ))
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    check_edit_permission(&existing, &auth.user_id)?;

    let updated = CalendarEvent {
        id: id.clone(),
        home_id: home_id.to_string(),
        title: input.title.unwrap_or(existing.title),
        date: input.date.unwrap_or(existing.date),
        end_date: input.end_date.or(existing.end_date),
        all_day: input.all_day.unwrap_or(existing.all_day),
        event_type: input.event_type.unwrap_or(existing.event_type),
        assignee: input.assignee.or(existing.assignee),
        completed: input.completed.or(existing.completed),
        color: input.color.or(existing.color),
        description: input.description.or(existing.description),
        google_event_id: input.google_event_id.or(existing.google_event_id),
        recurrence_rule: input.recurrence_rule.or(existing.recurrence_rule),
        recurrence_interval: input.recurrence_interval.or(existing.recurrence_interval),
        recurrence_end: input.recurrence_end.or(existing.recurrence_end),
        google_calendar_id: existing.google_calendar_id,
        created_by: existing.created_by,
    };

    sqlx::query(
        "UPDATE calendar_events SET title = ?, date = ?, end_date = ?, all_day = ?, type = ?, assignee = ?, completed = ?, color = ?, description = ?, google_event_id = ?, recurrence_rule = ?, recurrence_interval = ?, recurrence_end = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&updated.title)
    .bind(&updated.date)
    .bind(&updated.end_date)
    .bind(updated.all_day)
    .bind(&updated.event_type)
    .bind(&updated.assignee)
    .bind(updated.completed)
    .bind(&updated.color)
    .bind(&updated.description)
    .bind(&updated.google_event_id)
    .bind(&updated.recurrence_rule)
    .bind(updated.recurrence_interval)
    .bind(&updated.recurrence_end)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    // Push update to Google Calendar
    crate::handlers::google_calendar::update_event_on_google(&state.pool, &auth.user_id, &updated)
        .await;

    Ok(Json(updated))
}

pub async fn delete_event(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    // Get event to check ownership and google_event_id before deletion
    let event: Option<CalendarEvent> = sqlx::query_as(&format!(
        "{} WHERE id = ? AND home_id = ?",
        CALENDAR_SELECT
    ))
    .bind(&id)
    .bind(home_id)
    .fetch_optional(&state.pool)
    .await?;

    if let Some(ref ev) = event {
        check_edit_permission(ev, &auth.user_id)?;
    }

    sqlx::query("DELETE FROM calendar_events WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;

    // Delete from Google Calendar
    if let Some(event) = event
        && let Some(gid) = &event.google_event_id
    {
        crate::handlers::google_calendar::delete_event_on_google(
            &state.pool,
            &auth.user_id,
            gid,
        )
        .await;
    }

    Ok(())
}

pub async fn toggle_task(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<CalendarEvent>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: CalendarEvent = sqlx::query_as(&format!(
        "{} WHERE id = ? AND home_id = ?",
        CALENDAR_SELECT
    ))
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    check_edit_permission(&existing, &auth.user_id)?;

    let new_completed = !existing.completed.unwrap_or(false);

    sqlx::query("UPDATE calendar_events SET completed = ? WHERE id = ? AND home_id = ?")
        .bind(new_completed)
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;

    Ok(Json(CalendarEvent {
        completed: Some(new_completed),
        ..existing
    }))
}

// ── Exception handlers ──

pub async fn create_exception(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(event_id): Path<String>,
    Json(input): Json<CreateEventException>,
) -> Result<Json<CalendarEventException>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    // Verify event exists, belongs to home, and is recurring
    let event: CalendarEvent = sqlx::query_as(&format!(
        "{} WHERE id = ? AND home_id = ?",
        CALENDAR_SELECT
    ))
    .bind(&event_id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    if event.recurrence_rule.is_none() {
        return Err(AppError::BadRequest(
            "Event is not a recurring event".to_string(),
        ));
    }

    let exception = CalendarEventException {
        id: Uuid::new_v4().to_string(),
        event_id: event_id.clone(),
        original_date: input.original_date,
        is_deleted: input.is_deleted,
        title: input.title,
        date: input.date,
        end_date: input.end_date,
        all_day: input.all_day,
        assignee: input.assignee,
        color: input.color,
        description: input.description,
    };

    sqlx::query(
        "INSERT INTO calendar_event_exceptions (id, event_id, original_date, is_deleted, title, date, end_date, all_day, assignee, color, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&exception.id)
    .bind(&exception.event_id)
    .bind(&exception.original_date)
    .bind(exception.is_deleted)
    .bind(&exception.title)
    .bind(&exception.date)
    .bind(&exception.end_date)
    .bind(exception.all_day)
    .bind(&exception.assignee)
    .bind(&exception.color)
    .bind(&exception.description)
    .execute(&state.pool)
    .await?;

    Ok(Json(exception))
}

pub async fn delete_exception(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((event_id, original_date)): Path<(String, String)>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    // Verify event belongs to home
    let _event: CalendarEvent = sqlx::query_as(&format!(
        "{} WHERE id = ? AND home_id = ?",
        CALENDAR_SELECT
    ))
    .bind(&event_id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    sqlx::query(
        "DELETE FROM calendar_event_exceptions WHERE event_id = ? AND original_date = ?",
    )
    .bind(&event_id)
    .bind(&original_date)
    .execute(&state.pool)
    .await?;

    Ok(())
}
