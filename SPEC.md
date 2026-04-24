# LiquidFlow Specification

## Project Overview
**LiquidFlow** (Kindle Plus) is a premium, "canvas-first" reading platform that transforms static ebooks into animated, interactive experiences using `@chenglou/pretext` for text layout and HTML5 Canvas for rendering.

---

## Implemented Features

### 1. Core Reader
- **Canvas-based typography** using `@chenglou/pretext` with 60fps rendering
- **Scene-based navigation** - books split into scenes (~400 words)
- **Smooth scrolling** with scrollOffset tracking
- **Auto-chapter navigation** - scrolls past content to advance to next scene/chapter

### 2. UI/Controls
- **Interactive scrubber** - bottom progress bar for chapter jumping
- **Font controls** - A− / Reset (⟲) / A+ buttons
- **Theme toggle** - dark/light/sepia modes
- **Chapter navigation sidebar** - right-side panel (desktop 900px+)
- **Toolbar arrows** (‹ ›) - previous/next chapter in center strip

### 3. Visual Effects
- **ASCII Illustrations** - animated via AsciiVisualizer (pulse, shine, ripple effects)
- **Entity highlighting** - characters/places in text highlighted with accent glow
- **Dialogue styling** - quoted text rendered in bold with accent color
- **Scene breaks** - decorative ornament (· · ·)

### 4. Library/Shelf
- **Book grid display** - tiled cards with hover effects
- **Book management** - regenerate/delete via menu (⋮)
- **Menu fix** - only one menu open at a time

### 5. Interaction
- **Selection handles** - draggable text selection
- **Selection menu** - Query AI / Copy options
- **Entity lookups** - tap highlighted entities for descriptions
- **LLM lookups** - Ollama integration with retry logic

### 6. Pipeline/Ingestion
- **Project Gutenberg** integration
- **AI annotation** - mood, visualPrompt, entities via Ollama
- **ASCII generation**:
  - From image files in `temp/` folder
  - From Unsplash search (visualPrompt keyword)
  - Procedural fallback based on mood
- **Entity manifest** - extracted characters/places with AI descriptions

---

## Technical Architecture

### File Structure
```
pipeline/          → Ingestion + AI annotation (Node.js)
reader/            → Canvas rendering (TypeScript + Vite)
public/books/       → Static JSON manifests
.antigravity/       → Long-term memory (LTM)
```

### Key Files
| File | Purpose |
|------|---------|
| `reader/src/renderer.ts` | Core Canvas rendering engine |
| `reader/src/AsciiVisualizer.ts` | Animated ASCII particle system |
| `reader/src/main.ts` | Reader application logic |
| `reader/src/toolbar.ts` | Toolbar UI |
| `reader/src/shelf.ts` | Library grid |
| `reader/vite.config.ts` | Dev server + Management middleware |
| `pipeline/src/ingest.ts` | Book ingestion CLI |
| `pipeline/src/ai.ts` | Ollama annotation |
| `pipeline/src/image-fetcher.ts` | Image fetching & ASCII conversion |

---

## Future Enhancements (Ideas)

### Visual
- **Chapter decorations** - ASCII banners at chapter starts
- **Drop caps** - large first letter of chapters
- **Mood-based backgrounds** - dynamic canvas gradients
- **Fluid smoke transitions** - scene change animations
- **Running characters** - ASCII art moving through text (like the dragon example)

### Interaction  
- **Draggable selection handles** - resize selection after initial drag
- **Character voices** - TTS integration

### Data
- **Persistent storage** - IndexedDB for highlights/annotations
- **Lore book** - entity relationship visualization
- **Reading progress sync** - cloud/import/export

---

## Commands

```bash
# Start reader dev server
cd reader && npm run dev

# Build for production
cd reader && npm run build

# Run ingestion pipeline
cd pipeline && npm run ingest -- <book-id>

# Available books
time-machine, alice, moby-dick
```

---

## Dependencies

- **@chenglou/pretext** - Text layout engine
- **Ollama** - Local LLM (llama3 for lookups, granite4:3b for fast annotation)
- **Jimp** - Image processing in pipeline

---

## Configuration

### Theme Colors (layout-cache.ts)
```typescript
{
  dark: { bg: '#0e0d0b', text: '#e8e0d0', accent: '#c8922a', accent_glow: 'rgba(200,146,42,0.6)' },
  light: { bg: '#fcfaf7', text: '#1a1816', accent: '#8c6418', accent_glow: 'rgba(140,100,24,0.5)' },
  sepia: { bg: '#f4ecd8', text: '#433422', accent: '#965e2b', accent_glow: 'rgba(150,94,43,0.5)' }
}
```

### Font Settings
- Default font size: 18px
- Min: 12px, Max: 48px
- Font: Lora, Georgia, serif

---

## External Resources Referenced

- [@chenglou/pretext](https://github.com/chenglou/pretext) - Text layout library
- [sepandhaghighi/art](https://github.com/sepandhaghighi/art) - ASCII art Python library
- [pixlrt](https://github.com/kacheo/pixlrt) - TypeScript pixel art
- [ascii-generator](https://github.com/viktorHadz/ascii-generator) - Image to ASCII
- [go-figure](https://github.com/common-nighthawk/go-figure) - Go ASCII generator
- [elite AI tools](https://eliteai.tools/agent-skills/ascii-pixel-art) - ASCII pixel art skill

---

## Notes

- Build passes with TypeScript strict mode
- Reader uses RAF loop for animations (not DOM updates)
- Layout cache keyed by `${sceneId}:${fontSize}`
- LLM queries include retry logic (30s first attempt, 45s retry)
- Auto-chapter navigation requires scrolling past content + 1 line height

---

*Generated: 2026-04-24*