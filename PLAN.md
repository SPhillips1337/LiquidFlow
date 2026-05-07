# LiquidFlow: ai enhanced ebook reader Project Status & Roadmap
**Handover Document for AI Systems**

---

## 📖 Project Overview
LiquidFlow is a premium, "Canvas-First" reading application that transforms static ebooks into animated, interactive experiences. It uses `@chenglou/pretext` for text layout and HTML5 Canvas for 60fps rendering.

---

## ✅ Completed Features

### 1. Core Reader & Rendering
- **Canvas-based typography** using `@chenglou/pretext`
- **Scene-based navigation** with auto-chapter on scroll
- **Smooth scrolling** with scrollOffset tracking

### 2. UI/Controls
- **Toolbar**: Font A− / Reset (⟲) / A+, theme toggle, search, chapters
- **Interactive scrubber** - bottom progress bar
- **Chapter navigation sidebar** (desktop 900px+)
- **Toolbar arrows** (‹ ›) for prev/next chapter
- **Auto-chapter navigation** - scroll past content to advance

### 3. Visual Effects
- **Animated ASCII Illustrations** via AsciiVisualizer
  - Sine-wave breathing, diagonal shines, hover ripples
- **Entity highlighting** with theme-aware accent_glow styling
- **Dialogue styling** - quoted text in bold accent color
- **Scene break ornaments** (· · ·)
- **Mood-based procedural ASCII** generation
- **Image fetcher** from Unsplash (via visualPrompt)

### 4. Intelligence Layer
- **Ollama Proxy** - `/api/ollama` → `127.0.0.1:11434`
- **Retry logic** for LLM queries (30s first, 45s retry)
- **Selection menu** for Query AI / Copy
- **Entity manifest** with AI-generated descriptions

### 5. Library/Shelf
- **Tiled book cards** with hover effects
- **Book management** - regenerate/delete via menu
- **Menu fix** - correct state tracking (only one open at a time)

---

## 🚀 Roadmap

### Phase 3: Visual Polish
- **Chapter decorations** - ASCII banners at chapter start
- **Drop caps** - large first letter of chapters
- **Running characters** - animated ASCII art through text
- **Fluid smoke transitions** - scene change animations
- **Mood-based backgrounds** - dynamic gradients

### Phase 4: Audio & Accessibility
- **Text-to-Speech** - Ollama or edge-TTS integration
- **Better aria labels** for screen readers

### Phase 5: Data Persistence
- **IndexedDB storage** for highlights/annotations
- **Reading progress** sync
- **Lore book** - entity relationship visualization

### Phase 6: Interaction Refinements
- **Draggable selection handles** - resize after initial selection
- **Character voices** - TTS voice per character

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| Core | TypeScript, Vite |
| Rendering | HTML5 Canvas (60fps) |
| Text Layout | `@chenglou/pretext` |
| AI | Ollama (llama3, granite4:3b) |
| Images | Jimp, Unsplash API |
| Styling | Vanilla CSS, CSS Variables |

---

## 📂 Key Files

```
reader/
├── src/
│   ├── renderer.ts       # Core Canvas rendering
│   ├── AsciiVisualizer.ts # Animated ASCII particles
│   ├── main.ts          # Application logic
│   ├── toolbar.ts      # Toolbar UI
│   ├── shelf.ts        # Library grid
│   └── layout-cache.ts # Typography config & themes
├── vite.config.ts       # Dev server + management middleware
└── public/books/        # JSON manifests

pipeline/
├── src/
│   ├── ingest.ts       # Ingestion CLI
│   ├── ai.ts           # Ollama annotation
│   ├── image-fetcher.ts # Image to ASCII conversion
│   └── ascii.ts        # Procedural ASCII generation
```

---

## 🎯 Current Status

- **Progress**: 95% (Feature Complete)
- **Version**: 0.2.0
- **Features**: Demo-ready with library, reader, AI lookups, ASCII illustrations, auto-nav

---

## 💡 Tips for Next Developer

1. **60fps target** - All rendering in canvas, avoid DOM updates for visuals
2. **Layout cache** - Keyed by `${sceneId}:${fontSize}`
3. **Vertical slices** - Update shell and core modules together (prevents build breakage)
4. **Auto-nav padding** - Need scroll past content + 1 line to trigger (lets users read end)

**To the next developer**: Focus on visual effects and persistence. The core reader is solid.

---

*Updated: 2026-04-24*