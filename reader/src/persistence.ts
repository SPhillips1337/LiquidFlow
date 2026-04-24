import type { ReadingPosition } from './types'

// Per-bookId debounce timers so different books don't interfere
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function savePosition(pos: ReadingPosition): void {
  const key = `liquidflow.position.${pos.bookId}`
  const existing = debounceTimers.get(pos.bookId)
  if (existing !== undefined) clearTimeout(existing)
  const timer = setTimeout(() => {
    localStorage.setItem(key, JSON.stringify(pos))
    debounceTimers.delete(pos.bookId)
  }, 500)
  debounceTimers.set(pos.bookId, timer)
}

export function loadPosition(bookId: string): ReadingPosition | null {
  try {
    const raw = localStorage.getItem(`liquidflow.position.${bookId}`)
    if (raw === null) return null
    return JSON.parse(raw) as ReadingPosition
  } catch {
    return null
  }
}

export function saveFontSize(size: number): void {
  localStorage.setItem('liquidflow.fontSize', String(size))
}

export const DEFAULT_FONT_SIZE = 18

export function loadFontSize(): number {
  const raw = localStorage.getItem('liquidflow.fontSize')
  if (raw === null) return DEFAULT_FONT_SIZE
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE
}

export function saveTheme(theme: string): void {
  localStorage.setItem('liquidflow.theme', theme)
}

export function loadTheme(): 'dark' | 'light' | 'sepia' {
  const raw = localStorage.getItem('liquidflow.theme')
  if (raw === 'dark' || raw === 'light' || raw === 'sepia') return raw
  return 'dark'
}
