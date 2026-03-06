use axum::extract::{Path, Query, State};
use axum::{Extension, Json};

use crate::errors::AppError;
use crate::models::*;
use crate::validation::*;
use crate::AppState;

#[derive(serde::Deserialize)]
pub struct TransactionQuery {
    pub year_month: Option<String>,
}

// ── Accounts CRUD ──

pub async fn list_accounts(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<Vec<AccountWithBalance>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let accounts: Vec<Account> = sqlx::query_as(
        "SELECT id, home_id, user_id, name, type, initial_balance, color, billing_date, payment_date, payment_account_id, note, created_at FROM accounts WHERE home_id = ? ORDER BY created_at",
    )
    .bind(home_id)
    .fetch_all(&state.pool)
    .await?;

    let mut result = Vec::with_capacity(accounts.len());
    for account in accounts {
        let balance = calc_balance(&state, &account).await?;
        result.push(AccountWithBalance { account, balance });
    }

    Ok(Json(result))
}

pub async fn create_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(input): Json<CreateAccount>,
) -> Result<Json<AccountWithBalance>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    validate_name(&input.name, "name")?;
    validate_enum(&input.account_type, &["bank", "credit_card", "cash", "e_money"], "type")?;
    if let Some(balance) = input.initial_balance {
        validate_amount(balance.abs(), "initialBalance")?;
    }
    if let Some(day) = input.billing_date {
        validate_day_of_month(day, "billingDate")?;
    }
    if let Some(day) = input.payment_date {
        validate_day_of_month(day, "paymentDate")?;
    }
    let account = Account::new(home_id, auth.user_id.clone(), input);

    sqlx::query(
        "INSERT INTO accounts (id, home_id, user_id, name, type, initial_balance, color, billing_date, payment_date, payment_account_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&account.id)
    .bind(&account.home_id)
    .bind(&account.user_id)
    .bind(&account.name)
    .bind(&account.account_type)
    .bind(account.initial_balance)
    .bind(&account.color)
    .bind(account.billing_date)
    .bind(account.payment_date)
    .bind(&account.payment_account_id)
    .bind(&account.note)
    .bind(&account.created_at)
    .execute(&state.pool)
    .await?;

    let balance = account.initial_balance;
    Ok(Json(AccountWithBalance { account, balance }))
}

pub async fn update_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateAccount>,
) -> Result<Json<AccountWithBalance>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let existing: Account = sqlx::query_as(
        "SELECT id, home_id, user_id, name, type, initial_balance, color, billing_date, payment_date, payment_account_id, note, created_at FROM accounts WHERE id = ? AND home_id = ?",
    )
    .bind(&id)
    .bind(home_id)
    .fetch_one(&state.pool)
    .await?;

    let updated = Account {
        id: id.clone(),
        home_id: home_id.to_string(),
        user_id: existing.user_id,
        name: input.name.unwrap_or(existing.name),
        account_type: existing.account_type,
        initial_balance: input.initial_balance.unwrap_or(existing.initial_balance),
        color: input.color.or(existing.color),
        billing_date: input.billing_date.or(existing.billing_date),
        payment_date: input.payment_date.or(existing.payment_date),
        payment_account_id: input.payment_account_id.or(existing.payment_account_id),
        note: input.note.or(existing.note),
        created_at: existing.created_at,
    };

    sqlx::query(
        "UPDATE accounts SET name = ?, initial_balance = ?, color = ?, billing_date = ?, payment_date = ?, payment_account_id = ?, note = ? WHERE id = ? AND home_id = ?",
    )
    .bind(&updated.name)
    .bind(updated.initial_balance)
    .bind(&updated.color)
    .bind(updated.billing_date)
    .bind(updated.payment_date)
    .bind(&updated.payment_account_id)
    .bind(&updated.note)
    .bind(&id)
    .bind(home_id)
    .execute(&state.pool)
    .await?;

    let balance = calc_balance(&state, &updated).await?;
    Ok(Json(AccountWithBalance {
        account: updated,
        balance,
    }))
}

