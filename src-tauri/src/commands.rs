use crate::db::Database;
use crate::keystore::KeyStore;
use crate::models::*;
use crate::runner::RunnerState;
use std::sync::Arc;
use tauri::{Emitter, State};

type Db<'a> = State<'a, Arc<Database>>;
type Runner<'a> = State<'a, Arc<RunnerState>>;

#[tauri::command]
pub fn create_provider(db: Db<'_>, mut config: ProviderConfig) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    config.id = id.clone();
    config.created_at = now.clone();
    config.updated_at = now;
    db.create_provider(&config)?;
    Ok(id)
}

#[tauri::command]
pub fn update_provider(db: Db<'_>, mut config: ProviderConfig) -> Result<(), String> {
    config.updated_at = chrono::Utc::now().to_rfc3339();
    db.update_provider(&config)
}

#[tauri::command]
pub fn delete_provider(db: Db<'_>, id: String) -> Result<(), String> {
    db.delete_provider(&id)
}

#[tauri::command]
pub fn list_providers(db: Db<'_>) -> Result<Vec<ProviderConfig>, String> {
    db.list_providers()
}

#[tauri::command]
pub fn get_provider(db: Db<'_>, id: String) -> Result<Option<ProviderConfig>, String> {
    db.get_provider(&id)
}

#[tauri::command]
pub fn store_api_key(
    provider_id: String,
    key: String,
    storage: String,
    ks: State<'_, KeyStore>,
) -> Result<(), String> {
    match storage.as_str() {
        "secure" => ks.store_secure(&provider_id, &key),
        "memory" => {
            ks.store_memory(&provider_id, &key);
            Ok(())
        }
        _ => Err("Invalid storage type".into()),
    }
}

#[tauri::command]
pub fn get_api_key(
    provider_id: String,
    storage: String,
    ks: State<'_, KeyStore>,
) -> Result<Option<String>, String> {
    match storage.as_str() {
        "secure" => ks.get_secure(&provider_id),
        "memory" => Ok(ks.get_memory(&provider_id)),
        _ => Ok(None),
    }
}

