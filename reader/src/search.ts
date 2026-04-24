import type { BookManifest, SearchMatch, SearchState } from './types'

export function searchBook(manifest: BookManifest, query: string): SearchState {
  const trimmed = query.trim()
  if (!trimmed) {
    return { query, matches: [], currentIndex: 0 }
  }

  const lower = trimmed.toLowerCase()
  const matches: SearchMatch[] = []

  for (let ci = 0; ci < manifest.chapters.length; ci++) {
    const chapter = manifest.chapters[ci]
    for (let si = 0; si < chapter.scenes.length; si++) {
      const text = chapter.scenes[si].text
      const lowerText = text.toLowerCase()
      let offset = 0
      while (true) {
        const idx = lowerText.indexOf(lower, offset)
        if (idx === -1) break
        matches.push({ chapterIndex: ci, sceneIndex: si, charOffset: idx, length: lower.length })
        offset = idx + 1
      }
    }
  }

  return { query, matches, currentIndex: 0 }
}

export function nextMatch(state: SearchState): SearchState {
  if (state.matches.length === 0) return state
  return {
    ...state,
    currentIndex: (state.currentIndex + 1) % state.matches.length,
  }
}

export function prevMatch(state: SearchState): SearchState {
  if (state.matches.length === 0) return state
  return {
    ...state,
    currentIndex: (state.currentIndex - 1 + state.matches.length) % state.matches.length,
  }
}

export function emptySearchState(): SearchState {
  return { query: '', matches: [], currentIndex: 0 }
}
