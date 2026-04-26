# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM API Tester — a Tauri v2 desktop app for testing LLM API compatibility across OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages protocols. It sends requests, normalizes responses, runs compatibility checks, and produces reports.

## Development Commands

```bash
# Install dependencies
pnpm install --store-dir "$PWD/.pnpm-store"

# Start dev server (frontend HMR + Rust hot-rebuild)
pnpm tauri dev

# Type-check frontend only
pnpm exec tsc --noEmit

# Build frontend
pnpm exec vite build --emptyOutDir

# Check Rust backend compiles
cargo check --manifest-path src-tauri/Cargo.toml

# Full production build
pnpm tauri build
```

If global cache permissions are restricted, use local caches:
```bash
CARGO_HOME="$PWD/.cargo-home" cargo check --manifest-path src-tauri/Cargo.toml
PNPM_HOME="$PWD/.pnpm-home" pnpm install --store-dir "$PWD/.pnpm-store"
```

## Architecture

### Dual-layer: React frontend + Rust/Tauri backend

**Frontend** (`src/`) — React 19 + TypeScript + Vite + Tailwind CSS v4
- State management: Zustand (`src/stores/appStore.ts`)
- Routing: react-router-dom with 4 pages: Workspace, Matrix, History, Settings
- Tauri IPC via `invoke()` calls to Rust commands defined in `src-tauri/src/commands.rs`
- Monaco Editor for JSON request body editing
- Dark theme UI (gray-950 background)

**Backend** (`src-tauri/src/`) — Rust + Tauri v2
- `lib.rs` — app setup: initializes SQLite DB, RunnerState, KeyStore as managed state
- `commands.rs` — all Tauri `#[tauri::command]` handlers bridging frontend ↔ Rust
- `models.rs` — shared data types (ProviderConfig, TestCase, RunHistory, etc.) mirrored between Rust and TypeScript
- `protocol/` — `ProtocolAdapter` trait with three implementations:
  - `openai_chat.rs` → `/v1/chat/completions`
  - `openai_responses.rs` → `/v1/responses`
  - `anthropic.rs` → `/v1/messages`
- `runner.rs` — async request execution with SSE stream parsing, cancellation via `CancellationToken`, and Tauri event emission (`stream-chunk`, `stream-done`, `request-error`)
- `compat.rs` — compatibility check engine (Connectivity, Schema, Stream categories)
- `db.rs` — SQLite persistence via `rusqlite` with `Mutex<Connection>`
- `keystore.rs` — API key storage: OS keyring (`keyring` crate) or in-memory `HashMap`
- `history.rs` — run history queries with dynamic filtering
- `report.rs` — export to JSON/CSV/Markdown
- `schema.sql` — DDL for providers, test_cases, test_suites, run_history, matrix_runs tables

### Key data flow

1. Frontend calls `invoke("run_single_request", ...)` → `commands.rs` spawns `runner::execute_request`
2. Runner selects the protocol adapter, builds HTTP request, sends via `reqwest`
3. For streaming: SSE events are parsed line-by-line, deltas emitted as Tauri events
4. After completion: compatibility checks run (`compat::run_checks`), results saved to SQLite, `stream-done` event sent
5. Matrix runs iterate over all provider×model×protocol×testcase combinations

### Adding a new protocol

1. Create `src-tauri/src/protocol/<name>.rs` implementing `ProtocolAdapter`
2. Register in `src-tauri/src/protocol/mod.rs`
3. Add variant handling in `runner.rs::get_adapter()`
4. Add schema checks in `compat.rs` for the new protocol's response format