use axum::extract::{Path, Query, State};
use axum::{Extension, Json};

use crate::AppState;
use crate::errors::AppError;
use crate::models::*;

#[derive(serde::Deserialize)]
pub struct DocumentQuery {
    pub search: Option<String>,
    pub category: Option<String>,
}

pub async fn list_documents(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<DocumentQuery>,
) -> Result<Json<Vec<Document>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let mut documents: Vec<Document> = if let Some(category) = &query.category {
        sqlx::query_as(
            "SELECT id, home_id, title, category, file_url, file_type, uploaded_at, note FROM documents WHERE home_id = ? AND category = ? ORDER BY uploaded_at DESC",
        )
        .bind(home_id)
        .bind(category)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT id, home_id, title, category, file_url, file_type, uploaded_at, note FROM documents WHERE home_id = ? ORDER BY uploaded_at DESC",
        )
        .bind(home_id)
        .fetch_all(&state.pool)
        .await?
    };

    for doc in &mut documents {
        let tags: Vec<(String,)> =
            sqlx::query_as("SELECT tag FROM document_tags WHERE document_id = ?")
                .bind(&doc.id)
                .fetch_all(&state.pool)
                .await?;
        doc.tags = tags.into_iter().map(|(t,)| t).collect();
    }

    if let Some(search) = &query.search {
        let q = search.to_lowercase();
        documents.retain(|d| {
            d.title.to_lowercase().contains(&q)
                || d.tags.iter().any(|t| t.to_lowercase().contains(&q))
                || d.note
                    .as_ref()
                    .is_some_and(|n| n.to_lowercase().contains(&q))
        });
    }

    Ok(Json(documents))
}

pub async fn create_document(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateDocument>,
) -> Result<Json<Document>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    let doc = Document::new(home_id, input);

    sqlx::query(
        "INSERT INTO documents (id, home_id, title, category, file_url, file_type, uploaded_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&doc.id)
    .bind(&doc.home_id)
    .bind(&doc.title)
    .bind(&doc.category)
    .bind(&doc.file_url)
    .bind(&doc.file_type)
    .bind(&doc.uploaded_at)
    .bind(&doc.note)
    .execute(&state.pool)
    .await?;

    for tag in &doc.tags {
        sqlx::query("INSERT INTO document_tags (document_id, tag) VALUES (?, ?)")
            .bind(&doc.id)
            .bind(tag)
            .execute(&state.pool)
            .await?;
    }

    Ok(Json(doc))
}

pub async fn update_document(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateDocument>,
) -> Result<Json<Document>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: Document = sqlx::query_as(
        "SELECT id, home_id, title, category, file_url, file_type, uploaded_at, note FROM documents WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let title = input.title.unwrap_or(existing.title);
    let category = input.category.unwrap_or(existing.category);
    let file_url = input.file_url.unwrap_or(existing.file_url);
    let file_type = input.file_type.unwrap_or(existing.file_type);
    let note = input.note.or(existing.note);

    sqlx::query(
        "UPDATE documents SET title = ?, category = ?, file_url = ?, file_type = ?, note = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&title)
    .bind(&category)
    .bind(&file_url)
    .bind(&file_type)
    .bind(&note)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    let tags = if let Some(new_tags) = input.tags {
        sqlx::query("DELETE FROM document_tags WHERE document_id = ?")
            .bind(&id)
            .execute(&state.pool)
            .await?;
        for tag in &new_tags {
            sqlx::query("INSERT INTO document_tags (document_id, tag) VALUES (?, ?)")
                .bind(&id)
                .bind(tag)
                .execute(&state.pool)
                .await?;
        }
        new_tags
    } else {
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT tag FROM document_tags WHERE document_id = ?")
                .bind(&id)
                .fetch_all(&state.pool)
                .await?;
        rows.into_iter().map(|(t,)| t).collect()
    };

    Ok(Json(Document {
        id,
        home_id: home_id.to_string(),
        title,
        category,
        file_url,
        file_type,
        uploaded_at: existing.uploaded_at,
        tags,
        note,
    }))
}

pub async fn delete_document(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM documents WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}
