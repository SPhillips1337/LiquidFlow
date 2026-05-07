# Patterns & Lessons Learned

## 🔴 Failure: The "Half-Baked" Renderer Update
- **Context**: During the Kindle Plus redesign, the `renderer.ts` module was completely rewritten to a new API (`TypographyRenderer`), but the `main.ts` shell was not updated simultaneously.
- **Impact**: The application became non-functional as `main.ts` attempted to call `renderScene` with the old signature, causing type errors and runtime failures.
- **Lesson**: When refactoring core module interfaces, prioritize a "Vertical Slice" approach where the shell and renderer are updated in the same task to maintain a working build. Avoid leaving the core loop broken between tasks.

## 🔴 Failure: Renderer.ts File Truncation During Edit
- **Context**: During dialogue styling implementation, repeated edit attempts caused the renderer.ts file to truncate unexpectedly.
- **Impact**: Significant code loss requiring git checkout to recover.
- **Lesson**: Use git diff to verify changes before applying. When file gets truncated, immediately use `git checkout <file>` to recover.

## 🟢 Success: Decoupled Pipeline and Reader
- **Context**: Storing book data as static JSON manifests (`BookManifest`) in the public directory.
- **Impact**: The reader can remain a pure client-side application, making it easy to deploy and test. AI heavy-lifting (mood analysis, entity extraction) is done "ahead of time" during ingestion, ensuring a lag-free reading experience.
- **Pattern**: **AOT AI Annotation**. Pre-compute expensive AI hints and store them in the data model rather than making real-time calls during interaction.

## 🟢 Success: Pretext Layout Caching
- **Context**: The `LayoutCache` module stores `prepareWithSegments` results.
- **Impact**: Significant reduction in frame-time jitter. Once a scene is prepared for a specific font size, subsequent renders (driven by animations or scrolling) only perform the line-layout pass.
- **Pattern**: **Font-Keyed Layout Cache**. Key cache entries by `${sceneId}:${fontSize}` to handle user font-size adjustments.

## 🟢 Success: Auto-Navigation with Padding
- **Context**: Auto-chapter navigation triggered too easily, jumping after only a few pixels.
- **Impact**: Users couldn't read end of chapter.
- **Fix**: Added padding - auto-nav now triggers after scroll past content + 1 line height.
- **Pattern**: For scroll-based features, require overscrolling to prevent accidental triggers.

## 🟢 Success: Menu State Tracking
- **Context**: Library book menus (`...`) all opened on initial load due to window click listener inside loop.
- **Impact**: All menus showed as open simultaneously.
- **Fix**: Replaced global window listener with proper `openMenu` state tracking that only closes previously open menu.
- **Pattern**: Use scoped state, not global listeners in loops.

## 🔴 Failure: Entity Animation Causes Text Wobble
- **Context**: Floating character names ("entities") acted as text obstacles in `renderer.ts` lines 185-203, causing pretext to reflow lines around them on every frame.
- **Impact**: Visible text wobble when opening a chapter as entities drifted through the prose and line widths changed per frame.
- **Fix**: Disabled `spawnEntities()` calls in `openBook()` and `onSceneChanged()`. Transition effects (background particles) kept intact since they render on a separate z-index layer.
- **Lesson**: Dynamic obstacles in pretext cause continuous re-layout. Use separate canvas layers for background effects vs. in-text animations.

## 🟢 Success: Dual-Format AI Client
- **Context**: The AI client (`ai.ts`) was hardcoded to Ollama's API format (`/api/chat`, `{ message: { content } }`).
- **Impact**: Users with LM Studio or other OpenAI-compatible endpoints couldn't use AI features without running a translation proxy.
- **Fix**: Added `VITE_AI_FORMAT` env var (`ollama` | `openai`). When `openai`, posts to `/chat/completions` and parses `choices[0].message.content`. Backward compatible — falls back to legacy `VITE_OLLAMA_*` vars.
- **Pattern**: Abstract API format behind a single config toggle. Auto-detect response shape based on format flag.

## 🟢 Success: Self-Contained AI Companion Module
- **Context**: Needed to add 5 AI-powered features (summarize, study guide, quiz, notes, TTS) without bloating `main.ts` or the toolbar.
- **Impact**: Single 240-line module `ai-companion.ts` encapsulates all panel UI, AI calls, TTS, quiz state, and note persistence. `main.ts` only imports and wires 4 lines.
- **Pattern**: Keep feature-dense UI modules self-contained with their own DOM creation, event handling, and state management. Export a factory function with a minimal public API (show/hide/toggle/destroy).