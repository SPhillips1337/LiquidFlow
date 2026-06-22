import type { BookManifest, SearchState, TtsPlaybackState, TtsSettings, TtsVoiceOption } from './types'

export interface ToolbarCallbacks {
  onBack(): void
  onFontIncrease(): void
  onFontDecrease(): void
  onFontReset(): void
  onThemeToggle(): void
  onSearchSubmit(query: string): void
  onSearchNext(): void
  onSearchPrev(): void
  onSearchClose(): void
  onAICompanionToggle(): void
  onChapterSelect(chapterIndex: number): void
  onChapterNext(): void
  onChapterPrev(): void
  onTtsSettingsChange(settings: TtsSettings): void
  onTtsRead(): void
  onTtsPauseResume(): void
  onTtsStop(): void
}

export function createToolbar(
  container: HTMLElement,
  manifest: BookManifest,
  callbacks: ToolbarCallbacks
): {
  setChapterTitle(title: string): void
  setChapterNav(hasPrev: boolean, hasNext: boolean): void
  setProgress(fraction: number): void
  setSearchState(state: SearchState): void
  setFontSize(size: number, min: number, max: number): void
  setTheme(theme: 'dark' | 'light' | 'sepia'): void
  setTtsSettings(settings: TtsSettings): void
  setTtsVoices(voices: TtsVoiceOption[]): void
  setTtsPlaybackState(state: TtsPlaybackState): void
  destroy(): void
} {
  // ── Inject HTML ────────────────────────────────────────────────────────────
  const toolbarEl = document.createElement('div')
  toolbarEl.className = 'reader-toolbar'
  toolbarEl.innerHTML = `
    <div class="toolbar-left">
      <button class="tb-btn tb-back" aria-label="Back to library">←</button>
    </div>
    <div class="toolbar-center" style="cursor: pointer;" title="Open chapter list">
      <button class="tb-btn tb-chapter-prev" aria-label="Previous chapter">‹</button>
      <span class="tb-chapter-title"></span>
      <span class="tb-progress"></span>
      <button class="tb-btn tb-chapter-next" aria-label="Next chapter">›</button>
    </div>
    <div class="toolbar-right">
      <button class="tb-btn tb-font-dec" aria-label="Decrease font size">A−</button>
      <button class="tb-btn tb-font-reset" aria-label="Reset font size">⟲</button>
      <button class="tb-btn tb-font-inc" aria-label="Increase font size">A+</button>
      <button class="tb-btn tb-theme" aria-label="Toggle light/dark mode">☀️</button>
      <button class="tb-btn tb-settings" aria-label="Settings">⚙️</button>
      <button class="tb-btn tb-ai" aria-label="AI Companion">✦</button>
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

  const settingsOverlay = document.createElement('div')
  settingsOverlay.className = 'settings-overlay hidden'
  settingsOverlay.setAttribute('role', 'dialog')
  settingsOverlay.setAttribute('aria-labelledby', 'settings-title')
  settingsOverlay.innerHTML = `
    <form class="settings-panel">
      <div class="settings-header">
        <h2 id="settings-title">Reader Settings</h2>
        <button class="tb-btn settings-close" type="button" aria-label="Close settings">✕</button>
      </div>
      <fieldset class="settings-fieldset">
        <legend>Text to Speech</legend>
        <label class="settings-field" for="tts-voice">
          <span>Voice</span>
          <select id="tts-voice" name="voice" class="tts-voice-select"></select>
        </label>
        <label class="settings-field" for="tts-rate">
          <span>Speed <output class="tts-rate-value" for="tts-rate">1.0x</output></span>
          <input id="tts-rate" name="rate" class="tts-rate" type="range" min="0.5" max="2" step="0.1" value="1" />
        </label>
        <label class="settings-field" for="tts-pitch">
          <span>Pitch <output class="tts-pitch-value" for="tts-pitch">1.0</output></span>
          <input id="tts-pitch" name="pitch" class="tts-pitch" type="range" min="0.5" max="2" step="0.1" value="1" />
        </label>
        <label class="settings-check" for="tts-auto-read">
          <input id="tts-auto-read" name="autoRead" class="tts-auto-read" type="checkbox" />
          <span>Auto-read when opening a book or changing chapters</span>
        </label>
        <div class="settings-actions">
          <button class="tb-btn tts-read" type="button">Read chapter</button>
          <button class="tb-btn tts-pause" type="button" disabled>Pause</button>
          <button class="tb-btn tts-stop" type="button" disabled>Stop</button>
        </div>
        <p class="tts-status" aria-live="polite"></p>
      </fieldset>
    </form>
  `

  container.appendChild(toolbarEl)
  container.appendChild(chapterOverlay)
  container.appendChild(searchOverlay)
  container.appendChild(settingsOverlay)

  // ── Element refs ───────────────────────────────────────────────────────────
  const chapterTitleEl = toolbarEl.querySelector<HTMLElement>('.tb-chapter-title')!
  const progressEl = toolbarEl.querySelector<HTMLElement>('.tb-progress')!
  const fontDecBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-font-dec')!
  const fontResetBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-font-reset')!
  const fontIncBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-font-inc')!
  const themeBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-theme')!
  const settingsBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-settings')!
  const searchBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-search')!
  const chaptersBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-chapters')!
  const aiBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-ai')!
  const backBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-back')!
  const chapterPrevBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-chapter-prev')!
  const chapterNextBtn = toolbarEl.querySelector<HTMLButtonElement>('.tb-chapter-next')!

  const chapterListInner = chapterOverlay.querySelector<HTMLElement>('.chapter-list-inner')!

  const searchInput = searchOverlay.querySelector<HTMLInputElement>('.search-input')!
  const searchSubmitBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-submit')!
  const searchPrevBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-prev')!
  const searchNextBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-next')!
  const searchCloseBtn = searchOverlay.querySelector<HTMLButtonElement>('.search-close')!
  const searchStatusEl = searchOverlay.querySelector<HTMLElement>('.search-status')!
  const settingsCloseBtn = settingsOverlay.querySelector<HTMLButtonElement>('.settings-close')!
  const ttsVoiceSelect = settingsOverlay.querySelector<HTMLSelectElement>('.tts-voice-select')!
  const ttsRateInput = settingsOverlay.querySelector<HTMLInputElement>('.tts-rate')!
  const ttsPitchInput = settingsOverlay.querySelector<HTMLInputElement>('.tts-pitch')!
  const ttsAutoReadInput = settingsOverlay.querySelector<HTMLInputElement>('.tts-auto-read')!
  const ttsRateValue = settingsOverlay.querySelector<HTMLOutputElement>('.tts-rate-value')!
  const ttsPitchValue = settingsOverlay.querySelector<HTMLOutputElement>('.tts-pitch-value')!
  const ttsReadBtn = settingsOverlay.querySelector<HTMLButtonElement>('.tts-read')!
  const ttsPauseBtn = settingsOverlay.querySelector<HTMLButtonElement>('.tts-pause')!
  const ttsStopBtn = settingsOverlay.querySelector<HTMLButtonElement>('.tts-stop')!
  const ttsStatusEl = settingsOverlay.querySelector<HTMLElement>('.tts-status')!

  let currentTtsSettings: TtsSettings = {
    voiceURI: '',
    rate: 1,
    pitch: 1,
    autoRead: false
  }

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
    settingsOverlay.classList.add('hidden')
  }

  function closeChapterOverlay() {
    chapterOverlay.classList.add('hidden')
  }

  function openSearchOverlay() {
    searchOverlay.classList.remove('hidden')
    chapterOverlay.classList.add('hidden')
    settingsOverlay.classList.add('hidden')
    searchInput.focus()
  }

  function closeSearchOverlay() {
    searchOverlay.classList.add('hidden')
    searchStatusEl.textContent = ''
  }

  function openSettingsOverlay() {
    settingsOverlay.classList.remove('hidden')
    chapterOverlay.classList.add('hidden')
    searchOverlay.classList.add('hidden')
    ttsVoiceSelect.focus()
  }

  function closeSettingsOverlay() {
    settingsOverlay.classList.add('hidden')
  }

  function readTtsSettings(): TtsSettings {
    return {
      voiceURI: ttsVoiceSelect.value,
      rate: Number(ttsRateInput.value),
      pitch: Number(ttsPitchInput.value),
      autoRead: ttsAutoReadInput.checked
    }
  }

  function handleTtsSettingsInput() {
    currentTtsSettings = readTtsSettings()
    ttsRateValue.value = `${currentTtsSettings.rate.toFixed(1)}x`
    ttsPitchValue.value = currentTtsSettings.pitch.toFixed(1)
    callbacks.onTtsSettingsChange(currentTtsSettings)
  }

  // ── Button handlers ────────────────────────────────────────────────────────
  function handleBack() { callbacks.onBack() }
function handleChapterPrev(e: Event) { 
  e.stopPropagation()
  callbacks.onChapterPrev() 
}
function handleChapterNext(e: Event) { 
  e.stopPropagation()
  callbacks.onChapterNext() 
}
  function handleFontDec() { callbacks.onFontDecrease() }
  function handleFontReset() { callbacks.onFontReset() }
  function handleFontInc() { callbacks.onFontIncrease() }
  function handleThemeToggle() { callbacks.onThemeToggle() }
  function handleSettingsClick() {
    if (settingsOverlay.classList.contains('hidden')) {
      openSettingsOverlay()
    } else {
      closeSettingsOverlay()
    }
  }

  function handleAIToggle() { callbacks.onAICompanionToggle() }

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
    if (!chapterOverlay.classList.contains('hidden') && !chapterOverlay.contains(target) && target !== chaptersBtn && !toolbarCenter.contains(target)) {
      closeChapterOverlay()
    }
    if (!searchOverlay.classList.contains('hidden') && !searchOverlay.contains(target) && target !== searchBtn) {
      closeSearchOverlay()
    }
    if (!settingsOverlay.classList.contains('hidden') && !settingsOverlay.contains(target) && target !== settingsBtn) {
      closeSettingsOverlay()
    }
  }

  function handleDocKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeChapterOverlay()
      closeSearchOverlay()
      closeSettingsOverlay()
    }
  }

  const toolbarCenter = toolbarEl.querySelector<HTMLElement>('.toolbar-center')!

  // ── Attach listeners ───────────────────────────────────────────────────────
  backBtn.addEventListener('click', handleBack)
  chapterPrevBtn.addEventListener('click', handleChapterPrev)
  chapterNextBtn.addEventListener('click', handleChapterNext)
  fontDecBtn.addEventListener('click', handleFontDec)
  fontResetBtn.addEventListener('click', handleFontReset)
  fontIncBtn.addEventListener('click', handleFontInc)
  themeBtn.addEventListener('click', handleThemeToggle)
  settingsBtn.addEventListener('click', handleSettingsClick)
  aiBtn.addEventListener('click', handleAIToggle)
  searchBtn.addEventListener('click', handleSearchToggle)
  chaptersBtn.addEventListener('click', handleChaptersToggle)
  toolbarCenter.addEventListener('click', handleChaptersToggle)
  searchSubmitBtn.addEventListener('click', handleSearchSubmit)
  searchPrevBtn.addEventListener('click', () => callbacks.onSearchPrev())
  searchNextBtn.addEventListener('click', () => callbacks.onSearchNext())
  searchCloseBtn.addEventListener('click', handleSearchClose)
  searchInput.addEventListener('keydown', handleSearchInputKeydown)
  settingsCloseBtn.addEventListener('click', closeSettingsOverlay)
  ttsVoiceSelect.addEventListener('change', handleTtsSettingsInput)
  ttsRateInput.addEventListener('input', handleTtsSettingsInput)
  ttsPitchInput.addEventListener('input', handleTtsSettingsInput)
  ttsAutoReadInput.addEventListener('change', handleTtsSettingsInput)
  ttsReadBtn.addEventListener('click', () => callbacks.onTtsRead())
  ttsPauseBtn.addEventListener('click', () => callbacks.onTtsPauseResume())
  ttsStopBtn.addEventListener('click', () => callbacks.onTtsStop())
  document.addEventListener('pointerdown', handleDocPointerdown)
  document.addEventListener('keydown', handleDocKeydown)

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    setChapterTitle(title: string) {
      chapterTitleEl.textContent = title
    },

    setChapterNav(hasPrev: boolean, hasNext: boolean) {
      chapterPrevBtn.disabled = !hasPrev
      chapterNextBtn.disabled = !hasNext
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
      fontResetBtn.disabled = size === 18
    },

    setTheme(theme: 'dark' | 'light' | 'sepia') {
      themeBtn.textContent = theme === 'light' ? '🌙' : '☀️'
    },

    setTtsSettings(settings: TtsSettings) {
      currentTtsSettings = settings
      ttsVoiceSelect.value = settings.voiceURI
      ttsRateInput.value = String(settings.rate)
      ttsPitchInput.value = String(settings.pitch)
      ttsAutoReadInput.checked = settings.autoRead
      ttsRateValue.value = `${settings.rate.toFixed(1)}x`
      ttsPitchValue.value = settings.pitch.toFixed(1)
    },

    setTtsVoices(voices: TtsVoiceOption[]) {
      const selected = currentTtsSettings.voiceURI
      ttsVoiceSelect.innerHTML = ''

      if (voices.length === 0) {
        const option = document.createElement('option')
        option.value = ''
        option.textContent = 'System default voice'
        ttsVoiceSelect.appendChild(option)
        ttsStatusEl.textContent = 'No browser voices loaded yet.'
        return
      }

      const defaultOption = document.createElement('option')
      defaultOption.value = ''
      defaultOption.textContent = 'System default voice'
      ttsVoiceSelect.appendChild(defaultOption)

      for (const voice of voices) {
        const option = document.createElement('option')
        const natural = voice.name.toLowerCase().includes('natural') ? ' · Natural' : ''
        option.value = voice.voiceURI
        option.textContent = `${voice.name}${natural} (${voice.lang})`
        ttsVoiceSelect.appendChild(option)
      }

      ttsVoiceSelect.value = voices.some(v => v.voiceURI === selected) ? selected : ''
      ttsStatusEl.textContent = `${voices.length} voices available. Microsoft Natural voices appear first when available.`
    },

    setTtsPlaybackState(state: TtsPlaybackState) {
      const speaking = state === 'speaking'
      const paused = state === 'paused'
      ttsPauseBtn.disabled = state === 'idle'
      ttsStopBtn.disabled = state === 'idle'
      ttsPauseBtn.textContent = paused ? 'Resume' : 'Pause'
      ttsReadBtn.textContent = speaking || paused ? 'Restart chapter' : 'Read chapter'
      ttsStatusEl.textContent = state === 'idle' ? 'Ready to read the current chapter.' : state === 'paused' ? 'Reading paused.' : 'Reading aloud.'
    },

    destroy() {
      aiBtn.removeEventListener('click', handleAIToggle)
      backBtn.removeEventListener('click', handleBack)
      fontDecBtn.removeEventListener('click', handleFontDec)
      fontIncBtn.removeEventListener('click', handleFontInc)
      themeBtn.removeEventListener('click', handleThemeToggle)
      settingsBtn.removeEventListener('click', handleSettingsClick)
      searchBtn.removeEventListener('click', handleSearchToggle)
      chaptersBtn.removeEventListener('click', handleChaptersToggle)
      toolbarCenter.removeEventListener('click', handleChaptersToggle)
      searchSubmitBtn.removeEventListener('click', handleSearchSubmit)
      searchPrevBtn.removeEventListener('click', () => callbacks.onSearchPrev())
      searchNextBtn.removeEventListener('click', () => callbacks.onSearchNext())
      searchCloseBtn.removeEventListener('click', handleSearchClose)
      searchInput.removeEventListener('keydown', handleSearchInputKeydown)
      settingsCloseBtn.removeEventListener('click', closeSettingsOverlay)
      ttsVoiceSelect.removeEventListener('change', handleTtsSettingsInput)
      ttsRateInput.removeEventListener('input', handleTtsSettingsInput)
      ttsPitchInput.removeEventListener('input', handleTtsSettingsInput)
      ttsAutoReadInput.removeEventListener('change', handleTtsSettingsInput)
      document.removeEventListener('pointerdown', handleDocPointerdown)
      document.removeEventListener('keydown', handleDocKeydown)
      toolbarEl.remove()
      chapterOverlay.remove()
      searchOverlay.remove()
      settingsOverlay.remove()
    },
  }
}
