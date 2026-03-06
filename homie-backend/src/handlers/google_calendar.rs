use axum::extract::State;
use axum::response::{IntoResponse, Redirect};
use axum::{Extension, Json};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::Cookie;
use uuid::Uuid;

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;

// ── Google OAuth helpers ──

fn google_client_id() -> String {
    std::env::var("GOOGLE_CLIENT_ID").expect("GOOGLE_CLIENT_ID must be set")
}

fn google_client_secret() -> String {
    std::env::var("GOOGLE_CLIENT_SECRET").expect("GOOGLE_CLIENT_SECRET must be set")
}

fn google_calendar_redirect_uri() -> String {
    std::env::var("GOOGLE_CALENDAR_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3001/api/v1/calendar/google/callback".to_string())
}

fn frontend_url() -> String {
    std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".to_string())
}

// ── Google API types ──

#[derive(serde::Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleCalendarEvent {
    id: String,
    summary: Option<String>,
    description: Option<String>,
    start: Option<GoogleDateTime>,
    end: Option<GoogleDateTime>,
    status: Option<String>,
}

#[derive(serde::Deserialize)]
struct GoogleDateTime {
    date: Option<String>,
    #[serde(rename = "dateTime")]
    date_time: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleEventsResponse {
    items: Option<Vec<GoogleCalendarEvent>>,
    next_sync_token: Option<String>,
    next_page_token: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleCalendarListResponse {
    items: Option<Vec<GoogleCalendarListEntry>>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleCalendarListEntry {
    id: String,
    summary: Option<String>,
    #[allow(dead_code)]
    selected: Option<bool>,
    access_role: Option<String>,
    background_color: Option<String>,
    primary: Option<bool>,
}

#[derive(serde::Serialize)]
struct GoogleEventInsert {
    summary: String,
    description: Option<String>,
    start: GoogleDateTimeInsert,
    end: GoogleDateTimeInsert,
    #[serde(skip_serializing_if = "Option::is_none")]
    recurrence: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    transparency: Option<String>,
}

#[derive(serde::Serialize)]
struct GoogleDateTimeInsert {
    #[serde(skip_serializing_if = "Option::is_none")]
    date: Option<String>,
    #[serde(rename = "dateTime", skip_serializing_if = "Option::is_none")]
    date_time: Option<String>,
    #[serde(rename = "timeZone", skip_serializing_if = "Option::is_none")]
    time_zone: Option<String>,
}

// ── Token management ──

async fn refresh_google_token(
    pool: &sqlx::SqlitePool,
    token: &GoogleCalendarToken,
) -> Result<String, AppError> {
    // Check if token is still valid
    let expires_at = chrono::DateTime::parse_from_rfc3339(&token.expires_at)
        .map_err(|e| AppError::Internal(format!("Date parse error: {e}")))?;

    if chrono::Utc::now() < expires_at {
        return Ok(token.access_token.clone());
    }

    // Refresh the token
    let client = reqwest::Client::new();
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", google_client_id()),
            ("client_secret", google_client_secret()),
            ("refresh_token", token.refresh_token.clone()),
            ("grant_type", "refresh_token".to_string()),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Google token refresh failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(
            "Google token refresh failed".to_string(),
        ));
    }

    let token_data: GoogleTokenResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Token parse error: {e}")))?;

    let new_expires_at =
        (chrono::Utc::now() + chrono::Duration::seconds(token_data.expires_in)).to_rfc3339();

    sqlx::query(
        "UPDATE google_calendar_tokens SET access_token = ?, expires_at = ? WHERE user_id = ?",
    )
    .bind(&token_data.access_token)
    .bind(&new_expires_at)
    .bind(&token.user_id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(token_data.access_token)
}

// ── OAuth flow ──

#[derive(serde::Deserialize)]
pub struct CalendarCallbackQuery {
    pub code: String,
    pub state: String,
}

pub async fn connect(Extension(auth): Extension<AuthUser>, jar: CookieJar) -> impl IntoResponse {
    let state = format!("gcal_{}", Uuid::new_v4());

    let state_cookie = Cookie::build(("gcal_oauth_state", state.clone()))
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/")
        .max_age(time::Duration::seconds(600))
        .build();

    // Save user_id in cookie so callback knows who to associate
    let user_cookie = Cookie::build(("gcal_user_id", auth.user_id.clone()))
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .path("/")
        .max_age(time::Duration::seconds(600))
        .build();

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/calendar&state={}&access_type=offline&prompt=consent",
        google_client_id(),
        urlencoding::encode(&google_calendar_redirect_uri()),
        state
    );

    (
        jar.add(state_cookie).add(user_cookie),
        Redirect::temporary(&auth_url),
    )
}

pub async fn callback(
    State(state): State<AppState>,
    jar: CookieJar,
    axum::extract::Query(query): axum::extract::Query<CalendarCallbackQuery>,
) -> Result<impl IntoResponse, AppError> {
    // Verify state
    let stored_state = jar
        .get("gcal_oauth_state")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::Unauthorized("Invalid state".to_string()))?;

