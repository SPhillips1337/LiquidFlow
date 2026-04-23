// ── LiquidFlow Reader — Main Entry ──────────────────────────────────────────

import './style.css'
import type { BookManifest, OrbState, RenderState } from './types'
import { loadShelf, renderShelf } from './shelf'
import { renderScene, resizeCanvas, getLogicalSize } from './renderer'
import { fetchAiAscii } from './ascii'
import { showMarginalia, hideMarginalia } from './marginalia'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const shelfView     = document.getElementById('shelf')!
const readerView    = document.getElementById('reader-view')!
const bookGrid      = document.getElementById('book-grid')!
const canvas        = document.getElementById('reader-canvas') as HTMLCanvasElement
const btnBack       = document.getElementById('btn-back')!
const btnAscii      = document.getElementById('btn-ascii')!
const bookTitleNav  = document.getElementById('book-title-nav')!
const asciiPanel    = document.getElementById('ascii-panel')!
const marginalia    = document.getElementById('marginalia')!
const margContent   = document.getElementById('marginalia-content')!
const margClose     = document.getElementById('marginalia-close')!
const progressFill  = document.getElementById('progress-fill')!
const sceneInfo     = document.getElementById('scene-info')!

// ── State ─────────────────────────────────────────────────────────────────────
let state: RenderState | null = null
let rafId = 0
let dirty = true

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const books = await loadShelf()
  renderShelf(books, bookGrid, openBook)
}

function openBook(book: BookManifest) {
  const orb: OrbState = {
    x: 0, y: 0,
    radius: 70,
    dragging: false
  }

  state = {
    manifest: book,
    chapterIndex: 0,
    sceneIndex: 0,
    scrollOffset: 0,
    orb,
    asciiVisible: false
  }

  // Position orb in centre of canvas initially
  const { w, h } = getLogicalSize(canvas)
  orb.x = w * 0.72
  orb.y = h * 0.38

  bookTitleNav.textContent = book.title
  shelfView.classList.remove('active')
  readerView.classList.add('active')

  resizeCanvas(canvas)
  loadSceneAscii()
  dirty = true
  startLoop()
}

function closeBook() {
  cancelAnimationFrame(rafId)
  state = null
  readerView.classList.remove('active')
  shelfView.classList.add('active')
  hideMarginalia(marginalia)
}

// ── Render loop ───────────────────────────────────────────────────────────────
function startLoop() {
  cancelAnimationFrame(rafId)

  function loop() {
    if (!state) return
    if (dirty) {
      const { w } = getLogicalSize(canvas)
      // Sync canvas logical width (height is CSS flex)
      canvas.style.width = '100%'

      const scene = currentScene()
      if (scene) {
        renderScene(canvas, scene.text, state.orb, state.scrollOffset)
        updateProgress()
        updateSceneInfo()
      }
      dirty = false
    }
    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)
}

function currentScene() {
  if (!state) return null
  return state.manifest.chapters[state.chapterIndex]?.scenes[state.sceneIndex] ?? null
}

function updateProgress() {
  if (!state) return
  const totalScenes = state.manifest.chapters.reduce((s, c) => s + c.scenes.length, 0)
  let done = 0
  for (let ci = 0; ci < state.chapterIndex; ci++) {
    done += state.manifest.chapters[ci].scenes.length
  }
  done += state.sceneIndex
  progressFill.style.width = `${Math.round((done / totalScenes) * 100)}%`
}

function updateSceneInfo() {
  if (!state) return
  const ch = state.manifest.chapters[state.chapterIndex]
  sceneInfo.textContent = `${ch?.title ?? ''} · scene ${state.sceneIndex + 1}/${ch?.scenes.length ?? 1}`
}

// ── ASCII panel ───────────────────────────────────────────────────────────────
async function loadSceneAscii() {
  const scene = currentScene()
  if (!scene) return
  asciiPanel.textContent = 'generating…'
  const art = await fetchAiAscii(scene.visualPrompt)
  asciiPanel.textContent = art
}

