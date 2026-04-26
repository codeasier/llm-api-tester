use futures::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::models::*;
use crate::protocol::{
    anthropic::AnthropicAdapter, openai_chat::OpenAIChatAdapter,
    openai_responses::OpenAIResponsesAdapter, ProtocolAdapter,
};

pub struct RunnerState {
    pub tokens: Mutex<HashMap<String, CancellationToken>>,
}

pub struct ExecuteRequestInput {
    pub run_id: String,
    pub provider_id: String,
    pub model_id: String,
    pub protocol: String,
    pub api_key: String,
    pub base_url: String,
    pub custom_headers: serde_json::Value,
    pub body: serde_json::Value,
    pub stream: bool,
    pub test_case_id: Option<String>,
    pub matrix_run_id: Option<String>,
}

struct RequestFailure {
    status_code: Option<u16>,
    error: String,
    raw_response: Option<String>,
    parsed_output: Option<String>,
}

impl RunnerState {
    pub fn new() -> Self {
        RunnerState {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}

pub fn get_adapter(protocol: &str) -> Result<Box<dyn ProtocolAdapter>, String> {
    match protocol {
        "openai_chat" => Ok(Box::new(OpenAIChatAdapter)),
        "openai_responses" => Ok(Box::new(OpenAIResponsesAdapter)),
        "anthropic_messages" => Ok(Box::new(AnthropicAdapter)),
        _ => Err(format!("Unknown protocol: {protocol}")),
    }
}

pub async fn execute_request(
    app: tauri::AppHandle,
    runner: Arc<RunnerState>,
    db: Arc<crate::db::Database>,
    input: ExecuteRequestInput,
) {
    let ExecuteRequestInput {
        run_id,
        provider_id,
        model_id,
        protocol,
        api_key,
        base_url,
        custom_headers,
        body,
        stream,
        test_case_id,
        matrix_run_id,
    } = input;

    let cancel = CancellationToken::new();
    runner
        .tokens
        .lock()
        .await
        .insert(run_id.clone(), cancel.clone());

    let adapter = match get_adapter(&protocol) {
        Ok(a) => a,
        Err(e) => {
            let _ = app.emit(
                "request-error",
                RequestErrorEvent {
                    run_id,
                    error: e,
                    status_code: None,
                    raw_response: None,
                    parsed_output: None,
                },
            );
            return;
        }
    };

    let spec = match adapter.build_request(
        &base_url,
        &api_key,
        &model_id,
        &body,
        stream,
        &custom_headers,
    ) {
        Ok(s) => s,
        Err(e) => {
            let _ = app.emit(
                "request-error",
                RequestErrorEvent {
                    run_id,
                    error: e,
                    status_code: None,
                    raw_response: None,
                    parsed_output: None,
                },
            );
            return;
        }
    };

    let client = reqwest::Client::new();
    let start = std::time::Instant::now();
    let now_str = chrono::Utc::now().to_rfc3339();

    let request_snapshot = serde_json::json!({
        "url": spec.url, "body": spec.body, "stream": stream
    });

    let result = tokio::select! {
        _ = cancel.cancelled() => {
            let run = RunHistory {
                id: run_id.clone(), provider_id, model_id, protocol: protocol.clone(),
                test_case_id, matrix_run_id,
                request_snapshot, response_raw: None, response_parsed: None,
                status_code: None, error_message: Some("Cancelled".into()),
                duration_ms: Some(start.elapsed().as_millis() as u64),
                stream, compat_results: None, created_at: now_str,
            };
            let _ = db.save_run(&run);
            let _ = app.emit(
                "request-error",
                RequestErrorEvent {
                    run_id: run_id.clone(),
                    error: "Cancelled".into(),
                    status_code: None,
                    raw_response: None,
                    parsed_output: None,
                },
            );
            runner.tokens.lock().await.remove(&run_id);
            return;
        }
        res = execute_inner(&client, &spec, stream, adapter.as_ref(), &app, &run_id) => res,
    };

    let duration = start.elapsed().as_millis() as u64;
    let (status_code, error_msg, response_raw, normalized, failure_event) = match result {
        Ok((sc, raw, norm)) => (Some(sc), None, Some(raw), Some(norm), None),
        Err(failure) => (
            failure.status_code,
            Some(failure.error.clone()),
            failure.raw_response.clone(),
            failure
                .parsed_output
                .as_ref()
                .map(|parsed_output| NormalizedResponse {
                    id: None,
                    model: None,
                    content: parsed_output.clone(),
                    finish_reason: None,
                    usage: None,
                    raw_body: failure.raw_response.clone().unwrap_or_default(),
                    response_body: failure.raw_response.clone(),
                    stream_events: vec![],
                }),
            Some(RequestErrorEvent {
                run_id: run_id.clone(),
                error: failure.error,
                status_code: failure.status_code,
                raw_response: failure.raw_response,
                parsed_output: failure.parsed_output,
            }),
        ),
    };

    let compat = crate::compat::run_checks(
        &protocol,
        status_code,
        error_msg.as_deref(),
        normalized.as_ref(),
        stream,
    );

    let run = RunHistory {
        id: run_id.clone(),
        provider_id,
        model_id,
        protocol,
        test_case_id,
        matrix_run_id,
        request_snapshot,
        response_raw: response_raw.clone(),
        response_parsed: normalized.clone(),
        status_code,
        error_message: error_msg,
        duration_ms: Some(duration),
        stream,
        compat_results: Some(compat.clone()),
        created_at: now_str,
    };
    let _ = db.save_run(&run);

    if let Some(norm) = normalized {
        let _ = app.emit(
            "stream-done",
            StreamDoneEvent {
                run_id: run_id.clone(),
                normalized_response: norm,
                compat_results: compat,
            },
        );
    }

    if let Some(failure_event) = failure_event {
        let _ = app.emit("request-error", failure_event);
    }

    runner.tokens.lock().await.remove(&run_id);
}

async fn execute_inner(
    client: &reqwest::Client,
    spec: &crate::protocol::RequestSpec,
    stream: bool,
    adapter: &dyn ProtocolAdapter,
    app: &tauri::AppHandle,
    run_id: &str,
) -> Result<(u16, String, NormalizedResponse), RequestFailure> {
    let resp = client
        .post(&spec.url)
        .headers(spec.headers.clone())
        .json(&spec.body)
        .send()
        .await
        .map_err(|e| RequestFailure {
            status_code: None,
            error: e.to_string(),
            raw_response: None,
            parsed_output: None,
        })?;

    let status = resp.status().as_u16();

    if !stream {
        let body = resp.text().await.map_err(|e| RequestFailure {
            status_code: Some(status),
            error: e.to_string(),
            raw_response: None,
            parsed_output: None,
        })?;

        if status >= 400 {
            let formatted_body = format_response_body(&body);
            return Err(RequestFailure {
                status_code: Some(status),
                error: extract_error_message(&body).unwrap_or_else(|| format!("HTTP {status}")),
                raw_response: Some(formatted_body.clone()),
                parsed_output: extract_error_output(&body),
            });
        }

        let parsed = adapter
            .parse_response(status, &body)
            .map_err(|error| RequestFailure {
                status_code: Some(status),
                error,
                raw_response: Some(format_response_body(&body)),
                parsed_output: extract_error_output(&body),
            })?;
        return Ok((status, body, parsed));
    }

    let mut event_stream = resp.bytes_stream();
    let mut full_body = String::new();
    let mut response_body = String::new();
    let mut events: Vec<StreamEvent> = Vec::new();
    let mut content = String::new();
    let mut buf = String::new();
    let mut idx: usize = 0;
    let mut current_event_type = String::new();

    while let Some(chunk) = event_stream.next().await {
        let chunk = chunk.map_err(|e| RequestFailure {
            status_code: Some(status),
            error: e.to_string(),
            raw_response: Some(full_body.clone()),
            parsed_output: None,
        })?;
        let text = String::from_utf8_lossy(&chunk);
        buf.push_str(&text);
        full_body.push_str(&text);

        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim_end_matches('\r').to_string();
            buf = buf[pos + 1..].to_string();

            if let Some(stripped) = line.strip_prefix("event:") {
                current_event_type = stripped.trim().to_string();
                continue;
            }

            if !line.starts_with("data:") {
                continue;
            }
            let data = line[5..].trim().to_string();

            if data == adapter.stream_done_marker()
                || current_event_type == adapter.stream_done_marker()
            {
                if data != adapter.stream_done_marker() {
                    response_body = data.clone();
                }
                let evt = StreamEvent {
                    event_type: adapter.stream_done_marker().into(),
                    data: data.clone(),
                    delta_text: String::new(),
                    index: idx,
                };
                events.push(evt);
                break;
            }

            let evt = adapter.parse_stream_line(
                if current_event_type.is_empty() {
                    "data"
                } else {
                    &current_event_type
                },
                &data,
                idx,
            );
            if !evt.delta_text.is_empty() {
                content.push_str(&evt.delta_text);
                let _ = app.emit(
                    "stream-chunk",
                    StreamChunkEvent {
                        run_id: run_id.into(),
                        delta_text: evt.delta_text.clone(),
                        event_type: evt.event_type.clone(),
                        raw_data: data.clone(),
                    },
                );
            }
            events.push(evt);
            idx += 1;
            current_event_type.clear();
        }
    }

    let normalized = NormalizedResponse {
        id: None,
        model: None,
        content,
        finish_reason: None,
        usage: None,
        raw_body: full_body,
        response_body: if response_body.is_empty() {
            None
        } else {
            Some(response_body)
        },
        stream_events: events,
    };
    Ok((status, normalized.raw_body.clone(), normalized))
}

fn format_response_body(body: &str) -> String {
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|value| serde_json::to_string_pretty(&value).ok())
        .unwrap_or_else(|| body.to_string())
}

fn extract_error_message(body: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(body).ok()?;
    value
        .pointer("/error/message")
        .and_then(|message| message.as_str())
        .or_else(|| value.get("message").and_then(|message| message.as_str()))
        .or_else(|| value.get("detail").and_then(|detail| detail.as_str()))
        .map(ToString::to_string)
}

fn extract_error_output(body: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(body).ok()?;
    extract_error_message(body).or_else(|| serde_json::to_string_pretty(&value).ok())
}
