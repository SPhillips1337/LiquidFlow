export interface StoryReferenceSearch {
  themes: string[]
  gutendexTopics: string[]
  searchQueries: string[]
  motifs: string[]
  archetypes: string[]
}

export interface GutenbergReference {
  id: number
  title: string
  author: string
  subjects: string[]
  bookshelves: string[]
  summary?: string
  downloadCount: number
  url: string
}

interface GutendexBook {
  id: number
  title: string
  authors?: Array<{ name?: string }>
  subjects?: string[]
  bookshelves?: string[]
  summaries?: string[]
  download_count?: number
}

interface GutendexResponse {
  results?: GutendexBook[]
}

const GUTENDEX_URL = 'https://gutendex.com/books'
const MAX_TERMS = 6
const MAX_REFERENCES = 4

function compactTerms(values: Array<string | undefined>) {
  const seen = new Set<string>()
  const terms: string[] = []

  for (const value of values) {
    const term = String(value || '').trim().replace(/\s+/g, ' ')
    const key = term.toLowerCase()
    if (!term || term.length < 3 || term.length > 80 || seen.has(key)) continue
    seen.add(key)
    terms.push(term)
    if (terms.length >= MAX_TERMS) break
  }

  return terms
}

async function searchGutendex(params: Record<string, string>) {
  const url = new URL(GUTENDEX_URL)
  url.searchParams.set('languages', 'en')
  url.searchParams.set('sort', 'popular')

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  const resp = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 3600 },
  })

  if (!resp.ok) return []
  const data = await resp.json() as GutendexResponse
  return data.results || []
}

function toReference(book: GutendexBook): GutenbergReference {
  return {
    id: book.id,
    title: book.title,
    author: book.authors?.[0]?.name || 'Unknown',
    subjects: (book.subjects || []).slice(0, 5),
    bookshelves: (book.bookshelves || []).slice(0, 4),
    summary: book.summaries?.[0]?.slice(0, 700),
    downloadCount: book.download_count || 0,
    url: `https://www.gutenberg.org/ebooks/${book.id}`,
  }
}

export async function findGutenbergReferences(analysis: StoryReferenceSearch) {
  const topicTerms = compactTerms([
    ...analysis.gutendexTopics,
    ...analysis.themes,
    ...analysis.motifs,
  ])
  const searchTerms = compactTerms([
    ...analysis.searchQueries,
    ...analysis.archetypes,
    ...analysis.themes,
  ])

  const batches = await Promise.allSettled([
    ...topicTerms.slice(0, 3).map((topic) => searchGutendex({ topic })),
    ...searchTerms.slice(0, 3).map((search) => searchGutendex({ search })),
  ])

  const byId = new Map<number, GutendexBook>()
  for (const batch of batches) {
    if (batch.status !== 'fulfilled') continue
    for (const book of batch.value.slice(0, 4)) {
      if (!book.id || byId.has(book.id)) continue
      byId.set(book.id, book)
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => (b.download_count || 0) - (a.download_count || 0))
    .slice(0, MAX_REFERENCES)
    .map(toReference)
}

export function buildReferenceBrief(references: GutenbergReference[]) {
  if (!references.length) {
    return 'No external public-domain references were found. Deepen the story using the draft themes only.'
  }

  return references.map((ref, index) => {
    const subjects = ref.subjects.length ? ref.subjects.join('; ') : 'public-domain fiction'
    const shelves = ref.bookshelves.length ? ref.bookshelves.join('; ') : 'general literature'
    const summary = ref.summary ? ` Summary: ${ref.summary}` : ''
    return [
      `${index + 1}. ${ref.title} by ${ref.author}`,
      `Gutenberg: ${ref.url}`,
      `Subjects: ${subjects}`,
      `Bookshelves: ${shelves}.${summary}`,
    ].join('\n')
  }).join('\n\n')
}
