use axum::extract::{Multipart, Path, State};
use axum::{Extension, Json};
use std::io::Cursor;
use std::time::Duration;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::*;
use crate::AppState;

const MAX_FILE_SIZE: usize = 50 * 1024 * 1024; // 50MB

const ALLOWED_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
];

fn validate_magic_bytes(data: &[u8], declared_type: &str) -> bool {
    match declared_type {
        "image/jpeg" => data.starts_with(&[0xFF, 0xD8, 0xFF]),
        "image/png" => data.starts_with(&[0x89, 0x50, 0x4E, 0x47]),
        "image/webp" => data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP",
        "application/pdf" => data.starts_with(b"%PDF"),
        "video/mp4" => data.len() >= 8 && (&data[4..8] == b"ftyp" || &data[4..8] == b"moov"),
        "video/quicktime" => data.len() >= 8 && (&data[4..8] == b"ftyp" || &data[4..8] == b"moov"),
        "video/x-msvideo" => data.starts_with(b"RIFF") && data.len() >= 12 && &data[8..12] == b"AVI ",
        _ => false,
    }
}

fn sanitize_filename(name: &str) -> String {
    let name = name.split(['/', '\\', '\0']).last().unwrap_or("unnamed");
    let sanitized: String = name.chars()
        .filter(|c| !matches!(c, '\0'..='\x1f' | '<' | '>' | ':' | '"' | '|' | '?' | '*'))
        .collect();
    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "unnamed".to_string()
    } else if sanitized.len() > 255 {
        sanitized[..255].to_string()
    } else {
        sanitized
    }
}

fn is_image(content_type: &str) -> bool {
    content_type.starts_with("image/")
}

fn generate_thumbnail(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(data)
        .map_err(|e| AppError::Internal(format!("Image decode error: {e}")))?;
    if img.width() > 20000 || img.height() > 20000 {
        return Err(AppError::BadRequest("Image dimensions too large".to_string()));
    }
    let thumb = img.thumbnail(200, 200);
    let mut buf = Vec::new();
    thumb
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .map_err(|e| AppError::Internal(format!("Thumbnail encode error: {e}")))?;
    Ok(buf)
}

pub async fn upload(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<FileUploadResponse>, AppError> {
    let home_id = auth
        .home_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("No home membership".to_string()))?;

    let mut file_data: Option<(String, String, Vec<u8>)> = None; // (name, content_type, bytes)

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {e}")))?
    {
        if field.name() == Some("file") {
            let file_name = sanitize_filename(field.file_name().unwrap_or("unnamed"));
            let content_type = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_string();

            let bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(format!("File read error: {e}")))?;

            if bytes.len() > MAX_FILE_SIZE {
                return Err(AppError::BadRequest(
                    "File too large (max 50MB)".to_string(),
                ));
            }

            if !ALLOWED_TYPES.contains(&content_type.as_str()) {
                return Err(AppError::BadRequest(
                    "Unsupported file type".to_string(),
                ));
            }

            if !validate_magic_bytes(&bytes, &content_type) {
                return Err(AppError::BadRequest(
                    "File content does not match declared type".to_string(),
                ));
            }

            file_data = Some((file_name, content_type, bytes.to_vec()));
            break;
        }
    }

    let (original_name, content_type, bytes) =
        file_data.ok_or_else(|| AppError::BadRequest("No file field found".to_string()))?;

    let file_id = Uuid::new_v4().to_string();
    let s3_key = format!("files/{home_id}/{file_id}");
    let size = bytes.len() as i64;

    // Upload to S3
    state
        .storage
        .upload(&s3_key, bytes.clone(), &content_type)
        .await?;

    // Generate thumbnail for images
    let thumbnail_key = if is_image(&content_type) {
        let thumb_key = format!("thumbnails/{home_id}/{file_id}");
        match generate_thumbnail(&bytes) {
            Ok(thumb_bytes) => {
                state
                    .storage
                    .upload(&thumb_key, thumb_bytes, "image/jpeg")
                    .await?;
                Some(thumb_key)
            }
            Err(e) => {
                tracing::warn!("Thumbnail generation failed: {e:?}");
                None
            }
        }
    } else {
        None
    };

    // Save metadata to DB
    sqlx::query(
        "INSERT INTO files (id, home_id, original_name, content_type, size, s3_key, thumbnail_key, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&file_id)
    .bind(home_id)
    .bind(&original_name)
    .bind(&content_type)
    .bind(size)
    .bind(&s3_key)
    .bind(&thumbnail_key)
    .bind(&auth.user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    // Generate presigned URLs for response
    let url = state
        .storage
        .presign_get(&s3_key, Duration::from_secs(3600))
        .await?;

    let thumbnail_url = if let Some(ref tk) = thumbnail_key {
        Some(
            state
                .storage
                .presign_get(tk, Duration::from_secs(3600))
                .await?,
        )
    } else {
        None
    };

    Ok(Json(FileUploadResponse {
        id: file_id,
        original_name,
        content_type,
        size,
        url,
        thumbnail_url,
    }))
}

pub async fn get_url(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<FileUrlResponse>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let file: FileRecord = sqlx::query_as(
        "SELECT id, home_id, original_name, content_type, size, s3_key, thumbnail_key, uploaded_by, uploaded_at FROM files WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound,
        other => AppError::Internal(other.to_string()),
    })?;

    let url = state
        .storage
        .presign_get(&file.s3_key, Duration::from_secs(3600))
        .await?;

    let thumbnail_url = if let Some(ref tk) = file.thumbnail_key {
        Some(
            state
                .storage
                .presign_get(tk, Duration::from_secs(3600))
                .await?,
        )
    } else {
        None
    };

    Ok(Json(FileUrlResponse {
        url,
        thumbnail_url,
    }))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let file: FileRecord = sqlx::query_as(
        "SELECT id, home_id, original_name, content_type, size, s3_key, thumbnail_key, uploaded_by, uploaded_at FROM files WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound,
        other => AppError::Internal(other.to_string()),
    })?;

    // Delete from S3
    state.storage.delete(&file.s3_key).await?;

    if let Some(ref tk) = file.thumbnail_key {
        state.storage.delete(tk).await?;
    }

    // Delete from DB
    sqlx::query("DELETE FROM files WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(())
}
