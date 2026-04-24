// ── LookupCard DOM component ─────────────────────────────────────────────────
// A CSS position:absolute floating card for entity info and AI lookups.
// The #lookup-card element must already exist in the DOM (added in index.html).

export type LookupMode = 'entity' | 'ai-loading' | 'ai-result' | 'ai-error'

export interface LookupCardState {
  mode: LookupMode
  title: string
  body?: string
  anchorX: number   // canvas-relative px
  anchorY: number   // canvas-relative px
}

// ── Module-level state ────────────────────────────────────────────────────────

let currentDismiss: (() => void) | undefined
let outsideClickHandler: ((e: PointerEvent) => void) | undefined
let escapeHandler: ((e: KeyboardEvent) => void) | undefined

// ── HTML escaping ─────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

// ── Body content per mode ─────────────────────────────────────────────────────

function buildBodyHtml(mode: LookupMode, body?: string): string {
  switch (mode) {
    case 'entity':
      return escapeHtml(body ?? '')
    case 'ai-loading':
      return '<div class="spinner"></div> looking up\u2026'
    case 'ai-result':
      return escapeHtml(body ?? '')
    case 'ai-error':
      return escapeHtml(body ?? 'AI lookup unavailable \u2014 check Ollama connection')
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function showLookupCard(
  state: LookupCardState,
  canvas: HTMLCanvasElement,
  onDismiss?: () => void
): void {
  const card = document.getElementById('lookup-card') as HTMLElement | null
  if (!card) return

  // Populate content
  const titleEl = card.querySelector('.lookup-title') as HTMLElement
  const bodyEl  = card.querySelector('.lookup-body')  as HTMLElement
  titleEl.textContent = state.title
  bodyEl.innerHTML    = buildBodyHtml(state.mode, state.body)

  // Wire close button (idempotent — remove first to avoid duplicate listeners)
  const closeBtn = card.querySelector('.lookup-close') as HTMLButtonElement | null
  if (closeBtn) {
    closeBtn.onclick = () => hideLookupCard()
  }

  // Store dismiss callback
  currentDismiss = onDismiss

  // Show card (needed before measuring height)
  card.classList.remove('hidden')

  // Position the card
  const canvasRect  = canvas.getBoundingClientRect()
  const cardHeight  = card.offsetHeight || 240
  const cardWidth   = 320

  let top: number
  if (state.anchorY + 240 < canvas.height) {
    // Place above anchor
    top = canvasRect.top + state.anchorY - cardHeight - 8
  } else {
    // Place below anchor
    top = canvasRect.top + state.anchorY + 8
  }

  let left = canvasRect.left + state.anchorX - 160
  // Clamp horizontally within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - cardWidth - 8))

  card.style.top  = `${top}px`
  card.style.left = `${left}px`

  // Remove any existing listeners before attaching new ones
  _removeListeners()

  // Outside-click listener
  outsideClickHandler = (e: PointerEvent) => {
    if (!card.contains(e.target as Node)) {
      hideLookupCard()
    }
  }
  document.addEventListener('pointerdown', outsideClickHandler)

  // Escape key listener
  escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideLookupCard()
    }
  }
  document.addEventListener('keydown', escapeHandler)
}

export function hideLookupCard(): void {
  const card = document.getElementById('lookup-card') as HTMLElement | null
  if (!card) return

  card.classList.add('hidden')
  _removeListeners()

  if (currentDismiss) {
    const cb = currentDismiss
    currentDismiss = undefined
    cb()
  }
}

export function updateLookupCard(
  partial: Partial<Pick<LookupCardState, 'mode' | 'body'>>
): void {
  const card = document.getElementById('lookup-card') as HTMLElement | null
  if (!card || card.classList.contains('hidden')) return

  if (partial.mode !== undefined || partial.body !== undefined) {
    const bodyEl = card.querySelector('.lookup-body') as HTMLElement
    // Determine current mode from data attribute, fall back to 'ai-result'
    const mode = (partial.mode ?? (card.dataset.mode as LookupMode)) ?? 'ai-result'
    card.dataset.mode = mode
    bodyEl.innerHTML  = buildBodyHtml(mode, partial.body)
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _removeListeners(): void {
  if (outsideClickHandler) {
    document.removeEventListener('pointerdown', outsideClickHandler)
    outsideClickHandler = undefined
  }
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler)
    escapeHandler = undefined
  }
}
