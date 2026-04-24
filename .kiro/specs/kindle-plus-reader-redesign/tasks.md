# Implementation Plan: Kindle Plus Reader Redesign

## Overview

Incrementally transform LiquidFlow from a proof-of-concept canvas reader into a fully-featured "Kindle Plus" reading application. The plan builds bottom-up: types and data models first, then new subsystem modules, then the renderer overhaul, then the app shell wiring, and finally the pipeline extensions.

## Tasks

- [x] 1. Extend types and data models
  - Update `reader/src/types.ts`: add `AnimationHints`, extend `BookScene` with `animationHints`, add `EntityEntry`, extend `BookManifest` with `entityManifest`, add `TypographyConfig`, `LayoutLine`, `WordBound`, `InlineEntity`, `TransitionState`, `SelectionState`, `SearchMatch`, `SearchState`, `ReadingPosition`
  - Remove `OrbState` and `RenderState` (replaced by new state shape in `main.ts`)
  - _Requirements: 1.1, 5.1, 6.1, 7.1, 8.1, 9.1, 12.1, 13.1, 14.1_

- [x] 2. Implement `persistence.ts` and font-size controls
  - [x] 2.1 Create `reader/src/persistence.ts` with `savePosition`, `loadPosition`, `saveFontSize`, `loadFontSize`
    - Debounce `savePosition` writes to 500ms
    - Default font size 18 when no stored value
    - _Requirements: 2.4, 2.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 2.2 Write property test for font-size persistence round-trip
    - **Property 6: Font size persistence round-trip**
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 2.3 Write property test for reading position round-trip
    - **Property 21: Reading position round-trip**
    - **Validates: Requirements 12.1, 12.2**

- [x] 3. Implement `layout-cache.ts` and `makeTypographyConfig`
  - [x] 3.1 Create `reader/src/layout-cache.ts` with `LayoutCache` class and `makeTypographyConfig` function
    - `LayoutCache` stores `PreparedTextWithSegments` and `LayoutLine[]` keyed by `${sceneId}:${fontSize}`
    - `makeTypographyConfig` computes `lineHeight = fontSize * 1.6`, clamps `paddingX` so column ≤ 680px
    - Export `invalidateScene` and `clear` methods
    - _Requirements: 1.1, 1.4, 1.7, 14.1, 15.3_

  - [ ]* 3.2 Write property tests for typography config
    - **Property 1: Typography lineHeight invariant** — `lineHeight >= fontSize * 1.5` for all valid sizes
    - **Property 3: Heading font size invariant** — heading size ≥ 1.6× base
    - **Property 4: Column width clamping** — effective column never exceeds 680px
    - **Validates: Requirements 1.1, 1.4, 1.7**

  - [ ]* 3.3 Write property test for PrepareWithSegments cache hit
    - **Property 26: PrepareWithSegments cache hit** — `prepareWithSegments` called exactly once per unique (sceneId, fontSize) pair
    - **Validates: Requirements 14.1, 15.3**

- [x] 4. Implement `search.ts`
  - [x] 4.1 Create `reader/src/search.ts` with `searchBook`, `nextMatch`, `prevMatch`
    - Case-insensitive substring scan across all scene texts
    - Return `SearchState` with `matches`, `currentIndex`
    - Guard: empty query returns empty matches without scanning
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7_

  - [ ]* 4.2 Write property tests for search
    - **Property 7: Search returns only matching scenes** — every match corresponds to a scene containing the query
    - **Property 8: Search match cycling round-trip** — `nextMatch` N times returns to original index
    - **Validates: Requirements 3.2, 3.3, 3.5**

- [x] 5. Implement `input.ts`
  - [x] 5.1 Create `reader/src/input.ts` with `attachInputRouter`
    - Unify mouse, touch, keyboard events into semantic `InputEvent` union
    - Tap vs drag: movement < 10px AND duration < 200ms → `tap`; otherwise `drag-*`
    - Pinch detection for two-touch gestures
    - Call `preventDefault()` on touch drag to suppress native scroll
    - Return detach function
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 5.2 Write property test for tap vs drag classification
    - **Property 20: Tap vs drag classification** — classified as tap iff movement < 10px AND duration < 200ms
    - **Validates: Requirements 11.3**

- [x] 6. Implement `animation-driver.ts`
  - [x] 6.1 Create `reader/src/animation-driver.ts` with `AnimationDriver` class
    - `spawnEntities(scene)`: create 1–`min(3, entities.length)` `InlineEntity` objects from `animationHints.entities`; randomise initial position along top edge
    - `tick(dt)`: update entity positions with mood-based speed/path (sine wave, zigzag, arc per mood table)
    - Bounce entities off canvas edges
    - `getEntityObstacles()`: return current bounding boxes
    - `triggerTransition(scene)`: create `TransitionState` only on forward chapter-boundary crossings; duration 2000–5000ms
    - `clearEntities()`: remove all entities on scene change
    - _Requirements: 5.1, 5.2, 5.5, 5.7, 6.1, 6.4, 6.6_

  - [ ]* 6.2 Write property tests for animation driver
    - **Property 10: Entity spawn count** — spawn count between 1 and `min(3, L)` for L ≥ 1
    - **Property 12: Mood-to-speed mapping** — speed within documented range per mood
    - **Property 13: Transition duration bounds** — duration in [2000, 5000] ms
    - **Property 14: No backward transition** — backward navigation never creates a TransitionState
    - **Validates: Requirements 5.1, 5.5, 6.4, 6.6**

