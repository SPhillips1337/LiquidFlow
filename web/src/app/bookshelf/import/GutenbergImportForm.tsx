'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

interface GutendexBook {
  id: number
  title: string
  authors: Array<{ name: string }>
  subjects: string[]
  download_count: number
  formats: Record<string, string>
}

function textUrlFor(book: GutendexBook) {
  const entry = Object.entries(book.formats).find(([type, url]) => type.startsWith('text/plain') && url.startsWith('https://www.gutenberg.org/'))
  return entry?.[1] || `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`
}

export function GutenbergImportForm() {
  const router = useRouter()
  const [results, setResults] = useState<GutendexBook[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [ingestingId, setIngestingId] = useState<number | null>(null)

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const query = String(formData.get('q') || '').trim()

    if (!query) return

    setError('')
    setStatus('Searching Project Gutenberg.')
    setIsSearching(true)

    try {
      const resp = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Search failed')

      setResults(data.results || [])
      setStatus(data.results?.length ? `${data.results.length} matches found.` : 'No matches found.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
      setStatus('')
    } finally {
      setIsSearching(false)
    }
  }

  async function ingest(book: GutendexBook) {
    setError('')
    setStatus(`Importing ${book.title}. This can take a few minutes.`)
    setIngestingId(book.id)

    try {
      const resp = await fetch('/api/books/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: book.title,
          author: book.authors[0]?.name || 'Project Gutenberg',
          url: textUrlFor(book),
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Import failed')

      setStatus('Book imported. Returning to your bookshelf.')
      router.push('/bookshelf')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setIngestingId(null)
    }
  }

  return (
    <>
      <form className="flow-form" onSubmit={onSearch}>
        <fieldset disabled={isSearching || ingestingId !== null}>
          <legend>Find a public-domain book</legend>
          <div className="field-row">
            <label htmlFor="gutenberg-query">Search title or author</label>
            <input
              id="gutenberg-query"
              name="q"
              type="search"
              required
              minLength={2}
              maxLength={120}
              enterKeyHint="search"
              aria-describedby="import-status import-error"
              placeholder="Frankenstein, H. G. Wells, Jane Austen"
            />
          </div>
          <button className="button button-primary" type="submit">
            {isSearching ? 'Searching...' : 'Search Gutenberg'}
          </button>
        </fieldset>
      </form>

      <div className="form-status" aria-live="polite">
        {status ? <p id="import-status">{status}</p> : null}
        {error ? <p id="import-error" className="form-error">{error}</p> : null}
      </div>

      {results.length ? (
        <section className="search-results-panel" aria-label="Gutenberg results">
          {results.map((book) => (
            <article className="search-result-card" key={book.id}>
              <div>
                <h2>{book.title}</h2>
                <p className="meta">{book.authors[0]?.name || 'Unknown author'}</p>
                <p className="meta">{book.subjects.slice(0, 3).join(', ') || 'Project Gutenberg text'}</p>
              </div>
              <button
                className="button button-secondary compact"
                type="button"
                disabled={ingestingId !== null}
                onClick={() => ingest(book)}
              >
                {ingestingId === book.id ? 'Importing...' : 'Import'}
              </button>
            </article>
          ))}
        </section>
      ) : null}
    </>
  )
}
