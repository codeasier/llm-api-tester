use crate::models::*;

pub fn run_checks(
    protocol: &str,
    status_code: Option<u16>,
    error: Option<&str>,
    response: Option<&NormalizedResponse>,
    stream: bool,
) -> Vec<CheckResult> {
    let mut results = Vec::new();

    // Connectivity
    match (status_code, error) {
        (Some(code), _) if (200..300).contains(&code) => {
            results.push(pass("CONN_OK", "Connectivity", "OK"))
        }
        (Some(401) | Some(403), _) => {
            results.push(fail(
                "CONN_OK",
                "Connectivity",
                &format!("HTTP {}", status_code.unwrap()),
            ));
            results.push(fail("CONN_AUTH", "Connectivity", "Authentication failed"));
            return results;
        }
        (Some(code), _) => {
            results.push(fail("CONN_OK", "Connectivity", &format!("HTTP {code}")));
            return results;
        }
        (None, Some(err)) if err.contains("timeout") => {
            results.push(fail("CONN_TIMEOUT", "Connectivity", err));
            return results;
        }
        (None, Some(err)) => {
            results.push(fail("CONN_OK", "Connectivity", err));
            return results;
        }
        (None, None) => {
            results.push(fail("CONN_OK", "Connectivity", "No response received"));
            return results;
        }
    }
    results.push(pass("CONN_AUTH", "Connectivity", "OK"));
    results.push(pass("CONN_TIMEOUT", "Connectivity", "OK"));

    let resp = match response {
        Some(response) => response,
        None => return results,
    };

    if !stream {
        run_non_stream_schema_checks(protocol, resp, &mut results);
        return results;
    }

    run_stream_base_checks(resp, &mut results);

    match protocol {
        "openai_chat" => run_openai_chat_stream_checks(resp, &mut results),
        "openai_responses" => run_openai_responses_stream_checks(resp, &mut results),
        "anthropic_messages" => run_anthropic_stream_checks(resp, &mut results),
        _ => {}
    }

    results
}

fn run_non_stream_schema_checks(
    protocol: &str,
    resp: &NormalizedResponse,
    results: &mut Vec<CheckResult>,
) {
    let raw: serde_json::Value = serde_json::from_str(&resp.raw_body).unwrap_or_default();

    if resp.id.is_some() {
        results.push(pass("SCHEMA_ID", "Schema", "OK"));
    } else {
        results.push(fail("SCHEMA_ID", "Schema", "Missing 'id' field"));
    }

    let object_ok = match protocol {
        "openai_chat" => {
            raw.get("object").and_then(|value| value.as_str()) == Some("chat.completion")
        }
        "openai_responses" => {
            raw.get("object").and_then(|value| value.as_str()) == Some("response")
        }
        "anthropic_messages" => raw.get("type").and_then(|value| value.as_str()) == Some("message"),
        _ => false,
    };
    if object_ok {
        results.push(pass("SCHEMA_OBJECT", "Schema", "OK"));
    } else {
        results.push(fail(
            "SCHEMA_OBJECT",
            "Schema",
            "object/type field mismatch",
        ));
    }

    if !resp.content.is_empty() {
        results.push(pass("SCHEMA_CONTENT", "Schema", "OK"));
    } else {
        results.push(fail(
            "SCHEMA_CONTENT",
            "Schema",
            "No text content extracted",
        ));
    }

    if resp.finish_reason.is_some() {
        results.push(pass("SCHEMA_FINISH", "Schema", "OK"));
    } else {
        results.push(warn("SCHEMA_FINISH", "Schema", "No finish/stop reason"));
    }

    if resp.usage.is_some() {
        results.push(pass("SCHEMA_USAGE", "Schema", "OK"));
    } else {
        results.push(warn("SCHEMA_USAGE", "Schema", "No usage info"));
    }
}

fn run_stream_base_checks(resp: &NormalizedResponse, results: &mut Vec<CheckResult>) {
    let events = &resp.stream_events;
    if events.is_empty() {
        results.push(fail("STREAM_EVENTS", "Stream", "No stream events received"));
        results.push(fail("STREAM_DELTA_TEXT", "Stream", "No delta text found"));
        return;
    }

    results.push(pass(
        "STREAM_EVENTS",
        "Stream",
        &format!("Received {} stream events", events.len()),
    ));

    if events.iter().any(|event| !event.delta_text.is_empty()) {
        results.push(pass(
            "STREAM_DELTA_TEXT",
            "Stream",
            "Stream produced incremental text",
        ));
    } else {
        results.push(fail("STREAM_DELTA_TEXT", "Stream", "No delta text found"));
    }
}

