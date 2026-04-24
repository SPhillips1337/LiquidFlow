# Requirements Document

## Introduction

This document specifies the redesign of the LiquidFlow animated ebook reader into a "Kindle Plus" experience. The redesign replaces the current basic canvas renderer (single draggable orb, ASCII side panel, random-entity lore card) with a fully-featured reading application that combines proper book typography, Kindle-like reader controls, AI-driven animated text illustrations using the `pretext` library, and an elegant word/entity lookup system. The system must work well on both tablet (touch) and desktop (mouse/keyboard) and must continue to use canvas-based rendering via `@chenglou/pretext` to enable the animated text effects that are the core creative differentiator.

---

## Glossary

- **Reader**: The browser-based LiquidFlow canvas reading application (`reader/` package).
- **Pipeline**: The Node.js CLI ingestion tool (`pipeline/` package) that fetches, parses, and annotates books.
- **BookManifest**: The JSON file stored in `reader/public/books/` that represents a fully processed book, including chapters, scenes, and AI annotations.
- **Scene**: A paragraph cluster of approximately 400 words within a chapter, the atomic unit of rendering.
- **Canvas**: The HTML5 `<canvas>` element on which all text and animations are drawn using `@chenglou/pretext`.
- **Pretext**: The `@chenglou/pretext` library providing `prepareWithSegments`, `layoutNextLineRange`, and `materializeLineRange` APIs for precise, variable-width text layout on Canvas.
- **LayoutCursor**: The `pretext` cursor type that tracks position within a prepared text segment during line-by-line layout.
- **InlineEntity**: An animated character or symbol that swims through the page text, displacing words around it in real time.
- **SceneTransition**: A full-screen animated text art moment displayed between chapters or at scene boundaries.
- **AnimationDriver**: The subsystem that creates and updates `InlineEntity` and `SceneTransition` animations based on AI-provided scene metadata.
- **LookupCard**: The floating overlay card that displays entity context or AI-powered word/phrase meaning.
- **EntityManifest**: The pre-scanned list of named characters, places, and themes stored per scene in the `BookManifest`, available without an AI call.
- **Ollama**: The local AI backend accessed via a Cloudflare tunnel; model names and base URL are read from `.env` variables only.
- **FastModel**: The Ollama model designated for low-latency tasks (e.g. mood, entity extraction), configured via `VITE_OLLAMA_FAST_MODEL`.
- **MainModel**: The Ollama model designated for richer generation (e.g. lore cards, lookup explanations), configured via `VITE_OLLAMA_MAIN_MODEL`.
- **TypographyConfig**: The set of font, size, line-height, and spacing values that govern how text is rendered on the Canvas.
- **ReadingPosition**: The persistent record of a user's current chapter, scene, and scroll offset within a book.
- **SelectionRange**: A user-defined start and end point within the visible canvas text, produced by drag-to-highlight.

---

## Requirements

### Requirement 1: Book Typography

**User Story:** As a reader, I want the text to be formatted like a real book, so that reading on the canvas feels as comfortable and familiar as a Kindle or printed page.

#### Acceptance Criteria

1. THE Reader SHALL render body text using a serif font (Lora or Georgia fallback) at a configurable base size, with a line height of at least 1.5× the font size.
2. THE Reader SHALL render the first line of each paragraph with a first-line indent of at least 1.5em and no additional top margin between consecutive paragraphs.
3. THE Reader SHALL render the first paragraph after a chapter heading or scene break with no first-line indent (drop-cap or flush-left style).
4. THE Reader SHALL render chapter headings in a visually distinct style: larger font size (at least 1.6× body size), spaced-out letter-spacing, and centred horizontally within the text column.
5. THE Reader SHALL render scene break markers (blank-line clusters or `* * *` separators detected in the source text) as a centred ornamental separator glyph on the canvas.
6. WHEN the `TypographyConfig` changes (font size adjustment), THE Reader SHALL re-layout and re-render the current scene within one animation frame.
7. THE Reader SHALL constrain the text column to a maximum width of 680px on wide viewports to preserve comfortable line lengths.

---

### Requirement 2: Reader Controls — Font Size

**User Story:** As a reader, I want to increase or decrease the font size, so that I can adjust the text to my preferred reading comfort.

#### Acceptance Criteria

1. THE Reader SHALL provide increase-font and decrease-font controls accessible from the reader toolbar.
2. WHEN the increase-font control is activated, THE Reader SHALL increase the base font size by 2px, up to a maximum of 28px.
3. WHEN the decrease-font control is activated, THE Reader SHALL decrease the base font size by 2px, down to a minimum of 12px.
4. WHEN the font size changes, THE Reader SHALL persist the new size to `localStorage` under the key `liquidflow.fontSize`.
5. WHEN the Reader initialises, THE Reader SHALL restore the font size from `localStorage` if a stored value exists.