    if query.state != stored_state {
        return Err(AppError::Unauthorized("Invalid state".to_string()));
    }

    let user_id = jar
        .get("gcal_user_id")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::Unauthorized("Session expired".to_string()))?;

    // Exchange code for tokens
    let client = reqwest::Client::new();
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", query.code.as_str()),
            ("client_id", &google_client_id()),
            ("client_secret", &google_client_secret()),
            ("redirect_uri", &google_calendar_redirect_uri()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Token exchange failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(
            "Google Calendar authorization failed".to_string(),
        ));
    }

    let token_data: GoogleTokenResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Token parse error: {e}")))?;

    let refresh_token = token_data.refresh_token.ok_or_else(|| {
        AppError::Internal(
            "No refresh token received. Try revoking app access and reconnecting.".to_string(),
        )
    })?;

    let expires_at =
        (chrono::Utc::now() + chrono::Duration::seconds(token_data.expires_in)).to_rfc3339();

    // Upsert token
    sqlx::query(
        "INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            sync_token = NULL,
            connected_at = datetime('now')",
    )
    .bind(&user_id)
    .bind(&token_data.access_token)
    .bind(&refresh_token)
    .bind(&expires_at)
    .execute(&state.pool)
    .await?;

    // Clean up cookies
    let remove_state = Cookie::build(("gcal_oauth_state", ""))
        .path("/")
        .max_age(time::Duration::ZERO)
        .build();
    let remove_user = Cookie::build(("gcal_user_id", ""))
        .path("/")
        .max_age(time::Duration::ZERO)
        .build();

    let redirect_url = format!("{}/calendar?gcal=connected", frontend_url());
    Ok((
        jar.add(remove_state).add(remove_user),
        Redirect::temporary(&redirect_url),
    ))
}

pub async fn disconnect(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<(), AppError> {
    // Optionally revoke the token at Google
    let token: Option<GoogleCalendarToken> = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.pool)
    .await?;

    if let Some(token) = token {
        // Best-effort revoke
        let _ = reqwest::Client::new()
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", &token.refresh_token)])
            .send()
            .await;
    }

    sqlx::query("DELETE FROM google_calendar_tokens WHERE user_id = ?")
        .bind(&auth.user_id)
        .execute(&state.pool)
        .await?;

    Ok(())
}

pub async fn status(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<GoogleCalendarStatus>, AppError> {
    let token: Option<GoogleCalendarToken> = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.pool)
    .await?;

    Ok(Json(GoogleCalendarStatus {
        connected: token.is_some(),
        connected_at: token.map(|t| t.connected_at),
    }))
}

// ── Calendar list & selection ──

pub async fn list_calendars(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<GoogleCalendarInfo>>, AppError> {
    let token: GoogleCalendarToken = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Google Calendar not connected".to_string()))?;

    let access_token = refresh_google_token(&state.pool, &token).await?;

    let resp = reqwest::Client::new()
        .get("https://www.googleapis.com/calendar/v3/users/me/calendarList")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("CalendarList API error: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(
            "Failed to fetch calendar list".to_string(),
        ));
    }

    let list: GoogleCalendarListResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("CalendarList parse error: {e}")))?;

    // Load saved selections
    let selections: Vec<GoogleCalendarSelection> = sqlx::query_as(
        "SELECT user_id, calendar_id, calendar_name, selected, background_color FROM google_calendar_selections WHERE user_id = ?",
    )
    .bind(&auth.user_id)
    .fetch_all(&state.pool)
    .await?;

    let calendars: Vec<GoogleCalendarInfo> = list
        .items
        .unwrap_or_default()
        .into_iter()
        .filter(|c| c.access_role.as_deref() != Some("none"))
        .map(|c| {
            let saved = selections.iter().find(|s| s.calendar_id == c.id);
            // Default: all calendars visible (selected=true)
            let selected = saved.is_none_or(|s| s.selected);

            GoogleCalendarInfo {
                id: c.id,
                summary: c.summary.unwrap_or_default(),
                selected,
                background_color: c.background_color,
                access_role: c.access_role.unwrap_or_default(),
                primary: c.primary.unwrap_or(false),
            }
        })
        .collect();

    Ok(Json(calendars))
}