fn run_openai_chat_stream_checks(resp: &NormalizedResponse, results: &mut Vec<CheckResult>) {
    let json_chunks: Vec<serde_json::Value> = resp
        .stream_events
        .iter()
        .filter(|event| event.data != "[DONE]")
        .filter_map(|event| serde_json::from_str::<serde_json::Value>(&event.data).ok())
        .collect();

    if json_chunks.is_empty() {
        results.push(fail(
            "STREAM_CHAT_JSON_CHUNK",
            "Stream",
            "No parseable JSON chat chunks received",
        ));
    } else {
        results.push(pass(
            "STREAM_CHAT_JSON_CHUNK",
            "Stream",
            &format!("Parsed {} chat chunks", json_chunks.len()),
        ));
    }

    let has_choice_delta = json_chunks
        .iter()
        .any(|chunk| chunk.pointer("/choices/0").is_some());
    if has_choice_delta {
        results.push(pass(
            "STREAM_CHAT_CHOICES",
            "Stream",
            "Chat stream contains choices[0] chunks",
        ));
    } else {
        results.push(fail(
            "STREAM_CHAT_CHOICES",
            "Stream",
            "No chat chunk contained choices[0]",
        ));
    }

    let has_done = resp
        .stream_events
        .iter()
        .any(|event| event.data.trim() == "[DONE]");
    if has_done {
        results.push(pass(
            "STREAM_CHAT_DONE",
            "Stream",
            "Received [DONE] terminator",
        ));
    } else {
        results.push(fail(
            "STREAM_CHAT_DONE",
            "Stream",
            "Missing [DONE] terminator",
        ));
    }

    let finish_reason = json_chunks.iter().rev().find_map(|chunk| {
        chunk
            .pointer("/choices/0/finish_reason")
            .and_then(|value| value.as_str())
    });
    if let Some(reason) = finish_reason {
        results.push(pass(
            "STREAM_CHAT_FINISH",
            "Stream",
            &format!("finish_reason={reason}"),
        ));
    } else {
        results.push(warn(
            "STREAM_CHAT_FINISH",
            "Stream",
            "No finish_reason found in streamed chat chunks",
        ));
    }

    results.push(warn(
        "STREAM_CHAT_USAGE",
        "Stream",
        "Usage is not reliably available in streamed chat chunks",
    ));
}

fn run_openai_responses_stream_checks(resp: &NormalizedResponse, results: &mut Vec<CheckResult>) {
    let delta_events: Vec<&StreamEvent> = resp
        .stream_events
        .iter()
        .filter(|event| event.event_type == "response.output_text.delta")
        .collect();

    if delta_events.is_empty() {
        results.push(fail(
            "STREAM_RESPONSES_DELTA",
            "Stream",
            "Missing response.output_text.delta events",
        ));
    } else {
        results.push(pass(
            "STREAM_RESPONSES_DELTA",
            "Stream",
            &format!("Received {} output_text.delta events", delta_events.len()),
        ));
    }

    let completed_event = resp
        .stream_events
        .iter()
        .find(|event| event.event_type == "response.completed");
    let Some(completed_event) = completed_event else {
        results.push(fail(
            "STREAM_RESPONSES_COMPLETED",
            "Stream",
            "Missing response.completed event",
        ));
        results.push(warn(
            "STREAM_RESPONSES_SCHEMA",
            "Stream",
            "No final response.completed payload to inspect",
        ));
        results.push(warn(
            "STREAM_RESPONSES_USAGE",
            "Stream",
            "No final response.completed payload to inspect",
        ));
        return;
    };

    results.push(pass(
        "STREAM_RESPONSES_COMPLETED",
        "Stream",
        "Received response.completed event",
    ));

    let completed_json = serde_json::from_str::<serde_json::Value>(&completed_event.data).ok();
    let Some(completed_json) = completed_json else {
        results.push(fail(
            "STREAM_RESPONSES_JSON",
            "Stream",
            "response.completed payload is not valid JSON",
        ));
        results.push(warn(
            "STREAM_RESPONSES_SCHEMA",
            "Stream",
            "Could not inspect final response.completed payload",
        ));
        results.push(warn(
            "STREAM_RESPONSES_USAGE",
            "Stream",
            "Could not inspect final response.completed payload",
        ));
        return;
    };

    results.push(pass(
        "STREAM_RESPONSES_JSON",
        "Stream",
        "response.completed payload is valid JSON",
    ));

    let object_ok = completed_json
        .get("object")
        .and_then(|value| value.as_str())
        == Some("response");
    let status_ok = completed_json
        .get("status")
        .and_then(|value| value.as_str())
        .is_some();
    let id_ok = completed_json
        .get("id")
        .and_then(|value| value.as_str())
        .is_some();
    let output_ok = completed_json
        .get("output")
        .and_then(|value| value.as_array())
        .is_some();

    if object_ok && status_ok && id_ok && output_ok {
        results.push(pass(
            "STREAM_RESPONSES_SCHEMA",
            "Stream",
            "response.completed payload contains id/object/status/output",
        ));
    } else {
        results.push(warn(
            "STREAM_RESPONSES_SCHEMA",
            "Stream",
            "response.completed payload is missing one of id/object/status/output",
        ));
    }

    let usage = completed_json.get("usage");
    if usage.is_some() {
        results.push(pass(
            "STREAM_RESPONSES_USAGE",
            "Stream",
            "response.completed payload contains usage",
        ));
    } else {
        results.push(warn(
            "STREAM_RESPONSES_USAGE",
            "Stream",
            "response.completed payload does not contain usage",
        ));
    }
}

