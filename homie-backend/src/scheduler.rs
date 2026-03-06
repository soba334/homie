use chrono::{Datelike, FixedOffset, NaiveDate, Timelike, Utc};
use sqlx::SqlitePool;
use web_push::{
    ContentEncoding, IsahcWebPushClient, SubscriptionInfo, URL_SAFE_NO_PAD, VapidSignatureBuilder,
    WebPushClient, WebPushMessageBuilder,
};

pub async fn run(pool: SqlitePool) {
    let client = match IsahcWebPushClient::new() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create WebPushClient: {e}");
            return;
        }
    };

    loop {
        let jst = FixedOffset::east_opt(9 * 3600).unwrap();
        let now = Utc::now().with_timezone(&jst);
        let hour = now.hour();
        let minute = now.minute();

        let next_hour: u32 = if hour < 7 {
            7
        } else if hour < 20 {
            20
        } else {
            7
        };

        let sleep_hours = if next_hour > hour {
            next_hour - hour
        } else {
            24 - hour + next_hour
        };

        let sleep_secs = (sleep_hours as u64 * 3600).saturating_sub(minute as u64 * 60);
        tokio::time::sleep(std::time::Duration::from_secs(sleep_secs)).await;

        let current_jst = Utc::now().with_timezone(&jst);
        let current_hour = current_jst.hour();

        if current_hour == 7 {
            let today = current_jst.format("%Y-%m-%d").to_string();
            let today_date = current_jst.date_naive();

            if let Err(e) = send_garbage_notifications(&pool, &client, today_date, "day").await {
                tracing::error!("Garbage day notification error: {e:?}");
            }
            if let Err(e) = send_subscription_notifications(&pool, &client, &today, 0).await {
                tracing::error!("Subscription today notification error: {e:?}");
            }
        } else if current_hour == 20 {
            let tomorrow = current_jst.date_naive() + chrono::Duration::days(1);
            let tomorrow_str = tomorrow.format("%Y-%m-%d").to_string();

            if let Err(e) = send_garbage_notifications(&pool, &client, tomorrow, "eve").await {
                tracing::error!("Garbage eve notification error: {e:?}");
            }
            if let Err(e) = send_subscription_notifications(&pool, &client, &tomorrow_str, 1).await
            {
                tracing::error!("Subscription tomorrow notification error: {e:?}");
            }
        }
    }
}

async fn send_garbage_notifications(
    pool: &SqlitePool,
    client: &IsahcWebPushClient,
    target_date: NaiveDate,
    timing: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let dow = target_date.weekday().num_days_from_sunday() as i32;
    let week_of_month = ((target_date.day() - 1) / 7 + 1) as i32;

    #[derive(sqlx::FromRow)]
    struct ScheduleMatch {
        home_id: String,
        category_name: String,
    }

    let matches: Vec<ScheduleMatch> = sqlx::query_as(
        "SELECT DISTINCT gs.home_id, gc.name as category_name
         FROM garbage_schedules gs
         JOIN garbage_categories gc ON gc.id = gs.category_id
         JOIN garbage_schedule_days gsd ON gsd.schedule_id = gs.id
         WHERE gsd.day_of_week = ?
         AND (
           NOT EXISTS (SELECT 1 FROM garbage_schedule_weeks gsw WHERE gsw.schedule_id = gs.id)
           OR EXISTS (SELECT 1 FROM garbage_schedule_weeks gsw WHERE gsw.schedule_id = gs.id AND gsw.week_of_month = ?)
         )",
    )
    .bind(dow)
    .bind(week_of_month)
    .fetch_all(pool)
    .await?;

    let mut home_categories: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for m in &matches {
        home_categories
            .entry(m.home_id.clone())
            .or_default()
            .push(m.category_name.clone());
    }

    let is_eve = timing == "eve";
    let title = if is_eve {
        "明日はゴミ出し日"
    } else {
        "今日はゴミ出し日"
    };

    for (home_id, categories) in &home_categories {
        let body = categories.join("・");

        #[derive(sqlx::FromRow)]
        struct UserRow {
            id: String,
        }

        let users: Vec<UserRow> =
            sqlx::query_as("SELECT DISTINCT user_id as id FROM home_members WHERE home_id = ?")
                .bind(home_id)
                .fetch_all(pool)
                .await?;

        for user in &users {
            let prefs: Option<crate::models::NotificationPreferences> = sqlx::query_as(
                "SELECT user_id, garbage_enabled, garbage_timing, subscription_enabled, subscription_days_before, updated_at
                 FROM notification_preferences WHERE user_id = ?",
            )
            .bind(&user.id)
            .fetch_optional(pool)
            .await?;

            let enabled = prefs.as_ref().map(|p| p.garbage_enabled).unwrap_or(true);
            let timing_match = prefs
                .as_ref()
                .map(|p| p.garbage_timing == "both" || p.garbage_timing == timing)
                .unwrap_or(true);

            if !enabled || !timing_match {
                continue;
            }

            let payload = serde_json::json!({
                "title": title,
                "body": body,
                "tag": format!("garbage-{}", target_date),
                "data": { "url": "/garbage" }
            });

            send_push_to_user(pool, client, &user.id, &payload).await;
        }
    }

    Ok(())
}

