# Codebase Insight: LiquidFlow Architecture

## Overview
LiquidFlow is an animated ebook reader platform built with a clear separation between content ingestion and content presentation.

## Components

### 1. Pipeline (`pipeline/`)
- **Role**: Ingestion and annotation.
- **Tech**: Node.js, Project Gutenberg, Ollama AI.
- **Function**: 
    - Fetches public domain books from Project Gutenberg.
    - Strips boilerplate and splits content into Chapters and Scenes (~400-word segments).
    - Uses Ollama (FastModel) to annotate each scene with mood, visual prompts, and entities.
    - Produces a `BookManifest` JSON file in the reader's public directory.

### 2. Reader (`reader/`)
- **Role**: Presentation and interaction.
- **Tech**: Vite, TypeScript, `@chenglou/pretext`.
- **Function**:
    - Renders book text on an HTML5 Canvas using the Pretext layout engine.
    - Provides Kindle-like controls (font size, chapter navigation, search).
    - Handles real-time text animations and transitions based on pipeline-generated hints.
    - Supports AI-powered word lookups via Ollama (MainModel).

## Key Dependencies
- **@chenglou/pretext**: Critical for precise, variable-width text layout on Canvas, enabling text to flow around animated obstacles.
- **Ollama**: Provides local LLM capabilities for both ingestion (fast) and interactive lookups (rich).
