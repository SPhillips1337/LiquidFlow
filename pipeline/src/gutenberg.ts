// ── Project Gutenberg fetcher & cleaner ──────────────────────────────────────

// Known Gutenberg plain-text URLs for our PoC books
export const GUTENBERG_BOOKS: Record<string, { url: string; title: string; author: string; emoji: string; theme?: string }> = {
  'time-machine': {
    url: 'https://www.gutenberg.org/cache/epub/35/pg35.txt',
    title: 'The Time Machine',
    author: 'H.G. Wells',
    emoji: '⏱',
    theme: 'dark'
  },
  'alice': {
    url: 'https://www.gutenberg.org/cache/epub/11/pg11.txt',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    emoji: '🐇',
    theme: 'sepia'
  },
  'moby-dick': {
    url: 'https://www.gutenberg.org/cache/epub/2701/pg2701.txt',
    title: 'Moby-Dick',
    author: 'Herman Melville',
    emoji: '🐋',
    theme: 'dark'
  }
}

function fetchWithTimeout(url: string, timeoutMs = 30000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'LiquidFlow/0.3 (ebook reader)' }
    }).then(res => {
      clearTimeout(timer)
      resolve(res)
    }).catch(err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

/** Fetch raw text from Gutenberg */
export async function fetchGutenbergText(url: string): Promise<string> {
  // Extract book ID for fallback URLs
  const bookId = url.match(/(?:ebooks\/|epub\/)(\d+)/)?.[1] || ''
  const attempts = [
    url,
    ...(bookId ? [
      `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
      `https://www.gutenberg.org/ebooks/${bookId}.txt.utf-8`,
    ] : []),
  ]

  for (const attempt of [...new Set(attempts)]) {
    try {
      const res = await fetchWithTimeout(attempt, 15000)
      if (res.ok) return res.text()
    } catch {
      // Try next URL
    }
  }

  throw new Error(`Failed to fetch Gutenberg text from any mirror for: ${url}`)
}

/** Strip Gutenberg boilerplate header and footer */
export function stripBoilerplate(raw: string): string {
  // Header ends at the first occurrence of "*** START OF"
  const startMarker = /\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG/i
  const endMarker   = /\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i

  const startMatch = startMarker.exec(raw)
  const endMatch   = endMarker.exec(raw)

  let text = raw
  if (startMatch) {
    // Skip to end of that line
    const lineEnd = raw.indexOf('\n', startMatch.index)
    text = text.slice(lineEnd + 1)
  }
  if (endMatch) {
    const relIdx = endMatch.index - (startMatch ? raw.indexOf('\n', startMatch.index) + 1 : 0)
    text = text.slice(0, relIdx)
  }

  return text.trim()
}

/** Split text into chapters using common Gutenberg chapter headings */
export function splitChapters(text: string): Array<{ title: string; body: string }> {
  const lines = text.split('\n')

  const isHeading = (line: string): boolean => {
    const t = line.trim()
    if (!t || t.length > 80) return false

    // "Chapter 1", "CHAPTER I", "Chapter One", "Section 1", "Section I"
    if (/^(?:chapter|section)\s+\S+/i.test(t)) return true
    // "Part I", "Part 1" (not "part of" or "part instead")
    if (/^part\s+(?:\d+|[IVXLCDM]+)\b/i.test(t)) return true
    // "Letter 1", "Letter 2" (digits only — avoids "letter had")
    if (/^letter\s+\d+/i.test(t)) return true

    // Bare roman numeral on its own line: "I.", "II.", "XXIV."
    if (/^[IVXLCDM]+\.?$/.test(t)) return true

    // All-caps title (5+ chars, starts with uppercase letter):
    // "STORY OF THE DOOR", "DR. JEKYLL'S NARRATIVE"
    if (t.length >= 5 && /^[A-Z\u00C0-\u00D6]/.test(t) && t === t.toUpperCase()) return true

    return false
  }

  // ── Pass 1: Skip the Table of Contents ──────────────────────────────────
  // Find the first heading that is followed by substantial body text.
  // Everything before it is front matter / TOC and goes into "Preface".
  let firstRealIdx = -1
  for (let i = 0; i < Math.min(lines.length, 400); i++) {
    if (!isHeading(lines[i])) continue

    let bodyChars = 0
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      if (isHeading(lines[j])) break
      bodyChars += lines[j].trim().length
      if (bodyChars > 300) break
    }

    if (bodyChars > 300) {
      firstRealIdx = i
      break
    }
  }

  // Fallback: no real heading found — use first heading at all, or whole book
  if (firstRealIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (isHeading(lines[i])) { firstRealIdx = i; break }
    }
  }
  if (firstRealIdx === -1) {
    return [{ title: 'Preface', body: text.trim() }]
  }

  // ── Pass 2: Split from first real heading onward ────────────────────────
  const chapters: Array<{ title: string; body: string }> = []
  let currentTitle = 'Preface'
  let currentLines: string[] = []

  // Everything before the first real chapter is front matter (Preface)
  for (let i = 0; i < firstRealIdx; i++) currentLines.push(lines[i])

  for (let i = firstRealIdx; i < lines.length; i++) {
    if (isHeading(lines[i])) {
      if (currentLines.join('').trim().length > 100) {
        chapters.push({ title: currentTitle, body: currentLines.join('\n').trim() })
      }
      currentTitle = lines[i].trim()
      currentLines = []
    } else {
      currentLines.push(lines[i])
    }
  }

  if (currentLines.join('').trim().length > 100) {
    chapters.push({ title: currentTitle, body: currentLines.join('\n').trim() })
  }

  return chapters
}

/** Split a chapter body into scenes (paragraph clusters of ~400 words) */
export function splitScenes(body: string, targetWords = 400): string[] {
  const paragraphs = body.split(/\n{2,}/).filter(p => p.trim().length > 20)
  const scenes: string[] = []
  let current: string[] = []
  let wordCount = 0

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length
    current.push(para.trim())
    wordCount += words

    if (wordCount >= targetWords) {
      scenes.push(current.join('\n\n'))
      current = []
      wordCount = 0
    }
  }

  if (current.length > 0) scenes.push(current.join('\n\n'))
  return scenes
}
