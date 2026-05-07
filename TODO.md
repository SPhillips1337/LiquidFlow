# LiquidFlow TODO

## Outstanding Tasks

### 1. AI Illustrations (ASCII/Pixel Art)
- [x] Generate ASCII/Pixel art illustrations based on book themes/topics
- [x] Add procedural generation (mood-based: tense/melancholic/wonder/ominous/joyful)
- [x] Image fetcher from Unsplash API (via visualPrompt keyword)
- [x] Animate illustrations using AsciiVisualizer (pulse, shine, ripple effects)
- [x] Theme-aware colors (dark/light/sepia)

### 2. UI - Scroll & Navigation
- [x] Bottom progress scrubber
- [x] Vertical chapter navigation sidebar (desktop 900px+)
- [x] Font reset button (⟲)
- [x] Chapter nav arrows (‹ ›) in toolbar
- [x] Auto-chapter navigation on scroll past content

### 3. Library - Book Display & Menu
- [x] Fix menu showing open for all books on load (proper state tracking)
- [x] Tiled card layout with hover effects
- [x] Book management (regenerate/delete)

### 4. Text Styling Enhancements
- [x] Entity highlighting with theme-aware accent_glow
- [x] Dialogue styling (quoted text in bold accent)
- [x] Scene break decorations

### 5. Selection & LLM Query
- [x] Fix LLM timeout (added retry logic)
- [x] Selection handles at start/end
- [x] Selection menu with Query AI / Copy

---

## Future Ideas (Not Started)
- [ ] Chapter decorations (ASCII banners)
- [ ] Drop caps (large first letter)
- [ ] Fluid smoke transitions
- [ ] Persistent storage (IndexedDB)
- [ ] Draggable selection handles resize

---

## Completed (from project.json)
- [x] Interactive Scrubber
- [x] Ollama Proxy with 60s stability
- [x] Selection Handles & Context Menu
- [x] Book Management (Regenerate/Delete)
- [x] Theme-aware Editorial Glow
- [x] March Hare ASCII Illustration
- [x] Library Dashboard
- [x] Auto-chapter navigation

---

## Recently Added

### AI Companion Panel
- [x] **Summarize** — Ollama generates chapter thesis, key ideas, takeaways
- [x] **Study Guide** — Per-chapter deep read (main argument, quote, question)
- [x] **Quiz Me** — AI-generated 5-question quiz (factual + conceptual + applied)
- [x] **Notes** — AI-extracted quotes, frameworks, tags saved to localStorage
- [x] **Saved Notes** — Browse all extracted notes by chapter
- [x] **Read Aloud** — Browser SpeechSynthesis TTS with 0.5x–2x speed control

### Infrastructure
- [x] **openai-compatible backend** — LM Studio / OpenAI endpoint support via `VITE_AI_FORMAT`
- [x] **Entity animation disabled** — Removed `spawnEntities()` calls to fix text wobble on chapter open