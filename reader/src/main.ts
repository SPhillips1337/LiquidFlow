// ── LiquidFlow Reader — Kindle Plus App Shell ──────────────────────────────────
import './style.css'
import type { 
  BookManifest, 
  ReadingPosition, 
  TypographyConfig, 
  SearchState, 
  LayoutLine, 
  SelectionState 
} from './types'
import { loadShelf, renderShelf } from './shelf'
import { renderScene, resizeCanvas } from './renderer'
import { AnimationDriver } from './animation-driver'
import { LayoutCache, makeTypographyConfig } from './layout-cache'
import { createToolbar } from './toolbar'
import { attachInputRouter, type InputEvent } from './input'
import { showLookupCard, updateLookupCard, hideLookupCard } from './lookup-card'
import { searchBook, nextMatch, prevMatch, emptySearchState } from './search'
import { 
  savePosition, 
  loadPosition, 
  saveFontSize, 
  loadFontSize, 
  saveTheme, 
  loadTheme 
} from './persistence'
import { renderTransition } from './transition'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const shelfView         = document.getElementById('shelf')!
const readerView        = document.getElementById('reader-view')!
const bookGrid          = document.getElementById('book-grid')!
const mainCanvas        = document.getElementById('reader-canvas') as HTMLCanvasElement
const transitionCanvas  = document.getElementById('transition-canvas') as HTMLCanvasElement
const sceneInfoEl       = document.getElementById('scene-info')!

// ── Core Engines ──────────────────────────────────────────────────────────────
const animationDriver = new AnimationDriver()
const layoutCache     = new LayoutCache()

// ── App State ─────────────────────────────────────────────────────────────────
let manifest: BookManifest | null = null
let position: ReadingPosition | null = null
let config: TypographyConfig = makeTypographyConfig(loadFontSize(), window.innerWidth, loadTheme())
let searchState: SearchState = emptySearchState()
let selection: SelectionState | null = null

let toolbar: ReturnType<typeof createToolbar> | null = null
let inputDetach: (() => void) | null = null
let currentLines: LayoutLine[] = []
let dirty = true
let lastTime = performance.now()
let rafId = 0

// ── Initialization ────────────────────────────────────────────────────────────
async function init() {
  const books = await loadShelf()
  renderShelf(books, bookGrid, openBook)

  // Handle global resize
  window.addEventListener('resize', () => {
    if (!manifest) return
    config = makeTypographyConfig(config.fontSize, window.innerWidth, config.theme)
    resizeCanvas(mainCanvas)
    resizeCanvas(transitionCanvas)
    layoutCache.clear()
    dirty = true
  })
}

function openBook(book: BookManifest) {
  manifest = book
  
  // Load or init position
  const saved = loadPosition(book.id)
  position = saved || {
    bookId: book.id,
    chapterIndex: 0,
    sceneIndex: 0,
    scrollOffset: 0
  }

  // Sync UI
  shelfView.classList.remove('active')
  readerView.classList.add('active')
  
  resizeCanvas(mainCanvas)
  resizeCanvas(transitionCanvas)
  animationDriver.setCanvasSize(mainCanvas.width, mainCanvas.height)

  // Create toolbar
  toolbar = createToolbar(readerView, book, {
    onBack: closeBook,
    onFontIncrease: () => updateFontSize(config.fontSize + 2),
    onFontDecrease: () => updateFontSize(config.fontSize - 2),
    onThemeToggle: toggleTheme,
    onSettingsClick: () => alert('Settings menu coming soon! Use the toggle for now.'),
    onSearchSubmit: handleSearch,
    onSearchNext: () => { searchState = nextMatch(searchState); jumpToMatch(); },
    onSearchPrev: () => { searchState = prevMatch(searchState); jumpToMatch(); },
    onSearchClose: () => { searchState = emptySearchState(); dirty = true; },
    onChapterSelect: (idx) => jumpToChapter(idx)
  })
  toolbar.setFontSize(config.fontSize, 12, 48)
  toolbar.setTheme(config.theme)
  toolbar.setChapterTitle(book.chapters[position.chapterIndex].title)
  
  // Sync body class for UI theme
  document.body.setAttribute('data-theme', config.theme)

  // Attach input
  inputDetach = attachInputRouter(mainCanvas, handleInput)

  // Bootstrap entities for current scene
  spawnEntities()

  dirty = true
  startLoop()
}

function closeBook() {
  cancelAnimationFrame(rafId)
  if (toolbar) toolbar.destroy()
  if (inputDetach) inputDetach()
  
  manifest = null
  position = null
  toolbar = null
  inputDetach = null
  
  readerView.classList.remove('active')
  shelfView.classList.add('active')
}

