// ── Marginalia / Lore Card ───────────────────────────────────────────────────
// Triggered when user taps/clicks an entity name in the text.
// Uses Chain-of-Density prompting via Ollama.

import { generateLoreCard } from './ai'

let activeController: AbortController | null = null

export function showMarginalia(
  entity: string,
  context: string,
  bookTitle: string,
  panel: HTMLElement,
  contentEl: HTMLElement
): void {
  // Cancel any in-flight request
  activeController?.abort()
  activeController = new AbortController()

  panel.classList.remove('hidden')
  contentEl.innerHTML = `<div class="loading"><div class="spinner"></div> researching ${entity}…</div>`

  generateLoreCard(entity, context, bookTitle, activeController.signal)
    .then(text => {
      contentEl.innerHTML = `<strong>${entity}</strong><br><br>${escapeHtml(text)}`
    })
    .catch(err => {
      if (err.name === 'AbortError') return
      contentEl.innerHTML = `<span style="color:var(--text-muted)">Could not reach AI — check Ollama connection.</span>`
    })
}

export function hideMarginalia(panel: HTMLElement): void {
  activeController?.abort()
  activeController = null
  panel.classList.add('hidden')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}