- [x] 7. Implement `transition.ts`
  - Create `reader/src/transition.ts` with `renderTransition(canvas, state)` supporting `fluid-smoke` and `typographic-ascii` styles
  - `fluid-smoke`: 64×64 velocity grid + 400–600 character particles; motion-blur via semi-transparent fill; use `prepareWithSegments` for character width measurement
  - `typographic-ascii`: procedural noise brightness grid mapped to density ramp `' ·.:;+*#@█'`; use `prepareWithSegments` with mono font for cell sizing
  - Accept `TransitionState` with `progress` (0–1) and `visualPrompt`
  - _Requirements: 6.2, 6.3, 6.5, 15.4_

- [x] 8. Implement `lookup-card.ts`
  - [x] 8.1 Create `reader/src/lookup-card.ts` with `showLookupCard`, `hideLookupCard`, `updateLookupCard`
    - DOM structure: `.lookup-card` with `.lookup-title`, `.lookup-body`, close button
    - Positioning: above anchor if room (canvasH − anchorY > 240px), else below; clamp horizontally
    - Dismiss on outside click, Escape key, or close button
    - Cancel in-flight AI request via `AbortController` on dismiss
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 8.2 Write property tests for LookupCard
    - **Property 17: LookupCard content completeness** — entity name and description visible for any EntityEntry
    - **Property 18: LookupCard position constraint** — card fully within viewport, ≤ 40% canvas area
    - **Validates: Requirements 8.3, 8.5**

- [x] 9. Implement `toolbar.ts`
  - Create `reader/src/toolbar.ts` with `createToolbar(container, callbacks)`
  - Bottom-anchored on mobile (≤768px), top-anchored on desktop
  - Buttons: back, A−, A+, search (🔍), chapter list (≡); min 44×44px touch targets
  - `setChapterTitle`, `setProgress` methods; `destroy` cleanup
  - Chapter list overlay: lists all chapter titles, highlights active, closes on outside click or Escape
  - Search overlay: text input, next/prev match buttons, "no results" state, validation hint for empty query
  - _Requirements: 2.1, 3.1, 3.4, 3.6, 3.7, 4.1, 4.2, 4.4, 4.5, 11.6_

- [x] 10. Rewrite `renderer.ts` as `TypographyRenderer`
  - [x] 10.1 Replace `reader/src/renderer.ts` with new `TypographyRenderer`
    - Accept `(canvas, scene, layoutCache, entities, searchState, scrollOffset, typographyConfig)`
    - Use `makeTypographyConfig` for all font/spacing values
    - First-line indent (1.5em) for non-first paragraphs; flush-left for first paragraph after heading/break
    - Chapter headings: centred, `headingFont`, spaced letter-spacing
    - Scene break markers (`* * *` or blank-line clusters): centred ornamental separator
    - Narrow `lineW` around each `InlineEntity` bounding box (same logic as existing orb)
    - Draw search highlight rectangles in `--accent-glow` before text for matched word ranges
    - Draw inline entities as accent-coloured mono text with glow shadow after text pass
    - Return `LayoutLine[]` and store in `LayoutCache`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.3, 5.4, 14.2, 14.3, 14.4, 14.5, 15.1, 15.2_

  - [ ]* 10.2 Write property tests for renderer layout
    - **Property 2: First-line indent property** — first LayoutLine of each paragraph has x > paddingX + 1.5×fontSize
    - **Property 11: Entity line-width narrowing** — lineW < maxColumnWidth when entity overlaps line y-range
    - **Property 25: Layout correctness** — cursor chain integrity, all fields populated
    - **Validates: Requirements 1.2, 5.3, 14.2, 14.3, 14.5**

- [x] 11. Implement word hit-testing and drag-to-select in `main.ts`
  - [x] 11.1 Rewrite `reader/src/main.ts` as new app shell
    - [x] Replace old DOM refs and state with new shape (no `OrbState`/`RenderState`)
    - [x] Wire `attachInputRouter` for all canvas events
    - [x] On `tap`: binary-search `currentLines` by y, walk `line.words` to find tapped word; check against `entityManifest` (case-insensitive); open `LookupCard` in entity mode or AI mode
    - [x] On `drag-*`: track `SelectionState`; on `drag-end` extract selected text, open `LookupCard` in `ai-loading` mode, fire `lookupText()` AI call
    - [x] Render selection highlight rectangles via `dirty = true` on `drag-move`
    - [x] Restore `ReadingPosition` on book open; save on scene advance and scroll (debounced)
    - [x] Restore font size from `persistence.ts` on init
    - [x] Wire toolbar callbacks: font size, search, chapter nav
    - [x] Wire `AnimationDriver.tick(dt)` in rAF loop; set `dirty = true` when entities moved
    - [x] Wire `SceneTransition`: render on transition canvas; fade in/out via CSS opacity; skip on tap
    - [x] Cancel rAF on book close; cancel AI requests on LookupCard dismiss
    - _Requirements: 2.1, 2.2, 2.3, 4.3, 5.6, 6.5, 8.1, 8.2, 8.6, 9.1, 9.2, 9.3, 9.4, 9.6, 11.1, 11.5, 12.1, 12.2, 12.3, 12.4, 15.2, 15.5_

  - [x]* 11.2 Write property test for word hit-test correctness
    - **Property 16: Word hit-test correctness** — same tap coords always return same word; null when outside all words
    - **Validates: Requirements 8.1, 9.7**

  - [ ]* 11.3 Write property test for drag selection
    - **Property 19: Drag selection spans at least one word** — SelectionState.text non-empty when drag starts and ends within text area
    - **Validates: Requirements 9.1**

