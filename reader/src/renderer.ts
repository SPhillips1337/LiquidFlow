// ── TypographyRenderer ───────────────────────────────────────────────────────
// Kindle Plus canvas renderer: book typography, entity obstacles, search/selection highlights.

import { prepareWithSegments, layoutNextLineRange, materializeLineRange } from '@chenglou/pretext'
import type { LayoutCursor } from '@chenglou/pretext'
import type { BookScene, LayoutLine, WordBound, TypographyConfig } from './types'
import { LayoutCache } from './layout-cache'



// ── Scene break detection ────────────────────────────────────────────────────

function isSceneBreak(line: string): boolean {
  const t = line.trim()
  return t === '* * *' || t === '***' || t === '---'
}

function isHeadingLine(line: string): boolean {
  if (/^(chapter|part)\s/i.test(line.trim())) return true
  const t = line.trim()
  if (t.length > 0 && t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true
  return false
}

// ── Word computation ─────────────────────────────────────────────────────────

function computeWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  _lineX: number,
  font: string,
  lineStartOffset: number
): WordBound[] {
  const bounds: WordBound[] = []
  const wordRegex = /\S+/g
  let match: RegExpExecArray | null
  
  const oldFont = ctx.font
  ctx.font = font
  
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0]
    const startIdx = match.index
    const preText = text.slice(0, startIdx)
    const x = ctx.measureText(preText).width
    const w = ctx.measureText(word).width
    
    bounds.push({
      word,
      x,
      w,
      offset: lineStartOffset + startIdx
    })
  }
  
  ctx.font = oldFont
  return bounds
}

// ── Main render function ─────────────────────────────────────────────────────

export function renderScene(
  canvas: HTMLCanvasElement,
  scene: BookScene,
  layoutCache: LayoutCache,
  entities: Array<{ x: number; y: number; w: number; h: number }>,
  searchMatch: { charOffset: number; length: number } | null,
  scrollOffset: number,
  config: TypographyConfig,
  selection: { startLine: number; startWordIdx: number; endLine: number; endWordIdx: number } | null
): LayoutLine[] {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height

  // ── Clear ──
  ctx.fillStyle = config.colors.bg
  ctx.fillRect(0, 0, W, H)

  if (!scene.text) return []

  // ── Cache: prepared text ──
  let prepared = layoutCache.getPrepared(scene.id, config.fontSize)
  if (!prepared) {
    prepared = prepareWithSegments(scene.text, config.font)
    layoutCache.setPrepared(scene.id, config.fontSize, prepared)
  }

  // ── Cache: lines (skip re-layout when nothing dynamic) ──
  const canUseCache = !entities.length && !searchMatch && !selection
  if (canUseCache) {
    const cached = layoutCache.getLines(scene.id, config.fontSize)
    if (cached) {
      drawLines(ctx, canvas, cached, scrollOffset, config, null, null)
      return cached
    }
  }

  // ── Layout pass ──
  const lines: LayoutLine[] = []
  const baseX = config.paddingX
  const maxColW = Math.min(config.maxColumnWidth, W - config.paddingX * 2)
  let contentY = config.paddingTop

  // We split on blank lines (\n\n) to identify paragraphs.
  // We use a more robust split to handle varying newline styles.
  const paragraphs = scene.text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  
  let prevWasHeadingOrBreak = true
  for (let pi = 0; pi < paragraphs.length; pi++) {
    let text = paragraphs[pi].trim()
    
    const heading = isHeadingLine(text)
    const brk = isSceneBreak(text)
    
    // Normalize whitespace within the paragraph for smooth reflow,
    // unless it's a scene break marker.
    if (!brk) {
      text = text.replace(/\s+/g, ' ')
    }

    const flush = prevWasHeadingOrBreak || heading || brk
    prevWasHeadingOrBreak = heading || brk

    // Gap between paragraphs: a full line height for breathing room
    if (pi > 0) {
      contentY += config.lineHeight * 1.2
    }

    // Scene break ornament
    if (brk) {
      lines.push({
        x: baseX,
        y: contentY,
        w: maxColW,
        text: '· · ·',
        startCursor: { segmentIndex: 0, graphemeIndex: 0 },
        endCursor: { segmentIndex: 0, graphemeIndex: 0 },
        words: [],
        paragraphStart: true,
      })
      contentY += config.lineHeight
      continue
    }

    // Prepare this paragraph's text
    const paraFont = heading ? config.headingFont : config.font
    const paraPrepared = prepareWithSegments(text, paraFont)
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let isFirstLineOfPara = true

    // We need to track the paragraph start offset relative to scene.text
    // However, since we normalized whitespace, we'll use a relative offset strategy.
    // For hit-testing, we'll store the original text indices if needed, 
    // but for now, we'll focus on the visual layout.
    
    while (true) {
      // Compute line geometry
      let lineX = baseX
      let lineW = maxColW

      // Apply first-line indent: 2.0em for clear distinction
      const indent = (!heading && !flush && isFirstLineOfPara)
        ? config.fontSize * 2.0
        : 0

      // Narrow around entity obstacles
      const lineTop = contentY
      const lineBottom = contentY + config.lineHeight

      for (const ent of entities) {
        const entTop = ent.y - 4
        const entBottom = ent.y + ent.h + 4
        if (lineBottom > entTop && lineTop < entBottom) {
          const entLeft = ent.x
          const entRight = ent.x + ent.w
          const leftW = Math.max(0, entLeft - baseX - 8)
          const rightW = Math.max(0, W - config.paddingX - entRight - 8)
          if (leftW >= rightW && leftW > 60) {
            lineW = leftW
          } else if (rightW > 60) {
            lineX = entRight + 8
            lineW = rightW
          } else {
            contentY += config.lineHeight
            continue
          }
        }
      }

      const availW = lineW - indent
      const result = layoutNextLineRange(paraPrepared, cursor, availW)
      if (!result) break

      const materialized = materializeLineRange(paraPrepared, result)

      ctx.font = paraFont
      // Note: offsets will be slightly off due to normalization, 
      // but words are still searchable by content.
      const wordBounds = computeWords(ctx, materialized.text, lineX + indent, paraFont, 0) 

      lines.push({
        x: lineX + indent,
        y: contentY,
        w: lineW - indent,
        text: materialized.text,
        startCursor: result.start,
        endCursor: result.end,
        words: wordBounds,
        paragraphStart: isFirstLineOfPara,
      })

      cursor = result.end
      contentY += config.lineHeight
      isFirstLineOfPara = false
    }
  }

  // ── Store in cache ──
  layoutCache.setLines(scene.id, config.fontSize, lines)

  // ── Draw ──
  drawLines(ctx, canvas, lines, scrollOffset, config, searchMatch, selection)

  // ── Draw entities on top ──
  const entityFont = `bold ${Math.round(config.fontSize * 0.85)}px JetBrains Mono, monospace`
  ctx.font = entityFont
  ctx.fillStyle = config.colors.accent
  ctx.shadowColor = config.colors.glow
  ctx.shadowBlur = 8
  for (const ent of entities) {
    const screenY = ent.y - scrollOffset
    if (screenY > -ent.h && screenY < H + ent.h) {
      ctx.fillText((ent as any).name ?? '', ent.x, screenY + ent.h * 0.8)
    }
  }
  ctx.shadowBlur = 0

  return lines
}

