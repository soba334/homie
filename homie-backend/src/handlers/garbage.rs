use std::sync::Arc;

use axum::extract::{Path, State};
use axum::{Extension, Json};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use sqlx::SqlitePool;

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;
use crate::storage::S3Storage;

// ── Ollama chat API structs (local to this module) ──

#[derive(Debug, serde::Deserialize)]
struct OllamaChatResponse {
    message: Option<OllamaChatMessage>,
}

#[derive(Debug, serde::Deserialize)]
struct OllamaChatMessage {
    content: String,
}

/// Strip markdown fences (```json ... ```) if present.
fn extract_json_from_response(raw: &str) -> &str {
    let trimmed = raw.trim();

    // Handle ```json ... ``` or ``` ... ```
    if let Some(rest) = trimmed.strip_prefix("```") {
        // Skip the optional language tag on the first line
        let rest = if let Some(pos) = rest.find('\n') {
            &rest[pos + 1..]
        } else {
            rest
        };
        // Strip trailing ```
        if let Some(json_body) = rest.strip_suffix("```") {
            return json_body.trim();
        }
        return rest.trim();
    }

    trimmed
}

// ── Categories ──

pub async fn list_categories(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<GarbageCategory>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let mut categories: Vec<GarbageCategory> = sqlx::query_as(
        "SELECT id, home_id, name, color, description FROM garbage_categories WHERE home_id = ?",
    )
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

    let mut schedules: Vec<GarbageSchedule> = sqlx::query_as(
        "SELECT id, home_id, category_id, location, note FROM garbage_schedules WHERE home_id = ?",
    )
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

        let weeks: Vec<(i32,)> = sqlx::query_as(
            "SELECT week_of_month FROM garbage_schedule_weeks WHERE schedule_id = ?",
        )
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
            sqlx::query(
                "INSERT INTO garbage_schedule_weeks (schedule_id, week_of_month) VALUES (?, ?)",
            )
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
            sqlx::query(
                "INSERT INTO garbage_schedule_days (schedule_id, day_of_week) VALUES (?, ?)",
            )
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
            sqlx::query(
                "INSERT INTO garbage_schedule_weeks (schedule_id, week_of_month) VALUES (?, ?)",
            )
            .bind(&id)
            .bind(week)
            .execute(&state.pool)
            .await?;
        }
        if weeks.is_empty() { None } else { Some(weeks) }
    } else {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT week_of_month FROM garbage_schedule_weeks WHERE schedule_id = ?",
        )
        .bind(&id)
        .fetch_all(&state.pool)
        .await?;
        if rows.is_empty() {
            None
        } else {
            Some(rows.into_iter().map(|(w,)| w).collect())
        }
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

// ── AI Extract (from garbage guide images/PDFs) ──

pub async fn extract(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<GarbageExtractRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?
        .to_string();

    // Create job
    let job_id = uuid::Uuid::new_v4().to_string();
    let input_json = serde_json::to_string(&req).unwrap_or_default();

    sqlx::query(
        "INSERT INTO background_jobs (id, home_id, type, status, input) VALUES (?, ?, 'garbage_extract', 'pending', ?)",
    )
    .bind(&job_id)
    .bind(&home_id)
    .bind(&input_json)
    .execute(&state.pool)
    .await?;

    // Spawn background task
    let pool = state.pool.clone();
    let storage = state.storage.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        // Update status to processing
        let _ = sqlx::query("UPDATE background_jobs SET status = 'processing' WHERE id = ?")
            .bind(&job_id_clone)
            .execute(&pool)
            .await;

        match run_garbage_extract(&pool, &storage, &home_id, &req).await {
            Ok(result) => {
                let result_json = serde_json::to_string(&result).unwrap_or_default();
                let _ = sqlx::query(
                    "UPDATE background_jobs SET status = 'completed', result = ?, completed_at = datetime('now') WHERE id = ?",
                )
                .bind(&result_json)
                .bind(&job_id_clone)
                .execute(&pool)
                .await;
            }
            Err(e) => {
                let _ = sqlx::query(
                    "UPDATE background_jobs SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?",
                )
                .bind(format!("{e:?}"))
                .bind(&job_id_clone)
                .execute(&pool)
                .await;
            }
        }
    });

    Ok(Json(serde_json::json!({ "jobId": job_id })))
}

