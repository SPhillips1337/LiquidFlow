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
  loadTheme,
  DEFAULT_FONT_SIZE
} from './persistence'
import { renderTransition } from './transition'
import { createAICompanion } from './ai-companion'
import { ollamaChat, getDefaultModel } from './ai'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const shelfView         = document.getElementById('shelf')!
const readerView        = document.getElementById('reader-view')!
const bookGrid          = document.getElementById('book-grid')!
const mainCanvas        = document.getElementById('reader-canvas') as HTMLCanvasElement
const transitionCanvas  = document.getElementById('transition-canvas') as HTMLCanvasElement
const sceneInfoEl       = document.getElementById('scene-info')!
const progressBar       = document.getElementById('progress-bar')!
const progressFill       = document.getElementById('progress-fill')!

// ── Core Engines ──────────────────────────────────────────────────────────────
const animationDriver = new AnimationDriver()
const layoutCache     = new LayoutCache()

// ── App State ─────────────────────────────────────────────────────────────────
let manifest: BookManifest | null = null
let position: ReadingPosition | null = null
let config: TypographyConfig = makeTypographyConfig(loadFontSize(), window.innerWidth, loadTheme())
let searchState: SearchState = emptySearchState()
let selection: SelectionState | null = null
let mouseX = 0
let mouseY = 0

let toolbar: ReturnType<typeof createToolbar> | null = null
let aiCompanion: ReturnType<typeof createAICompanion> | null = null
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
    initChapterNav() // update nav visibility
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
    onFontReset: () => updateFontSize(DEFAULT_FONT_SIZE),
    onThemeToggle: toggleTheme,
    onSettingsClick: () => alert('Settings menu coming soon! Use the toggle for now.'),
    onSearchSubmit: handleSearch,
    onSearchNext: () => { searchState = nextMatch(searchState); jumpToMatch(); },
    onSearchPrev: () => { searchState = prevMatch(searchState); jumpToMatch(); },
    onSearchClose: () => { searchState = emptySearchState(); dirty = true; },
    onAICompanionToggle: () => { 
      if (aiCompanion) {
        aiCompanion.toggle()
        initChapterNav()
      }
    },
    onChapterSelect: (idx) => jumpToChapter(idx),
    onChapterNext: nextChapter,
    onChapterPrev: prevChapter
  })
  toolbar.setFontSize(config.fontSize, 12, 48)
  toolbar.setTheme(config.theme)
  toolbar.setChapterTitle(book.chapters[position.chapterIndex].title)
  toolbar.setChapterNav(position.chapterIndex > 0, position.chapterIndex < book.chapters.length - 1)

  // Create AI Companion panel
  aiCompanion = createAICompanion(readerView, book, {
    getChapterText: () => getChapterText(),
    getBookTitle: () => book.title,
    getBookAuthor: () => book.author,
    getChapterIndex: () => position?.chapterIndex ?? 0,
    onClose: () => initChapterNav()
  })
  
  // Sync body class for UI theme
  document.body.setAttribute('data-theme', config.theme)

  // Attach input
  inputDetach = attachInputRouter(mainCanvas, handleInput)

  // Bootstrap entities for current scene — disabled: entity obstacles cause text wobble with pretext reflow
  // spawnEntities()
  updateProgress()

  // Initialize interactive scrubber
  initScrubber()

  // Initialize chapter navigation sidebar
  initChapterNav()

  dirty = true
  startLoop()
}

function getChapterText(): string {
  if (!manifest || !position) return ''
  const ch = manifest.chapters[position.chapterIndex]
  return ch.scenes.map(s => s.text).join('\n\n')
}

function closeBook() {
  cancelAnimationFrame(rafId)
  if (toolbar) toolbar.destroy()
  if (aiCompanion) aiCompanion.destroy()
  if (inputDetach) inputDetach()
  
  manifest = null
  position = null
  toolbar = null
  aiCompanion = null
  inputDetach = null
  
  readerView.classList.remove('active')
  shelfView.classList.add('active')

  const nav = document.getElementById('chapter-nav')
  if (nav) nav.classList.add('hidden')
}

