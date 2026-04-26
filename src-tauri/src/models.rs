use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    #[serde(default)]
    pub headers: serde_json::Value,
    #[serde(default)]
    pub models: Vec<String>,
    #[serde(default = "default_key_storage")]
    pub key_storage: KeyStorage,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

fn default_key_storage() -> KeyStorage {
    KeyStorage::Secure
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum KeyStorage {
    Secure,
    Memory,
    None,
}

impl std::fmt::Display for KeyStorage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KeyStorage::Secure => write!(f, "secure"),
            KeyStorage::Memory => write!(f, "memory"),
            KeyStorage::None => write!(f, "none"),
        }
    }
}

impl std::str::FromStr for KeyStorage {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "secure" => Ok(KeyStorage::Secure),
            "memory" => Ok(KeyStorage::Memory),
            "none" => Ok(KeyStorage::None),
            _ => Err(format!("unknown key storage: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub request_body: serde_json::Value,
    #[serde(default)]
    pub stream: bool,
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSuite {
    pub id: String,
    pub name: String,
    pub test_case_ids: Vec<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedResponse {
    pub id: Option<String>,
    pub model: Option<String>,
    pub content: String,
    pub finish_reason: Option<String>,
    pub usage: Option<UsageInfo>,
    pub raw_body: String,
    pub response_body: Option<String>,
    pub stream_events: Vec<StreamEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    pub event_type: String,
    pub data: String,
    pub delta_text: String,
    pub index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub check_id: String,
    pub category: String,
    pub status: CheckStatus,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CheckStatus {
    Pass,
    Fail,
    Warn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunHistory {
    pub id: String,
    pub provider_id: String,
    pub model_id: String,
    pub protocol: String,
    pub test_case_id: Option<String>,
    pub matrix_run_id: Option<String>,
    pub request_snapshot: serde_json::Value,
    pub response_raw: Option<String>,
    pub response_parsed: Option<NormalizedResponse>,
    pub status_code: Option<u16>,
    pub error_message: Option<String>,
    pub duration_ms: Option<u64>,
    pub stream: bool,
    pub compat_results: Option<Vec<CheckResult>>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunHistorySummary {
    pub id: String,
    pub provider_id: String,
    pub model_id: String,
    pub protocol: String,
    pub status_code: Option<u16>,
    pub duration_ms: Option<u64>,
    pub stream: bool,
    pub pass_count: usize,
    pub fail_count: usize,
    pub warn_count: usize,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixRun {
    pub id: String,
    pub name: Option<String>,
    pub provider_ids: Vec<String>,
    pub model_ids: Vec<String>,
    pub protocol_list: Vec<String>,
    pub test_case_ids: Vec<String>,
    pub status: String,
    pub summary: Option<serde_json::Value>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixConfig {
    pub name: Option<String>,
    pub provider_ids: Vec<String>,
    pub model_ids: Vec<String>,
    pub protocols: Vec<String>,
    pub test_case_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HistoryFilter {
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub protocol: Option<String>,
    pub matrix_run_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunkEvent {
    pub run_id: String,
    pub delta_text: String,
    pub event_type: String,
    pub raw_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamDoneEvent {
    pub run_id: String,
    pub normalized_response: NormalizedResponse,
    pub compat_results: Vec<CheckResult>,
}