// ── Navigation ────────────────────────────────────────────────────────────────
function nextScene() {
  if (!state) return
  const ch = state.manifest.chapters[state.chapterIndex]
  if (state.sceneIndex < ch.scenes.length - 1) {
    state.sceneIndex++
  } else if (state.chapterIndex < state.manifest.chapters.length - 1) {
    state.chapterIndex++
    state.sceneIndex = 0
  }
  state.scrollOffset = 0
  dirty = true
  loadSceneAscii()
}

function prevScene() {
  if (!state) return
  if (state.sceneIndex > 0) {
    state.sceneIndex--
  } else if (state.chapterIndex > 0) {
    state.chapterIndex--
    const ch = state.manifest.chapters[state.chapterIndex]
    state.sceneIndex = ch.scenes.length - 1
  }
  state.scrollOffset = 0
  dirty = true
  loadSceneAscii()
}

// ── Orb drag ──────────────────────────────────────────────────────────────────
function getCanvasPos(e: MouseEvent | Touch): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function isOnOrb(x: number, y: number): boolean {
  if (!state) return false
  const { orb } = state
  const dx = x - orb.x, dy = y - orb.y
  return Math.sqrt(dx * dx + dy * dy) <= orb.radius + 10
}

canvas.addEventListener('mousedown', e => {
  if (!state) return
  const pos = getCanvasPos(e)
  if (isOnOrb(pos.x, pos.y)) {
    state.orb.dragging = true
    canvas.style.cursor = 'grabbing'
  }
})

canvas.addEventListener('mousemove', e => {
  if (!state) return
  const pos = getCanvasPos(e)
  if (state.orb.dragging) {
    state.orb.x = pos.x
    state.orb.y = pos.y
    dirty = true
  } else {
    canvas.style.cursor = isOnOrb(pos.x, pos.y) ? 'grab' : 'crosshair'
  }
})

canvas.addEventListener('mouseup', () => {
  if (!state) return
  state.orb.dragging = false
  canvas.style.cursor = 'crosshair'
})

// Touch support for tablets
canvas.addEventListener('touchstart', e => {
  if (!state) return
  const t = e.touches[0]
  const pos = getCanvasPos(t)
  if (isOnOrb(pos.x, pos.y)) {
    state.orb.dragging = true
    e.preventDefault()
  }
}, { passive: false })

canvas.addEventListener('touchmove', e => {
  if (!state?.orb.dragging) return
  const t = e.touches[0]
  const pos = getCanvasPos(t)
  state.orb.x = pos.x
  state.orb.y = pos.y
  dirty = true
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('touchend', () => {
  if (state) state.orb.dragging = false
})

// ── Scroll / swipe ────────────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  if (!state) return
  state.scrollOffset = Math.max(0, state.scrollOffset + e.deltaY)
  dirty = true
  e.preventDefault()
}, { passive: false })

// Keyboard navigation
window.addEventListener('keydown', e => {
  if (!state) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextScene()
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevScene()
  if (e.key === 'Escape') hideMarginalia(marginalia)
})

// ── Entity tap (click on canvas — detect word under cursor) ──────────────────
// Simple approach: check if click is near a known entity name in current scene
canvas.addEventListener('click', e => {
  if (!state) return
  const scene = currentScene()
  if (!scene || state.orb.dragging) return

  // We don't have per-word coordinates from pretext in this simple integration,
  // so we show a random entity on click as a PoC trigger.
  // A full implementation would use layoutWithLines to map click → word.
  const entities = scene.entities
  if (entities.length === 0) return

  const entity = entities[Math.floor(Math.random() * entities.length)]
  showMarginalia(entity, scene.text, state.manifest.title, marginalia, margContent)
})

// ── Button handlers ───────────────────────────────────────────────────────────
btnBack.addEventListener('click', closeBook)

btnAscii.addEventListener('click', () => {
  if (!state) return
  state.asciiVisible = !state.asciiVisible
  asciiPanel.classList.toggle('hidden', !state.asciiVisible)
})

margClose.addEventListener('click', () => hideMarginalia(marginalia))

// ── Resize ────────────────────────────────────────────────────────────────────
const ro = new ResizeObserver(() => {
  if (!state) return
  resizeCanvas(canvas)
  dirty = true
})
ro.observe(canvas)

// ── Boot ──────────────────────────────────────────────────────────────────────
init()
