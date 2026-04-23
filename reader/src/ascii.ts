// ── Typographic ASCII Art ────────────────────────────────────────────────────
// Two modes:
//   1. "word-density" — uses words from the book text as pixels (the Twitter magic)
//   2. "ai-generated" — raw ASCII from Ollama, displayed in the side panel

import { generateAsciiDescription } from './ai'

/**
 * Mode 1: Render a grayscale image-like composition using words from the text.
 * The "density" of each character maps to brightness — denser chars = darker.
 * We tile the book's own words across the composition.
 */
export function buildWordDensityAscii(
  words: string[],
  width: number,   // chars wide
  height: number,  // lines tall
  densityMap: number[][]  // 0..1 per cell, 0=light 1=dark
): string {
  const DENSITY_CHARS = ' ·.:;+*#@█'
  let wordIdx = 0
  const lines: string[] = []

  for (let row = 0; row < height; row++) {
    let line = ''
    for (let col = 0; col < width; col++) {
      const d = densityMap[row]?.[col] ?? 0
      const charIdx = Math.floor(d * (DENSITY_CHARS.length - 1))
      const densityChar = DENSITY_CHARS[charIdx]

      // For mid-density cells, use a word character instead of a symbol
      if (d > 0.2 && d < 0.85 && words.length > 0) {
        const word = words[wordIdx % words.length]
        const ch = word[col % word.length] ?? densityChar
        line += ch
        wordIdx++
      } else {
        line += densityChar
      }
    }
    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Generate a simple radial density map — used as a placeholder until
 * a real image-based map is available.
 */
export function radialDensityMap(
  width: number,
  height: number,
  cx: number = 0.5,
  cy: number = 0.4
): number[][] {
  const map: number[][] = []
  for (let r = 0; r < height; r++) {
    const row: number[] = []
    for (let c = 0; c < width; c++) {
      const dx = c / width - cx
      const dy = r / height - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      // Invert: centre is dark (dense), edges are light
      row.push(Math.max(0, 1 - dist * 2.2))
    }
    map.push(row)
  }
  return map
}

/**
 * Mode 2: Fetch AI-generated ASCII from Ollama and return it.
 * Cached per visualPrompt to avoid redundant calls.
 */
const asciiCache = new Map<string, string>()

export async function fetchAiAscii(
  visualPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  if (asciiCache.has(visualPrompt)) return asciiCache.get(visualPrompt)!

  try {
    const art = await generateAsciiDescription(visualPrompt, signal)
    asciiCache.set(visualPrompt, art)
    return art
  } catch {
    // Fallback: word-density placeholder
    const fallback = buildWordDensityAscii(
      visualPrompt.split(' '),
      40, 10,
      radialDensityMap(40, 10)
    )
    asciiCache.set(visualPrompt, fallback)
    return fallback
  }
}

/** Extract words from text for word-density mode */
export function extractWords(text: string): string[] {
  return text.match(/\b[a-zA-Z]{3,}\b/g) ?? []
}