---

### Requirement 3: Reader Controls — In-Book Search

**User Story:** As a reader, I want to search for text within the current book, so that I can jump directly to a passage I'm looking for.

#### Acceptance Criteria

1. THE Reader SHALL provide a search control in the reader toolbar that opens a search input overlay.
2. WHEN the user submits a non-empty search query, THE Reader SHALL scan all scene texts in the current `BookManifest` for case-insensitive substring matches.
3. WHEN at least one match is found, THE Reader SHALL navigate to the first matching scene and highlight the matched substring on the canvas by rendering it in the accent colour.
4. WHEN no match is found, THE Reader SHALL display a "no results" message within the search overlay.
5. WHEN multiple matches exist, THE Reader SHALL provide next-match and previous-match controls that cycle through all matching scenes in order.
6. WHEN the search overlay is dismissed, THE Reader SHALL clear all search highlights and restore normal text rendering.
7. IF the search query is empty, THEN THE Reader SHALL display a validation hint and SHALL NOT initiate a search.

---

### Requirement 4: Reader Controls — Jump to Chapter

**User Story:** As a reader, I want to jump directly to a chapter by selecting it from a list, so that I can navigate the book without paging through every scene.

#### Acceptance Criteria

1. THE Reader SHALL provide a chapter-navigation control in the reader toolbar that opens a chapter list overlay.
2. THE Reader SHALL display all chapter titles from the current `BookManifest` in the chapter list, in order.
3. WHEN the user selects a chapter from the list, THE Reader SHALL navigate to the first scene of that chapter and reset the scroll offset to zero.
4. THE Reader SHALL indicate the currently active chapter in the chapter list with a visual highlight.
5. WHEN the chapter list overlay is open, THE Reader SHALL close it when the user taps or clicks outside the overlay or presses Escape.

---

### Requirement 5: Inline Animated Text Entities

**User Story:** As a reader, I want animated characters or symbols to swim through the page text, so that the reading experience feels alive and connected to the story's themes.

#### Acceptance Criteria

1. WHEN a scene is loaded, THE AnimationDriver SHALL spawn between one and three `InlineEntity` objects based on the scene's `entities` array from the `BookManifest`.
2. THE AnimationDriver SHALL animate each `InlineEntity` along a smooth path across the canvas, updating its position each animation frame.
3. WHEN an `InlineEntity` is present, THE Reader SHALL use `layoutNextLineRange` to narrow the available line width around the entity's bounding box, causing text to flow around it in real time.
4. THE Reader SHALL represent each `InlineEntity` visually as a short animated text string (e.g. the entity name rendered in a stylised font or as a glyph sequence) rather than a raster image.
5. THE AnimationDriver SHALL vary each `InlineEntity`'s speed and path based on the scene's `mood` field: slow and drifting for melancholic moods, fast and erratic for tense moods.
6. WHEN the user taps or clicks an `InlineEntity`, THE Reader SHALL open the `LookupCard` for that entity using its pre-scanned `EntityManifest` data without an AI call.
7. THE AnimationDriver SHALL remove all `InlineEntity` objects when the scene changes.

---

### Requirement 6: Scene Transition Animations

**User Story:** As a reader, I want full-screen animated text art to appear at chapter boundaries, so that scene transitions feel cinematic and thematically resonant.

#### Acceptance Criteria

1. WHEN the reader advances from the last scene of a chapter to the first scene of the next chapter, THE AnimationDriver SHALL trigger a `SceneTransition` animation.
2. THE AnimationDriver SHALL render the `SceneTransition` as a full-canvas animated composition using `pretext`-laid text, inspired by fluid-smoke or variable-typographic-ASCII styles.
3. THE AnimationDriver SHALL derive the visual content of the `SceneTransition` from the outgoing chapter's `visualPrompt` field stored in the `BookManifest`.
4. THE `SceneTransition` animation SHALL run for between 2 and 5 seconds before automatically advancing to the next scene.
5. WHEN the user taps or clicks the canvas during a `SceneTransition`, THE AnimationDriver SHALL immediately end the transition and display the next scene.
6. THE AnimationDriver SHALL NOT trigger a `SceneTransition` when navigating backwards through scenes.

---

### Requirement 7: AI-Driven Animation Metadata in the Pipeline

**User Story:** As a developer, I want the ingestion pipeline to produce richer AI annotations per scene, so that the reader has the data it needs to drive animations without making real-time AI calls for every scene load.

