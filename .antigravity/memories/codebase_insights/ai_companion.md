---
type: semantic
tags: [reader, ai, companion, ui, tts]
created: 2026-05-07
related:
  - ../architectural_decisions/openai_compatible_backend.md
  - ../../reader/src/ai-companion.ts
  - ../../reader/src/ai.ts
blast_radius: reader
confidence: high
---

# Codebase Insight: AI Companion Module

## Overview
The AI Companion is a slide-out panel in the reader that provides 5 AI-powered reading features. It lives in a single self-contained module at `reader/src/ai-companion.ts`.

## Architecture
- **Pattern**: Factory function `createAICompanion(container, manifest, callbacks)` that creates all DOM, wires events, and returns `{ show, hide, toggle, destroy, isVisible }`.
- **Integration**: Toolbar has a ✦ button wired to `onAICompanionToggle` which calls `toggle()`. Panel is created in `openBook()`, destroyed in `closeBook()`.
- **Panel Layout**: Fixed-width (340px) sidebar sliding in from the right. Positioned within `#reader-view` with `z-index: 25` (above canvas, below toolbar).

## Features

### 1. Summarize
- Sends chapter text (first 3500 chars) to AI with prompt template (thesis, 5 key ideas, 3 takeaways).
- Uses `ollamaChat` from `ai.ts` with model from `getDefaultModel()`.

### 2. Study Guide
- AI prompt asks for main argument, best quote, reflection question, connection to previous chapters.
- Same text truncation and AI call pattern as Summarize.

### 3. Quiz Me
- AI generates 5 questions (2 factual, 2 conceptual, 1 applied) in Q&A format.
- Client-side `parseQuiz()` regex extracts Q/A pairs from AI response.
- Interactive UI: one question at a time, "Show Answer" reveals, Prev/Next navigation.
- Quiz state held in module-level `quizState` variable (not persisted).

### 4. Notes (Memory Palace)
- AI extracts 3 quotes, core frameworks, tags from chapter.
- Saved to `localStorage` keyed by `liquidflow.notes.${bookId}.${chapterIndex}`.
- "Saved" tab lists all extracted notes for current book, organized by chapter in `<details>` elements.

### 5. Read Aloud (TTS)
- Uses browser-native `window.speechSynthesis` (Web Speech API).
- Reads entire chapter text concatenated from all scenes.
- Speed slider (0.5x–2x) adjusts `utterance.rate`.
- Play/Pause/Stop controls. Speed changes take effect on next playback.

## Key Design Decisions
- **MAX_CHARS = 3500**: Chapter text truncated to avoid blowing AI context windows. Enough for meaningful analysis of most scenes.
- **Self-contained DOM**: Panel creates its own HTML via `innerHTML`, avoiding template dependencies.
- **No external state**: All state (TTS, quiz, speaking status) lives inside the closure.
- **Error handling**: Every AI call catches errors and shows inline error message with retry option.

## Related Files
- `reader/src/ai-companion.ts` — the module
- `reader/src/ai.ts` — AI client with dual-format support
- `reader/src/toolbar.ts` — ✦ button wiring
- `reader/src/main.ts` — lifecycle integration
- `reader/src/style.css` — `.ai-companion*` styles (~150 lines)
