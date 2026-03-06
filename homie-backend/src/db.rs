use sqlx::SqlitePool;

pub async fn init_db(pool: &SqlitePool) {
    // Enable foreign keys
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await
        .expect("Failed to enable foreign keys");

    // ── Auth tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            google_id TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            avatar_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create users table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS homes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT 'My Home',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create homes table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            role TEXT NOT NULL DEFAULT 'member',
            UNIQUE(home_id, user_id)
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create members table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create refresh_tokens table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS invite_codes (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            code TEXT NOT NULL UNIQUE,
            created_by TEXT NOT NULL REFERENCES users(id),
            expires_at TEXT NOT NULL,
            used_by TEXT REFERENCES users(id),
            used_at TEXT
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create invite_codes table");

    // ── Garbage tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS garbage_categories (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT ''
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create garbage_categories table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS garbage_category_items (
            category_id TEXT NOT NULL REFERENCES garbage_categories(id) ON DELETE CASCADE,
            item TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create garbage_category_items table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS garbage_schedules (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            category_id TEXT NOT NULL REFERENCES garbage_categories(id) ON DELETE CASCADE,
            location TEXT,
            note TEXT
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create garbage_schedules table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS garbage_schedule_days (
            schedule_id TEXT NOT NULL REFERENCES garbage_schedules(id) ON DELETE CASCADE,
            day_of_week INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create garbage_schedule_days table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS garbage_schedule_weeks (
            schedule_id TEXT NOT NULL REFERENCES garbage_schedules(id) ON DELETE CASCADE,
            week_of_month INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create garbage_schedule_weeks table");

    // ── Budget tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS budget_entries (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            paid_by TEXT NOT NULL REFERENCES users(id),
            receipt_image_url TEXT
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create budget_entries table");

    // ── Calendar tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS calendar_events (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            end_date TEXT,
            all_day BOOLEAN NOT NULL DEFAULT 0,
            type TEXT NOT NULL DEFAULT 'personal',
            assignee TEXT REFERENCES users(id),
            completed BOOLEAN,
            color TEXT,
            description TEXT,
            google_event_id TEXT,
            recurrence_rule TEXT,
            recurrence_interval INTEGER DEFAULT 1,
            recurrence_end TEXT
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create calendar_events table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS calendar_event_exceptions (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
            original_date TEXT NOT NULL,
            is_deleted BOOLEAN NOT NULL DEFAULT 0,
            title TEXT,
            date TEXT,
            end_date TEXT,
            all_day BOOLEAN,
            assignee TEXT,
            color TEXT,
            description TEXT,
            UNIQUE(event_id, original_date)
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create calendar_event_exceptions table");

    // ── Document tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            note TEXT
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create documents table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS document_tags (
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            tag TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create document_tags table");

    // ── Google Calendar tokens ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS google_calendar_tokens (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            sync_token TEXT,
            connected_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create google_calendar_tokens table");

    // ── Google Calendar selections ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS google_calendar_selections (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            calendar_id TEXT NOT NULL,
            calendar_name TEXT NOT NULL DEFAULT '',
            selected BOOLEAN NOT NULL DEFAULT 1,
            background_color TEXT,
            PRIMARY KEY (user_id, calendar_id)
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create google_calendar_selections table");

    // ── Account tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('bank', 'credit_card', 'cash', 'e_money')),
            initial_balance REAL NOT NULL DEFAULT 0,
            color TEXT,
            billing_date INTEGER,
            payment_date INTEGER,
            payment_account_id TEXT REFERENCES accounts(id),
            note TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create accounts table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS account_transactions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            home_id TEXT NOT NULL REFERENCES homes(id),
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
            category TEXT,
            description TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL,
            transfer_to_account_id TEXT REFERENCES accounts(id),
            budget_entry_id TEXT REFERENCES budget_entries(id),
            salary_record_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create account_transactions table");

    // ── Monthly budgets ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS monthly_budgets (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            year_month TEXT NOT NULL,
            UNIQUE(home_id, category, year_month)
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create monthly_budgets table");

    // ── Savings goals ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS savings_goals (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            name TEXT NOT NULL,
            target_amount REAL NOT NULL,
            current_amount REAL NOT NULL DEFAULT 0,
            target_date TEXT,
            account_id TEXT REFERENCES accounts(id),
            note TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create savings_goals table");

    // ── Employment tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS employments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            home_id TEXT NOT NULL REFERENCES homes(id),
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('part_time', 'full_time')),
            hourly_rate REAL,
            night_start_hour INTEGER DEFAULT 22,
            night_end_hour INTEGER DEFAULT 5,
            night_rate_multiplier REAL DEFAULT 1.25,
            holiday_rate_multiplier REAL DEFAULT 1.35,
            overtime_threshold_minutes INTEGER DEFAULT 480,
            overtime_rate_multiplier REAL DEFAULT 1.25,
            monthly_salary REAL,
            transport_allowance REAL DEFAULT 0,
            pay_day INTEGER,
            social_insurance_rate REAL DEFAULT 0.15,
            income_tax_rate REAL DEFAULT 0.05,
            color TEXT,
            note TEXT,
            deposit_account_id TEXT REFERENCES accounts(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create employments table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS shifts (
            id TEXT PRIMARY KEY,
            employment_id TEXT NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id),
            home_id TEXT NOT NULL REFERENCES homes(id),
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            break_minutes INTEGER NOT NULL DEFAULT 0,
            is_holiday INTEGER NOT NULL DEFAULT 0,
            note TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create shifts table");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS salary_records (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            home_id TEXT NOT NULL REFERENCES homes(id),
            employment_id TEXT NOT NULL REFERENCES employments(id),
            year_month TEXT NOT NULL,
            base_pay REAL NOT NULL DEFAULT 0,
            overtime_pay REAL NOT NULL DEFAULT 0,
            night_pay REAL NOT NULL DEFAULT 0,
            holiday_pay REAL NOT NULL DEFAULT 0,
            transport_allowance REAL NOT NULL DEFAULT 0,
            other_allowances REAL NOT NULL DEFAULT 0,
            gross_amount REAL NOT NULL,
            social_insurance REAL NOT NULL DEFAULT 0,
            income_tax REAL NOT NULL DEFAULT 0,
            other_deductions REAL NOT NULL DEFAULT 0,
            net_amount REAL NOT NULL,
            paid_date TEXT,
            deposit_account_id TEXT REFERENCES accounts(id),
            note TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(employment_id, year_month)
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create salary_records table");

    // ── users migration: add display_name ──

    let has_display_name: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('users') WHERE name = 'display_name'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !has_display_name {
        sqlx::query("ALTER TABLE users ADD COLUMN display_name TEXT")
            .execute(pool)
            .await
            .expect("Failed to add display_name to users");

        // Backfill: set display_name = name for existing users
        sqlx::query("UPDATE users SET display_name = name WHERE display_name IS NULL")
            .execute(pool)
            .await
            .expect("Failed to backfill display_name");
    }

    // ── invite_codes migration: add invited_email ──

    let has_invited_email: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('invite_codes') WHERE name = 'invited_email'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !has_invited_email {
        sqlx::query("ALTER TABLE invite_codes ADD COLUMN invited_email TEXT")
            .execute(pool)
            .await
            .expect("Failed to add invited_email to invite_codes");
    }

    // ── budget_entries migration: add account_id ──

    // SQLite doesn't support ADD COLUMN IF NOT EXISTS, so check first
    let has_account_id: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('budget_entries') WHERE name = 'account_id'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !has_account_id {
        sqlx::query(
            "ALTER TABLE budget_entries ADD COLUMN account_id TEXT REFERENCES accounts(id)",
        )
        .execute(pool)
        .await
        .expect("Failed to add account_id to budget_entries");
    }

    // ── calendar_events migration: add google_calendar_id ──

    let has_gcal_id: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('calendar_events') WHERE name = 'google_calendar_id'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !has_gcal_id {
        sqlx::query("ALTER TABLE calendar_events ADD COLUMN google_calendar_id TEXT")
            .execute(pool)
            .await
            .expect("Failed to add google_calendar_id to calendar_events");
    }

    // ── calendar_events migration: add created_by ──

    let has_created_by: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('calendar_events') WHERE name = 'created_by'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !has_created_by {
        sqlx::query("ALTER TABLE calendar_events ADD COLUMN created_by TEXT REFERENCES users(id)")
            .execute(pool)
            .await
            .expect("Failed to add created_by to calendar_events");
    }

    // ── Subscriptions ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            paid_by TEXT NOT NULL REFERENCES users(id),
            account_id TEXT REFERENCES accounts(id),
            billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'yearly', 'weekly')),
            billing_day INTEGER NOT NULL,
            next_billing_date TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            note TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create subscriptions table");

    // ── Migration: Add google_event_id and sync_to_calendar to subscriptions ──
    let has_google_event_id: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('subscriptions') WHERE name = 'google_event_id'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !has_google_event_id {
        sqlx::query("ALTER TABLE subscriptions ADD COLUMN google_event_id TEXT")
            .execute(pool)
            .await
            .expect("Failed to add google_event_id to subscriptions");
        sqlx::query(
            "ALTER TABLE subscriptions ADD COLUMN sync_to_calendar INTEGER NOT NULL DEFAULT 1",
        )
        .execute(pool)
        .await
        .expect("Failed to add sync_to_calendar to subscriptions");
    }

    // ── Migration: Add deposit_account_id to employments ──

    let has_deposit_account_id: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('employments') WHERE name = 'deposit_account_id'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !has_deposit_account_id {
        sqlx::query(
            "ALTER TABLE employments ADD COLUMN deposit_account_id TEXT REFERENCES accounts(id)",
        )
        .execute(pool)
        .await
        .expect("Failed to add deposit_account_id to employments");
    }

    // ── File tables ──

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            home_id TEXT NOT NULL REFERENCES homes(id),
            original_name TEXT NOT NULL,
            content_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            s3_key TEXT NOT NULL,
            thumbnail_key TEXT,
            uploaded_by TEXT NOT NULL REFERENCES users(id),
            uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create files table");
}