fn run_anthropic_stream_checks(resp: &NormalizedResponse, results: &mut Vec<CheckResult>) {
    let has_message_start = resp
        .stream_events
        .iter()
        .any(|event| event.event_type == "message_start");
    let has_content_block_start = resp
        .stream_events
        .iter()
        .any(|event| event.event_type == "content_block_start");
    let has_content_delta = resp
        .stream_events
        .iter()
        .any(|event| event.event_type == "content_block_delta");
    let has_message_delta = resp
        .stream_events
        .iter()
        .any(|event| event.event_type == "message_delta");
    let has_message_stop = resp
        .stream_events
        .iter()
        .any(|event| event.event_type == "message_stop");

    if has_content_delta {
        results.push(pass(
            "STREAM_ANTHROPIC_DELTA",
            "Stream",
            "Received content_block_delta events",
        ));
    } else {
        results.push(fail(
            "STREAM_ANTHROPIC_DELTA",
            "Stream",
            "Missing content_block_delta events",
        ));
    }

    if has_message_stop {
        results.push(pass(
            "STREAM_ANTHROPIC_MESSAGE_STOP",
            "Stream",
            "Received message_stop event",
        ));
    } else {
        results.push(fail(
            "STREAM_ANTHROPIC_MESSAGE_STOP",
            "Stream",
            "Missing message_stop event",
        ));
    }

    if has_message_start || has_content_block_start {
        results.push(pass(
            "STREAM_ANTHROPIC_STRUCTURE",
            "Stream",
            "Received anthropic stream start structure events",
        ));
    } else {
        results.push(warn(
            "STREAM_ANTHROPIC_STRUCTURE",
            "Stream",
            "Missing message_start/content_block_start events",
        ));
    }

    if has_message_delta {
        let stop_reason = resp.stream_events.iter().find_map(|event| {
            if event.event_type != "message_delta" {
                return None;
            }
            serde_json::from_str::<serde_json::Value>(&event.data)
                .ok()
                .and_then(|value| {
                    value
                        .pointer("/delta/stop_reason")
                        .and_then(|reason| reason.as_str())
                        .map(ToString::to_string)
                })
        });
        if let Some(reason) = stop_reason {
            results.push(pass(
                "STREAM_ANTHROPIC_FINISH",
                "Stream",
                &format!("stop_reason={reason}"),
            ));
        } else {
            results.push(warn(
                "STREAM_ANTHROPIC_FINISH",
                "Stream",
                "message_delta events did not expose stop_reason",
            ));
        }
    } else {
        results.push(warn(
            "STREAM_ANTHROPIC_FINISH",
            "Stream",
            "No message_delta events to inspect for stop_reason",
        ));
    }

    let usage_found = resp.stream_events.iter().any(|event| {
        if event.event_type != "message_start" && event.event_type != "message_delta" {
            return false;
        }

        let Ok(value) = serde_json::from_str::<serde_json::Value>(&event.data) else {
            return false;
        };

        value.pointer("/message/usage").is_some() || value.pointer("/usage").is_some()
    });
    if usage_found {
        results.push(pass(
            "STREAM_ANTHROPIC_USAGE",
            "Stream",
            "Usage metadata found in anthropic stream events",
        ));
    } else {
        results.push(warn(
            "STREAM_ANTHROPIC_USAGE",
            "Stream",
            "No usage metadata found in anthropic stream events",
        ));
    }
}

fn pass(id: &str, category: &str, reason: &str) -> CheckResult {
    CheckResult {
        check_id: id.into(),
        category: category.into(),
        status: CheckStatus::Pass,
        reason: reason.into(),
    }
}

fn fail(id: &str, category: &str, reason: &str) -> CheckResult {
    CheckResult {
        check_id: id.into(),
        category: category.into(),
        status: CheckStatus::Fail,
        reason: reason.into(),
    }
}

fn warn(id: &str, category: &str, reason: &str) -> CheckResult {
    CheckResult {
        check_id: id.into(),
        category: category.into(),
        status: CheckStatus::Warn,
        reason: reason.into(),
    }
}
