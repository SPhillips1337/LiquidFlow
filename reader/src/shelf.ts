import type { BookManifest } from './types'
import { DEMO_MANIFEST } from './demo-book'

const FALLBACK_MANIFESTS = [
  '/books/time-machine.manifest.json',
  '/books/alice.manifest.json',
  '/books/moby-dick.manifest.json',
]

const GENRES = [
  'All',
  'Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Romance',
  'Historical Fiction',
  'Adventure',
  'Horror',
  'Poetry',
  'Drama',
  'Philosophy',
  'History',
  'Science',
  'Religion',
  'Humor',
]

interface GutendexBook {
  id: number
  title: string
  authors: Array<{ name: string; birth_year: number | null; death_year: number | null }>
  subjects: string[]
  bookshelves: string[]
  languages: string[]
  download_count: number
}

export async function loadShelf(): Promise<BookManifest[]> {
  const books: BookManifest[] = [DEMO_MANIFEST]

  // Try dynamic listing first, fall back to hardcoded paths
  let manifestPaths = FALLBACK_MANIFESTS
  try {
    const resp = await fetch('/api/books/list')
    if (resp.ok) {
      const data = await resp.json() as { manifests: string[] }
      if (data.manifests?.length) {
        manifestPaths = data.manifests.map(f => `/books/${f}`)
      }
    }
  } catch {
    // Use fallback
  }

  const results = await Promise.allSettled(
    manifestPaths.map(p => fetch(p).then(r => r.ok ? r.json() as Promise<BookManifest> : Promise.reject()))
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

  const closeAllMenus = () => {
    grid.querySelectorAll('.book-settings-menu').forEach(m => m.classList.add('hidden'))
  }

  // ── Search bar ──
  const searchSection = document.createElement('div')
  searchSection.className = 'shelf-search'
  searchSection.innerHTML = `
    <div class="shelf-search-row">
      <input type="text" class="search-input shelf-search-input" placeholder="Search books by title to ingest\u2026" />
      <select class="genre-select">
        ${GENRES.map(g => `<option value="${g === 'All' ? '' : g.toLowerCase()}">${g}</option>`).join('')}
      </select>
      <button class="tb-btn shelf-search-btn">Search</button>
    </div>
    <div class="search-results hidden"></div>
    <div class="search-status"></div>
  `
  grid.appendChild(searchSection)

  const searchInput = searchSection.querySelector<HTMLInputElement>('.shelf-search-input')!
  const genreSelect = searchSection.querySelector<HTMLSelectElement>('.genre-select')!
  const searchBtn = searchSection.querySelector<HTMLButtonElement>('.shelf-search-btn')!
  const searchResults = searchSection.querySelector<HTMLElement>('.search-results')!
  const searchStatus = searchSection.querySelector<HTMLElement>('.search-status')!

  async function doSearch(page = 1) {
    const query = searchInput.value.trim()
    const topic = genreSelect.value
    if (!query && !topic) return

    searchResults.classList.remove('hidden')
    searchResults.innerHTML = '<div class="search-loading"><span class="spinner"></span> Searching\u2026</div>'

    try {
      const url = `/api/books/search?q=${encodeURIComponent(query)}&topic=${encodeURIComponent(topic)}&page=${page}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Search failed')
      const data = await resp.json()
      renderSearchResults(data, page, searchResults, searchStatus, (p) => doSearch(p))
    } catch (e: any) {
      searchResults.innerHTML = `<div class="search-error">\u26A0\uFE0F ${escHtml(e.message)}</div>`
    }
  }

  searchBtn.addEventListener('click', () => doSearch())
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(1) })
  genreSelect.addEventListener('change', () => {
    if (searchInput.value.trim()) doSearch(1)
  })

  // ── Library header ──
  const libraryHeader = document.createElement('div')
  libraryHeader.className = 'library-header'
  libraryHeader.textContent = '\u2014 My Library \u2014'
  grid.appendChild(libraryHeader)

  // ── Existing book cards ──
  let cardCount = 0
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

    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      
      if (target.closest('.book-settings-trigger')) {
        e.stopPropagation()
        const menu = card.querySelector('.book-settings-menu')!
        const isHidden = menu.classList.contains('hidden')
        closeAllMenus()
        if (isHidden) menu.classList.remove('hidden')
        return
      }

      if (target.closest('.book-settings-menu')) {
        e.stopPropagation()
        return
      }

      onSelect(book)
    })

    const regen = card.querySelector('.regenerate-btn')!
    const del   = card.querySelector('.delete-btn')!

    regen.addEventListener('click', async (e) => {
      e.stopPropagation()
      const btn = e.target as HTMLElement
      btn.innerText = 'Regenerating\u2026'
      try {
        const resp = await fetch(`/api/manage/regenerate?id=${book.id}`, { method: 'POST' })
        if (resp.ok) {
           btn.innerText = 'Success! Reloading\u2026'
           setTimeout(() => window.location.reload(), 1000)
        } else {
           throw new Error('Regeneration failed')
        }
      } catch (err) {
        btn.innerText = 'Error'
        console.error(err)
      }
    })

    del.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!confirm(`Are you sure you want to delete "${book.title}"?`)) return
      try {
        const resp = await fetch(`/api/manage/delete?id=${book.id}`, { method: 'POST' })
        if (resp.ok) window.location.reload()
      } catch (err) {
        console.error(err)
      }
    })

    grid.appendChild(card)
    cardCount++
  }

  if (cardCount === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-library'
    empty.textContent = 'No books in your library yet. Search above to find and ingest books.'
    grid.appendChild(empty)
  }

  window.addEventListener('click', closeAllMenus, { once: true })
}

function renderSearchResults(
  data: { results: GutendexBook[]; count: number; next: string | null; previous: string | null },
  currentPage: number,
  container: HTMLElement,
  statusEl: HTMLElement,
  onPageChange: (page: number) => void,
) {
  const results = data.results || []
  const totalCount = data.count || 0
  const PER_PAGE = 32
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))

  if (results.length === 0) {
    container.innerHTML = '<div class="search-empty">No books found. Try a different search.</div>'
    return
  }

  const existingIds = new Set<string>()
  document.querySelectorAll('.book-card').forEach(card => {
    const nameEl = card.querySelector('.book-name')
    if (nameEl) existingIds.add(nameEl.textContent?.toLowerCase() || '')
  })

  // ── Results grid ──
  let html = '<div class="search-results-grid">'
  for (const book of results) {
    const author = book.authors[0]?.name || 'Unknown'
    const subjects = book.subjects.slice(0, 3).join(', ')
    const gutenbergUrl = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`
    const alreadyOwned = existingIds.has(book.title.toLowerCase())

    html += `
      <div class="search-result-card" data-id="${book.id}" data-url="${escHtml(gutenbergUrl)}" data-title="${escHtml(book.title)}" data-author="${escHtml(author)}">
        <div class="search-result-emoji">📖</div>
        <div class="search-result-info">
          <div class="search-result-title">${escHtml(book.title)}</div>
          <div class="search-result-author">${escHtml(author)}</div>
          <div class="search-result-meta">${escHtml(subjects)}</div>
        </div>
        <div class="search-result-action">
          ${alreadyOwned
            ? '<span class="search-result-owned">✓ In Library</span>'
            : `<button class="tb-btn ingest-btn">Ingest</button>`
          }
        </div>
      </div>
    `
  }
  html += '</div>'

  // ── Pagination ──
  html += buildPagination(currentPage, totalPages, totalCount)

  container.innerHTML = html

  // Wire page links
  container.querySelectorAll<HTMLButtonElement>('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page || '0')
      if (p > 0 && p !== currentPage) onPageChange(p)
    })
  })

  // Wire ingest buttons
  container.querySelectorAll('.ingest-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const card = (e.target as HTMLElement).closest('.search-result-card') as HTMLElement
      if (!card) return

      const id = `gutenberg-${card.dataset.id || ''}`
      const url = card.dataset.url || ''
      const title = card.dataset.title || ''
      const author = card.dataset.author || ''

      const ingestBtn = e.target as HTMLButtonElement
      ingestBtn.disabled = true
      ingestBtn.textContent = 'Ingesting\u2026'
      statusEl.innerHTML = '<span class="ingest-status">⏳ Ingesting <strong>' + escHtml(title) + '</strong> \u2014 this may take a few minutes\u2026</span>'

      try {
        const resp = await fetch('/api/books/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, url, title, author }),
        })
        const data = await resp.json()
        if (data.success) {
          statusEl.innerHTML = `<span class="ingest-status ingest-success">✅ <strong>${escHtml(title)}</strong> ingested! Reloading\u2026</span>`
          setTimeout(() => window.location.reload(), 1500)
        } else {
          throw new Error(data.error || 'Ingestion failed')
        }
      } catch (e: any) {
        ingestBtn.disabled = false
        ingestBtn.textContent = 'Ingest'
        statusEl.innerHTML = `<span class="ingest-status ingest-error">⚠️ ${escHtml(e.message)}</span>`
      }
    })
  })
}

