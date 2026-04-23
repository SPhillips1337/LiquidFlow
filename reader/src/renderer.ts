// ── Pretext Canvas Renderer ──────────────────────────────────────────────────
// Core of the "Kindle+" experience: text flows around a draggable orb at 60fps.

import { prepareWithSegments, layoutNextLineRange, materializeLineRange } from '@chenglou/pretext'
import type { LayoutCursor } from '@chenglou/pretext'
import type { OrbState } from './types'

const BODY_FONT    = '18px Lora, Georgia, serif'
const LINE_HEIGHT  = 28
const PADDING_X    = 48
const PADDING_TOP  = 32

// Accent colour from CSS vars (read once)
const ACCENT       = '#c8922a'
const TEXT_COLOR   = '#e8e0d0'
const ORB_COLOR    = 'rgba(200, 146, 42, 0.18)'
const ORB_BORDER   = 'rgba(200, 146, 42, 0.55)'

export interface RenderedPage {
  /** Total height in px of the laid-out text */
  totalHeight: number
}

/**
 * Render a scene's text onto the canvas, flowing around the orb obstacle.
 * Returns the total content height so the caller can manage scroll.
 */
export function renderScene(
  canvas: HTMLCanvasElement,
  text: string,
  orb: OrbState,
  scrollOffset: number
): RenderedPage {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)

  // ── Background ──
  ctx.fillStyle = '#0e0d0b'
  ctx.fillRect(0, 0, W, H)

  // ── Prepare text (cached by text identity in caller) ──
  const prepared = prepareWithSegments(text, BODY_FONT)

  const maxW = W - PADDING_X * 2
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = PADDING_TOP - scrollOffset

  // ── Flow text line by line, narrowing around orb ──
  ctx.fillStyle = TEXT_COLOR
  ctx.font = BODY_FONT

  let totalHeight = PADDING_TOP

  while (true) {
    const absY = y + scrollOffset  // absolute y in content space

    // Determine available width at this y, accounting for orb
    let lineX = PADDING_X
    let lineW = maxW

    if (orb.radius > 0) {
      const orbTop    = orb.y - orb.radius - LINE_HEIGHT
      const orbBottom = orb.y + orb.radius + LINE_HEIGHT

      if (absY > orbTop && absY < orbBottom) {
        // How much does the orb intrude horizontally at this y?
        const dy = absY - orb.y
        const intrude = Math.sqrt(Math.max(0, orb.radius * orb.radius - dy * dy))

        const orbLeft  = orb.x - intrude
        const orbRight = orb.x + intrude

        // Text is to the left or right of orb, or split — we pick the wider side
        const leftW  = Math.max(0, orbLeft - PADDING_X - 8)
        const rightW = Math.max(0, W - PADDING_X - orbRight - 8)

        if (leftW >= rightW && leftW > 60) {
          lineW = leftW
        } else if (rightW > 60) {
          lineX = orbRight + 8
          lineW = rightW
        } else {
          // Too narrow — skip this line row
          y += LINE_HEIGHT
          totalHeight += LINE_HEIGHT
          continue
        }
      }
    }

    const result = layoutNextLineRange(prepared, cursor, lineW)
    if (!result) break  // end of text

    const { end: nextCursor } = result
    const lineText = materializeLineRange(prepared, result)

    // Only draw if visible on screen
    if (y > -LINE_HEIGHT && y < H + LINE_HEIGHT) {
      ctx.fillText(lineText.text, lineX, y + LINE_HEIGHT * 0.8)
    }

    cursor = nextCursor
    y += LINE_HEIGHT
    totalHeight += LINE_HEIGHT
  }

  totalHeight += PADDING_TOP

  // ── Draw orb ──
  if (orb.radius > 0) {
    const grd = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius)
    grd.addColorStop(0, 'rgba(200, 146, 42, 0.25)')
    grd.addColorStop(0.7, ORB_COLOR)
    grd.addColorStop(1, 'transparent')

    ctx.beginPath()
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2)
    ctx.fillStyle = grd
    ctx.fill()

    ctx.beginPath()
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2)
    ctx.strokeStyle = ORB_BORDER
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Subtle inner glow dot
    ctx.beginPath()
    ctx.arc(orb.x, orb.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = ACCENT
    ctx.fill()
  }

  return { totalHeight }
}

/** Resize canvas to match its CSS display size (handles devicePixelRatio) */
export function resizeCanvas(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width  = rect.width  * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  // Re-apply logical size so our coordinate math stays in CSS px
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