async fn run_garbage_extract(
    pool: &SqlitePool,
    storage: &Arc<S3Storage>,
    home_id: &str,
    req: &GarbageExtractRequest,
) -> Result<GarbageExtractResult, AppError> {
    // 1. Look up file, verify home_id, validate it's image or PDF
    let file: FileRecord = sqlx::query_as(
        "SELECT id, home_id, original_name, content_type, size, s3_key, thumbnail_key, uploaded_by, uploaded_at FROM files WHERE id = ? AND home_id = ?",
    )
    .bind(&req.file_id)
    .bind(home_id)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound,
        other => AppError::Internal(other.to_string()),
    })?;

    if !file.content_type.starts_with("image/") && file.content_type != "application/pdf" {
        return Err(AppError::BadRequest(
            "File must be an image or PDF".to_string(),
        ));
    }

    // 2. Download from S3, base64 encode
    let file_bytes = storage.download(&file.s3_key).await?;
    let file_base64 = BASE64.encode(&file_bytes);

    // 3. Build Ollama request
    let ollama_url =
        std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let ollama_model = std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "qwen3.5:2b".to_string());

    let system_prompt = "あなたはゴミ分別表の読み取りアシスタントです。アップロードされた画像またはPDFはゴミの分別方法が書かれた資料です。以下のJSON形式で全てのゴミカテゴリと分別ルールを抽出してください。\n\n```json\n{\"categories\": [{\"name\": \"カテゴリ名（例: 燃えるゴミ）\", \"color\": \"#カラーコード（6桁16進数、適切な色を割り当て）\", \"description\": \"説明（収集時の注意点など）\", \"items\": [\"品目1\", \"品目2\", \"品目3\"], \"schedule\": {\"dayOfWeek\": [0], \"weekOfMonth\": [1], \"note\": \"収集時間等の備考\"}}]}\n```\n\n全てのカテゴリを漏れなく抽出してください。色は以下から選んでください: #EF4444(赤), #F59E0B(黄), #10B981(緑), #3B82F6(青), #8B5CF6(紫), #EC4899(ピンク), #6B7280(グレー), #F97316(オレンジ)\nJSONのみを返してください。";

    let user_message = if file.content_type.starts_with("image/") {
        serde_json::json!({
            "role": "user",
            "content": "この分別表の内容を全て抽出してください。",
            "images": [file_base64]
        })
    } else {
        serde_json::json!({
            "role": "user",
            "content": format!("この分別表の内容を全て抽出してください。\n\n[添付ファイル: {}]", file.original_name)
        })
    };

    let ollama_body = serde_json::json!({
        "model": ollama_model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            user_message
        ],
        "stream": false,
        "options": {
            "temperature": 0.1
        }
    });

    tracing::info!("Sending to Ollama ({ollama_model})...");
    let start = std::time::Instant::now();

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{ollama_url}/api/chat"))
        .json(&ollama_body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama request failed: {e}")))?;

    let elapsed = start.elapsed();
    tracing::info!(
        "Ollama responded in {:.1}s (status: {})",
        elapsed.as_secs_f64(),
        resp.status()
    );

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_else(|_| "unknown".to_string());
        return Err(AppError::Internal(format!(
            "Ollama returned {status}: {body}"
        )));
    }

    let ollama_resp: OllamaChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Ollama response: {e}")))?;

    // 4. Parse the response into a structured result
    let content = ollama_resp.message.map(|m| m.content).unwrap_or_default();
    tracing::info!(
        "Ollama garbage extract raw response ({} chars): {content}",
        content.len()
    );
    let json_str = extract_json_from_response(&content);
    tracing::info!("Ollama garbage extract parsed JSON: {json_str}");

    let result: GarbageExtractResult = serde_json::from_str(json_str).map_err(|e| {
        AppError::Internal(format!(
            "Failed to parse garbage extract data from model response: {e}. Raw content: {content}"
        ))
    })?;

    Ok(result)
}

// ── AI Sort ──

