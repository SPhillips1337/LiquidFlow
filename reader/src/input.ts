// ── Unified input event router ───────────────────────────────────────────────

export type InputEvent =
  | { type: 'tap';        x: number; y: number }
  | { type: 'drag-start'; x: number; y: number }
  | { type: 'drag-move';  x: number; y: number }
  | { type: 'drag-end';   x: number; y: number }
  | { type: 'scroll';     deltaY: number }
  | { type: 'pinch';      scaleDelta: number }  // scaleDelta > 1 = zoom in, < 1 = zoom out
  | { type: 'key';        key: string; modifiers: string[] }  // modifiers: ['ctrl', 'meta', 'shift', 'alt']

const TAP_MOVE_THRESHOLD = 10   // px
const TAP_TIME_THRESHOLD = 200  // ms

const HANDLED_KEYS = new Set([
  'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Escape', 'f',
])

function canvasCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function touchDistance(a: Touch, b: Touch): number {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

export function attachInputRouter(
  canvas: HTMLCanvasElement,
  onEvent: (e: InputEvent) => void
): () => void {

  // ── Pointer / mouse drag state ─────────────────────────────────────────────
  let pointerDown = false
  let dragActive = false
  let downX = 0
  let downY = 0
  let downTime = 0

  // ── Touch state ───────────────────────────────────────────────────────────
  let prevPinchDist: number | null = null

  // ── Mouse handlers ────────────────────────────────────────────────────────
  function onMouseDown(e: MouseEvent) {
    const { x, y } = canvasCoords(canvas, e.clientX, e.clientY)
    pointerDown = true
    dragActive = false
    downX = x
    downY = y
    downTime = performance.now()
  }

  function onMouseMove(e: MouseEvent) {
    if (!pointerDown) return
    const { x, y } = canvasCoords(canvas, e.clientX, e.clientY)
    const dx = x - downX
    const dy = y - downY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const elapsed = performance.now() - downTime

    if (!dragActive && (dist >= TAP_MOVE_THRESHOLD || elapsed >= TAP_TIME_THRESHOLD)) {
      dragActive = true
      onEvent({ type: 'drag-start', x, y })
    } else if (dragActive) {
      onEvent({ type: 'drag-move', x, y })
    }
  }

  function onMouseUp(e: MouseEvent) {
    if (!pointerDown) return
    const { x, y } = canvasCoords(canvas, e.clientX, e.clientY)
    pointerDown = false

    if (dragActive) {
      dragActive = false
      onEvent({ type: 'drag-end', x, y })
    } else {
      onEvent({ type: 'tap', x, y })
    }
  }

  function onWheel(e: WheelEvent) {
    onEvent({ type: 'scroll', deltaY: e.deltaY })
  }

  // ── Touch handlers ────────────────────────────────────────────────────────
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      const { x, y } = canvasCoords(canvas, t.clientX, t.clientY)
      pointerDown = true
      dragActive = false
      downX = x
      downY = y
      downTime = performance.now()
      prevPinchDist = null
    } else if (e.touches.length === 2) {
      // entering pinch — cancel any ongoing drag
      pointerDown = false
      dragActive = false
      prevPinchDist = touchDistance(e.touches[0], e.touches[1])
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 2) {
      // pinch
      const newDist = touchDistance(e.touches[0], e.touches[1])
      if (prevPinchDist !== null && prevPinchDist > 0) {
        onEvent({ type: 'pinch', scaleDelta: newDist / prevPinchDist })
      }
      prevPinchDist = newDist
      return
    }

    if (!pointerDown || e.touches.length !== 1) return
    const t = e.touches[0]
    const { x, y } = canvasCoords(canvas, t.clientX, t.clientY)
    const dx = x - downX
    const dy = y - downY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const elapsed = performance.now() - downTime

    if (!dragActive && (dist >= TAP_MOVE_THRESHOLD || elapsed >= TAP_TIME_THRESHOLD)) {
      dragActive = true
      onEvent({ type: 'drag-start', x, y })
    } else if (dragActive) {
      e.preventDefault()
      onEvent({ type: 'drag-move', x, y })
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length >= 2) return

    if (e.touches.length === 0 && prevPinchDist !== null) {
      // pinch ended
      prevPinchDist = null
      return
    }

    if (!pointerDown) return
    const changed = e.changedTouches[0]
    const { x, y } = canvasCoords(canvas, changed.clientX, changed.clientY)
    pointerDown = false

    if (dragActive) {
      dragActive = false
      onEvent({ type: 'drag-end', x, y })
    } else {
      onEvent({ type: 'tap', x, y })
    }
  }

  // ── Keyboard handler (attached to window) ─────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (!HANDLED_KEYS.has(e.key)) return

    const modifiers: string[] = []
    if (e.ctrlKey)  modifiers.push('ctrl')
    if (e.metaKey)  modifiers.push('meta')
    if (e.shiftKey) modifiers.push('shift')
    if (e.altKey)   modifiers.push('alt')

    onEvent({ type: 'key', key: e.key, modifiers })
  }

  // ── Attach listeners ──────────────────────────────────────────────────────
  canvas.addEventListener('mousedown',  onMouseDown)
  canvas.addEventListener('mousemove',  onMouseMove)
  canvas.addEventListener('mouseup',    onMouseUp)
  canvas.addEventListener('wheel',      onWheel,      { passive: true })
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false })
  canvas.addEventListener('touchend',   onTouchEnd,   { passive: true })
  window.addEventListener('keydown',    onKeyDown)

  // ── Detach function ───────────────────────────────────────────────────────
  return () => {
    canvas.removeEventListener('mousedown',  onMouseDown)
    canvas.removeEventListener('mousemove',  onMouseMove)
    canvas.removeEventListener('mouseup',    onMouseUp)
    canvas.removeEventListener('wheel',      onWheel)
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove',  onTouchMove)
    canvas.removeEventListener('touchend',   onTouchEnd)
    window.removeEventListener('keydown',    onKeyDown)
  }
}
