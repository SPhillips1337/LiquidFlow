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
      <div class="book-settings-trigger" title="Book Settings">\u22EE</div>
      <div class="book-settings-menu hidden">
        <div class="menu-item regenerate-btn">Regenerate</div>
        <div class="menu-item delete-btn danger">Delete</div>
      </div>
      <span class="book-emoji">${book.emoji}</span>
      <span class="book-name">${escHtml(book.title)}</span>
      <span class="book-author">${escHtml(book.author)}</span>
      ${firstMood ? `<span class="book-mood">${escHtml(firstMood)}</span>` : ''}
    `

    // ── Open Logic ──
    const open = (e: Event) => {
      // Prevent opening if clicking menu
      if ((e.target as HTMLElement).closest('.book-settings-trigger') || 
          (e.target as HTMLElement).closest('.book-settings-menu')) return
      onSelect(book)
    }
    card.addEventListener('click', open)
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(e) })

    // ── Settings Menu Logic ──
    const trigger = card.querySelector('.book-settings-trigger')!
    const menu    = card.querySelector('.book-settings-menu')!
    const regen   = card.querySelector('.regenerate-btn')!
    const del     = card.querySelector('.delete-btn')!

    trigger.addEventListener('click', (e) => {
      e.stopPropagation()
      menu.classList.toggle('hidden')
    })

    regen.addEventListener('click', async (e) => {
      e.stopPropagation()
      menu.classList.add('hidden')
      const btn = e.target as HTMLElement
      btn.innerText = 'Regenerating...'
      try {
        const resp = await fetch(`/api/manage/regenerate?id=${book.id}`, { method: 'POST' })
        if (resp.ok) {
           btn.innerText = 'Success! Reloading...'
           setTimeout(() => window.location.reload(), 1000)
        } else {
           throw new Error('Regeneration failed')
        }
      } catch (err) {
        btn.innerText = 'Error (Check Console)'
        console.error(err)
      }
    })

    del.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!confirm(`Are you sure you want to delete "${book.title}"?`)) return
      menu.classList.add('hidden')
      try {
        const resp = await fetch(`/api/manage/delete?id=${book.id}`, { method: 'POST' })
        if (resp.ok) window.location.reload()
      } catch (err) {
        console.error(err)
      }
    })

    // Close menu on click outside
    window.addEventListener('click', () => menu.classList.add('hidden'))

    grid.appendChild(card)
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
