use axum::extract::{Path, State};
use axum::{Extension, Json};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;

// ── Ollama chat API structs (local to this module) ──

#[derive(Debug, serde::Deserialize)]
struct OllamaChatResponse {
    message: Option<OllamaChatMessage>,
}

#[derive(Debug, serde::Deserialize)]
struct OllamaChatMessage {
    content: String,
}

// ── Helpers ──

/// Find the largest char-boundary index <= `target` in `s`.
fn floor_char_boundary(s: &str, target: usize) -> usize {
    if target >= s.len() {
        return s.len();
    }
    let mut idx = target;
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    idx
}

/// Split text into chunks of roughly `max_chars` characters,
/// preferring paragraph boundaries (`\n\n`).
fn split_into_chunks(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for paragraph in text.split("\n\n") {
        let paragraph = paragraph.trim();
        if paragraph.is_empty() {
            continue;
        }

        if !current.is_empty() && current.len() + paragraph.len() + 2 > max_chars {
            chunks.push(std::mem::take(&mut current));
        }

        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(paragraph);

        // If a single paragraph exceeds max_chars, split it further
        while current.len() > max_chars {
            let boundary = floor_char_boundary(&current, max_chars);
            let split_at = current[..boundary]
                .rfind('\n')
                .or_else(|| current[..boundary].rfind(' '))
                .unwrap_or(boundary);
            let split_at = if split_at == 0 { boundary } else { split_at };
            let left = current[..split_at].to_string();
            let right = current[split_at..].trim().to_string();
            chunks.push(left);
            current = right;
        }
    }

    if !current.is_empty() {
        chunks.push(current);
    }

    chunks
}

/// Extract a file ID from the document's file_url field.
/// Handles several formats:
///   - Raw UUID: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
///   - API path: "/api/v1/files/{id}/url" or "/api/v1/files/{id}"
///   - Full URL containing the above path
fn extract_file_id_from_url(file_url: &str) -> Option<String> {
    let trimmed = file_url.trim();

    // If it looks like a UUID directly
    if uuid::Uuid::parse_str(trimmed).is_ok() {
        return Some(trimmed.to_string());
    }

    // Try to find /api/v1/files/{id} in the path
    if let Some(pos) = trimmed.find("/api/v1/files/") {
        let after = &trimmed[pos + "/api/v1/files/".len()..];
        let id_part = after.split('/').next().unwrap_or("");
        let id_part = id_part.split('?').next().unwrap_or("");
        if !id_part.is_empty() {
            return Some(id_part.to_string());
        }
    }

    None
}

// ── POST /api/v1/documents/{id}/extract-text ──