pub async fn delete_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM accounts WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

// ── Transactions CRUD ──

pub async fn list_transactions(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(account_id): Path<String>,
    Query(query): Query<TransactionQuery>,
) -> Result<Json<Vec<AccountTransaction>>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let transactions = if let Some(ym) = &query.year_month {
        sqlx::query_as::<_, AccountTransaction>(
            "SELECT id, account_id, home_id, amount, type, category, description, date, transfer_to_account_id, budget_entry_id, salary_record_id, created_at FROM account_transactions WHERE account_id = ? AND home_id = ? AND date LIKE ? || '%' ORDER BY date DESC",
        )
        .bind(&account_id)
        .bind(home_id)
        .bind(ym)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, AccountTransaction>(
            "SELECT id, account_id, home_id, amount, type, category, description, date, transfer_to_account_id, budget_entry_id, salary_record_id, created_at FROM account_transactions WHERE account_id = ? AND home_id = ? ORDER BY date DESC",
        )
        .bind(&account_id)
        .bind(home_id)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(transactions))
}

pub async fn create_transaction(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(account_id): Path<String>,
    Json(input): Json<CreateAccountTransaction>,
) -> Result<Json<AccountTransaction>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap().to_string();
    validate_amount(input.amount, "amount")?;
    validate_enum(&input.transaction_type, &["income", "expense", "transfer"], "type")?;
    let tx = AccountTransaction::new(account_id, home_id, input);

    sqlx::query(
        "INSERT INTO account_transactions (id, account_id, home_id, amount, type, category, description, date, transfer_to_account_id, budget_entry_id, salary_record_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&tx.id)
    .bind(&tx.account_id)
    .bind(&tx.home_id)
    .bind(tx.amount)
    .bind(&tx.transaction_type)
    .bind(&tx.category)
    .bind(&tx.description)
    .bind(&tx.date)
    .bind(&tx.transfer_to_account_id)
    .bind(&tx.budget_entry_id)
    .bind(&tx.salary_record_id)
    .bind(&tx.created_at)
    .execute(&state.pool)
    .await?;

    Ok(Json(tx))
}

pub async fn delete_transaction(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<(), AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    sqlx::query("DELETE FROM account_transactions WHERE id = ? AND home_id = ?")
        .bind(&id)
        .bind(home_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

// ── Summary ──

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsSummary {
    pub total_balance: f64,
    pub accounts: Vec<AccountWithBalance>,
}

pub async fn accounts_summary(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<AccountsSummary>, AppError> {
    let home_id = auth.home_id.as_deref().unwrap();

    let accounts: Vec<Account> = sqlx::query_as(
        "SELECT id, home_id, user_id, name, type, initial_balance, color, billing_date, payment_date, payment_account_id, note, created_at FROM accounts WHERE home_id = ? ORDER BY created_at",
    )
    .bind(home_id)
    .fetch_all(&state.pool)
    .await?;

    let mut items = Vec::with_capacity(accounts.len());
    let mut total_balance = 0.0;

    for account in accounts {
        let balance = calc_balance(&state, &account).await?;
        total_balance += balance;
        items.push(AccountWithBalance { account, balance });
    }

    Ok(Json(AccountsSummary {
        total_balance,
        accounts: items,
    }))
}

// ── Helper ──

async fn calc_balance(state: &AppState, account: &Account) -> Result<f64, AppError> {
    let tx_sum: Option<f64> = sqlx::query_scalar(
        "SELECT SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount WHEN type = 'transfer' THEN -amount ELSE 0 END) FROM account_transactions WHERE account_id = ?",
    )
    .bind(&account.id)
    .fetch_one(&state.pool)
    .await?;

    let transfer_in: Option<f64> = sqlx::query_scalar(
        "SELECT SUM(amount) FROM account_transactions WHERE transfer_to_account_id = ?",
    )
    .bind(&account.id)
    .fetch_one(&state.pool)
    .await?;

    Ok(account.initial_balance + tx_sum.unwrap_or(0.0) + transfer_in.unwrap_or(0.0))
}
