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
public/books/       → Static JSON manifests
```

**Key Technologies**:
- `@chenglou/pretext` - Text layout engine
- Ollama (llama3) - AI for lookups and ingestion annotation
- HTML5 Canvas - 60fps rendering

---

## 🎯 Current Goals

From `project.json` (status: demo_ready, 75% complete):

1. **Implement Fluid Smoke Transition** - pending, medium priority
2. **Add SQLite/IndexedDB persistence for highlights** - pending, high priority
3. **Mobile precision tuning for selection handles** - pending, low priority

---

## ⚠️ Known Patterns & Risks

### Lessons Learned
- **FAILURE**: During Kindle Plus redesign, `renderer.ts` was rewritten but `main.ts` wasn't updated together → build broken. **Solution**: Always update shell and core modules in same task (vertical slice).

- **SUCCESS**: Decoupled pipeline from reader using static JSON manifests (AOT AI annotation).

- **SUCCESS**: Font-keyed layout cache (`${sceneId}:${fontSize}`) eliminates re-layout during animation.

### Critical Files
- `reader/src/renderer.ts` - Core Canvas rendering engine (60fps target)
- `reader/src/AsciiVisualizer.ts` - Animated ASCII particle system
- `reader/vite.config.ts` - Dev server + Management middleware

---

## 🛠 Commands

```bash
npm run dev        # Start reader dev server
npm run build      # Build for production
npm run pipeline  # Run ingestion (see pipeline/README.md)
```

---

## 📋 Status

- **Version**: 0.2.0
- **Last Updated**: 2026-04-24
- **Features**: Interactive scrubber, Ollama proxy (60s timeout), selection handles, book management, ASCII illustrations, editorial glow