// ── Drawing helper ───────────────────────────────────────────────────────────

function drawLines(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lines: LayoutLine[],
  scrollOffset: number,
  config: TypographyConfig,
  searchMatch: { charOffset: number; length: number } | null,
  selection: { startLine: number; startWordIdx: number; endLine: number; endWordIdx: number } | null
): void {
  const H = canvas.height

  // Track char offset for search match detection
  let charOffset = 0

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const screenY = line.y - scrollOffset

    // Skip off-screen lines
    if (screenY + config.lineHeight < 0 || screenY > H + config.lineHeight) {
      charOffset += line.text.length + 1  // +1 for space/newline separator
      continue
    }

    const isBreakOrnament = line.text === '· · ·'
    const isHeadingLine_ = !isBreakOrnament && line.paragraphStart && isHeadingLine(line.text)

    // ── Selection highlight ──
    if (selection) {
      const { startLine, startWordIdx, endLine, endWordIdx } = selection
      if (li >= startLine && li <= endLine) {
        const wStart = li === startLine ? startWordIdx : 0
        const wEnd   = li === endLine   ? endWordIdx   : line.words.length - 1
        if (wStart <= wEnd && line.words.length > 0) {
          const wx0 = line.x + (line.words[wStart]?.x ?? 0)
          const lastWord = line.words[wEnd]
          const wx1 = line.x + (lastWord ? lastWord.x + lastWord.w : 0)
          ctx.fillStyle = config.colors.selection
          ctx.fillRect(wx0, screenY, wx1 - wx0, config.lineHeight)
        }
      }
    }

    // ── Search highlight ──
    if (searchMatch && !isBreakOrnament) {
      const lineEnd = charOffset + line.text.length
      const matchStart = searchMatch.charOffset
      const matchEnd   = searchMatch.charOffset + searchMatch.length
      if (matchStart < lineEnd && matchEnd > charOffset) {
        // Compute pixel range of match within this line
        const localStart = Math.max(0, matchStart - charOffset)
        const localEnd   = Math.min(line.text.length, matchEnd - charOffset)
        const preText    = line.text.slice(0, localStart)
        const matchText  = line.text.slice(localStart, localEnd)
        ctx.font = config.font
        const preW  = ctx.measureText(preText).width
        const matchW = ctx.measureText(matchText).width
        ctx.fillStyle = config.colors.glow
        ctx.fillRect(line.x + preW, screenY, matchW, config.lineHeight)
      }
    }

    // ── Draw text ──
    if (isBreakOrnament) {
      ctx.font = config.font
      ctx.fillStyle = config.colors.muted
      ctx.textAlign = 'center'
      ctx.fillText(line.text, line.x + line.w / 2, screenY + config.lineHeight * 0.8)
      ctx.textAlign = 'left'
    } else if (isHeadingLine_) {
      ctx.font = config.headingFont
      ctx.fillStyle = config.colors.accent
      ctx.textAlign = 'center'
      ctx.fillText(line.text, line.x + line.w / 2, screenY + config.lineHeight * 0.8)
      ctx.textAlign = 'left'
    } else {
      ctx.font = config.font
      ctx.fillStyle = config.colors.text
      ctx.fillText(line.text, line.x, screenY + config.lineHeight * 0.8)
    }

    charOffset += line.text.length + 1
  }
}

// ── Canvas helpers (kept from old renderer) ──────────────────────────────────

export function resizeCanvas(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width  = rect.width  * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ;(canvas as HTMLCanvasElement & { _logicalW: number; _logicalH: number })._logicalW = rect.width
  ;(canvas as HTMLCanvasElement & { _logicalW: number; _logicalH: number })._logicalH = rect.height
}

export function getLogicalSize(canvas: HTMLCanvasElement): { w: number; h: number } {
  const c = canvas as HTMLCanvasElement & { _logicalW?: number; _logicalH?: number }
  return {
    w: c._logicalW ?? canvas.getBoundingClientRect().width,
    h: c._logicalH ?? canvas.getBoundingClientRect().height
  }
}