- [x] 12. Checkpoint — Ensure all tests pass
  - [x] Ensure all tests pass, ask the user if questions arise.

- [x] 13. Extend `style.css`
  - [x] Add `.reader-toolbar`, `.lookup-card`, `.chapter-list-overlay`, `.search-overlay` styles
  - [x] Remove `.reader-nav`, `.ascii-panel`, `.marginalia` styles (replaced)
  - [x] Add `lookupIn` keyframe animation (fade + 8px translateY, 150ms)
  - [x] Ensure toolbar buttons meet 44×44px touch target on touch devices
  - _Requirements: 10.2, 10.3, 11.6_

- [x] 14. Update `index.html`
  - [x] Replace `.reader-nav` markup with toolbar mount point `<div id="reader-toolbar"></div>`
  - [x] Add `<canvas id="transition-canvas">` as sibling of `#reader-canvas` with `position: absolute; inset: 0; pointer-events: none; z-index: 5; opacity: 0`
  - [x] Remove ASCII panel and marginalia DOM elements
  - [x] Add `<div id="lookup-card" class="lookup-card hidden">` inside `#app`
  - _Requirements: 6.2, 10.1_

- [x] 15. Remove deprecated modules
  - [x] Delete `reader/src/ascii.ts` (functionality absorbed into `transition.ts`)
  - [x] Delete `reader/src/marginalia.ts` (replaced by `lookup-card.ts`)
  - _Requirements: (cleanup — no direct requirement, enables clean build)_

- [x] 16. Extend pipeline `ai.ts`
  - [x] Update `pipeline/src/ai.ts`: extend `SceneAnnotation` with `transitionStyle` field
  - [x] Update Ollama prompt to request `transitionStyle` (one of `fluid-smoke | typographic-ascii | particle-drift`)
  - [x] Add `DEFAULT_ANNOTATION` fallback constant with `transitionStyle: 'particle-drift'`
  - [x] Add `generateEntityDescription(name, contextText, ollamaBase, mainModel)` function using `MainModel`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 16.1 Write property test for annotateScene output completeness
    - **Property 15: AnimationHints completeness** — all four fields present and valid on every annotation
    - **Validates: Requirements 7.1**

- [x] 17. Extend pipeline `ingest.ts` with entity manifest
  - [x] 17.1 Add `buildEntityManifest(chapters, ollamaBase, mainModel)` to `pipeline/src/ingest.ts`
    - [x] Collect all unique entity names across scenes (case-sensitive dedup, keep earliest scene)
    - [x] Call `generateEntityDescription` per unique entity using `MainModel`
    - [x] Write result as `entityManifest` top-level key in `BookManifest` JSON
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x]* 17.2 Write property tests for entity manifest
    - **Property 22: Entity manifest deduplication** — one entry per unique name, `firstSeenScene` is earliest
    - **Property 23: EntityEntry field completeness** — all four fields present, `type` is valid enum value
    - **Property 24: BookManifest serialization round-trip** — `entityManifest` survives JSON round-trip
    - **Validates: Requirements 13.1, 13.2, 13.4, 13.5**

- [x] 18. Update `demo-book.ts` and `shelf.ts`
  - [x] Update `reader/src/demo-book.ts`: add `animationHints` to each scene, add `entityManifest` to manifest
  - [x] Update `reader/src/shelf.ts`: handle `entityManifest` missing from older manifests (treat as `[]`)
  - _Requirements: 7.2, 13.5_

- [x] 19. Add testing dependencies and configure test runner
  - [x] Add `vitest` and `fast-check` as dev dependencies in `reader/package.json` and `pipeline/package.json`
  - [x] Add `"test": "vitest --run"` script to both packages
  - [x] Create `reader/src/__tests__/` and `pipeline/src/__tests__/` directories with placeholder index
  - _Requirements: (test infrastructure)_

- [x] 20. Final checkpoint — Ensure all tests pass
  - [x] Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with `numRuns: 100` minimum; tag format: `// Feature: kindle-plus-reader-redesign, Property N: <text>`
- The transition canvas (`#transition-canvas`) is always present in the DOM but invisible (`opacity: 0`) except during active `SceneTransition`
- `OrbState` / `RenderState` from the old `types.ts` are removed; the new app state lives directly in `main.ts`
