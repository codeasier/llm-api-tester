# LLM API Tester

A Tauri desktop application for testing and validating LLM API compatibility across:

- OpenAI Chat Completions
- OpenAI Responses
- Anthropic Messages

## Stack

- Frontend: React + TypeScript + Vite + pnpm
- Backend: Rust + Tauri
- Storage: SQLite + system secure credential storage

## Features

- Workspace-first API testing UI
- Provider configuration: base URL, model IDs, custom headers, API key storage strategy
- Protocol-specific request builder with advanced JSON editor
- Stream and non-stream request execution
- Real-time stream output and cancellation
- Compatibility checks for connectivity, schema, and streaming events
- Saved test cases and batch compatibility matrix
- Run history and report export as JSON, CSV, or Markdown

## Development

```bash
pnpm install --store-dir "$PWD/.pnpm-store"
pnpm tauri dev
```

If global pnpm or Cargo cache permissions are restricted, use local cache directories:

```bash
PNPM_HOME="$PWD/.pnpm-home" pnpm install --store-dir "$PWD/.pnpm-store"
CARGO_HOME="$PWD/.cargo-home" cargo check --manifest-path src-tauri/Cargo.toml
```

## Verification

```bash
pnpm run verify
```

This runs:

- TypeScript type checking
- Frontend lint
- Vitest unit tests
- Frontend production build
- Rust formatting check
- Rust compile check
- Rust clippy with warnings denied

## Local build pipelines

### macOS

```bash
pnpm run build:macos
```

This runs the full verification pipeline and then builds the Tauri macOS bundle.

### Windows / Linux

The script names are reserved now so CI and local workflows can expand without renaming commands later:

```bash
pnpm run build:win
pnpm run build:linux
```

These currently exit with a placeholder message.

## CI overview

- Pull requests should pass frontend checks, Rust checks, and unit tests.
- A separate macOS workflow can build and upload unsigned desktop artifacts.
