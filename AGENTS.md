# LiquidFlow: AGENTS.md

**Project**: LiquidFlow (Kindle Plus) - Premium canvas-first reading platform

---

## 📂 Memory & Context

**Long-Term Memory (LTM) Location**: `.antigravity/memories/`

- `codebase_insights/liquidflow_architecture.md` - Project overview and component separation
- `architectural_decisions/pretext_canvas_rendering.md` - Rendering technology decision
- `architectural_decisions/kindle_plus_redesign.md` - Current redesign status
- `patterns_and_lessons.md` - Lessons learned (including failure cases)

---

## 🏗 Architecture

```
pipeline/          → Ingestion + AI annotation (Node.js)
reader/            → Canvas rendering (TypeScript + Vite)
public/books/      → Static JSON manifests
```

**Key Technologies**:
- `@chenglou/pretext` - Text layout engine
- Ollama (llama3, granite4:3b) - AI for lookups and ingestion
- Jimp - Image processing
- HTML5 Canvas - 60fps rendering

---

## 🎯 Current Goals

From `project.json` (status: demo_ready, 95% complete):

1. **IndexedDB persistence for highlights** - pending, high priority
2. **Chapter decorations (ASCII banners)** - pending, medium
3. **Fluid Smoke Transition** - pending, medium
4. **Drop caps styling** - pending, low

---

## ⚠️ Known Patterns & Risks

### Lessons Learned
- **FAILURE**: `renderer.ts` rewritten but `main.ts` not updated together → build broken. **Solution**: Vertical slices.
- **FAILURE**: Renderer.ts file truncation during edits. **Solution**: Use git checkout to recover immediately.
- **SUCCESS**: Decoupled pipeline/reader with static manifests (AOT AI annotation).
- **SUCCESS**: Font-keyed layout cache (`${sceneId}:${fontSize}`).
- **SUCCESS**: Auto-nav needs padding (scroll past content + 1 line).
- **SUCCESS**: Menu state must be tracked (not global window listeners).

### Critical Files
- `reader/src/renderer.ts` - Core Canvas rendering (60fps)
- `reader/src/AsciiVisualizer.ts` - Animated ASCII particles
- `reader/src/main.ts` - App logic & auto-navigation
- `pipeline/src/ingest.ts` - Ingestion CLI

---

## 🛠 Commands

```bash
cd reader && npm run dev      # Start reader dev server
cd reader && npm run build    # Build for production
cd pipeline && npm run ingest -- alice  # Ingest book
```

---

## 📋 Status

- **Version**: 0.2.0
- **Progress**: 95% (Feature Complete)
- **Last Updated**: 2026-04-24

**Features**: Canvas typography, auto-chapter nav, scrubber, font controls, theme toggle, dialogue styling, entity highlighting, ASCII illustrations (animated), mood-based procedural ASCII, Unsplash image fetcher, chapter sidebar, LLM retry logic, book management