pub async fn update_calendar_selections(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<UpdateCalendarSelections>,
) -> Result<(), AppError> {
    // Verify user has Google Calendar connected
    let _token: GoogleCalendarToken = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Google Calendar not connected".to_string()))?;

    for item in &input.calendars {
        sqlx::query(
            "INSERT INTO google_calendar_selections (user_id, calendar_id, selected)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id, calendar_id) DO UPDATE SET selected = excluded.selected",
        )
        .bind(&auth.user_id)
        .bind(&item.id)
        .bind(item.selected)
        .execute(&state.pool)
        .await?;
    }

    Ok(())
}

// ── Sync logic ──

fn parse_google_date(dt: &Option<GoogleDateTime>) -> (String, bool) {
    match dt {
        Some(gdt) => {
            if let Some(date) = &gdt.date {
                (date.clone(), true)
            } else if let Some(date_time) = &gdt.date_time {
                // Extract date part from ISO datetime
                let date = date_time.split('T').next().unwrap_or(date_time).to_string();
                (date, false)
            } else {
                (String::new(), false)
            }
        }
        None => (String::new(), false),
    }
}

pub async fn sync(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<SyncResult>, AppError> {
    let home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?;

    let token: GoogleCalendarToken = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Google Calendar not connected".to_string()))?;

    let access_token = refresh_google_token(&state.pool, &token).await?;
    let client = reqwest::Client::new();

    // ── Get all calendars ──
    let cal_list_resp = client
        .get("https://www.googleapis.com/calendar/v3/users/me/calendarList")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("CalendarList API error: {e}")))?;

    // Always sync ALL calendars — selection controls display only
    let calendar_ids: Vec<String> = if cal_list_resp.status().is_success() {
        let list: GoogleCalendarListResponse = cal_list_resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("CalendarList parse error: {e}")))?;

        let all_cals = list.items.unwrap_or_default();

        // Upsert selection entries so the UI knows about all calendars
        let existing_selections: Vec<GoogleCalendarSelection> = sqlx::query_as(
            "SELECT user_id, calendar_id, calendar_name, selected, background_color FROM google_calendar_selections WHERE user_id = ?",
        )
        .bind(&auth.user_id)
        .fetch_all(&state.pool)
        .await?;

        for cal in &all_cals {
            if cal.access_role.as_deref() == Some("none") {
                continue;
            }
            let exists = existing_selections.iter().any(|s| s.calendar_id == cal.id);
            if exists {
                // Update name/color in case they changed
                sqlx::query(
                    "UPDATE google_calendar_selections SET calendar_name = ?, background_color = ? WHERE user_id = ? AND calendar_id = ?",
                )
                .bind(cal.summary.as_deref().unwrap_or(""))
                .bind(&cal.background_color)
                .bind(&auth.user_id)
                .bind(&cal.id)
                .execute(&state.pool)
                .await?;
            } else {
                // New calendar → default selected=true
                sqlx::query(
                    "INSERT OR IGNORE INTO google_calendar_selections (user_id, calendar_id, calendar_name, selected, background_color) VALUES (?, ?, ?, 1, ?)",
                )
                .bind(&auth.user_id)
                .bind(&cal.id)
                .bind(cal.summary.as_deref().unwrap_or(""))
                .bind(&cal.background_color)
                .execute(&state.pool)
                .await?;
            }
        }

        all_cals
            .into_iter()
            .filter(|c| c.access_role.as_deref() != Some("none"))
            .map(|c| c.id)
            .collect()
    } else {
        vec!["primary".to_string()]
    };

    // ── Google → Homie (all calendars) ──
    let mut imported = 0u32;
    let mut updated = 0u32;
    let mut deleted = 0u32;
    let mut new_sync_token: Option<String> = None;

    let three_months_ago = (chrono::Utc::now() - chrono::Duration::days(90)).to_rfc3339();

    for calendar_id in &calendar_ids {
        let is_primary = calendar_id == "primary" || calendar_ids.first() == Some(calendar_id);
        let mut page_token: Option<String> = None;

        loop {
            let mut url = format!(
                "https://www.googleapis.com/calendar/v3/calendars/{}/events?singleEvents=true&maxResults=250",
                urlencoding::encode(calendar_id)
            );

            // Only use sync_token for primary calendar
            if is_primary {
                if let Some(ref st) = token.sync_token {
                    url.push_str(&format!("&syncToken={}", urlencoding::encode(st)));
                } else {
                    url.push_str(&format!(
                        "&timeMin={}",
                        urlencoding::encode(&three_months_ago)
                    ));
                }
            } else {
                url.push_str(&format!(
                    "&timeMin={}",
                    urlencoding::encode(&three_months_ago)
                ));
            }

            if let Some(ref pt) = page_token {
                url.push_str(&format!("&pageToken={}", urlencoding::encode(pt)));
            }

            let resp = client
                .get(&url)
                .bearer_auth(&access_token)
                .send()
                .await
                .map_err(|e| AppError::Internal(format!("Google Calendar API error: {e}")))?;

            if resp.status() == reqwest::StatusCode::GONE {
                // Sync token expired for primary, reset and skip
                sqlx::query(
                    "UPDATE google_calendar_tokens SET sync_token = NULL WHERE user_id = ?",
                )
                .bind(&auth.user_id)
                .execute(&state.pool)
                .await?;
                break;
            }

            if !resp.status().is_success() {
                // Skip this calendar on error
                tracing::warn!(
                    "Failed to fetch events from calendar {}: {}",
                    calendar_id,
                    resp.status()
                );
                break;
            }

            let events_resp: GoogleEventsResponse = resp
                .json()
                .await
                .map_err(|e| AppError::Internal(format!("Parse error: {e}")))?;

            if let Some(items) = events_resp.items {
                for ge in items {
                    // Use calendar_id + event_id as unique key to avoid collisions across calendars
                    let google_event_id = if is_primary {
                        ge.id.clone()
                    } else {
                        format!("{}:{}", calendar_id, ge.id)
                    };

                    let is_cancelled = ge.status.as_deref() == Some("cancelled");

                    let existing: Option<CalendarEvent> = sqlx::query_as(
                        "SELECT id, home_id, title, date, end_date, all_day, type, assignee, completed, color, description, google_event_id, recurrence_rule, recurrence_interval, recurrence_end, google_calendar_id FROM calendar_events WHERE google_event_id = ? AND home_id = ?",
                    )
                    .bind(&google_event_id)
                    .bind(home_id)
                    .fetch_optional(&state.pool)
                    .await?;

                    if is_cancelled {
                        if existing.is_some() {
                            sqlx::query(
                                "DELETE FROM calendar_events WHERE google_event_id = ? AND home_id = ?",
                            )
                            .bind(&google_event_id)
                            .bind(home_id)
                            .execute(&state.pool)
                            .await?;
                            deleted += 1;
                        }
                        continue;
                    }

                    let (date, all_day) = parse_google_date(&ge.start);
                    let (end_date, _) = parse_google_date(&ge.end);
                    let title = ge.summary.unwrap_or_else(|| "(No title)".to_string());

                    if date.is_empty() {
                        continue;
                    }

                    if let Some(existing) = existing {
                        sqlx::query(
                            "UPDATE calendar_events SET title = ?, date = ?, end_date = ?, all_day = ?, description = ?, google_calendar_id = ? WHERE id = ?",
                        )
                        .bind(&title)
                        .bind(&date)
                        .bind(if end_date.is_empty() { None } else { Some(&end_date) })
                        .bind(all_day)
                        .bind(&ge.description)
                        .bind(calendar_id)
                        .bind(&existing.id)
                        .execute(&state.pool)
                        .await?;
                        updated += 1;
                    } else {
                        let id = Uuid::new_v4().to_string();
                        sqlx::query(
                            "INSERT INTO calendar_events (id, home_id, title, date, end_date, all_day, type, google_event_id, description, google_calendar_id, created_by) VALUES (?, ?, ?, ?, ?, ?, 'google', ?, ?, ?, ?)",
                        )
                        .bind(&id)
                        .bind(home_id)
                        .bind(&title)
                        .bind(&date)
                        .bind(if end_date.is_empty() { None } else { Some(&end_date) })
                        .bind(all_day)
                        .bind(&google_event_id)
                        .bind(&ge.description)
                        .bind(calendar_id)
                        .bind(&auth.user_id)
                        .execute(&state.pool)
                        .await?;
                        imported += 1;
                    }
                }
            }

            // Save sync token only for primary
            if is_primary {
                if let Some(nst) = events_resp.next_sync_token {
                    new_sync_token = Some(nst);
                    break;
                }
            } else if events_resp.next_page_token.is_none() {
                break;
            }

            page_token = events_resp.next_page_token;
            if page_token.is_none() {
                break;
            }
        }
    }

    // Save sync token for primary
    if let Some(ref st) = new_sync_token {
        sqlx::query("UPDATE google_calendar_tokens SET sync_token = ? WHERE user_id = ?")
            .bind(st)
            .bind(&auth.user_id)
            .execute(&state.pool)
            .await?;
    }

    // ── Homie → Google (push unsynced events) ──
    let unsynced: Vec<CalendarEvent> = sqlx::query_as(
        "SELECT id, home_id, title, date, end_date, all_day, type, assignee, completed, color, description, google_event_id, recurrence_rule, recurrence_interval, recurrence_end FROM calendar_events WHERE home_id = ? AND google_event_id IS NULL AND type != 'garbage'",
    )
    .bind(home_id)
    .fetch_all(&state.pool)
    .await?;

    let mut pushed = 0u32;
    for event in &unsynced {
        let google_event = build_google_event(event);

        let resp = client
            .post("https://www.googleapis.com/calendar/v3/calendars/primary/events")
            .bearer_auth(&access_token)
            .json(&google_event)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                if let Ok(created) = r.json::<GoogleCalendarEvent>().await {
                    sqlx::query("UPDATE calendar_events SET google_event_id = ? WHERE id = ?")
                        .bind(&created.id)
                        .bind(&event.id)
                        .execute(&state.pool)
                        .await?;
                    pushed += 1;
                }
            }
            Ok(r) => {
                tracing::warn!(
                    "Failed to push event {} to Google: {}",
                    event.id,
                    r.status()
                );
            }
            Err(e) => {
                tracing::warn!("Failed to push event {} to Google: {}", event.id, e);
            }
        }
    }

    Ok(Json(SyncResult {
        imported,
        updated,
        deleted,
        pushed,
    }))
}

