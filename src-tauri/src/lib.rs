mod commands;
mod compat;
mod db;
mod history;
mod keystore;
mod models;
mod protocol;
mod report;
mod runner;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("llm-api-tester.db");
            let db = db::Database::new(&db_path).expect("failed to init database");
            app.manage(std::sync::Arc::new(db));
            app.manage(std::sync::Arc::new(runner::RunnerState::new()));
            app.manage(keystore::KeyStore::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_provider,
            commands::update_provider,
            commands::delete_provider,
            commands::list_providers,
            commands::get_provider,
            commands::store_api_key,
            commands::get_api_key,
            commands::delete_api_key,
            commands::save_test_case,
            commands::list_test_cases,
            commands::delete_test_case,
            commands::save_test_suite,
            commands::list_test_suites,
            commands::delete_test_suite,
            commands::run_single_request,
            commands::cancel_request,
            commands::run_matrix,
            commands::cancel_matrix,
            commands::list_run_history,
            commands::get_run_detail,
            commands::export_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
