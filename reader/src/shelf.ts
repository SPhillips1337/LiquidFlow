// ── Book Shelf ───────────────────────────────────────────────────────────────
// Loads available book manifests and renders the library grid.

import type { BookManifest } from './types'

// Books are loaded from /books/*.manifest.json
// For PoC we also include a built-in demo so the reader works immediately.
import { DEMO_MANIFEST } from './demo-book'

const MANIFEST_PATHS = [
  '/books/time-machine.manifest.json',
  '/books/alice.manifest.json',
  '/books/moby-dick.manifest.json',
]

export async function loadShelf(): Promise<BookManifest[]> {
  const books: BookManifest[] = [DEMO_MANIFEST]

  const results = await Promise.allSettled(
    MANIFEST_PATHS.map(p => fetch(p).then(r => r.ok ? r.json() as Promise<BookManifest> : Promise.reject()))
  )

  for (const r of results) {
    if (r.status === 'fulfilled') books.push(r.value)
  }

  return books
}

export function renderShelf(
  books: BookManifest[],
  grid: HTMLElement,
  onSelect: (book: BookManifest) => void
): void {
  grid.innerHTML = ''

  for (const book of books) {
    const card = document.createElement('div')
    card.className = 'book-card'
    card.tabIndex = 0
    card.setAttribute('role', 'button')
    card.setAttribute('aria-label', `Open ${book.title} by ${book.author}`)

    const firstMood = book.chapters[0]?.scenes[0]?.mood ?? ''

    card.innerHTML = `
      <span class="book-emoji">${book.emoji}</span>
      <span class="book-name">${escHtml(book.title)}</span>
      <span class="book-author">${escHtml(book.author)}</span>
      ${firstMood ? `<span class="book-mood">${escHtml(firstMood)}</span>` : ''}
    `

    const open = () => onSelect(book)
    card.addEventListener('click', open)
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open() })

    grid.appendChild(card)
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