async fn send_subscription_notifications(
    pool: &SqlitePool,
    client: &IsahcWebPushClient,
    target_date: &str,
    days_before: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    #[derive(sqlx::FromRow)]
    struct SubMatch {
        name: String,
        amount: f64,
        paid_by: String,
        next_billing_date: String,
    }

    let subs: Vec<SubMatch> = sqlx::query_as(
        "SELECT name, amount, paid_by, next_billing_date FROM subscriptions
         WHERE is_active = 1 AND next_billing_date = ?",
    )
    .bind(target_date)
    .fetch_all(pool)
    .await?;

    let is_today = days_before == 0;

    for sub in &subs {
        let prefs: Option<crate::models::NotificationPreferences> = sqlx::query_as(
            "SELECT user_id, garbage_enabled, garbage_timing, subscription_enabled, subscription_days_before, updated_at
             FROM notification_preferences WHERE user_id = ?",
        )
        .bind(&sub.paid_by)
        .fetch_optional(pool)
        .await?;

        let enabled = prefs
            .as_ref()
            .map(|p| p.subscription_enabled)
            .unwrap_or(true);
        let days_match = prefs
            .as_ref()
            .map(|p| p.subscription_days_before >= days_before)
            .unwrap_or(true);

        if !enabled || !days_match {
            continue;
        }

        let title = if is_today {
            format!("今日は{}の支払日", sub.name)
        } else {
            format!("明日は{}の支払日", sub.name)
        };

        let payload = serde_json::json!({
            "title": title,
            "body": format!("{}円", sub.amount as i64),
            "tag": format!("sub-{}-{}", sub.name, sub.next_billing_date),
            "data": { "url": "/budget" }
        });

        send_push_to_user(pool, client, &sub.paid_by, &payload).await;
    }

    Ok(())
}

async fn send_push_to_user(
    pool: &SqlitePool,
    client: &IsahcWebPushClient,
    user_id: &str,
    payload: &serde_json::Value,
) {
    #[derive(sqlx::FromRow)]
    struct PushSub {
        id: String,
        endpoint: String,
        p256dh: String,
        auth: String,
    }

    let subs: Vec<PushSub> = sqlx::query_as(
        "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let vapid_private_key = match std::env::var("VAPID_PRIVATE_KEY") {
        Ok(key) => key,
        Err(_) => return,
    };
    let vapid_subject =
        std::env::var("VAPID_SUBJECT").unwrap_or_else(|_| "mailto:admin@example.com".to_string());

    let payload_str = serde_json::to_string(payload).unwrap_or_default();

    for sub in &subs {
        let subscription_info = SubscriptionInfo::new(&sub.endpoint, &sub.p256dh, &sub.auth);

        let vapid_sig =
            match VapidSignatureBuilder::from_base64_no_sub(&vapid_private_key, URL_SAFE_NO_PAD) {
                Ok(partial) => {
                    let mut builder = partial.add_sub_info(&subscription_info);
                    builder.add_claim("sub", vapid_subject.clone());
                    match builder.build() {
                        Ok(sig) => sig,
                        Err(e) => {
                            tracing::warn!("VAPID signature build error: {e}");
                            continue;
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("VAPID builder error: {e}");
                    continue;
                }
            };

        let mut msg_builder = WebPushMessageBuilder::new(&subscription_info);
        msg_builder.set_payload(ContentEncoding::Aes128Gcm, payload_str.as_bytes());
        msg_builder.set_vapid_signature(vapid_sig);

        let message = match msg_builder.build() {
            Ok(msg) => msg,
            Err(e) => {
                tracing::warn!("Push message build error: {e}");
                continue;
            }
        };

        match client.send(message).await {
            Ok(_) => {}
            Err(e) => {
                let err_str = format!("{e}");
                tracing::warn!("Push send error for {}: {err_str}", sub.endpoint);
                if err_str.contains("410") || err_str.contains("Gone") {
                    let _ = sqlx::query("DELETE FROM push_subscriptions WHERE id = ?")
                        .bind(&sub.id)
                        .execute(pool)
                        .await;
                }
            }
        }
    }
}
