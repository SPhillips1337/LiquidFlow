// ── Shared types for LiquidFlow reader ──────────────────────────────────────

export interface BookScene {
  id: string
  text: string
  mood: string          // e.g. "tense", "melancholic", "wonder"
  visualPrompt: string  // for ASCII art generation
  entities: string[]    // character/place names for marginalia tap
}

export interface BookChapter {
  title: string
  scenes: BookScene[]
}

export interface BookManifest {
  id: string
  title: string
  author: string
  emoji: string
  chapters: BookChapter[]
}

export interface OrbState {
  x: number
  y: number
  radius: number
  dragging: boolean
}

export interface RenderState {
  manifest: BookManifest
  chapterIndex: number
  sceneIndex: number
  scrollOffset: number   // px scrolled within current scene
  orb: OrbState
  asciiVisible: boolean
}