// ── Main Loop ─────────────────────────────────────────────────────────────────
function startLoop() {
  lastTime = performance.now()
  
  function loop(now: number) {
    if (!manifest || !position) return
    
    const dt = now - lastTime
    lastTime = now

    // 1. Update animations
    const entitiesMoved = animationDriver.tick(dt)
    if (entitiesMoved) dirty = true

    // 2. Handle transitions
    const transition = animationDriver.updateTransition()
    if (transition) {
      transitionCanvas.classList.remove('hidden')
      renderTransition(transitionCanvas, transition)
    } else {
      transitionCanvas.classList.add('hidden')
    }

    // 3. Render reader content
    if (dirty) {
      const scene = manifest.chapters[position.chapterIndex].scenes[position.sceneIndex]
      const obstacles = animationDriver.getEntityObstacles()
      const currentMatch = searchState.matches.length > 0 ? searchState.matches[searchState.currentIndex] : null
      
      currentLines = renderScene(
        mainCanvas,
        scene,
        layoutCache,
        obstacles,
        currentMatch,
        position.scrollOffset,
        config,
        selection
      )
      
      updateSceneInfo()
      if (toolbar) toolbar.setProgress(calculateProgress())
      dirty = false
    }

    rafId = requestAnimationFrame(loop)
  }
  
  rafId = requestAnimationFrame(loop)
}

// ── State Mutators ────────────────────────────────────────────────────────────
function updateFontSize(newSize: number) {
  const size = Math.max(12, Math.min(newSize, 48))
  config = makeTypographyConfig(size, window.innerWidth, config.theme)
  saveFontSize(size)
  layoutCache.clear()
  if (toolbar) toolbar.setFontSize(size, 12, 48)
  dirty = true
}

function toggleTheme() {
  const next: Record<string, 'dark' | 'light' | 'sepia'> = {
    dark: 'light',
    light: 'dark',
    sepia: 'dark'
  }
  const newTheme = next[config.theme] || 'dark'
  config = makeTypographyConfig(config.fontSize, window.innerWidth, newTheme)
  saveTheme(newTheme)
  
  // Update UI
  document.body.setAttribute('data-theme', newTheme)
  if (toolbar) toolbar.setTheme(newTheme)
  
  dirty = true
}

function jumpToChapter(idx: number) {
  if (!manifest || !position) return
  position.chapterIndex = idx
  position.sceneIndex = 0
  position.scrollOffset = 0
  onSceneChanged()
}

function jumpToMatch() {
  if (!manifest || !position || searchState.matches.length === 0) return
  const m = searchState.matches[searchState.currentIndex]
  position.chapterIndex = m.chapterIndex
  position.sceneIndex = m.sceneIndex
  position.scrollOffset = 0 // ideal: scroll to match
  onSceneChanged()
}

function onSceneChanged() {
  if (!manifest || !position) return
  savePosition(position)
  if (toolbar) {
    toolbar.setChapterTitle(manifest.chapters[position.chapterIndex].title)
    toolbar.setSearchState(searchState)
  }
  spawnEntities()
  animationDriver.triggerTransition(
    manifest.chapters[position.chapterIndex].scenes[position.sceneIndex],
    position.chapterIndex,
    position.sceneIndex
  )
  dirty = true
}

function spawnEntities() {
  if (!manifest || !position) return
  const scene = manifest.chapters[position.chapterIndex].scenes[position.sceneIndex]
  animationDriver.spawnEntities(scene, config.lineHeight)
}

// ── Input Handling ────────────────────────────────────────────────────────────
function handleInput(e: InputEvent) {
  if (!manifest || !position) return

  switch (e.type) {
    case 'tap':
      handleTap(e.x, e.y)
      break
    case 'scroll':
      position.scrollOffset = Math.max(0, position.scrollOffset + e.deltaY)
      dirty = true
      savePosition(position)
      break
    case 'drag-start': {
      const idx = findWordIndicesAt(e.x, e.y)
      if (idx) {
        selection = { 
          startLine: idx.lineIdx, 
          startWordIdx: idx.wordIdx,
          endLine: idx.lineIdx,
          endWordIdx: idx.wordIdx
        }
        dirty = true
      }
      break
    }
    case 'drag-move':
      if (selection) {
        const idx = findWordIndicesAt(e.x, e.y)
        if (idx) {
          selection.endLine = idx.lineIdx
          selection.endWordIdx = idx.wordIdx
          dirty = true
        }
      }
      break
    case 'drag-end':
      if (selection && (selection.startLine !== selection.endLine || selection.startWordIdx !== selection.endWordIdx)) {
        handleSelectionLookup()
      } else {
        selection = null
        dirty = true
      }
      break
    case 'key':
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextScene()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevScene()
      if (e.key === 'Escape') hideLookupCard()
      break
  }
}