fn build_google_event(event: &CalendarEvent) -> GoogleEventInsert {
    let (start, end) = if event.all_day {
        (
            GoogleDateTimeInsert {
                date: Some(event.date.clone()),
                date_time: None,
                time_zone: None,
            },
            GoogleDateTimeInsert {
                date: Some(event.end_date.clone().unwrap_or_else(|| event.date.clone())),
                date_time: None,
                time_zone: None,
            },
        )
    } else {
        let tz = "Asia/Tokyo";
        (
            GoogleDateTimeInsert {
                date: None,
                date_time: Some(format!("{}T00:00:00", event.date)),
                time_zone: Some(tz.to_string()),
            },
            GoogleDateTimeInsert {
                date: None,
                date_time: Some(format!(
                    "{}T23:59:59",
                    event.end_date.as_deref().unwrap_or(&event.date)
                )),
                time_zone: Some(tz.to_string()),
            },
        )
    };

    GoogleEventInsert {
        summary: event.title.clone(),
        description: event.description.clone(),
        start,
        end,
        recurrence: None,
        transparency: None,
    }
}

// ── Push helpers (called from calendar handlers) ──

pub async fn push_event_to_google(
    pool: &sqlx::SqlitePool,
    user_id: &str,
    event: &CalendarEvent,
) -> Result<Option<String>, AppError> {
    let token: Option<GoogleCalendarToken> = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let Some(token) = token else {
        return Ok(None);
    };

    let access_token = refresh_google_token(pool, &token).await?;
    let client = reqwest::Client::new();
    let google_event = build_google_event(event);

    let resp = client
        .post("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(&access_token)
        .json(&google_event)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Google push failed: {e}")))?;

    if resp.status().is_success() {
        let created: GoogleCalendarEvent = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Parse error: {e}")))?;
        Ok(Some(created.id))
    } else {
        tracing::warn!("Google push failed: {}", resp.status());
        Ok(None)
    }
}

pub async fn update_event_on_google(pool: &sqlx::SqlitePool, user_id: &str, event: &CalendarEvent) {
    let Some(google_event_id) = &event.google_event_id else {
        return;
    };

    let token: Option<GoogleCalendarToken> = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let Some(token) = token else { return };

    let Ok(access_token) = refresh_google_token(pool, &token).await else {
        return;
    };

    let google_event = build_google_event(event);
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/{}",
        urlencoding::encode(google_event_id)
    );

    let _ = reqwest::Client::new()
        .put(&url)
        .bearer_auth(&access_token)
        .json(&google_event)
        .send()
        .await;
}

