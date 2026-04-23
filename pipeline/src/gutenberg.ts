// ── Project Gutenberg fetcher & cleaner ──────────────────────────────────────

// Known Gutenberg plain-text URLs for our PoC books
export const GUTENBERG_BOOKS: Record<string, { url: string; title: string; author: string; emoji: string }> = {
  'time-machine': {
    url: 'https://www.gutenberg.org/cache/epub/35/pg35.txt',
    title: 'The Time Machine',
    author: 'H.G. Wells',
    emoji: '⏱'
  },
  'alice': {
    url: 'https://www.gutenberg.org/cache/epub/11/pg11.txt',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    emoji: '🐇'
  },
  'moby-dick': {
    url: 'https://www.gutenberg.org/cache/epub/2701/pg2701.txt',
    title: 'Moby-Dick',
    author: 'Herman Melville',
    emoji: '🐋'
  }
}

/** Fetch raw text from Gutenberg */
export async function fetchGutenbergText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
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
  // Match lines like "CHAPTER I", "Chapter 1", "CHAPTER ONE", "I.", "Part I" etc.
  const chapterRe = /^(chapter\s+[\divxlcIVXLC]+\.?|part\s+[\divxlcIVXLC]+\.?|[IVX]+\.\s)/im

  const lines = text.split('\n')
  const chapters: Array<{ title: string; body: string }> = []
  let currentTitle = 'Preface'
  let currentLines: string[] = []

  for (const line of lines) {
    if (chapterRe.test(line.trim()) && line.trim().length < 80) {
      if (currentLines.join('').trim().length > 100) {
        chapters.push({ title: currentTitle, body: currentLines.join('\n').trim() })
      }
      currentTitle = line.trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentLines.join('').trim().length > 100) {
    chapters.push({ title: currentTitle, body: currentLines.join('\n').trim() })
  }

  // Limit to first 8 chapters for PoC
  return chapters.slice(0, 8)
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
