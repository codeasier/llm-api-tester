pub mod anthropic;
pub mod openai_chat;
pub mod openai_responses;

use crate::models::NormalizedResponse;
use reqwest::header::HeaderMap;

pub struct RequestSpec {
    pub url: String,
    pub headers: HeaderMap,
    pub body: serde_json::Value,
}

pub trait ProtocolAdapter: Send + Sync {
    fn build_request(
        &self,
        base_url: &str,
        api_key: &str,
        model: &str,
        body: &serde_json::Value,
        stream: bool,
        custom_headers: &serde_json::Value,
    ) -> Result<RequestSpec, String>;

    fn parse_response(&self, status: u16, body: &str) -> Result<NormalizedResponse, String>;

    fn parse_stream_line(
        &self,
        event_type: &str,
        data: &str,
        index: usize,
    ) -> crate::models::StreamEvent;

    fn stream_done_marker(&self) -> &str;
}
