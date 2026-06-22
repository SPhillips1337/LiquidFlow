// ── Create a story from a premise (Ollama) → LiquidFlow manifest ─────────────
// Usage: npm run create-story -- "A lighthouse keeper finds a door underwater"
//        npm run create-story -- "premise" "Science Fiction"

import { generateCraftedStory } from './ai.js'
import { processBookText } from './ingest-core.js'
import { searchBooks, getPlainTextUrl, GutendexBook } from './gutendex.js'

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36)
  return `story-${base || 'untitled'}-${Date.now().toString(36)}`
}

async function findGutenbergReferences(premise: string) {
  try {
    const analysis = await import('./ai.js').then(m => m.deconstructPremise(premise))
    console.log('🧠  Deconstructed premise → themes:', analysis.themes.join(', '))

    const topics = analysis.gutendex_topics.length
      ? analysis.gutendex_topics
      : analysis.themes.slice(0, 2)

    const results: GutendexBook[] = []
    for (const t of topics) {
      const resp = await searchBooks({ topic: t, languages: 'en', sort: 'popular', page: 1 })
      results.push(...resp.results.slice(0, 2))
    }

    const seen = new Set<number>()
    const unique = results.filter((b) => {
      if (seen.has(b.id)) return false
      seen.add(b.id)
      return true
    })

    console.log('📚  Gutenberg references found:')
    for (const b of unique.slice(0, 3)) {
      const url = getPlainTextUrl(b)
      console.log(`   • ${b.title} by ${b.authors[0]?.name || 'Unknown'} — ${url}`)
    }

    return unique.slice(0, 3)
  } catch (e) {
    console.warn('   (Gutenberg reference lookup skipped:', (e as Error).message, ')')
    return []
  }
}

async function main() {
  const premise = process.argv[2]
  const genre = process.argv[3] || 'Fiction'

  if (!premise?.trim()) {
    console.error('Usage: npm run create-story -- "<premise>" [genre]')
    process.exit(1)
  }

  console.log(`\n✍️  Generating ${genre} story (crafted mode)…`)
  console.log(`   Premise: ${premise.slice(0, 120)}${premise.length > 120 ? '…' : ''}\n`)

  const gutenbergRefs = await findGutenbergReferences(premise.trim())

  const generated = await generateCraftedStory(premise.trim(), genre, gutenbergRefs)
  const bookId = slugify(generated.title)

  console.log(`📚 Title: ${generated.title}`)
  console.log(`   Author: ${generated.author}`)
  console.log(`   id: ${bookId}\n`)

  const { outPath, sceneCount } = await processBookText(
    bookId,
    {
      title: generated.title,
      author: generated.author,
      emoji: '✨',
      theme: 'dark',
    },
    generated.text,
    { skipAsciiFetch: true }
  )

  console.log(`\n✅ Done! ${sceneCount} scenes → ${outPath}\n`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})