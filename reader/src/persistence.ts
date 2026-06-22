import type { ReadingPosition, TtsSettings } from './types'

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

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  voiceURI: '',
  rate: 1,
  pitch: 1,
  autoRead: false
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(n)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export function saveTtsSettings(settings: TtsSettings): void {
  localStorage.setItem('liquidflow.tts', JSON.stringify(settings))
}

export function loadTtsSettings(): TtsSettings {
  try {
    const raw = localStorage.getItem('liquidflow.tts')
    if (raw === null) return DEFAULT_TTS_SETTINGS
    const parsed = JSON.parse(raw) as Partial<TtsSettings>
    return {
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : '',
      rate: clamp(parsed.rate, 0.5, 2, DEFAULT_TTS_SETTINGS.rate),
      pitch: clamp(parsed.pitch, 0.5, 2, DEFAULT_TTS_SETTINGS.pitch),
      autoRead: parsed.autoRead === true
    }
  } catch {
    return DEFAULT_TTS_SETTINGS
  }
}