#[tauri::command]
pub fn delete_api_key(
    provider_id: String,
    storage: String,
    ks: State<'_, KeyStore>,
) -> Result<(), String> {
    match storage.as_str() {
        "secure" => ks.delete_secure(&provider_id),
        "memory" => {
            ks.delete_memory(&provider_id);
            Ok(())
        }
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn save_test_case(db: Db<'_>, mut tc: TestCase) -> Result<String, String> {
    if tc.id.is_empty() {
        tc.id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        tc.created_at = now.clone();
        tc.updated_at = now;
    } else {
        tc.updated_at = chrono::Utc::now().to_rfc3339();
    }
    let id = tc.id.clone();
    db.save_test_case(&tc)?;
    Ok(id)
}

#[tauri::command]
pub fn list_test_cases(db: Db<'_>) -> Result<Vec<TestCase>, String> {
    db.list_test_cases()
}

#[tauri::command]
pub fn delete_test_case(db: Db<'_>, id: String) -> Result<(), String> {
    db.delete_test_case(&id)
}

#[tauri::command]
pub fn save_test_suite(db: Db<'_>, mut ts: TestSuite) -> Result<String, String> {
    if ts.id.is_empty() {
        ts.id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        ts.created_at = now.clone();
        ts.updated_at = now;
    } else {
        ts.updated_at = chrono::Utc::now().to_rfc3339();
    }
    let id = ts.id.clone();
    db.save_test_suite(&ts)?;
    Ok(id)
}

#[tauri::command]
pub fn list_test_suites(db: Db<'_>) -> Result<Vec<TestSuite>, String> {
    db.list_test_suites()
}

#[tauri::command]
pub fn delete_test_suite(db: Db<'_>, id: String) -> Result<(), String> {
    db.delete_test_suite(&id)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn run_single_request(
    app: tauri::AppHandle,
    db: Db<'_>,
    runner: Runner<'_>,
    ks: State<'_, KeyStore>,
    provider_id: String,
    model_id: String,
    protocol: String,
    body: serde_json::Value,
    stream: bool,
    test_case_id: Option<String>,
) -> Result<String, String> {
    let provider = db
        .get_provider(&provider_id)?
        .ok_or_else(|| "Provider not found".to_string())?;
    let key = match provider.key_storage {
        KeyStorage::Secure => ks.get_secure(&provider_id)?,
        KeyStorage::Memory => ks.get_memory(&provider_id),
        KeyStorage::None => None,
    };
    let api_key = key.unwrap_or_default();
    let run_id = uuid::Uuid::new_v4().to_string();
    let db_arc = db.inner().clone();
    let runner_arc = runner.inner().clone();

    tokio::spawn(crate::runner::execute_request(
        app,
        runner_arc,
        db_arc,
        crate::runner::ExecuteRequestInput {
            run_id: run_id.clone(),
            provider_id,
            model_id,
            protocol,
            api_key,
            base_url: provider.base_url,
            custom_headers: provider.headers,
            body,
            stream,
            test_case_id,
            matrix_run_id: None,
        },
    ));
    Ok(run_id)
}

#[tauri::command]
pub async fn cancel_request(runner: Runner<'_>, run_id: String) -> Result<(), String> {
    let tokens = runner.tokens.lock().await;
    if let Some(token) = tokens.get(&run_id) {
        token.cancel();
        Ok(())
    } else {
        Err("Run not found".into())
    }
}

#[tauri::command]
pub async fn run_matrix(
    app: tauri::AppHandle,
    db: Db<'_>,
    runner: Runner<'_>,
    ks: State<'_, KeyStore>,
    config: MatrixConfig,
) -> Result<String, String> {
    let matrix_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let matrix = MatrixRun {
        id: matrix_id.clone(),
        name: config.name.clone(),
        provider_ids: config.provider_ids.clone(),
        model_ids: config.model_ids.clone(),
        protocol_list: config.protocols.clone(),
        test_case_ids: config.test_case_ids.clone(),
        status: "running".into(),
        summary: None,
        created_at: now,
        completed_at: None,
    };
    db.save_matrix_run(&matrix)?;

    let db_arc = db.inner().clone();
    let providers = db.list_providers()?;
    let test_cases = db.list_test_cases()?;

    let mut api_keys: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for pid in &config.provider_ids {
        if let Some(p) = providers.iter().find(|p| &p.id == pid) {
            let key = match p.key_storage {
                KeyStorage::Secure => ks.get_secure(pid)?.unwrap_or_default(),
                KeyStorage::Memory => ks.get_memory(pid).unwrap_or_default(),
                KeyStorage::None => String::new(),
            };
            api_keys.insert(pid.clone(), key);
        }
    }

    let mid = matrix_id.clone();
    let app2 = app.clone();
    let runner_arc = runner.inner().clone();
    let matrix_token_key = format!("matrix:{mid}");
    {
        let mut tokens = runner_arc.tokens.lock().await;
        tokens.insert(
            matrix_token_key.clone(),
            tokio_util::sync::CancellationToken::new(),
        );
    }
    tokio::spawn(async move {
        let mut cancelled = false;
        'matrix: for pid in &config.provider_ids {
            let provider = match providers.iter().find(|p| &p.id == pid) {
                Some(p) => p,
                None => continue,
            };
            let api_key = api_keys.get(pid).cloned().unwrap_or_default();
            for model in &config.model_ids {
                for proto in &config.protocols {
                    for tcid in &config.test_case_ids {
                        let tc = match test_cases.iter().find(|t| &t.id == tcid) {
                            Some(t) => t,
                            None => continue,
                        };
                        let run_id = format!("{mid}:{}", uuid::Uuid::new_v4());
                        let should_stop = {
                            let tokens = runner_arc.tokens.lock().await;
                            tokens
                                .get(&matrix_token_key)
                                .map(|t| t.is_cancelled())
                                .unwrap_or(true)
                        };
                        if should_stop {
                            cancelled = true;
                            break 'matrix;
                        }
                        crate::runner::execute_request(
                            app2.clone(),
                            runner_arc.clone(),
                            db_arc.clone(),
                            crate::runner::ExecuteRequestInput {
                                run_id,
                                provider_id: pid.clone(),
                                model_id: model.clone(),
                                protocol: proto.clone(),
                                api_key: api_key.clone(),
                                base_url: provider.base_url.clone(),
                                custom_headers: provider.headers.clone(),
                                body: tc.request_body.clone(),
                                stream: tc.stream,
                                test_case_id: Some(tcid.clone()),
                                matrix_run_id: Some(mid.clone()),
                            },
                        )
                        .await;
                    }
                }
            }
        }
        let final_status = if cancelled { "cancelled" } else { "completed" };
        let _ = db_arc.update_matrix_status(
            &mid,
            final_status,
            None,
            Some(&chrono::Utc::now().to_rfc3339()),
        );
        runner_arc.tokens.lock().await.remove(&matrix_token_key);
        let _ = app2.emit(
            "matrix-done",
            serde_json::json!({"matrix_run_id": mid, "status": final_status}),
        );
    });

    Ok(matrix_id)
}

#[tauri::command]
pub async fn cancel_matrix(runner: Runner<'_>, matrix_run_id: String) -> Result<(), String> {
    let tokens = runner.tokens.lock().await;
    for (key, token) in tokens.iter() {
        if key.contains(&matrix_run_id) {
            token.cancel();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_run_history(
    db: Db<'_>,
    filters: HistoryFilter,
) -> Result<Vec<RunHistorySummary>, String> {
    db.list_run_history(&filters)
}

#[tauri::command]
pub fn get_run_detail(db: Db<'_>, run_id: String) -> Result<Option<RunHistory>, String> {
    db.get_run_detail(&run_id)
}

#[tauri::command]
pub fn export_report(db: Db<'_>, matrix_run_id: String, format: String) -> Result<String, String> {
    let filter = HistoryFilter {
        matrix_run_id: Some(matrix_run_id),
        ..Default::default()
    };
    let summaries = db.list_run_history(&filter)?;
    let mut runs = Vec::new();
    for s in &summaries {
        if let Some(r) = db.get_run_detail(&s.id)? {
            runs.push(r);
        }
    }
    match format.as_str() {
        "json" => crate::report::export_json(&runs),
        "csv" => crate::report::export_csv(&runs),
        "markdown" => crate::report::export_markdown(&runs),
        _ => Err("Unsupported format".into()),
    }
}