pub async fn push_subscription_to_google(
    pool: &sqlx::SqlitePool,
    user_id: &str,
    sub: &crate::models::Subscription,
) -> Result<Option<String>, AppError> {
    let token: Option<GoogleCalendarToken> = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let Some(token) = token else {
        return Ok(None);
    };

    let access_token = refresh_google_token(pool, &token).await?;
    let client = reqwest::Client::new();

    let rrule = build_subscription_rrule(&sub.billing_cycle, sub.billing_day);
    let google_event = GoogleEventInsert {
        summary: format!("💳 {} ({}円)", sub.name, sub.amount as i64),
        description: Some(format!(
            "定期支払い: {}\n金額: {}円\nカテゴリ: {}",
            sub.name, sub.amount as i64, sub.category
        )),
        start: GoogleDateTimeInsert {
            date: Some(sub.next_billing_date.clone()),
            date_time: None,
            time_zone: None,
        },
        end: GoogleDateTimeInsert {
            date: Some(sub.next_billing_date.clone()),
            date_time: None,
            time_zone: None,
        },
        recurrence: Some(vec![rrule]),
        transparency: Some("transparent".to_string()),
    };

    let resp = client
        .post("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(&access_token)
        .json(&google_event)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Google push failed: {e}")))?;

    if resp.status().is_success() {
        let created: GoogleCalendarEvent = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Parse error: {e}")))?;
        Ok(Some(created.id))
    } else {
        tracing::warn!("Google push failed for subscription: {}", resp.status());
        Ok(None)
    }
}

pub async fn update_subscription_on_google(
    pool: &sqlx::SqlitePool,
    user_id: &str,
    sub: &crate::models::Subscription,
) {
    let Some(google_event_id) = &sub.google_event_id else {
        return;
    };

    let token: Option<GoogleCalendarToken> = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let Some(token) = token else { return };
    let Ok(access_token) = refresh_google_token(pool, &token).await else {
        return;
    };

    let rrule = build_subscription_rrule(&sub.billing_cycle, sub.billing_day);
    let google_event = GoogleEventInsert {
        summary: format!("💳 {} ({}円)", sub.name, sub.amount as i64),
        description: Some(format!(
            "定期支払い: {}\n金額: {}円\nカテゴリ: {}",
            sub.name, sub.amount as i64, sub.category
        )),
        start: GoogleDateTimeInsert {
            date: Some(sub.next_billing_date.clone()),
            date_time: None,
            time_zone: None,
        },
        end: GoogleDateTimeInsert {
            date: Some(sub.next_billing_date.clone()),
            date_time: None,
            time_zone: None,
        },
        recurrence: Some(vec![rrule]),
        transparency: Some("transparent".to_string()),
    };

    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/{}",
        urlencoding::encode(google_event_id)
    );

    let _ = reqwest::Client::new()
        .put(&url)
        .bearer_auth(&access_token)
        .json(&google_event)
        .send()
        .await;
}

fn build_subscription_rrule(billing_cycle: &str, billing_day: i32) -> String {
    match billing_cycle {
        "weekly" => {
            let day = match billing_day {
                0 => "SU",
                1 => "MO",
                2 => "TU",
                3 => "WE",
                4 => "TH",
                5 => "FR",
                6 => "SA",
                _ => "MO",
            };
            format!("RRULE:FREQ=WEEKLY;BYDAY={day}")
        }
        "yearly" => "RRULE:FREQ=YEARLY".to_string(),
        _ => format!("RRULE:FREQ=MONTHLY;BYMONTHDAY={billing_day}"),
    }
}

pub async fn delete_event_on_google(pool: &sqlx::SqlitePool, user_id: &str, google_event_id: &str) {
    let token: Option<GoogleCalendarToken> = sqlx::query_as(
        "SELECT user_id, access_token, refresh_token, expires_at, sync_token, connected_at FROM google_calendar_tokens WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let Some(token) = token else { return };

    let Ok(access_token) = refresh_google_token(pool, &token).await else {
        return;
    };

    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/{}",
        urlencoding::encode(google_event_id)
    );

    let _ = reqwest::Client::new()
        .delete(&url)
        .bearer_auth(&access_token)
        .send()
        .await;
}
