// ── Shared types for Kindle Plus reader ─────────────────────────────────────

// Re-export LayoutCursor from pretext so other modules only need to import from './types'
import type { LayoutCursor } from '@chenglou/pretext'
export type { LayoutCursor }

export interface AsciiAsset {
  charGrid: string[][]
  colorGrid: string[][]
  subjectMask: boolean[][]
  width: number
  height: number
}

// Animation hints stored per scene by the pipeline
export interface AnimationHints {
  mood: string  // one word: "tense" | "melancholic" | "wonder" | "ominous" | "joyful" | "neutral"
  visualPrompt: string  // ≤15 words for transition art
  entities: string[]   // up to 5 named strings
  transitionStyle: 'fluid-smoke' | 'typographic-ascii' | 'particle-drift'
}

// A scene is a paragraph cluster (~400 words)
export interface BookScene {
  id: string
  text: string
  // Legacy fields kept for backward compat with old manifests:
  mood: string
  visualPrompt: string
  entities: string[]
  // New:
  animationHints: AnimationHints
  illustration?: AsciiAsset
}

export interface BookChapter {
  title: string
  scenes: BookScene[]
}

// One entry in the top-level entity manifest
export interface EntityEntry {
  name: string
  type: 'character' | 'place' | 'theme'
  description: string   // ≤30 words, one sentence
  firstSeenScene: string  // scene ID
}

export interface BookManifest {
  id: string
  title: string
  author: string
  emoji: string
  chapters: BookChapter[]
  entityManifest: EntityEntry[]  // top-level, may be empty array for old manifests
}

export type ReaderTheme = 'dark' | 'light' | 'sepia'

export interface ThemeColors {
  bg: string
  text: string
  accent: string
  muted: string
  glow: string
  selection: string
  accent_glow: string
}

// Typography configuration derived from font size + canvas width
export interface TypographyConfig {
  fontSize: number        // 12–28, default 18
  lineHeight: number      // fontSize * 1.6
  paddingX: number        // 48px or (canvasW - 680) / 2 when wide
  paddingTop: number      // 32px
  maxColumnWidth: number  // 680px
  font: string            // e.g. "18px Lora, Georgia, serif"
  headingFont: string     // e.g. "bold 29px Lora, Georgia, serif"
  theme: ReaderTheme
  colors: ThemeColors
}

// A laid-out line with word-level hit boxes
export interface WordBound {
  word: string
  x: number   // relative to line.x
  w: number
  offset: number // char offset within scene text
}

export interface LayoutLine {
  x: number
  y: number           // top of line in content space (not screen space)
  w: number           // available width used for this line
  text: string        // materialized string
  startCursor: LayoutCursor
  endCursor: LayoutCursor
  words: WordBound[]  // word-level hit boxes within this line
  paragraphStart: boolean  // true if this is the first line of a paragraph
}

// An animated entity that swims through the text
export interface InlineEntity {
  id: string
  name: string          // entity name string, rendered as text
  x: number             // current canvas x (logical px)
  y: number             // current canvas y (logical px)
  vx: number            // velocity x px/frame
  vy: number            // velocity y px/frame
  width: number         // measured via ctx.measureText
  height: number        // = lineHeight
  phase: number         // oscillation phase for sinusoidal path
  mood: string          // inherited from scene
}

// Scene transition animation state
export interface TransitionState {
  style: 'fluid-smoke' | 'typographic-ascii' | 'particle-drift'
  visualPrompt: string
  progress: number      // 0–1
  duration: number      // ms, 2000–5000
  startTime: number     // performance.now() at trigger
}

// Text selection state for drag-to-highlight
export interface SelectionState {
  startLine: number    // index into currentLines
  startWordIdx: number
  endLine: number
  endWordIdx: number
}

// Search result
export interface SearchMatch {
  chapterIndex: number
  sceneIndex: number
  charOffset: number   // byte offset within scene text
  length: number
}

export interface SearchState {
  query: string
  matches: SearchMatch[]
  currentIndex: number
}

// Persisted reading position
export interface ReadingPosition {
  bookId: string
  chapterIndex: number
  sceneIndex: number
  scrollOffset: number
}
