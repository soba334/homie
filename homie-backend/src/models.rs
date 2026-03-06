use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Auth ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub google_id: String,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub display_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Home {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: String,
    pub home_id: String,
    pub user_id: String,
    pub role: String,
}

#[allow(dead_code)]
#[derive(Debug, sqlx::FromRow)]
pub struct RefreshToken {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub expires_at: String,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, sqlx::FromRow)]
pub struct InviteCode {
    pub id: String,
    pub home_id: String,
    pub code: String,
    pub created_by: String,
    pub expires_at: String,
    pub used_by: Option<String>,
    pub used_at: Option<String>,
    pub invited_email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub home_id: Option<String>,
}

// ── Auth API responses ──

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub home: Option<HomeWithMembers>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeWithMembers {
    pub id: String,
    pub name: String,
    pub members: Vec<MemberInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberInfo {
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub email: String,
    pub avatar_url: Option<String>,
    pub role: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteResponse {
    pub code: String,
    pub expires_at: String,
}

#[derive(Debug, Deserialize)]
pub struct JoinRequest {
    pub code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfile {
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHomeRequest {
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinResponse {
    pub home_id: String,
    pub home_name: String,
}

// ── Google Calendar ──

#[derive(Debug, sqlx::FromRow)]
pub struct GoogleCalendarToken {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
    pub sync_token: Option<String>,
    pub connected_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarStatus {
    pub connected: bool,
    pub connected_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub imported: u32,
    pub updated: u32,
    pub deleted: u32,
    pub pushed: u32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarSelection {
    pub user_id: String,
    pub calendar_id: String,
    pub calendar_name: String,
    pub selected: bool,
    pub background_color: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarInfo {
    pub id: String,
    pub summary: String,
    pub selected: bool,
    pub background_color: Option<String>,
    pub access_role: String,
    pub primary: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCalendarSelections {
    pub calendars: Vec<CalendarSelectionItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarSelectionItem {
    pub id: String,
    pub selected: bool,
}

// ── Files ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FileRecord {
    pub id: String,
    pub home_id: String,
    pub original_name: String,
    pub content_type: String,
    pub size: i64,
    pub s3_key: String,
    pub thumbnail_key: Option<String>,
    pub uploaded_by: String,
    pub uploaded_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileUploadResponse {
    pub id: String,
    pub original_name: String,
    pub content_type: String,
    pub size: i64,
    pub url: String,
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileUrlResponse {
    pub url: String,
    pub thumbnail_url: Option<String>,
}

// ── Garbage ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GarbageCategory {
    pub id: String,
    pub home_id: String,
    pub name: String,
    pub color: String,
    pub description: String,
    #[sqlx(skip)]
    pub items: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGarbageCategory {
    pub name: String,
    pub color: String,
    pub description: String,
    pub items: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGarbageCategory {
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub items: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GarbageSchedule {
    pub id: String,
    pub home_id: String,
    pub category_id: String,
    #[sqlx(skip)]
    pub day_of_week: Vec<i32>,
    #[sqlx(skip)]
    pub week_of_month: Option<Vec<i32>>,
    pub location: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGarbageSchedule {
    pub category_id: String,
    pub day_of_week: Vec<i32>,
    pub week_of_month: Option<Vec<i32>>,
    pub location: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGarbageSchedule {
    pub category_id: Option<String>,
    pub day_of_week: Option<Vec<i32>>,
    pub week_of_month: Option<Vec<i32>>,
    pub location: Option<String>,
    pub note: Option<String>,
}

// ── Budget ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BudgetEntry {
    pub id: String,
    pub home_id: String,
    pub date: String,
    pub amount: f64,
    pub category: String,
    pub description: String,
    pub paid_by: String,
    pub receipt_image_url: Option<String>,
    pub account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBudgetEntry {
    pub date: String,
    pub amount: f64,
    pub category: String,
    pub description: String,
    pub paid_by: String,
    pub receipt_image_url: Option<String>,
    pub account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBudgetEntry {
    pub date: Option<String>,
    pub amount: Option<f64>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub paid_by: Option<String>,
    pub receipt_image_url: Option<String>,
    pub account_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummary {
    pub monthly_total: f64,
    pub by_person: std::collections::HashMap<String, f64>,
    pub by_category: std::collections::HashMap<String, f64>,
}

// ── Calendar ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub home_id: String,
    pub title: String,
    pub date: String,
    pub end_date: Option<String>,
    pub all_day: bool,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub event_type: String,
    pub assignee: Option<String>,
    pub completed: Option<bool>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub google_event_id: Option<String>,
    pub recurrence_rule: Option<String>,
    pub recurrence_interval: Option<i32>,
    pub recurrence_end: Option<String>,
    pub google_calendar_id: Option<String>,
    pub created_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventException {
    pub id: String,
    pub event_id: String,
    pub original_date: String,
    pub is_deleted: bool,
    pub title: Option<String>,
    pub date: Option<String>,
    pub end_date: Option<String>,
    pub all_day: Option<bool>,
    pub assignee: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandedCalendarEvent {
    pub id: String,
    pub home_id: String,
    pub title: String,
    pub date: String,
    pub end_date: Option<String>,
    pub all_day: bool,
    #[serde(rename = "type")]
    pub event_type: String,
    pub assignee: Option<String>,
    pub completed: Option<bool>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub google_event_id: Option<String>,
    pub recurrence_rule: Option<String>,
    pub recurrence_interval: Option<i32>,
    pub recurrence_end: Option<String>,
    pub is_recurrence_instance: bool,
    pub original_event_id: Option<String>,
    pub occurrence_date: Option<String>,
    pub garbage_schedule_id: Option<String>,
    pub google_calendar_id: Option<String>,
    pub created_by: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCalendarEvent {
    pub title: String,
    pub date: String,
    pub end_date: Option<String>,
    pub all_day: bool,
    #[serde(rename = "type")]
    pub event_type: String,
    pub assignee: Option<String>,
    pub completed: Option<bool>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub google_event_id: Option<String>,
    pub recurrence_rule: Option<String>,
    pub recurrence_interval: Option<i32>,
    pub recurrence_end: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCalendarEvent {
    pub title: Option<String>,
    pub date: Option<String>,
    pub end_date: Option<String>,
    pub all_day: Option<bool>,
    #[serde(rename = "type")]
    pub event_type: Option<String>,
    pub assignee: Option<String>,
    pub completed: Option<bool>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub google_event_id: Option<String>,
    pub recurrence_rule: Option<String>,
    pub recurrence_interval: Option<i32>,
    pub recurrence_end: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEventException {
    pub original_date: String,
    pub is_deleted: bool,
    pub title: Option<String>,
    pub date: Option<String>,
    pub end_date: Option<String>,
    pub all_day: Option<bool>,
    pub assignee: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

// ── Documents ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub home_id: String,
    pub title: String,
    pub category: String,
    pub file_url: String,
    pub file_type: String,
    pub uploaded_at: String,
    #[sqlx(skip)]
    pub tags: Vec<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocument {
    pub title: String,
    pub category: String,
    pub file_url: String,
    pub file_type: String,
    pub tags: Vec<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocument {
    pub title: Option<String>,
    pub category: Option<String>,
    pub file_url: Option<String>,
    pub file_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub note: Option<String>,
}

// ── Accounts ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub home_id: String,
    pub user_id: String,
    pub name: String,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub account_type: String,
    pub initial_balance: f64,
    pub color: Option<String>,
    pub billing_date: Option<i32>,
    pub payment_date: Option<i32>,
    pub payment_account_id: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccount {
    pub name: String,
    #[serde(rename = "type")]
    pub account_type: String,
    pub initial_balance: Option<f64>,
    pub color: Option<String>,
    pub billing_date: Option<i32>,
    pub payment_date: Option<i32>,
    pub payment_account_id: Option<String>,
    pub note: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccount {
    pub name: Option<String>,
    pub initial_balance: Option<f64>,
    pub color: Option<String>,
    pub billing_date: Option<i32>,
    pub payment_date: Option<i32>,
    pub payment_account_id: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithBalance {
    #[serde(flatten)]
    pub account: Account,
    pub balance: f64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccountTransaction {
    pub id: String,
    pub account_id: String,
    pub home_id: String,
    pub amount: f64,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub transaction_type: String,
    pub category: Option<String>,
    pub description: String,
    pub date: String,
    pub transfer_to_account_id: Option<String>,
    pub budget_entry_id: Option<String>,
    pub salary_record_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountTransaction {
    pub amount: f64,
    #[serde(rename = "type")]
    pub transaction_type: String,
    pub category: Option<String>,
    pub description: Option<String>,
    pub date: String,
    pub transfer_to_account_id: Option<String>,
    pub budget_entry_id: Option<String>,
}

// ── Monthly Budgets ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyBudget {
    pub id: String,
    pub home_id: String,
    pub category: String,
    pub amount: f64,
    pub year_month: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMonthlyBudget {
    pub category: String,
    pub amount: f64,
    pub year_month: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetVsActual {
    pub category: String,
    pub budget_amount: f64,
    pub actual_amount: f64,
    pub remaining: f64,
    pub usage_rate: f64,
    pub over_budget: bool,
}

// ── Savings Goals ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SavingsGoal {
    pub id: String,
    pub home_id: String,
    pub name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub target_date: Option<String>,
    pub account_id: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSavingsGoal {
    pub name: String,
    pub target_amount: f64,
    pub current_amount: Option<f64>,
    pub target_date: Option<String>,
    pub account_id: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSavingsGoal {
    pub name: Option<String>,
    pub target_amount: Option<f64>,
    pub current_amount: Option<f64>,
    pub target_date: Option<String>,
    pub account_id: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavingsGoalWithProgress {
    #[serde(flatten)]
    pub goal: SavingsGoal,
    pub progress_rate: f64,
    pub monthly_required: Option<f64>,
}

// ── Employment ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Employment {
    pub id: String,
    pub user_id: String,
    pub home_id: String,
    pub name: String,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub employment_type: String,
    pub hourly_rate: Option<f64>,
    pub night_start_hour: Option<i32>,
    pub night_end_hour: Option<i32>,
    pub night_rate_multiplier: Option<f64>,
    pub holiday_rate_multiplier: Option<f64>,
    pub overtime_threshold_minutes: Option<i32>,
    pub overtime_rate_multiplier: Option<f64>,
    pub monthly_salary: Option<f64>,
    pub transport_allowance: Option<f64>,
    pub pay_day: Option<i32>,
    pub social_insurance_rate: Option<f64>,
    pub income_tax_rate: Option<f64>,
    pub color: Option<String>,
    pub note: Option<String>,
    pub deposit_account_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmployment {
    pub user_id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub employment_type: String,
    pub hourly_rate: Option<f64>,
    pub night_start_hour: Option<i32>,
    pub night_end_hour: Option<i32>,
    pub night_rate_multiplier: Option<f64>,
    pub holiday_rate_multiplier: Option<f64>,
    pub overtime_threshold_minutes: Option<i32>,
    pub overtime_rate_multiplier: Option<f64>,
    pub monthly_salary: Option<f64>,
    pub transport_allowance: Option<f64>,
    pub pay_day: Option<i32>,
    pub social_insurance_rate: Option<f64>,
    pub income_tax_rate: Option<f64>,
    pub color: Option<String>,
    pub note: Option<String>,
    pub deposit_account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEmployment {
    pub name: Option<String>,
    pub hourly_rate: Option<f64>,
    pub night_start_hour: Option<i32>,
    pub night_end_hour: Option<i32>,
    pub night_rate_multiplier: Option<f64>,
    pub holiday_rate_multiplier: Option<f64>,
    pub overtime_threshold_minutes: Option<i32>,
    pub overtime_rate_multiplier: Option<f64>,
    pub monthly_salary: Option<f64>,
    pub transport_allowance: Option<f64>,
    pub pay_day: Option<i32>,
    pub social_insurance_rate: Option<f64>,
    pub income_tax_rate: Option<f64>,
    pub color: Option<String>,
    pub note: Option<String>,
    pub deposit_account_id: Option<String>,
}

// ── Shifts ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Shift {
    pub id: String,
    pub employment_id: String,
    pub user_id: String,
    pub home_id: String,
    pub date: String,
    pub start_time: String,
    pub end_time: String,
    pub break_minutes: i32,
    pub is_holiday: bool,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShift {
    pub employment_id: String,
    pub date: String,
    pub start_time: String,
    pub end_time: String,
    pub break_minutes: Option<i32>,
    pub is_holiday: Option<bool>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateShift {
    pub employment_id: Option<String>,
    pub date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub break_minutes: Option<i32>,
    pub is_holiday: Option<bool>,
    pub note: Option<String>,
}

// ── Salary ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SalaryRecord {
    pub id: String,
    pub user_id: String,
    pub home_id: String,
    pub employment_id: String,
    pub year_month: String,
    pub base_pay: f64,
    pub overtime_pay: f64,
    pub night_pay: f64,
    pub holiday_pay: f64,
    pub transport_allowance: f64,
    pub other_allowances: f64,
    pub gross_amount: f64,
    pub social_insurance: f64,
    pub income_tax: f64,
    pub other_deductions: f64,
    pub net_amount: f64,
    pub paid_date: Option<String>,
    pub deposit_account_id: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSalaryRecord {
    pub employment_id: String,
    pub year_month: String,
    pub base_pay: f64,
    pub overtime_pay: Option<f64>,
    pub night_pay: Option<f64>,
    pub holiday_pay: Option<f64>,
    pub transport_allowance: Option<f64>,
    pub other_allowances: Option<f64>,
    pub gross_amount: f64,
    pub social_insurance: Option<f64>,
    pub income_tax: Option<f64>,
    pub other_deductions: Option<f64>,
    pub net_amount: f64,
    pub paid_date: Option<String>,
    pub deposit_account_id: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSalaryRecord {
    pub base_pay: Option<f64>,
    pub overtime_pay: Option<f64>,
    pub night_pay: Option<f64>,
    pub holiday_pay: Option<f64>,
    pub transport_allowance: Option<f64>,
    pub other_allowances: Option<f64>,
    pub gross_amount: Option<f64>,
    pub social_insurance: Option<f64>,
    pub income_tax: Option<f64>,
    pub other_deductions: Option<f64>,
    pub net_amount: Option<f64>,
    pub paid_date: Option<String>,
    pub deposit_account_id: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SalaryPrediction {
    pub employment_id: String,
    pub employment_name: String,
    pub year_month: String,
    pub total_shifts: u32,
    pub total_work_minutes: i32,
    pub base_pay: f64,
    pub overtime_pay: f64,
    pub night_pay: f64,
    pub holiday_pay: f64,
    pub transport_allowance: f64,
    pub gross_amount: f64,
    pub social_insurance: f64,
    pub income_tax: f64,
    pub total_deductions: f64,
    pub net_amount: f64,
    pub shift_details: Vec<ShiftPayDetail>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShiftPayDetail {
    pub shift_id: String,
    pub date: String,
    pub work_minutes: i32,
    pub normal_minutes: i32,
    pub overtime_minutes: i32,
    pub night_minutes: i32,
    pub is_holiday: bool,
    pub pay: f64,
}

// ── Subscriptions ──

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub id: String,
    pub home_id: String,
    pub name: String,
    pub amount: f64,
    pub category: String,
    pub paid_by: String,
    pub account_id: Option<String>,
    pub billing_cycle: String, // monthly, yearly, weekly
    pub billing_day: i32,      // day of month (1-31) or day of week (0-6)
    pub next_billing_date: String,
    pub is_active: bool,
    pub note: Option<String>,
    pub created_at: String,
    pub google_event_id: Option<String>,
    pub sync_to_calendar: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscription {
    pub name: String,
    pub amount: f64,
    pub category: String,
    pub paid_by: String,
    pub account_id: Option<String>,
    pub billing_cycle: String,
    pub billing_day: i32,
    pub next_billing_date: String,
    pub note: Option<String>,
    pub sync_to_calendar: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubscription {
    pub name: Option<String>,
    pub amount: Option<f64>,
    pub category: Option<String>,
    pub paid_by: Option<String>,
    pub account_id: Option<String>,
    pub billing_cycle: Option<String>,
    pub billing_day: Option<i32>,
    pub next_billing_date: Option<String>,
    pub is_active: Option<bool>,
    pub note: Option<String>,
    pub sync_to_calendar: Option<bool>,
}

// ── Receipt OCR ──

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptScanResult {
    pub date: Option<String>,
    pub store: Option<String>,
    pub items: Vec<ReceiptItem>,
    pub total: Option<f64>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReceiptItem {
    pub name: String,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptScanRequest {
    pub file_id: String,
}

// ── Constructors ──

impl GarbageCategory {
    pub fn new(home_id: String, input: CreateGarbageCategory) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            name: input.name,
            color: input.color,
            description: input.description,
            items: input.items,
        }
    }
}

impl GarbageSchedule {
    pub fn new(home_id: String, input: CreateGarbageSchedule) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            category_id: input.category_id,
            day_of_week: input.day_of_week,
            week_of_month: input.week_of_month,
            location: input.location,
            note: input.note,
        }
    }
}

impl BudgetEntry {
    pub fn new(home_id: String, input: CreateBudgetEntry) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            date: input.date,
            amount: input.amount,
            category: input.category,
            description: input.description,
            paid_by: input.paid_by,
            receipt_image_url: input.receipt_image_url,
            account_id: input.account_id,
        }
    }
}

impl CalendarEvent {
    pub fn new(home_id: String, created_by: String, input: CreateCalendarEvent) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            title: input.title,
            date: input.date,
            end_date: input.end_date,
            all_day: input.all_day,
            event_type: input.event_type,
            assignee: input.assignee,
            completed: input.completed,
            color: input.color,
            description: input.description,
            google_event_id: input.google_event_id,
            recurrence_rule: input.recurrence_rule,
            recurrence_interval: input.recurrence_interval,
            recurrence_end: input.recurrence_end,
            google_calendar_id: None,
            created_by: Some(created_by),
        }
    }

    pub fn to_expanded(
        &self,
        is_instance: bool,
        occurrence_date: Option<String>,
    ) -> ExpandedCalendarEvent {
        ExpandedCalendarEvent {
            id: self.id.clone(),
            home_id: self.home_id.clone(),
            title: self.title.clone(),
            date: occurrence_date.clone().unwrap_or_else(|| self.date.clone()),
            end_date: self.end_date.clone(),
            all_day: self.all_day,
            event_type: self.event_type.clone(),
            assignee: self.assignee.clone(),
            completed: self.completed,
            color: self.color.clone(),
            description: self.description.clone(),
            google_event_id: self.google_event_id.clone(),
            recurrence_rule: self.recurrence_rule.clone(),
            recurrence_interval: self.recurrence_interval,
            recurrence_end: self.recurrence_end.clone(),
            is_recurrence_instance: is_instance,
            original_event_id: if is_instance {
                Some(self.id.clone())
            } else {
                None
            },
            occurrence_date,
            garbage_schedule_id: None,
            google_calendar_id: self.google_calendar_id.clone(),
            created_by: self.created_by.clone(),
        }
    }
}

impl Document {
    pub fn new(home_id: String, input: CreateDocument) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            title: input.title,
            category: input.category,
            file_url: input.file_url,
            file_type: input.file_type,
            uploaded_at: chrono::Utc::now().to_rfc3339(),
            tags: input.tags,
            note: input.note,
        }
    }
}

impl Account {
    pub fn new(home_id: String, user_id: String, input: CreateAccount) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            user_id: input.user_id.unwrap_or(user_id),
            name: input.name,
            account_type: input.account_type,
            initial_balance: input.initial_balance.unwrap_or(0.0),
            color: input.color,
            billing_date: input.billing_date,
            payment_date: input.payment_date,
            payment_account_id: input.payment_account_id,
            note: input.note,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl AccountTransaction {
    pub fn new(account_id: String, home_id: String, input: CreateAccountTransaction) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            account_id,
            home_id,
            amount: input.amount,
            transaction_type: input.transaction_type,
            category: input.category,
            description: input.description.unwrap_or_default(),
            date: input.date,
            transfer_to_account_id: input.transfer_to_account_id,
            budget_entry_id: input.budget_entry_id,
            salary_record_id: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl MonthlyBudget {
    pub fn new(home_id: String, input: CreateMonthlyBudget) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            category: input.category,
            amount: input.amount,
            year_month: input.year_month,
        }
    }
}

impl SavingsGoal {
    pub fn new(home_id: String, input: CreateSavingsGoal) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            name: input.name,
            target_amount: input.target_amount,
            current_amount: input.current_amount.unwrap_or(0.0),
            target_date: input.target_date,
            account_id: input.account_id,
            note: input.note,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl Employment {
    pub fn new(user_id: String, home_id: String, input: CreateEmployment) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            user_id: input.user_id.unwrap_or(user_id),
            home_id,
            name: input.name,
            employment_type: input.employment_type,
            hourly_rate: input.hourly_rate,
            night_start_hour: input.night_start_hour,
            night_end_hour: input.night_end_hour,
            night_rate_multiplier: input.night_rate_multiplier,
            holiday_rate_multiplier: input.holiday_rate_multiplier,
            overtime_threshold_minutes: input.overtime_threshold_minutes,
            overtime_rate_multiplier: input.overtime_rate_multiplier,
            monthly_salary: input.monthly_salary,
            transport_allowance: input.transport_allowance,
            pay_day: input.pay_day,
            social_insurance_rate: input.social_insurance_rate,
            income_tax_rate: input.income_tax_rate,
            color: input.color,
            note: input.note,
            deposit_account_id: input.deposit_account_id,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl Subscription {
    pub fn new(home_id: String, input: CreateSubscription) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            home_id,
            name: input.name,
            amount: input.amount,
            category: input.category,
            paid_by: input.paid_by,
            account_id: input.account_id,
            billing_cycle: input.billing_cycle,
            billing_day: input.billing_day,
            next_billing_date: input.next_billing_date,
            is_active: true,
            note: input.note,
            created_at: chrono::Utc::now().to_rfc3339(),
            google_event_id: None,
            sync_to_calendar: input.sync_to_calendar.unwrap_or(true),
        }
    }
}

impl Shift {
    pub fn new(user_id: String, home_id: String, input: CreateShift) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            employment_id: input.employment_id,
            user_id,
            home_id,
            date: input.date,
            start_time: input.start_time,
            end_time: input.end_time,
            break_minutes: input.break_minutes.unwrap_or(0),
            is_holiday: input.is_holiday.unwrap_or(false),
            note: input.note,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl SalaryRecord {
    pub fn new(user_id: String, home_id: String, input: CreateSalaryRecord) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            user_id,
            home_id,
            employment_id: input.employment_id,
            year_month: input.year_month,
            base_pay: input.base_pay,
            overtime_pay: input.overtime_pay.unwrap_or(0.0),
            night_pay: input.night_pay.unwrap_or(0.0),
            holiday_pay: input.holiday_pay.unwrap_or(0.0),
            transport_allowance: input.transport_allowance.unwrap_or(0.0),
            other_allowances: input.other_allowances.unwrap_or(0.0),
            gross_amount: input.gross_amount,
            social_insurance: input.social_insurance.unwrap_or(0.0),
            income_tax: input.income_tax.unwrap_or(0.0),
            other_deductions: input.other_deductions.unwrap_or(0.0),
            net_amount: input.net_amount,
            paid_date: input.paid_date,
            deposit_account_id: input.deposit_account_id,
            note: input.note,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

// ── Push Notifications ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePushSubscription {
    pub endpoint: String,
    pub keys: PushSubscriptionKeys,
}

#[derive(Debug, Deserialize)]
pub struct PushSubscriptionKeys {
    pub p256dh: String,
    pub auth: String,
}

#[derive(Debug, Deserialize)]
pub struct UnsubscribePush {
    pub endpoint: String,
}

// ── Garbage Sort AI ──

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GarbageSortRequest {
    pub query: Option<String>,
    pub file_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GarbageSortResult {
    pub category: Option<String>,
    pub explanation: String,
    pub tips: Option<String>,
}

// ── Garbage Extract AI ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GarbageExtractRequest {
    pub file_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GarbageExtractResult {
    pub categories: Vec<GarbageExtractCategory>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GarbageExtractCategory {
    pub name: String,
    pub color: String,
    pub description: String,
    pub items: Vec<String>,
    pub schedule: Option<GarbageExtractSchedule>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GarbageExtractSchedule {
    pub day_of_week: Vec<i32>,
    pub week_of_month: Vec<i32>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPreferences {
    pub user_id: String,
    pub garbage_enabled: bool,
    pub garbage_timing: String,
    pub subscription_enabled: bool,
    pub subscription_days_before: i32,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNotificationPreferences {
    pub garbage_enabled: Option<bool>,
    pub garbage_timing: Option<String>,
    pub subscription_enabled: Option<bool>,
    pub subscription_days_before: Option<i32>,
}
