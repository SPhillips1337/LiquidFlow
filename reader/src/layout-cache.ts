import type { PreparedTextWithSegments } from '@chenglou/pretext'
import type { LayoutLine, TypographyConfig } from './types'

type CacheKey = string  // `${sceneId}:${fontSize}`

export const THEMES: Record<string, any> = {
  dark: {
    bg: '#0e0d0b',
    text: '#e8e0d0',
    accent: '#c8922a',
    muted: '#4a4540',
    glow: 'rgba(200,146,42,0.4)',
    selection: 'rgba(200,146,42,0.2)',
    accent_glow: 'rgba(200,146,42,0.6)'
  },
  light: {
    bg: '#fcfaf7',
    text: '#1a1816',
    accent: '#8c6418',
    muted: '#a8a098',
    glow: 'rgba(140,100,24,0.2)',
    selection: 'rgba(140,100,24,0.15)',
    accent_glow: 'rgba(140,100,24,0.5)'
  },
  sepia: {
    bg: '#f4ecd8',
    text: '#433422',
    accent: '#965e2b',
    muted: '#bda78e',
    glow: 'rgba(150,94,43,0.25)',
    selection: 'rgba(150,94,43,0.15)',
    accent_glow: 'rgba(150,94,43,0.5)'
  }
}

export function makeTypographyConfig(fontSize: number, canvasWidth: number, theme: 'dark' | 'light' | 'sepia' = 'light'): TypographyConfig {
  const lineHeight = Math.round(fontSize * 1.6)
  const maxColumnWidth = 680
  const paddingX = canvasWidth > 680 + 96
    ? Math.floor((canvasWidth - 680) / 2)
    : 48
  const paddingTop = 48
  const font = `${fontSize}px Lora, Georgia, serif`
  const headingFont = `bold ${Math.round(fontSize * 1.6)}px Lora, Georgia, serif`
  const colors = THEMES[theme]

  return { fontSize, lineHeight, maxColumnWidth, paddingX, paddingTop, font, headingFont, theme, colors }
}

export class LayoutCache {
  private prepared = new Map<CacheKey, PreparedTextWithSegments>()
  private lines    = new Map<CacheKey, LayoutLine[]>()

  private key(sceneId: string, fontSize: number): CacheKey {
    return `${sceneId}:${fontSize}`
  }

  getPrepared(sceneId: string, fontSize: number): PreparedTextWithSegments | undefined {
    return this.prepared.get(this.key(sceneId, fontSize))
  }

  setPrepared(sceneId: string, fontSize: number, p: PreparedTextWithSegments): void {
    this.prepared.set(this.key(sceneId, fontSize), p)
  }

  getLines(sceneId: string, fontSize: number): LayoutLine[] | undefined {
    return this.lines.get(this.key(sceneId, fontSize))
  }

  setLines(sceneId: string, fontSize: number, lines: LayoutLine[]): void {
    this.lines.set(this.key(sceneId, fontSize), lines)
  }

  invalidateScene(sceneId: string): void {
    const prefix = `${sceneId}:`
    for (const k of this.prepared.keys()) {
      if (k.startsWith(prefix)) this.prepared.delete(k)
    }
    for (const k of this.lines.keys()) {
      if (k.startsWith(prefix)) this.lines.delete(k)
    }
  }

  clear(): void {
    this.prepared.clear()
    this.lines.clear()
  }
}