#### Acceptance Criteria

1. WHEN the Pipeline ingests a book, THE Pipeline SHALL annotate each scene with an `animationHints` object containing: `mood` (one word), `visualPrompt` (≤15 words), `entities` (array of up to five named strings), and `transitionStyle` (one of: `fluid-smoke`, `typographic-ascii`, `particle-drift`).
2. THE Pipeline SHALL store the `animationHints` object within each `BookScene` entry in the `BookManifest` JSON.
3. THE Pipeline SHALL use the `FastModel` Ollama model for scene annotation to minimise ingestion time.
4. IF the Ollama endpoint is unreachable during ingestion, THEN THE Pipeline SHALL write a default `animationHints` object (`mood: "neutral"`, `visualPrompt: "atmospheric literary scene"`, `entities: []`, `transitionStyle: "particle-drift"`) and SHALL log a warning without aborting ingestion.
5. THE Pipeline SHALL read the Ollama base URL and model names exclusively from environment variables; these values SHALL NOT be hardcoded.

---

### Requirement 8: Pre-Scanned Entity Lookup

**User Story:** As a reader, I want to tap a known character, place, or theme and instantly see a context card, so that I can get information without waiting for an AI response.

#### Acceptance Criteria

1. THE Reader SHALL detect a single tap or click on a canvas region that corresponds to a word matching an entry in the current scene's `entities` array.
2. WHEN a matching entity is tapped, THE Reader SHALL open the `LookupCard` within 100ms, populated with the entity name and a brief description sourced from the `EntityManifest` without an AI call.
3. THE `LookupCard` SHALL display the entity name, a one-sentence description (from the manifest), and the scene context sentence in which the entity appears.
4. THE `LookupCard` SHALL be dismissable by tapping outside it, pressing Escape, or tapping a close affordance on the card itself.
5. THE `LookupCard` SHALL be positioned near the tapped word without obscuring more than 40% of the canvas.
6. WHEN the `LookupCard` is open and the user scrolls the canvas, THE Reader SHALL reposition or dismiss the `LookupCard` to avoid stale positioning.

---

### Requirement 9: AI-Powered Arbitrary Text Lookup

**User Story:** As a reader, I want to drag to highlight any word or phrase and get an AI-powered explanation of its meaning in the context of the book, so that I can understand unfamiliar language or deepen my understanding of the text.

#### Acceptance Criteria

1. THE Reader SHALL detect a drag gesture on the canvas that defines a `SelectionRange` spanning one or more words.
2. WHEN a `SelectionRange` is completed, THE Reader SHALL render the selected text with a highlight overlay on the canvas and open the `LookupCard` in a loading state.
3. THE Reader SHALL send the selected text and the surrounding scene context (up to 400 characters) to the `MainModel` via Ollama to generate a contextual explanation.
4. WHEN the AI response is received, THE Reader SHALL populate the `LookupCard` with the explanation text, replacing the loading state.
5. IF the Ollama endpoint is unreachable, THEN THE Reader SHALL display a fallback message in the `LookupCard` indicating that AI lookup is unavailable.
6. THE Reader SHALL cancel any in-flight AI lookup request when the `LookupCard` is dismissed before the response arrives.
7. THE Reader SHALL use word-boundary detection via the `pretext` layout data to map canvas pixel coordinates to word boundaries when constructing the `SelectionRange`.

---

### Requirement 10: Elegant LookupCard Design

**User Story:** As a reader, I want the lookup card to be visually elegant and non-intrusive, so that it enhances rather than interrupts the reading experience.

#### Acceptance Criteria

1. THE `LookupCard` SHALL be rendered as a floating overlay element positioned above the canvas using CSS, not drawn on the canvas itself.
2. THE `LookupCard` SHALL use the existing dark amber design system (CSS variables from `style.css`) for colours, typography, and border treatment.
3. THE `LookupCard` SHALL animate in with a fade and subtle upward translate (≤150ms) and animate out with a fade (≤100ms).
4. THE `LookupCard` SHALL display a loading spinner while an AI response is pending.
5. THE `LookupCard` SHALL have a maximum width of 320px and a maximum height of 240px, with overflow scrollable.
6. THE `LookupCard` SHALL include a visible close affordance (×) in its top-right corner.

---

### Requirement 11: Tablet and Desktop Input Compatibility

**User Story:** As a reader using either a tablet or a desktop browser, I want all interactions to work correctly with my input method, so that the experience is equally good on both devices.

#### Acceptance Criteria

