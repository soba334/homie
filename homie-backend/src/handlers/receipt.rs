use axum::extract::State;
use axum::{Extension, Json};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;

/// Ollama chat API response structure.
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

pub async fn scan(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<ReceiptScanRequest>,
) -> Result<Json<ReceiptScanResult>, AppError> {
    let home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?;

    // 1. Look up the file record and verify home_id matches
    let file: FileRecord = sqlx::query_as(
        "SELECT id, home_id, original_name, content_type, size, s3_key, thumbnail_key, uploaded_by, uploaded_at FROM files WHERE id = ? AND home_id = ?",
    )
    .bind(&req.file_id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound,
        other => AppError::Internal(other.to_string()),
    })?;

    // Verify it is an image
    if !file.content_type.starts_with("image/") {
        return Err(AppError::BadRequest("File is not an image".to_string()));
    }

    // 2. Download the image bytes from S3
    let image_bytes = state.storage.download(&file.s3_key).await?;

    // 3. Base64-encode the image
    let image_base64 = BASE64.encode(&image_bytes);

    // 4. Build and send the Ollama API request
    let ollama_url =
        std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let ollama_model = std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "qwen3.5:2b".to_string());

    let prompt = "このレシートの画像を分析して、以下のJSON形式で情報を抽出してください。日本語のレシートです。\n\n{\"date\": \"YYYY-MM-DD\", \"store\": \"店名\", \"items\": [{\"name\": \"品名\", \"amount\": 数値}], \"total\": 合計数値, \"category\": \"食費|日用品|光熱費|家賃|交通費|医療費|娯楽|その他\"}\n\nJSONのみを返してください。";

    let ollama_body = serde_json::json!({
        "model": ollama_model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [image_base64]
            }
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

    // 5. Extract the content from the Ollama response
    let content = ollama_resp.message.map(|m| m.content).unwrap_or_default();

    // 6. Parse the JSON, stripping markdown fences if present
    let json_str = extract_json_from_response(&content);

    let result: ReceiptScanResult = serde_json::from_str(json_str).map_err(|e| {
        AppError::Internal(format!(
            "Failed to parse receipt data from model response: {e}. Raw content: {content}"
        ))
    })?;

    Ok(Json(result))
}
