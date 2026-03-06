mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod scheduler;
mod storage;
mod validation;

use axum::Router;
use axum::http::HeaderValue;
use axum::routing::{delete, get, patch, post, put};
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use storage::S3Storage;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;
use tracing::info;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::SqlitePool,
    pub storage: Arc<S3Storage>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "homie_backend=info,tower_http=info".parse().unwrap()),
        )
        .init();

    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:homie.db?mode=rwc".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    db::init_db(&pool).await;

    let storage = Arc::new(S3Storage::new().await);

    let state = AppState {
        pool: pool.clone(),
        storage,
    };

    let frontend_url =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".to_string());

    let cors = CorsLayer::new()
        .allow_origin(frontend_url.parse::<axum::http::HeaderValue>().unwrap())
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
        ])
        .allow_headers([axum::http::header::CONTENT_TYPE])
        .allow_credentials(true);

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/api/v1/auth/google", get(handlers::auth::google_login))
        .route(
            "/api/v1/auth/google/callback",
            get(handlers::auth::google_callback),
        )
        .route("/api/v1/auth/refresh", post(handlers::auth::refresh))
        // Google Calendar OAuth callback (public because it's a redirect from Google)
        .route(
            "/api/v1/calendar/google/callback",
            get(handlers::google_calendar::callback),
        );

    // Auth routes (auth required, no home required)
    let auth_routes = Router::new()
        .route("/api/v1/auth/logout", post(handlers::auth::logout))
        .route("/api/v1/auth/me", get(handlers::auth::me))
        .route("/api/v1/auth/profile", put(handlers::auth::update_profile))
        .route("/api/v1/homes", post(handlers::homes::create_home))
        .route("/api/v1/homes/join", post(handlers::homes::join))
        // Google Calendar (auth required, no home required for connect/status)
        .route(
            "/api/v1/calendar/google/connect",
            get(handlers::google_calendar::connect),
        )
        .route(
            "/api/v1/calendar/google/disconnect",
            post(handlers::google_calendar::disconnect),
        )
        .route(
            "/api/v1/calendar/google/status",
            get(handlers::google_calendar::status),
        )
        .route(
            "/api/v1/calendar/google/calendars",
            get(handlers::google_calendar::list_calendars)
                .put(handlers::google_calendar::update_calendar_selections),
        )
        // Push Notifications
        .route("/api/v1/push/subscribe", post(handlers::push::subscribe))
        .route(
            "/api/v1/push/unsubscribe",
            post(handlers::push::unsubscribe),
        )
        .route(
            "/api/v1/push/preferences",
            get(handlers::push::get_preferences).put(handlers::push::update_preferences),
        )
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::require_auth,
        ));

    // Protected routes (auth + home required)
    let protected_routes = Router::new()
        // Homes
        .route(
            "/api/v1/homes/{home_id}/invite",
            post(handlers::homes::invite),
        )
        // Files
        .route("/api/v1/files", post(handlers::files::upload))
        .route("/api/v1/files/{id}/url", get(handlers::files::get_url))
        .route("/api/v1/files/{id}", delete(handlers::files::delete))
        // Garbage
        .route(
            "/api/v1/garbage/categories",
            get(handlers::garbage::list_categories).post(handlers::garbage::create_category),
        )
        .route(
            "/api/v1/garbage/categories/{id}",
            put(handlers::garbage::update_category).delete(handlers::garbage::delete_category),
        )
        .route(
            "/api/v1/garbage/schedules",
            get(handlers::garbage::list_schedules).post(handlers::garbage::create_schedule),
        )
        .route(
            "/api/v1/garbage/schedules/{id}",
            put(handlers::garbage::update_schedule).delete(handlers::garbage::delete_schedule),
        )
        .route("/api/v1/garbage/all", delete(handlers::garbage::delete_all))
        .route("/api/v1/garbage/ask", post(handlers::garbage::ask))
        .route("/api/v1/garbage/extract", post(handlers::garbage::extract))
        // Budget
        .route(
            "/api/v1/budget/entries",
            get(handlers::budget::list_entries).post(handlers::budget::create_entry),
        )
        .route(
            "/api/v1/budget/entries/{id}",
            put(handlers::budget::update_entry).delete(handlers::budget::delete_entry),
        )
        .route("/api/v1/budget/summary", get(handlers::budget::summary))
        // Calendar
        .route(
            "/api/v1/calendar/events",
            get(handlers::calendar::list_events).post(handlers::calendar::create_event),
        )
        .route(
            "/api/v1/calendar/events/{id}",
            put(handlers::calendar::update_event).delete(handlers::calendar::delete_event),
        )
        .route(
            "/api/v1/calendar/events/{id}/toggle",
            patch(handlers::calendar::toggle_task),
        )
        .route(
            "/api/v1/calendar/events/{id}/exception",
            post(handlers::calendar::create_exception),
        )
        .route(
            "/api/v1/calendar/events/{id}/exception/{original_date}",
            delete(handlers::calendar::delete_exception),
        )
        // Google Calendar Sync
        .route(
            "/api/v1/calendar/google/sync",
            post(handlers::google_calendar::sync),
        )
        // Documents
        .route(
            "/api/v1/documents",
            get(handlers::documents::list_documents).post(handlers::documents::create_document),
        )
        .route(
            "/api/v1/documents/{id}",
            put(handlers::documents::update_document).delete(handlers::documents::delete_document),
        )
        // Accounts
        .route(
            "/api/v1/accounts",
            get(handlers::accounts::list_accounts).post(handlers::accounts::create_account),
        )
        .route(
            "/api/v1/accounts/summary",
            get(handlers::accounts::accounts_summary),
        )
        .route(
            "/api/v1/accounts/{id}",
            put(handlers::accounts::update_account).delete(handlers::accounts::delete_account),
        )
        .route(
            "/api/v1/accounts/{id}/transactions",
            get(handlers::accounts::list_transactions).post(handlers::accounts::create_transaction),
        )
        .route(
            "/api/v1/accounts/transactions/{id}",
            delete(handlers::accounts::delete_transaction),
        )
        // Monthly Budgets
        .route(
            "/api/v1/budgets/monthly",
            get(handlers::monthly_budgets::list_budgets)
                .post(handlers::monthly_budgets::upsert_budget),
        )
        .route(
            "/api/v1/budgets/monthly/{id}",
            delete(handlers::monthly_budgets::delete_budget),
        )
        // Savings Goals
        .route(
            "/api/v1/savings",
            get(handlers::savings::list_goals).post(handlers::savings::create_goal),
        )
        .route(
            "/api/v1/savings/{id}",
            put(handlers::savings::update_goal).delete(handlers::savings::delete_goal),
        )
        // Employments
        .route(
            "/api/v1/employments",
            get(handlers::employments::list_employments)
                .post(handlers::employments::create_employment),
        )
        .route(
            "/api/v1/employments/{id}",
            put(handlers::employments::update_employment)
                .delete(handlers::employments::delete_employment),
        )
        // Shifts
        .route(
            "/api/v1/shifts",
            get(handlers::shifts::list_shifts).post(handlers::shifts::create_shift),
        )
        .route(
            "/api/v1/shifts/{id}",
            put(handlers::shifts::update_shift).delete(handlers::shifts::delete_shift),
        )
        // Subscriptions
        .route(
            "/api/v1/subscriptions",
            get(handlers::subscriptions::list_subscriptions)
                .post(handlers::subscriptions::create_subscription),
        )
        .route(
            "/api/v1/subscriptions/{id}",
            put(handlers::subscriptions::update_subscription)
                .delete(handlers::subscriptions::delete_subscription),
        )
        // Receipt OCR
        .route("/api/v1/receipt/scan", post(handlers::receipt::scan))
        // Salary
        .route("/api/v1/salary/predict", get(handlers::salary::predict))
        .route(
            "/api/v1/salary/records",
            get(handlers::salary::list_records).post(handlers::salary::create_record),
        )
        .route(
            "/api/v1/salary/records/{id}",
            put(handlers::salary::update_record).delete(handlers::salary::delete_record),
        )
        .layer(axum::middleware::from_fn(middleware::auth::require_home))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::require_auth,
        ));

    // Serve frontend static files (SPA fallback to index.html)
    let frontend_dir =
        std::env::var("FRONTEND_DIR").unwrap_or_else(|_| "../homie-app/dist".to_string());
    let spa_fallback = ServeDir::new(&frontend_dir)
        .not_found_service(ServeFile::new(format!("{frontend_dir}/index.html")));

    let app = Router::new()
        .merge(public_routes)
        .merge(auth_routes)
        .merge(protected_routes)
        .fallback_service(spa_fallback)
        .layer(cors)
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{port}");
    info!("Server running on http://{addr}");

    let scheduler_pool = pool.clone();
    tokio::spawn(async move {
        scheduler::run(scheduler_pool).await;
    });

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