function initChapterNav() {
  if (!manifest) return
  const nav = document.getElementById('chapter-nav')
  const inner = nav?.querySelector('.chapter-nav-inner')
  if (!nav || !inner) return

  inner.innerHTML = ''
  manifest.chapters.forEach((ch, idx) => {
    const item = document.createElement('div')
    item.className = 'chapter-nav-item'
    item.textContent = ch.title
    if (idx === position?.chapterIndex) {
      item.classList.add('active')
      item.textContent = `▸ ${item.textContent}`
    }
    item.addEventListener('click', () => jumpToChapter(idx))
    inner.appendChild(item)
  })

  const show = window.innerWidth >= 900 && (!aiCompanion || !aiCompanion.isVisible())
  nav.classList.toggle('hidden', !show)
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
        selection,
        manifest.entityManifest,
        mouseX,
        mouseY
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
  // spawnEntities() — disabled: entity obstacles cause text wobble with pretext reflow
  updateProgress()
  animationDriver.triggerTransition(
    manifest.chapters[position.chapterIndex].scenes[position.sceneIndex],
    position.chapterIndex,
    position.sceneIndex
  )
  updateChapterNavHighlight()
  if (toolbar) {
    toolbar.setChapterNav(position.chapterIndex > 0, position.chapterIndex < (manifest?.chapters.length ?? 0) - 1)
  }
  dirty = true
}

function updateChapterNavHighlight() {
  const nav = document.getElementById('chapter-nav')
  const items = nav?.querySelectorAll('.chapter-nav-item')
  if (!items) return
  items.forEach((item, idx) => {
    const el = item as HTMLElement
    if (idx === position?.chapterIndex) {
      el.classList.add('active')
      el.textContent = `▸ ${manifest?.chapters[idx]?.title ?? ''}`
    } else {
      el.classList.remove('active')
      el.textContent = manifest?.chapters[idx]?.title ?? ''
    }
  })
}

function updateProgress() {
  if (!manifest || !position) return
  const total = manifest.chapters.length
  const current = position.chapterIndex + (position.sceneIndex / manifest.chapters[position.chapterIndex].scenes.length)
  const fraction = current / total
  progressFill.style.width = `${fraction * 100}%`
  if (toolbar) toolbar.setProgress(fraction)
}

// ── Scrubbing Logic ───────────────────────────────────────────────────────────
function initScrubber() {
  let isDragging = false

  const handleScrub = (e: MouseEvent | TouchEvent) => {
    if (!manifest) return
    const rect = progressBar.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const fraction = x / rect.width
    
    // Jump to chapter
    const totalChapters = manifest.chapters.length
    const targetChapter = Math.min(totalChapters - 1, Math.floor(fraction * totalChapters))
    
    if (position && (position.chapterIndex !== targetChapter)) {
      position.chapterIndex = targetChapter
      position.sceneIndex = 0
      position.scrollOffset = 0
      dirty = true
      savePosition(position)
    }
  }

  progressBar.addEventListener('mousedown', (e) => {
    isDragging = true
    handleScrub(e)
  })
  window.addEventListener('mousemove', (e) => {
    if (isDragging) handleScrub(e)
  })
  window.addEventListener('mouseup', () => {
    isDragging = false
  })
}

