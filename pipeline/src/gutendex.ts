// ── Gutendex client (shared between reader and pipeline) ─────────────────────
// Gutendex: https://gutendex.com  (public-domain Gutenberg metadata)

const GUTENDEX_URL = 'https://gutendex.com'

export interface GutendexBook {
  id: number
  title: string
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>
  subjects: string[]
  bookshelves: string[]
  languages: string[]
  download_count: number
  formats: Record<string, string>
}

export interface GutendexResponse {
  count: number
  next: string | null
  previous: string | null
  results: GutendexBook[]
}

export interface SearchParams {
  search?: string
  topic?: string
  page?: number
  languages?: string
  sort?: 'popular' | 'ascending' | 'descending'
}

export async function searchBooks(params: SearchParams = {}): Promise<GutendexResponse> {
  const url = new URL(`${GUTENDEX_URL}/books`)
  if (params.search) url.searchParams.set('search', params.search)
  if (params.topic) url.searchParams.set('topic', params.topic)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.languages) url.searchParams.set('languages', params.languages)
  if (params.sort) url.searchParams.set('sort', params.sort)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Gutendex error: ${res.status}`)
  return res.json()
}

export function getPlainTextUrl(book: GutendexBook): string {
  // Prefer the canonical cache/epub mirror used elsewhere in the repo
  return `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`
}

export async function fetchBookSummary(id: number): Promise<string | null> {
  // Gutendex sometimes includes summaries; fall back to null if absent
  const res = await fetch(`${GUTENDEX_URL}/books/${id}`)
  if (!res.ok) return null
  const data = await res.json()
  const summaries: string[] = data.summaries || []
  return summaries.length ? summaries[0] : null
}