pub async fn ask(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<GarbageSortRequest>,
) -> Result<Json<GarbageSortResult>, AppError> {
    let home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?;

    // 1. Validate at least query or fileId is provided
    if req.query.is_none() && req.file_id.is_none() {
        return Err(AppError::BadRequest(
            "At least one of query or fileId must be provided".to_string(),
        ));
    }

    // 2. Load garbage categories with items
    let mut categories: Vec<GarbageCategory> = sqlx::query_as(
        "SELECT id, home_id, name, color, description FROM garbage_categories WHERE home_id = ?",
    )
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

    // Load schedules
    let mut schedules: Vec<GarbageSchedule> = sqlx::query_as(
        "SELECT id, home_id, category_id, location, note FROM garbage_schedules WHERE home_id = ?",
    )
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

        let weeks: Vec<(i32,)> = sqlx::query_as(
            "SELECT week_of_month FROM garbage_schedule_weeks WHERE schedule_id = ?",
        )
        .bind(&s.id)
        .fetch_all(&state.pool)
        .await?;
        s.week_of_month = if weeks.is_empty() {
            None
        } else {
            Some(weeks.into_iter().map(|(w,)| w).collect())
        };
    }

    // 3. Build context string
    let day_names = ['日', '月', '火', '水', '木', '金', '土'];
    let mut context = String::from("あなたの家のゴミ分別ルール:\n");

    for cat in &categories {
        // Find schedules for this category
        let cat_schedules: Vec<&GarbageSchedule> = schedules
            .iter()
            .filter(|s| s.category_id == cat.id)
            .collect();

        let schedule_str = if cat_schedules.is_empty() {
            String::new()
        } else {
            let parts: Vec<String> = cat_schedules
                .iter()
                .map(|s| {
                    let days: Vec<String> = s
                        .day_of_week
                        .iter()
                        .filter_map(|&d| day_names.get(d as usize).map(|c| c.to_string()))
                        .collect();
                    let days_str = days.join("・");

                    if let Some(ref weeks) = s.week_of_month {
                        let weeks_str: Vec<String> =
                            weeks.iter().map(|w| format!("第{w}")).collect();
                        format!("{days_str}, {}週", weeks_str.join("・"))
                    } else {
                        days_str
                    }
                })
                .collect();
            format!("(収集日: {})", parts.join(", "))
        };

        context.push_str(&format!("\n【{}】{}\n", cat.name, schedule_str));
        if !cat.items.is_empty() {
            context.push_str(&format!("対象品目: {}\n", cat.items.join(", ")));
        }
    }

    // 4. If fileId provided, download image from S3, base64 encode
    let image_base64 = if let Some(ref file_id) = req.file_id {
        let file: FileRecord = sqlx::query_as(
            "SELECT id, home_id, original_name, content_type, size, s3_key, thumbnail_key, uploaded_by, uploaded_at FROM files WHERE id = ? AND home_id = ?",
        )
        .bind(file_id)
        .bind(home_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::Internal(other.to_string()),
        })?;

        if !file.content_type.starts_with("image/") {
            return Err(AppError::BadRequest("File is not an image".to_string()));
        }

        let image_bytes = state.storage.download(&file.s3_key).await?;
        Some(BASE64.encode(&image_bytes))
    } else {
        None
    };

    // 5. Build Ollama request
    let ollama_url =
        std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let ollama_model = std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "qwen3.5:2b".to_string());

    let system_prompt = format!(
        "あなたはゴミ分別アシスタントです。ユーザーの家のゴミ分別ルールに基づいて、正確に分別方法を答えてください。\n\n{context}\n\n以下のJSON形式で回答してください:\n{{\"category\": \"該当カテゴリ名\", \"explanation\": \"理由の説明\", \"tips\": \"出す時の注意点(あれば)\"}}\nJSONのみを返してください。該当するカテゴリがない場合はcategoryをnullにしてください。"
    );

    let user_query = req
        .query
        .as_deref()
        .unwrap_or("この画像の物は何ゴミですか？");

    let user_message = if let Some(ref b64) = image_base64 {
        serde_json::json!({
            "role": "user",
            "content": user_query,
            "images": [b64]
        })
    } else {
        serde_json::json!({
            "role": "user",
            "content": user_query
        })
    };

    let ollama_body = serde_json::json!({
        "model": ollama_model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            user_message
        ],
        "stream": false,
        "options": {
            "temperature": 0.1
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{ollama_url}/api/chat"))
        .json(&ollama_body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_else(|_| "unknown".to_string());
        return Err(AppError::Internal(format!(
            "Ollama returned {status}: {body}"
        )));
    }

    let ollama_resp: OllamaChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Ollama response: {e}")))?;

    // 6. Parse response and return
    let content = ollama_resp.message.map(|m| m.content).unwrap_or_default();
    let json_str = extract_json_from_response(&content);

    let result: GarbageSortResult = serde_json::from_str(json_str).map_err(|e| {
        AppError::Internal(format!(
            "Failed to parse garbage sort data from model response: {e}. Raw content: {content}"
        ))
    })?;

    Ok(Json(result))
}
