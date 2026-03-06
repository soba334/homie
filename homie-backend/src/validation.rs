use crate::errors::AppError;

const MAX_STRING_LEN: usize = 500;
const MAX_NAME_LEN: usize = 100;

pub fn validate_amount(amount: f64, field: &str) -> Result<(), AppError> {
    if amount < 0.0 {
        return Err(AppError::BadRequest(format!("{field} must be non-negative")));
    }
    if amount > 999_999_999.0 {
        return Err(AppError::BadRequest(format!("{field} is too large")));
    }
    Ok(())
}

pub fn validate_string_len(s: &str, max: usize, field: &str) -> Result<(), AppError> {
    if s.len() > max {
        return Err(AppError::BadRequest(format!("{field} is too long (max {max} chars)")));
    }
    Ok(())
}

pub fn validate_name(s: &str, field: &str) -> Result<(), AppError> {
    validate_string_len(s, MAX_NAME_LEN, field)?;
    if s.trim().is_empty() {
        return Err(AppError::BadRequest(format!("{field} cannot be empty")));
    }
    Ok(())
}

pub fn validate_description(s: &str, field: &str) -> Result<(), AppError> {
    validate_string_len(s, MAX_STRING_LEN, field)
}

pub fn validate_day_of_month(day: i32, field: &str) -> Result<(), AppError> {
    if !(1..=31).contains(&day) {
        return Err(AppError::BadRequest(format!("{field} must be between 1 and 31")));
    }
    Ok(())
}

pub fn validate_hour(hour: i32, field: &str) -> Result<(), AppError> {
    if !(0..=23).contains(&hour) {
        return Err(AppError::BadRequest(format!("{field} must be between 0 and 23")));
    }
    Ok(())
}

pub fn validate_rate(rate: f64, field: &str) -> Result<(), AppError> {
    if rate < 0.0 || rate > 100.0 {
        return Err(AppError::BadRequest(format!("{field} must be between 0 and 100")));
    }
    Ok(())
}

pub fn validate_enum(value: &str, allowed: &[&str], field: &str) -> Result<(), AppError> {
    if !allowed.contains(&value) {
        return Err(AppError::BadRequest(format!("Invalid {field}: {value}")));
    }
    Ok(())
}
