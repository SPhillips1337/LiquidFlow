# Codebase Insight: LiquidFlow Architecture

## Overview
LiquidFlow is an animated ebook reader platform built with clear separation between content ingestion and presentation.

## Components

### 1. Pipeline (`pipeline/`)
- **Role**: Ingestion and annotation.
- **Tech**: Node.js, Project Gutenberg, Ollama AI, Jimp.
- **Function**: 
    - Fetches public domain books from Project Gutenberg.
    - Strips boilerplate and splits into Chapters and Scenes (~400-word segments).
    - Uses Ollama (granite4:3b) to annotate scenes with mood, visualPrompt, entities.
    - Generates ASCII illustrations (from images, Unsplash, or procedural).
    - Produces a `BookManifest` JSON in reader's public directory.
    - Extracts entity manifest with AI-generated descriptions.

### 2. Reader (`reader/`)
- **Role**: Presentation and interaction.
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

## Key Dependencies
- **@chenglou/pretext**: Precise text layout, flow around obstacles.
- **Ollama**: Local LLM (llama3 for lookups, granite4:3b for annotation).
- **Jimp**: Image processing for ASCII conversion.

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

## Build Notes
- Reader uses RAF loop - avoid DOM for visual updates
- Layout cache keyed by `${sceneId}:${fontSize}`
- Auto-nav triggers after scroll past content + 1 line