function handleTap(x: number, y: number) {
  const idx = findWordIndicesAt(x, y)
  if (!idx) return

  const line = currentLines[idx.lineIdx]
  const wordObj = line.words[idx.wordIdx]
  const word = wordObj.word.replace(/[.,!?;:()"]/g, '')
  if (!word) return

  // Check entity manifest
  const entity = manifest!.entityManifest?.find(e => e.name.toLowerCase() === word.toLowerCase())
  
  showLookupCard({
    mode: entity ? 'entity' : 'ai-loading',
    title: word,
    body: entity?.description,
    anchorX: x,
    anchorY: y
  }, mainCanvas)

  if (!entity) {
    const scene = manifest!.chapters[position!.chapterIndex].scenes[position!.sceneIndex]
    lookupTextAI(word, getSentenceAt(scene.text, wordObj.offset))
  }
}

async function lookupTextAI(text: string, context?: string) {
  try {
    const prompt = context 
      ? `Define the word "${text}" in the context of this sentence: "${context}". Keep it brief and scholarly.`
      : `Provide a brief, scholarly definition for the term "${text}".`

    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama3', 
        prompt,
        stream: false
      })
    })
    const data = await resp.json()
    updateLookupCard({ mode: 'ai-result', body: data.response })
  } catch {
    updateLookupCard({ mode: 'ai-error' })
  }
}

function handleSelectionLookup() {
  if (!selection || !manifest || !position) return
  
  // Extract text from selection
  let text = ''
  const startL = Math.min(selection.startLine, selection.endLine)
  const endL   = Math.max(selection.startLine, selection.endLine)

  for (let li = startL; li <= endL; li++) {
    const line = currentLines[li]
    const wStart = (li === selection.startLine) ? selection.startWordIdx : 0
    const wEnd   = (li === selection.endLine)   ? selection.endWordIdx   : line.words.length - 1
    
    // Note: this simple extraction doesn't handle reversed drag perfectly but works for PoC
    const words = line.words.slice(Math.min(wStart, wEnd), Math.max(wStart, wEnd) + 1)
    text += words.map(w => w.word).join(' ') + ' '
  }

  showLookupCard({
    mode: 'ai-loading',
    title: 'Selection Lookup',
    anchorX: window.innerWidth / 2, 
    anchorY: window.innerHeight / 2
  }, mainCanvas, () => {
    selection = null
    dirty = true
  })

  lookupTextAI(text.trim())
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function findWordIndicesAt(x: number, y: number): { lineIdx: number; wordIdx: number } | null {
  const scrolledY = y + position!.scrollOffset
  const lineIdx = currentLines.findIndex(l => scrolledY >= l.y && scrolledY <= l.y + config.lineHeight)
  if (lineIdx === -1) return null

  const line = currentLines[lineIdx]
  const wordIdx = line.words.findIndex(w => x >= line.x + w.x && x <= line.x + w.x + w.w)
  if (wordIdx === -1) return null

  return { lineIdx, wordIdx }
}

function getSentenceAt(text: string, offset: number): string {
  const left = text.lastIndexOf('.', offset) + 1
  let right = text.indexOf('.', offset)
  if (right === -1) right = text.length
  return text.substring(left, right + 1).trim()
}

function handleSearch(query: string) {
  if (!manifest) return
  searchState = searchBook(manifest, query)
  if (toolbar) toolbar.setSearchState(searchState)
  if (searchState.matches.length > 0) jumpToMatch()
}

function nextScene() {
  if (!manifest || !position) return
  const ch = manifest.chapters[position.chapterIndex]
  if (position.sceneIndex < ch.scenes.length - 1) {
    position.sceneIndex++
    position.scrollOffset = 0
    onSceneChanged()
  } else if (position.chapterIndex < manifest.chapters.length - 1) {
    position.chapterIndex++
    position.sceneIndex = 0
    position.scrollOffset = 0
    onSceneChanged()
  }
}

function prevScene() {
  if (!manifest || !position) return
  if (position.sceneIndex > 0) {
    position.sceneIndex--
    position.scrollOffset = 0
    onSceneChanged()
  } else if (position.chapterIndex > 0) {
    position.chapterIndex--
    const ch = manifest.chapters[position.chapterIndex]
    position.sceneIndex = ch.scenes.length - 1
    position.scrollOffset = 0
    onSceneChanged()
  }
}

function calculateProgress(): number {
  if (!manifest || !position) return 0
  const total = manifest.chapters.reduce((sum, ch) => sum + ch.scenes.length, 0)
  let done = 0
  for (let i = 0; i < position.chapterIndex; i++) done += manifest.chapters[i].scenes.length
  done += position.sceneIndex
  return done / total
}

function updateSceneInfo() {
  if (!manifest || !position) return
  const ch = manifest.chapters[position.chapterIndex]
  sceneInfoEl.textContent = `Scene ${position.sceneIndex + 1} of ${ch.scenes.length}`
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init()
