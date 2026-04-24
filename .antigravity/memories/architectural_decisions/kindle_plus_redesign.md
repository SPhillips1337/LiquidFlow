# Architectural Decision: Kindle Plus Redesign

## Context
The initial PoC for LiquidFlow was a single-canvas reader with limited controls and a "random" entity system. The goal is to mature this into a premium "Kindle Plus" experience.

## Decision
Undertake a comprehensive redesign of the reader and pipeline to support professional typography, standard reader controls, and deep AI-driven entity lookups.

## Status: In Progress

## Key Changes
- **Typography**: Moving from simple "fill text" to a structured `TypographyRenderer` with proper indents, line-heights, and font scaling.
- **State Management**: Replacing the ad-hoc `OrbState` with a robust `ReadingPosition` and `TypographyConfig`.
- **Interactions**: Implementing unified input routing for touch/mouse, supporting both "tap for entity" and "drag for AI lookup".
- **Pipeline Extensions**: Enhancing the manifest with a top-level `entityManifest` to allow instant lookups for known characters.

## Known Risks
- **Renderer/Shell Mismatch**: During transition, the renderer API may change before the main application logic is updated, leading to build failures. (Documented in Lessons Learned).
