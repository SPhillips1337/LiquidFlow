import type { BookManifest, SearchState } from './types'

export interface ToolbarCallbacks {
  onBack(): void
  onFontIncrease(): void
  onFontDecrease(): void
  onThemeToggle(): void
  onSettingsClick(): void
  onSearchSubmit(query: string): void
  onSearchNext(): void
  onSearchPrev(): void
  onSearchClose(): void
  onChapterSelect(chapterIndex: number): void
}

export function createToolbar(
  container: HTMLElement,
  manifest: BookManifest,
  callbacks: ToolbarCallbacks
): {
  setChapterTitle(title: string): void
  setProgress(fraction: number): void
  setSearchState(state: SearchState): void
  setFontSize(size: number, min: number, max: number): void
  setTheme(theme: 'dark' | 'light' | 'sepia'): void
  destroy(): void
} {
  // ── Inject HTML ────────────────────────────────────────────────────────────
  const toolbarEl = document.createElement('div')
  toolbarEl.className = 'reader-toolbar'
  toolbarEl.innerHTML = `
    <div class="toolbar-left">
      <button class="tb-btn tb-back" aria-label="Back to library">←</button>
    </div>
    <div class="toolbar-center">
      <span class="tb-chapter-title"></span>
      <span class="tb-progress"></span>
    </div>
    <div class="toolbar-right">
      <button class="tb-btn tb-font-dec" aria-label="Decrease font size">A−</button>
      <button class="tb-btn tb-font-inc" aria-label="Increase font size">A+</button>
      <button class="tb-btn tb-theme" aria-label="Toggle light/dark mode">☀️</button>
      <button class="tb-btn tb-settings" aria-label="Settings">⚙️</button>
      <button class="tb-btn tb-search" aria-label="Search">🔍</button>
      <button class="tb-btn tb-chapters" aria-label="Chapter list">≡</button>
    </div>
  `

  const chapterOverlay = document.createElement('div')
  chapterOverlay.className = 'chapter-list-overlay hidden'
  chapterOverlay.setAttribute('role', 'dialog')
  chapterOverlay.setAttribute('aria-label', 'Chapter list')
  chapterOverlay.innerHTML = `<div class="chapter-list-inner"></div>`

  const searchOverlay = document.createElement('div')
  searchOverlay.className = 'search-overlay hidden'
  searchOverlay.setAttribute('role', 'search')
  searchOverlay.innerHTML = `
    <div class="search-inner">
      <input class="search-input" type="text" placeholder="Search…" aria-label="Search book" />
      <button class="tb-btn search-submit">Find</button>
      <button class="tb-btn search-prev" aria-label="Previous match">↑</button>
      <button class="tb-btn search-next" aria-label="Next match">↓</button>
      <button class="tb-btn search-close" aria-label="Close search">✕</button>
    </div>
    <div class="search-status"></div>
  `

  container.appendChild(toolbarEl)
  container.appendChild(chapterOverlay)
  container.appendChild(searchOverlay)

  // ── Element refs ───────────────────────────────────────────────────────────
  const chapterTitleEl = toolbarEl.querySelector<HTMLElement>('.tb-chapter-title')!
  const progressEl = toolbarEl.querySelector<HTMLElement>('.tb-progress')!
  const fontDecBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-font-dec')!
  const fontIncBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-font-inc')!
  const themeBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-theme')!
  const settingsBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-settings')!
  const searchBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-search')!
  const chaptersBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-chapters')!
  const backBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-back')!

  const chapterListInner = chapterOverlay.querySelector<HTMLElement>('.chapter-list-inner')!

  const searchInput = searchOverlay.querySelector<HTMLInputElement>('.search-input')!
  const searchSubmitBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-submit')!
  const searchPrevBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-prev')!
  const searchNextBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-next')!
  const searchCloseBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-close')!
  const searchStatusEl = searchOverlay.querySelector<HTMLElement>('.search-status')!

  // ── Populate chapter list ──────────────────────────────────────────────────
  manifest.chapters.forEach((chapter, index) => {
    const item = document.createElement('button')
    item.className = 'chapter-item'
    item.textContent = chapter.title
    item.addEventListener('click', () => {
      callbacks.onChapterSelect(index)
      closeChapterOverlay()
    })
    chapterListInner.appendChild(item)
  })

  // ── Overlay helpers ────────────────────────────────────────────────────────
  function openChapterOverlay() {
    chapterOverlay.classList.remove('hidden')
    searchOverlay.classList.add('hidden')
  }

  function closeChapterOverlay() {
    chapterOverlay.classList.add('hidden')
  }

  function openSearchOverlay() {
    searchOverlay.classList.remove('hidden')
    chapterOverlay.classList.add('hidden')
    searchInput.focus()
  }

  function closeSearchOverlay() {
    searchOverlay.classList.add('hidden')
    searchStatusEl.textContent = ''
  }

  // ── Button handlers ────────────────────────────────────────────────────────
  function handleBack() { callbacks.onBack() }
  function handleFontDec() { callbacks.onFontDecrease() }
  function handleFontInc() { callbacks.onFontIncrease() }
  function handleThemeToggle() { callbacks.onThemeToggle() }
  function handleSettingsClick() { callbacks.onSettingsClick() }

  function handleSearchToggle() {
    if (searchOverlay.classList.contains('hidden')) {
      openSearchOverlay()
    } else {
      closeSearchOverlay()
    }
  }

  function handleChaptersToggle() {
    if (chapterOverlay.classList.contains('hidden')) {
      openChapterOverlay()
    } else {
      closeChapterOverlay()
    }
  }

  function handleSearchSubmit() {
    const query = searchInput.value.trim()
    if (!query) {
      searchStatusEl.textContent = 'Enter a search term'
      return
    }
    callbacks.onSearchSubmit(query)
  }

  function handleSearchClose() {
    callbacks.onSearchClose()
    closeSearchOverlay()
  }

  function handleSearchInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearchSubmit()
    }
  }

  // ── Outside click / Escape to close overlays ───────────────────────────────
  function handleDocPointerdown(e: PointerEvent) {
    const target = e.target as Node
    if (!chapterOverlay.classList.contains('hidden') && !chapterOverlay.contains(target) && target !== chaptersBtn) {
      closeChapterOverlay()
    }
    if (!searchOverlay.classList.contains('hidden') && !searchOverlay.contains(target) && target !== searchBtn) {
      closeSearchOverlay()
    }
  }

  function handleDocKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeChapterOverlay()
      closeSearchOverlay()
    }
  }

  // ── Attach listeners ───────────────────────────────────────────────────────
  backBtn.addEventListener('click', handleBack)
  fontDecBtn.addEventListener('click', handleFontDec)
  fontIncBtn.addEventListener('click', handleFontInc)
  themeBtn.addEventListener('click', handleThemeToggle)
  settingsBtn.addEventListener('click', handleSettingsClick)
  searchBtn.addEventListener('click', handleSearchToggle)
  chaptersBtn.addEventListener('click', handleChaptersToggle)
  searchSubmitBtn.addEventListener('click', handleSearchSubmit)
  searchPrevBtn.addEventListener('click', () => callbacks.onSearchPrev())
  searchNextBtn.addEventListener('click', () => callbacks.onSearchNext())
  searchCloseBtn.addEventListener('click', handleSearchClose)
  searchInput.addEventListener('keydown', handleSearchInputKeydown)
  document.addEventListener('pointerdown', handleDocPointerdown)
  document.addEventListener('keydown', handleDocKeydown)

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    setChapterTitle(title: string) {
      chapterTitleEl.textContent = title
    },

    setProgress(fraction: number) {
      progressEl.textContent = `${Math.round(fraction * 100)}%`
    },

    setSearchState(state: SearchState) {
      if (!state.query) {
        searchStatusEl.textContent = ''
      } else if (state.matches.length === 0) {
        searchStatusEl.textContent = 'No results'
      } else {
        searchStatusEl.textContent = `${state.currentIndex + 1} of ${state.matches.length} matches`
      }
    },

    setFontSize(size: number, min: number, max: number) {
      fontDecBtn.disabled = size <= min
      fontIncBtn.disabled = size >= max
    },

    setTheme(theme: 'dark' | 'light' | 'sepia') {
      themeBtn.textContent = theme === 'light' ? '🌙' : '☀️'
    },

    destroy() {
      backBtn.removeEventListener('click', handleBack)
      fontDecBtn.removeEventListener('click', handleFontDec)
      fontIncBtn.removeEventListener('click', handleFontInc)
      themeBtn.removeEventListener('click', handleThemeToggle)
      settingsBtn.removeEventListener('click', handleSettingsClick)
      searchBtn.removeEventListener('click', handleSearchToggle)
      chaptersBtn.removeEventListener('click', handleChaptersToggle)
      searchSubmitBtn.removeEventListener('click', handleSearchSubmit)
      searchPrevBtn.removeEventListener('click', () => callbacks.onSearchPrev())
      searchNextBtn.removeEventListener('click', () => callbacks.onSearchNext())
      searchCloseBtn.removeEventListener('click', handleSearchClose)
      searchInput.removeEventListener('keydown', handleSearchInputKeydown)
      document.removeEventListener('pointerdown', handleDocPointerdown)
      document.removeEventListener('keydown', handleDocKeydown)
      toolbarEl.remove()
      chapterOverlay.remove()
      searchOverlay.remove()
    },
  }
}