function buildPagination(
  current: number,
  total: number,
  totalCount: number,
): string {
  const pages = getPageRange(current, total)

  let html = `<div class="pagination">`
  html += `<span class="pagination-info">${totalCount} results</span>`
  html += `<div class="pagination-controls">`

  // << First
  if (current > 1) {
    html += `<button class="tb-btn page-btn" data-page="1" title="First page">\u00AB</button>`
  }
  // < Prev
  if (current > 1) {
    html += `<button class="tb-btn page-btn" data-page="${current - 1}" title="Page ${current - 1}">\u2039</button>`
  }
  // Page numbers
  for (const p of pages) {
    if (p === '...') {
      html += `<span class="page-ellipsis">\u2026</span>`
    } else {
      html += `<button class="tb-btn page-btn ${p === current ? 'page-active' : ''}" data-page="${p}">${p}</button>`
    }
  }
  // > Next
  if (current < total) {
    html += `<button class="tb-btn page-btn" data-page="${current + 1}" title="Page ${current + 1}">\u203A</button>`
  }
  // >> Last
  if (current < total) {
    html += `<button class="tb-btn page-btn" data-page="${total}" title="Last page (${total})">\u00BB</button>`
  }

  html += `</div></div>`
  return html
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    const r: number[] = []
    for (let i = 1; i <= total; i++) r.push(i)
    return r
  }

  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')
  if (total > 1) pages.push(total)

  // Deduplicate adjacent ellipses
  const deduped: (number | '...')[] = []
  let prevWasEllipsis = false
  for (const p of pages) {
    if (p === '...') {
      if (!prevWasEllipsis) deduped.push('...')
      prevWasEllipsis = true
    } else {
      deduped.push(p)
      prevWasEllipsis = false
    }
  }
  return deduped
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