pub async fn extract_text(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<DocumentExtractResponse>, AppError> {
    let home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?;

    // 1. Look up the document
    let doc: Document = sqlx::query_as(
        "SELECT id, home_id, title, category, file_url, file_type, uploaded_at, note FROM documents WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound,
        other => AppError::Internal(other.to_string()),
    })?;

    // 2. Find the file record via file_url
    let file_id = extract_file_id_from_url(&doc.file_url).ok_or_else(|| {
        AppError::BadRequest(format!(
            "Cannot extract file ID from file_url: {}",
            doc.file_url
        ))
    })?;

    let file: FileRecord = sqlx::query_as(
        "SELECT id, home_id, original_name, content_type, size, s3_key, thumbnail_key, uploaded_by, uploaded_at FROM files WHERE id = ? AND home_id = ?",
    )
    .bind(&file_id)
    .bind(home_id)
    .fetch_one(&state.pool)
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

    // 3. Download from S3 and base64-encode
    let file_bytes = state.storage.download(&file.s3_key).await?;
    let file_base64 = BASE64.encode(&file_bytes);

    // 4. Send to Ollama for OCR
    let ollama_url =
        std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let ollama_model = std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "qwen3.5:2b".to_string());

    let system_prompt = "あなたはOCRアシスタントです。画像/ドキュメントからテキストを正確に抽出してください。レイアウトを保持し、すべてのテキストを漏れなく抽出してください。抽出したテキストのみを返してください。";

    let user_message = if file.content_type.starts_with("image/") {
        serde_json::json!({
            "role": "user",
            "content": "このドキュメントのテキストを全て抽出してください。",
            "images": [file_base64]
        })
    } else {
        serde_json::json!({
            "role": "user",
            "content": format!(
                "このドキュメントのテキストを全て抽出してください。\n\n[添付ファイル: {}]",
                file.original_name
            ),
            "images": [file_base64]
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

    let extracted_text = ollama_resp.message.map(|m| m.content).unwrap_or_default();

    // 5. Split into chunks
    let chunks = split_into_chunks(&extracted_text, 500);

    // 6. Delete existing chunks and insert new ones
    sqlx::query("DELETE FROM document_texts WHERE document_id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await?;

    for (i, chunk) in chunks.iter().enumerate() {
        sqlx::query(
            "INSERT INTO document_texts (document_id, home_id, chunk_index, content) VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(home_id)
        .bind(i as i32)
        .bind(chunk)
        .execute(&state.pool)
        .await?;
    }

    Ok(Json(DocumentExtractResponse {
        chunks_extracted: chunks.len(),
    }))
}

// ── POST /api/v1/documents/ask ──

pub async fn ask(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<DocumentAskRequest>,
) -> Result<Json<DocumentAskResult>, AppError> {
    let home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?;

    // 1. Sanitize query for FTS5: wrap each word in double quotes
    let fts_query: String = req
        .query
        .split_whitespace()
        .map(|word| {
            let sanitized: String = word.chars().filter(|c| !"\"\\'*:()".contains(*c)).collect();
            format!("\"{sanitized}\"")
        })
        .collect::<Vec<_>>()
        .join(" ");

    // 2. Search FTS5
    #[derive(Debug, sqlx::FromRow)]
    struct ChunkRow {
        #[allow(dead_code)]
        id: i64,
        document_id: String,
        content: String,
        #[allow(dead_code)]
        chunk_index: i32,
    }

    let mut matched_chunks: Vec<ChunkRow> = if !fts_query.is_empty() {
        sqlx::query_as::<_, ChunkRow>(
            "SELECT dt.id, dt.document_id, dt.content, dt.chunk_index
             FROM document_texts dt
             JOIN document_texts_fts fts ON dt.id = fts.rowid
             WHERE dt.home_id = ? AND document_texts_fts MATCH ?
             ORDER BY rank
             LIMIT 10",
        )
        .bind(home_id)
        .bind(&fts_query)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
    } else {
        Vec::new()
    };

    // 3. Fallback to LIKE if no FTS results
    if matched_chunks.is_empty() {
        let like_pattern = format!("%{}%", req.query);
        matched_chunks = sqlx::query_as::<_, ChunkRow>(
            "SELECT id, document_id, content, chunk_index
             FROM document_texts
             WHERE home_id = ? AND content LIKE ?
             LIMIT 10",
        )
        .bind(home_id)
        .bind(&like_pattern)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();
    }

    // 4. Build context and sources
    let mut context = String::from("参照資料:\n");
    let mut sources: Vec<DocumentSource> = Vec::new();
    let mut seen_docs: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (i, chunk) in matched_chunks.iter().enumerate() {
        // Look up document title
        let title: String = sqlx::query_scalar("SELECT title FROM documents WHERE id = ?")
            .bind(&chunk.document_id)
            .fetch_one(&state.pool)
            .await
            .unwrap_or_else(|_| "不明".to_string());

        context.push_str(&format!(
            "\n【{}】(chunk {})\n{}\n",
            title,
            i + 1,
            chunk.content
        ));

        if seen_docs.insert(chunk.document_id.clone()) {
            let snippet: String = if chunk.content.len() > 100 {
                let mut end = 100;
                // Avoid splitting in the middle of a multi-byte character
                while !chunk.content.is_char_boundary(end) && end < chunk.content.len() {
                    end += 1;
                }
                format!("{}...", &chunk.content[..end])
            } else {
                chunk.content.clone()
            };

            sources.push(DocumentSource {
                document_id: chunk.document_id.clone(),
                title,
                snippet,
            });
        }
    }

    // 5. If no chunks found, return a no-results answer
    if matched_chunks.is_empty() {
        return Ok(Json(DocumentAskResult {
            answer:
                "該当する情報が見つかりませんでした。まず書類のテキスト抽出を実行してください。"
                    .to_string(),
            sources: vec![],
        }));
    }

    // 6. Send to Ollama
    let ollama_url =
        std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let ollama_model = std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "qwen3.5:2b".to_string());

    let system_prompt = format!(
        "あなたは資料検索アシスタントです。ユーザーの質問に対して、提供された参照資料の内容に基づいて正確に回答してください。資料に記載されていない情報は推測せず、「該当する情報が見つかりませんでした」と回答してください。\n\n{context}"
    );

    let ollama_body = serde_json::json!({
        "model": ollama_model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": req.query
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

    let answer = ollama_resp.message.map(|m| m.content).unwrap_or_default();

    Ok(Json(DocumentAskResult { answer, sources }))
}