1. THE Reader SHALL handle both `touch` and `mouse` events for all interactive gestures: tap/click for entity lookup, drag for text selection, scroll for page navigation, and toolbar control activation.
2. WHEN a touch drag gesture is in progress, THE Reader SHALL call `preventDefault()` on the touch event to suppress native scroll interference.
3. THE Reader SHALL distinguish between a tap (duration < 200ms, movement < 10px) and a drag (movement ≥ 10px) to correctly route touch events to either entity lookup or text selection.
4. THE Reader SHALL support pinch-to-zoom on the canvas by adjusting the `TypographyConfig` font size within the defined min/max bounds.
5. THE Reader SHALL support keyboard navigation: ArrowRight/ArrowDown to advance scenes, ArrowLeft/ArrowUp to go back, Escape to dismiss overlays, and Ctrl+F (or Cmd+F) to open the search overlay.
6. THE Reader SHALL render the toolbar controls at a minimum touch target size of 44×44px on touch-capable devices.

---

### Requirement 12: Reading Position Persistence

**User Story:** As a reader, I want my reading position to be saved automatically, so that I can close the browser and return to exactly where I left off.

#### Acceptance Criteria

1. WHEN the reader advances to a new scene or scrolls within a scene, THE Reader SHALL persist the current `ReadingPosition` (book ID, chapter index, scene index, scroll offset) to `localStorage`.
2. WHEN a book is opened from the shelf, THE Reader SHALL restore the saved `ReadingPosition` for that book if one exists.
3. THE Reader SHALL debounce scroll-position persistence to at most once per 500ms to avoid excessive `localStorage` writes.
4. WHEN a book is opened for the first time (no saved position), THE Reader SHALL start at chapter 0, scene 0, scroll offset 0.

---

### Requirement 13: Pipeline — Extended Entity Manifest

**User Story:** As a developer, I want the pipeline to produce a richer entity manifest per book, so that the reader can show instant entity cards without AI calls.

#### Acceptance Criteria

1. WHEN the Pipeline ingests a book, THE Pipeline SHALL produce a top-level `entityManifest` array in the `BookManifest` containing one entry per unique named entity found across all scenes.
2. Each entry in the `entityManifest` SHALL contain: `name` (string), `type` (one of: `character`, `place`, `theme`), `description` (one sentence, ≤30 words), and `firstSeenScene` (scene ID string).
3. THE Pipeline SHALL use the `MainModel` to generate the `description` for each entity, using the scene text in which the entity first appears as context.
4. IF an entity name appears in more than one scene, THE Pipeline SHALL deduplicate it in the `entityManifest`, keeping the entry from the earliest scene.
5. THE Pipeline SHALL write the `entityManifest` as a top-level key in the `BookManifest` JSON alongside the `chapters` array.

---

### Requirement 14: Pretext Layout API Compliance

**User Story:** As a developer, I want all text rendering to use the `pretext` layout API correctly, so that variable-width line layout and animation obstacles work reliably.

#### Acceptance Criteria

1. THE Reader SHALL use `prepareWithSegments` to prepare scene text before layout, and SHALL cache the prepared result for the duration of the scene to avoid redundant preparation.
2. THE Reader SHALL use `layoutNextLineRange` with a per-line available width to lay out each line, passing the correct `LayoutCursor` from the previous call.
3. THE Reader SHALL use `materializeLineRange` to obtain the renderable string for each laid-out line before calling `ctx.fillText`.
4. WHEN an `InlineEntity` or orb obstacle is present, THE Reader SHALL compute the available line width by subtracting the obstacle's horizontal intrusion at each line's y-coordinate before calling `layoutNextLineRange`.
5. THE Reader SHALL store per-line layout results (x, y, width, text content, cursor range) in a frame-local array to enable word-coordinate lookup for tap detection and text selection.

---

### Requirement 15: Canvas Rendering Performance

**User Story:** As a reader, I want the canvas to render smoothly at 60fps even with animations active, so that the experience never feels janky.

#### Acceptance Criteria

1. THE Reader SHALL maintain a target frame rate of 60fps during normal reading and inline animation playback, measured as frame render time ≤ 16ms on a mid-range tablet.
2. THE Reader SHALL only re-render the canvas when state has changed (dirty-flag pattern), and SHALL NOT re-render on frames where no state has changed.
3. THE Reader SHALL cache `prepareWithSegments` results keyed by scene ID and font size, and SHALL NOT call `prepareWithSegments` more than once per unique (scene ID, font size) pair.
4. WHEN a `SceneTransition` animation is running, THE Reader SHALL render it in a separate canvas layer or composited draw pass so that the transition does not block the main text layout path.
5. THE Reader SHALL cancel any pending `requestAnimationFrame` callbacks when the reader view is closed or the book is changed.
