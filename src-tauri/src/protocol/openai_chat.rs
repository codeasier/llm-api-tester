use super::{ProtocolAdapter, RequestSpec};
use crate::models::{NormalizedResponse, StreamEvent, UsageInfo};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, CONTENT_TYPE};

pub struct OpenAIChatAdapter;

impl ProtocolAdapter for OpenAIChatAdapter {
    fn build_request(
        &self,
        base_url: &str,
        api_key: &str,
        model: &str,
        body: &serde_json::Value,
        stream: bool,
        custom_headers: &serde_json::Value,
    ) -> Result<RequestSpec, String> {
        let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {api_key}")).map_err(|e| e.to_string())?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(obj) = custom_headers.as_object() {
            for (k, v) in obj {
                if let Some(vs) = v.as_str() {
                    if let (Ok(hn), Ok(hv)) = (
                        HeaderName::from_bytes(k.as_bytes()),
                        HeaderValue::from_str(vs),
                    ) {
                        headers.insert(hn, hv);
                    }
                }
            }
        }
        let mut b = body.clone();
        if let Some(obj) = b.as_object_mut() {
            obj.insert("model".into(), serde_json::Value::String(model.into()));
            obj.insert("stream".into(), serde_json::Value::Bool(stream));
        }
        Ok(RequestSpec {
            url,
            headers,
            body: b,
        })
    }

    fn parse_response(&self, _status: u16, body: &str) -> Result<NormalizedResponse, String> {
        let v: serde_json::Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
        let content = v
            .pointer("/choices/0/message/content")
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .to_string();
        let finish = v
            .pointer("/choices/0/finish_reason")
            .and_then(|f| f.as_str())
            .map(|s| s.to_string());
        let usage = v.get("usage").map(|u| UsageInfo {
            prompt_tokens: u.get("prompt_tokens").and_then(|t| t.as_u64()),
            completion_tokens: u.get("completion_tokens").and_then(|t| t.as_u64()),
            total_tokens: u.get("total_tokens").and_then(|t| t.as_u64()),
        });
        Ok(NormalizedResponse {
            id: v.get("id").and_then(|i| i.as_str()).map(|s| s.to_string()),
            model: v
                .get("model")
                .and_then(|m| m.as_str())
                .map(|s| s.to_string()),
            content,
            finish_reason: finish,
            usage,
            raw_body: body.to_string(),
            response_body: Some(body.to_string()),
            stream_events: vec![],
        })
    }

    fn parse_stream_line(&self, _event_type: &str, data: &str, index: usize) -> StreamEvent {
        let delta = serde_json::from_str::<serde_json::Value>(data)
            .ok()
            .and_then(|v| {
                v.pointer("/choices/0/delta/content")
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();
        StreamEvent {
            event_type: "content_delta".into(),
            data: data.into(),
            delta_text: delta,
            index,
        }
    }

    fn stream_done_marker(&self) -> &str {
        "[DONE]"
    }
}
