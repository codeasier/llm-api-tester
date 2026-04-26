use crate::models::*;

pub fn export_json(runs: &[RunHistory]) -> Result<String, String> {
    serde_json::to_string_pretty(runs).map_err(|e| e.to_string())
}

pub fn export_csv(runs: &[RunHistory]) -> Result<String, String> {
    let mut wtr = csv::Writer::from_writer(Vec::new());
    wtr.write_record([
        "id",
        "provider_id",
        "model_id",
        "protocol",
        "status_code",
        "duration_ms",
        "stream",
        "pass",
        "fail",
        "warn",
        "error",
        "created_at",
    ])
    .map_err(|e| e.to_string())?;
    for r in runs {
        let checks = r.compat_results.as_deref().unwrap_or(&[]);
        let pass = checks
            .iter()
            .filter(|c| c.status == CheckStatus::Pass)
            .count();
        let fail_c = checks
            .iter()
            .filter(|c| c.status == CheckStatus::Fail)
            .count();
        let warn = checks
            .iter()
            .filter(|c| c.status == CheckStatus::Warn)
            .count();
        wtr.write_record([
            &r.id,
            &r.provider_id,
            &r.model_id,
            &r.protocol,
            &r.status_code.map(|s| s.to_string()).unwrap_or_default(),
            &r.duration_ms.map(|d| d.to_string()).unwrap_or_default(),
            &r.stream.to_string(),
            &pass.to_string(),
            &fail_c.to_string(),
            &warn.to_string(),
            r.error_message.as_deref().unwrap_or(""),
            &r.created_at,
        ])
        .map_err(|e| e.to_string())?;
    }
    let bytes = wtr.into_inner().map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

pub fn export_markdown(runs: &[RunHistory]) -> Result<String, String> {
    let mut md = String::from("# LLM API Compatibility Report\n\n");
    md.push_str(
        "| Provider | Model | Protocol | Status | Duration | Pass | Fail | Warn | Error |\n",
    );
    md.push_str(
        "|----------|-------|----------|--------|----------|------|------|------|-------|\n",
    );
    for r in runs {
        let checks = r.compat_results.as_deref().unwrap_or(&[]);
        let pass = checks
            .iter()
            .filter(|c| c.status == CheckStatus::Pass)
            .count();
        let fail_c = checks
            .iter()
            .filter(|c| c.status == CheckStatus::Fail)
            .count();
        let warn = checks
            .iter()
            .filter(|c| c.status == CheckStatus::Warn)
            .count();
        md.push_str(&format!(
            "| {} | {} | {} | {} | {}ms | {} | {} | {} | {} |\n",
            r.provider_id,
            r.model_id,
            r.protocol,
            r.status_code.map(|s| s.to_string()).unwrap_or("-".into()),
            r.duration_ms.map(|d| d.to_string()).unwrap_or("-".into()),
            pass,
            fail_c,
            warn,
            r.error_message.as_deref().unwrap_or("-"),
        ));
    }
    Ok(md)
}