// ── Input Handling ────────────────────────────────────────────────────────────
function handleInput(e: InputEvent) {
  if (!manifest || !position) return

  switch (e.type) {
    case 'tap':
      handleTap(e.x, e.y)
      break
    case 'mousemove':
      mouseX = e.x
      mouseY = e.y
      dirty = true
      break
    case 'scroll':
      position.scrollOffset = Math.max(0, position.scrollOffset + e.deltaY)
      
      // Check for auto-chapter navigation at boundaries
      checkAutoChapterNav()
      
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
        showSelectionMenu(e.x, e.y)
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

async function lookupTextAI(text: string, context?: string, retryCount = 0) {
  console.log(`[AI Lookup] Starting query for: "${text}" (retry: ${retryCount})`)
  const controller = new AbortController()
  const timeoutMs = retryCount > 0 ? 45000 : 30000 // shorter on retry
  const timeoutId = setTimeout(() => {
    console.warn(`[AI Lookup] TIMEOUT ${timeoutMs/1000}s reached for: "${text}"`)
    controller.abort()
  }, timeoutMs)

  try {
    const prompt = context 
      ? `Define the word "${text}" in the context of this sentence: "${context}". Keep it brief and scholarly.`
      : `Provide a brief, scholarly definition for the term "${text}".`

    console.log(`[AI Lookup] Requesting AI definition for: "${text}"`)
    const response = await ollamaChat(getDefaultModel(), prompt, undefined, controller.signal)

    clearTimeout(timeoutId)
    console.log(`[AI Lookup] Success! Response length: ${response.length}`)
    updateLookupCard({ mode: 'ai-result', body: response })
  } catch (err: any) {
    clearTimeout(timeoutId)
    console.error(`[AI Lookup] Error:`, err)
    const isTimeout = err.name === 'AbortError'
    
    // Retry once on timeout
    if (isTimeout && retryCount === 0) {
      console.log(`[AI Lookup] Retrying with longer timeout...`)
      return lookupTextAI(text, context, 1)
    }
    
    updateLookupCard({ 
      mode: 'ai-error', 
      body: isTimeout ? 'Lookup timed out — AI might be busy' : `Error: ${err.message}`
    })
  }
}

function showSelectionMenu(x: number, y: number) {
  if (!selection) return

  showLookupCard({
    mode: 'selection-menu',
    title: 'Selection',
    anchorX: x,
    anchorY: y,
    onAction: (action) => {
      if (action === 'query') {
        handleSelectionLookup()
      } else if (action === 'copy') {
        const text = getSelectedText()
        navigator.clipboard.writeText(text)
        hideLookupCard()
      }
    }
  }, mainCanvas, () => {
    selection = null
    dirty = true
  })
}

function getSelectedText(): string {
  if (!selection || !manifest || !position) return ''
  
  // Extract text from selection
  let text = ''
  const startL = Math.min(selection.startLine, selection.endLine)
  const endL   = Math.max(selection.startLine, selection.endLine)

  for (let li = startL; li <= endL; li++) {
    const line = currentLines[li]
    if (!line) continue
    const wStart = (li === selection.startLine) ? selection.startWordIdx : 0
    const wEnd   = (li === selection.endLine)   ? selection.endWordIdx   : line.words.length - 1
    
    const words = line.words.slice(Math.min(wStart, wEnd), Math.max(wStart, wEnd) + 1)
    text += words.map(w => w.word).join(' ') + ' '
  }
  return text.trim()
}

function handleSelectionLookup() {
  const text = getSelectedText()
  if (!text) return

  updateLookupCard({
    mode: 'ai-loading',
    body: 'Analyzing selection\u2026'
  })

  lookupTextAI(text)
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

function nextChapter() {
  if (!manifest || !position) return
  if (position.chapterIndex < manifest.chapters.length - 1) {
    position.chapterIndex++
    position.sceneIndex = 0
    position.scrollOffset = 0
    onSceneChanged()
  }
}

function prevChapter() {
  if (!manifest || !position) return
  if (position.chapterIndex > 0) {
    position.chapterIndex--
    position.sceneIndex = 0
    position.scrollOffset = 0
    onSceneChanged()
  }
}

// ── Auto-chapter navigation ───────────────────────────────────────────
let lastAutoNavTime = 0
const AUTO_NAV_COOLDOWN = 1500 // ms between auto-chapter transitions
let justNavigated = false

function checkAutoChapterNav() {
  if (!manifest || !position || !currentLines.length || justNavigated) return
  
  const now = Date.now()
  if (now - lastAutoNavTime < AUTO_NAV_COOLDOWN) return
  
  const contentHeight = currentLines.length * config.lineHeight
  const scrollY = position.scrollOffset
  
  // At bottom of content - need extra padding before auto-advancing
  if (scrollY > contentHeight + config.lineHeight) {
    console.log('[AutoNav] Bottom reached, going next')
    justNavigated = true
    lastAutoNavTime = now
    nextScene()
    setTimeout(() => { justNavigated = false }, 500)
  }
  
  // At top of content - go to previous
  else if (scrollY <= 50 && position.chapterIndex > 0) {
    console.log('[AutoNav] Top reached, going prev')
    justNavigated = true
    lastAutoNavTime = now
    prevScene()
    setTimeout(() => { justNavigated = false }, 500)
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
