---
type: semantic
tags: [ai, backend, ollama, lm-studio, openai, config]
created: 2026-05-07
related:
  - ../../reader/src/ai.ts
  - ../../reader/.env.example
  - ../codebase_insights/liquidflow_architecture.md
blast_radius: reader, pipeline
confidence: high
---

# Architectural Decision: OpenAI-Compatible AI Backend

## Context
The AI client (`reader/src/ai.ts`) was originally written exclusively for Ollama's API format (`POST /api/chat` with response `{ message: { content } }`). Users running LM Studio, text-gen-webui, or other OpenAI-compatible local servers could not use AI features without running a translation proxy.

## Decision
Abstract the AI client to support both Ollama and OpenAI-compatible API formats via a single `VITE_AI_FORMAT` environment variable.

## Status: Active

## Implementation
- **New env vars**: `VITE_AI_BASE_URL`, `VITE_AI_FORMAT`, `VITE_AI_MAIN_MODEL`, `VITE_AI_FAST_MODEL`.
- **Fallback chain**: `VITE_AI_*` takes precedence, falls back to legacy `VITE_OLLAMA_*`.
- **Format switch**:
  - `ollama` (default): POST to `${base}/api/chat`, parse `data.message.content`.
  - `openai`: POST to `${base}/chat/completions`, parse `data.choices[0].message.content`.
- **Model resolution**: `getDefaultModel()` returns `MAIN_MODEL || FAST_MODEL || 'llama3.2'`.

## Key Changes
- `ollamaChat` function made backend-agnostic (kept name for backward compatibility).
- Added `getDefaultModel()` export for AI Companion to use configured model instead of hardcoded `llama3:latest`.
- `.env.example` updated to document new config alongside legacy vars.

## Rationale
- **Minimal friction**: Single config toggle instead of separate code paths or proxy setup.
- **Backward compatible**: Existing `VITE_OLLAMA_*` users unaffected.
- **Same message format**: Both APIs use the same `messages` array format — only the endpoint and response shape differ.

## Consequences
- AI Companion, lookups, and pipeline annotation all transparently support LM Studio.
- Only affects HTTP-level request/response — no changes to prompt templates or calling code.

## Testing
- Build validated with both format settings.
- LM Studio compatibility verified with `http://[IP_ADDRESS]/v1` + `VITE_AI_FORMAT=openai`.
