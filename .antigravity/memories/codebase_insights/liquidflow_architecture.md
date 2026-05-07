# Codebase Insight: LiquidFlow Architecture

## Overview
LiquidFlow is an animated ebook reader platform with an AI reading companion, built with clear separation between content ingestion and presentation.

## Components

### 1. Pipeline (`pipeline/`)
- **Role**: Ingestion and annotation.
- **Tech**: Node.js, Project Gutenberg, Ollama/LM Studio AI, Jimp.
- **Function**: 
    - Fetches public domain books from Project Gutenberg.
    - Strips boilerplate and splits into Chapters and Scenes (~400-word segments).
    - Uses Ollama (granite4:3b) to annotate scenes with mood, visualPrompt, entities.
    - Generates ASCII illustrations (from images, Unsplash, or procedural).
    - Produces a `BookManifest` JSON in reader's public directory.
    - Extracts entity manifest with AI-generated descriptions.

### 2. Reader (`reader/`)
- **Role**: Presentation, interaction, and AI companion features.
- **Tech**: Vite, TypeScript, `@chenglou/pretext`.
- **Function**:
    - Renders book text on HTML5 Canvas using pretext.
    - Canvas-based 60fps rendering with RAF loop.
    - Animated ASCII via AsciiVisualizer.
    - Auto-chapter navigation on scroll.
    - Theme system (dark/light/sepia).
    - Font controls, chapter nav arrows, sidebar.
    - Dialogue styling (quoted text bold).
    - Entity highlighting.
    - **AI Companion panel** (toggle via toolbar ✦ button):
      - Summarize chapter, study guide, quiz, extract notes, TTS read-aloud.
    - Background transition effects (particle-drift, fluid-smoke, typographic-ascii).

### 3. AI Backend (`reader/src/ai.ts`)
- **Role**: Unified AI client supporting Ollama and OpenAI-compatible endpoints.
- **Tech**: Fetch-based client with configurable base URL and API format.
- **Function**:
    - `ollamaChat(model, prompt, system)` — core chat function.
    - `getDefaultModel()` — returns configured model with fallback chain.
    - Dual-format support: `ollama` (default) vs `openai` (LM Studio).
    - Used by: scene annotation (pipeline), lore cards, ASCII generation, AI Companion, word lookup.

## Key Dependencies
- **@chenglou/pretext**: Precise text layout, flow around obstacles.
- **Ollama / OpenAI-compatible**: Local LLM (configured via `VITE_AI_BASE_URL` + `VITE_AI_FORMAT`).
- **Jimp**: Image processing for ASCII conversion.
- **Web Speech API**: Browser-native TTS for Read Aloud feature.

## Current Features
- Canvas typography at 60fps
- Animated ASCII illustrations
- Entity highlighting with accent_glow
- Dialogue styling
- Auto-chapter navigation
- Font reset button
- Chapter arrows (‹ ›)
- Chapter sidebar (desktop)
- Book management (regenerate/delete)
- LLM retry logic
- AI Companion panel (summarize, study guide, quiz, notes, TTS)
- OpenAI-compatible backend support (LM Studio)
- Background transition effects on chapter change

## Removed / Disabled
- **Entity floating animation**: Disabled — moving text obstacles caused pretext re-layout wobble.

## Build Notes
- Reader uses RAF loop - avoid DOM for visual updates.
- Layout cache keyed by `${sceneId}:${fontSize}`.
- Auto-nav triggers after scroll past content + 1 line.
- Transition effects render on a separate z-index layer (`#transition-canvas`, z-index: 1).