CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL,
    headers TEXT NOT NULL DEFAULT '{}', models TEXT NOT NULL DEFAULT '[]',
    key_storage TEXT NOT NULL DEFAULT 'secure',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, protocol TEXT NOT NULL,
    request_body TEXT NOT NULL, stream INTEGER NOT NULL DEFAULT 0,
    description TEXT, tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    test_case_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS run_history (
    id TEXT PRIMARY KEY, provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL, protocol TEXT NOT NULL,
    test_case_id TEXT, matrix_run_id TEXT,
    request_snapshot TEXT NOT NULL, response_raw TEXT,
    response_parsed TEXT, status_code INTEGER,
    error_message TEXT, duration_ms INTEGER,
    stream INTEGER NOT NULL DEFAULT 0,
    compat_results TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matrix_runs (
    id TEXT PRIMARY KEY, name TEXT,
    provider_ids TEXT NOT NULL, model_ids TEXT NOT NULL,
    protocol_list TEXT NOT NULL, test_case_ids TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', summary TEXT,
    created_at TEXT NOT NULL, completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rh_provider ON run_history(provider_id);
CREATE INDEX IF NOT EXISTS idx_rh_matrix ON run_history(matrix_run_id);
CREATE INDEX IF NOT EXISTS idx_rh_created ON run_history(created_at);
