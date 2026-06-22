import type { BookManifest, TtsPlaybackState } from './types'
import { ollamaChat, getDefaultModel } from './ai'

const MAX_CHARS = 3500

export interface AICompanionCallbacks {
  getChapterText(): string
  getBookTitle(): string
  getBookAuthor(): string
  getChapterIndex(): number
  onTtsRead(): void
  onTtsPauseResume(): void
  onTtsStop(): void
  onClose?: () => void
}

export function createAICompanion(
  container: HTMLElement,
  manifest: BookManifest,
  callbacks: AICompanionCallbacks
) {
  const panel = document.createElement('div')
  panel.className = 'ai-companion hidden'
  panel.innerHTML = `
    <div class="ai-header">
      <span class="ai-title">✦ AI Companion</span>
      <button class="tb-btn ai-close">✕</button>
    </div>
    <div class="ai-actions">
      <button class="tb-btn ai-action" data-action="summarize">📋 Summarize</button>
      <button class="tb-btn ai-action" data-action="guide">📖 Study Guide</button>
      <button class="tb-btn ai-action" data-action="quiz">❓ Quiz Me</button>
      <button class="tb-btn ai-action" data-action="extract">🏛️ Notes</button>
      <button class="tb-btn ai-action" data-action="saved-notes">📂 Saved</button>
    </div>
    <div class="ai-tts">
      <div class="ai-tts-row">
        <button class="tb-btn ai-tts-toggle">🔊 Read Aloud</button>
        <button class="tb-btn ai-tts-stop hidden">⏹</button>
      </div>
      <div class="ai-tts-settings-note">Uses the voice, speed, and pitch from Reader Settings.</div>
    </div>
    <div class="ai-results"></div>
  `
  container.appendChild(panel)

  const resultsEl = panel.querySelector<HTMLElement>('.ai-results')!
  const closeBtn = panel.querySelector<HTMLButtonElement>('.ai-close')!
  const actionBtns = panel.querySelectorAll<HTMLButtonElement>('.ai-action')
  const ttsToggle = panel.querySelector<HTMLButtonElement>('.ai-tts-toggle')!
  const ttsStop = panel.querySelector<HTMLButtonElement>('.ai-tts-stop')!

  let ttsState: TtsPlaybackState = 'idle'
  let quizState: { questions: Array<{ q: string; a: string }>; current: number } | null = null

  function setTtsPlaybackState(state: TtsPlaybackState) {
    ttsState = state
    ttsStop.classList.toggle('hidden', state === 'idle')
    ttsToggle.textContent = state === 'paused' ? '▶ Resume' : state === 'speaking' ? '⏸ Pause' : '🔊 Read Aloud'
  }

  ttsToggle.addEventListener('click', () => {
    if (ttsState !== 'idle') {
      callbacks.onTtsPauseResume()
      return
    }
    callbacks.onTtsRead()
  })

  ttsStop.addEventListener('click', () => callbacks.onTtsStop())

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function fmt(s: string): string {
    return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
  }

  function setLoading() { resultsEl.innerHTML = '<div class="ai-loading"><span class="spinner"></span> Analyzing&hellip;</div>' }

  function showError(msg: string) { resultsEl.innerHTML = `<div class="ai-error">⚠️ ${escapeHtml(msg)}</div>` }

  async function callAI(prompt: string): Promise<string | null> {
    setLoading()
    try {
      return await ollamaChat(getDefaultModel(), prompt)
    } catch (err: any) {
      showError(err.message || 'AI request failed. Is Ollama running?')
      return null
    }
  }

  async function handleSummarize() {
    const text = callbacks.getChapterText().slice(0, MAX_CHARS)
    if (!text) { showError('No chapter text.'); return }
    const r = await callAI(`Act as a brutal book summarizer. For "${callbacks.getBookTitle()}" by ${callbacks.getBookAuthor()}, based on this chapter:

${text}

Give me:
\u2022 1-sentence thesis
\u2022 5 key ideas with examples
\u2022 3 actionable takeaways
\u2022 Who should skip this chapter

No fluff.`)
    if (r) resultsEl.innerHTML = `<div class="ai-result">${fmt(r)}</div>`
  }

  async function handleGuide() {
    const text = callbacks.getChapterText().slice(0, MAX_CHARS)
    if (!text) { showError('No chapter text.'); return }
    const r = await callAI(`Walk me through this chapter of "${callbacks.getBookTitle()}".

For this chapter:
\u2022 Main argument
\u2022 Best quote (paraphrased)
\u2022 One question to make me think
\u2022 Connection to previous chapters

Chapter:
${text}`)
    if (r) resultsEl.innerHTML = `<div class="ai-result">${fmt(r)}</div>`
  }

  async function handleQuiz() {
    const text = callbacks.getChapterText().slice(0, MAX_CHARS)
    if (!text) { showError('No chapter text.'); return }
    const r = await callAI(`I just read this chapter of "${callbacks.getBookTitle()}". Quiz me with 5 questions:

\u2022 2 factual recall
\u2022 2 conceptual understanding
\u2022 1 application to my life

Format exactly:
Q1: [question]
A1: [answer]
Q2: [question]
A2: [answer]

Chapter:
${text}`)
    if (!r) return
    const questions = parseQuiz(r)
    if (questions.length === 0) { resultsEl.innerHTML = `<div class="ai-result">${fmt(r)}</div>`; return }
    quizState = { questions, current: 0 }
    renderQuiz()
  }

  async function handleExtract() {
    const text = callbacks.getChapterText().slice(0, MAX_CHARS)
    if (!text) { showError('No chapter text.'); return }
    const r = await callAI(`I'm building a personal library index. For this chapter of "${callbacks.getBookTitle()}":
Extract:
\u2022 3 quotes worth remembering
\u2022 Core frameworks I can reuse
\u2022 Tags for future reference (themes, mood, applications)

Format as clean notes.

Chapter:
${text}`)
    if (!r) return
    const key = `liquidflow.notes.${manifest.id}.${callbacks.getChapterIndex()}`
    localStorage.setItem(key, r)
    resultsEl.innerHTML = `<div class="ai-result"><span class="ai-saved-badge">\u2713 Saved</span>${fmt(r)}</div>`
  }

  function handleSavedNotes() {
    const prefix = `liquidflow.notes.${manifest.id}.`
    const entries: Array<{ idx: number; text: string }> = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) {
        const idx = parseInt(k.slice(prefix.length))
        const t = localStorage.getItem(k)!
        entries.push({ idx, text: t })
      }
    }
    entries.sort((a, b) => a.idx - b.idx)
    if (entries.length === 0) {
      resultsEl.innerHTML = '<div class="ai-result">No saved notes yet. Open a chapter and use "Notes" to extract.</div>'
      return
    }
    let html = '<div class="ai-saved-list">'
    for (const e of entries) {
      html += `<details class="ai-note-item"><summary>Chapter ${e.idx + 1}</summary><div class="ai-note-content">${fmt(e.text)}</div></details>`
    }
    html += '</div>'
    resultsEl.innerHTML = html
  }

  function parseQuiz(text: string): Array<{ q: string; a: string }> {
    const out: Array<{ q: string; a: string }> = []
    const re = /Q\d+:\s*(.+?)\s*A\d+:\s*(.+?)(?=Q\d+:|$)/gs
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      out.push({ q: m[1].trim(), a: m[2].trim() })
    }
    return out
  }

  function renderQuiz() {
    if (!quizState || quizState.questions.length === 0) return
    const { questions, current } = quizState
    const q = questions[current]
    const total = questions.length
    let html = `<div class="ai-quiz">
      <div class="ai-quiz-header">Question ${current + 1} of ${total}</div>
      <div class="ai-quiz-question">${escapeHtml(q.q)}</div>
      <div class="ai-quiz-answer hidden">${escapeHtml(q.a)}</div>
      <div class="ai-quiz-actions">
        <button class="tb-btn ai-quiz-reveal">Show Answer</button>
      </div>
      <div class="ai-quiz-nav">
        ${current > 0 ? '<button class="tb-btn ai-quiz-prev">\u2190 Prev</button>' : ''}
        ${current < total - 1 ? '<button class="tb-btn ai-quiz-next">Next \u2192</button>' : ''}
      </div>
    </div>`
    resultsEl.innerHTML = html
    const revealBtn = resultsEl.querySelector<HTMLButtonElement>('.ai-quiz-reveal')
    const answerEl = resultsEl.querySelector<HTMLElement>('.ai-quiz-answer')
    revealBtn?.addEventListener('click', () => {
      answerEl?.classList.remove('hidden')
      revealBtn.textContent = '\u2713'
      revealBtn.disabled = true
    })
    resultsEl.querySelector<HTMLButtonElement>('.ai-quiz-prev')?.addEventListener('click', () => {
      if (quizState) { quizState.current--; renderQuiz() }
    })
    resultsEl.querySelector<HTMLButtonElement>('.ai-quiz-next')?.addEventListener('click', () => {
      if (quizState) { quizState.current++; renderQuiz() }
    })
  }

  const actionMap: Record<string, () => void> = {
    summarize: handleSummarize,
    guide: handleGuide,
    quiz: handleQuiz,
    extract: handleExtract,
    'saved-notes': handleSavedNotes,
  }
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.action
      if (a && actionMap[a]) actionMap[a]()
    })
  })

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden')
    callbacks.onClose?.()
  })

  return {
    show() { panel.classList.remove('hidden') },
    hide() { panel.classList.add('hidden') },
    toggle() { panel.classList.toggle('hidden') },
    setTtsPlaybackState,
    destroy() { callbacks.onTtsStop(); panel.remove() },
    isVisible() { return !panel.classList.contains('hidden') }
  }
}
