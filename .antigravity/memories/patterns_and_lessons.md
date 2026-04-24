# Patterns & Lessons Learned

## 🔴 Failure: The "Half-Baked" Renderer Update
- **Context**: During the Kindle Plus redesign, the `renderer.ts` module was completely rewritten to a new API (`TypographyRenderer`), but the `main.ts` shell was not updated simultaneously.
- **Impact**: The application became non-functional as `main.ts` attempted to call `renderScene` with the old signature, causing type errors and runtime failures.
- **Lesson**: When refactoring core module interfaces, prioritize a "Vertical Slice" approach where the shell and renderer are updated in the same task to maintain a working build. Avoid leaving the core loop broken between tasks.

## 🟢 Success: Decoupled Pipeline and Reader
- **Context**: Storing book data as static JSON manifests (`BookManifest`) in the public directory.
- **Impact**: The reader can remain a pure client-side application, making it easy to deploy and test. AI heavy-lifting (mood analysis, entity extraction) is done "ahead of time" during ingestion, ensuring a lag-free reading experience.
- **Pattern**: **AOT AI Annotation**. Pre-compute expensive AI hints and store them in the data model rather than making real-time calls during interaction.

## 🟢 Success: Pretext Layout Caching
- **Context**: The `LayoutCache` module stores `prepareWithSegments` results.
- **Impact**: Significant reduction in frame-time jitter. Once a scene is prepared for a specific font size, subsequent renders (driven by animations or scrolling) only perform the line-layout pass.
- **Pattern**: **Font-Keyed Layout Cache**. Key cache entries by `${sceneId}:${fontSize}` to handle user font-size adjustments.
