// ── LiquidFlow Book Ingestion CLI ────────────────────────────────────────────
// Usage: npm run ingest -- <book-id>
//        npm run ingest -- <id> <url> <title> <author> [emoji]
// e.g.:  npm run ingest -- time-machine
//        npm run ingest -- frankenstein https://www.gutenberg.org/cache/epub/84/pg84.txt "Frankenstein" "Mary Shelley" 🧟


import {
  GUTENBERG_BOOKS,
  fetchGutenbergText,
  stripBoilerplate,
} from './gutenberg.js'
import { processBookText } from './ingest-core.js'

async function main() {
  const bookId = process.argv[2]
  const customUrl = process.argv[3]
  const customTitle = process.argv[4]
  const customAuthor = process.argv[5]
  const customEmoji = process.argv[6] || '📖'

  let meta: { url: string; title: string; author: string; emoji: string; theme?: string }

  if (customUrl && customTitle && customAuthor) {
    meta = { url: customUrl, title: customTitle, author: customAuthor, emoji: customEmoji, theme: 'dark' }
  } else if (bookId && GUTENBERG_BOOKS[bookId]) {
    meta = GUTENBERG_BOOKS[bookId]
  } else {
    console.error(`Usage: npm run ingest -- <book-id>`)
    console.error(`   or: npm run ingest -- <id> <url> "<title>" "<author>" [emoji]`)
    console.error(`Available: ${Object.keys(GUTENBERG_BOOKS).join(', ')}`)
    process.exit(1)
  }
  console.log(`\n📖 Ingesting: ${meta.title} by ${meta.author}`)
  console.log(`   Source: ${meta.url}\n`)

  // 1. Fetch
  process.stdout.write('⬇  Fetching from Project Gutenberg… ')
  const raw = await fetchGutenbergText(meta.url)
  console.log(`done (${Math.round(raw.length / 1024)}KB)`)

  // 2. Strip boilerplate
  const clean = stripBoilerplate(raw)
  console.log(`✂  Stripped boilerplate. ${Math.round(clean.length / 1024)}KB remaining.`)

  const { outPath, sceneCount } = await processBookText(bookId, {
    title: meta.title,
    author: meta.author,
    emoji: meta.emoji,
    theme: meta.theme,
  }, clean)

  console.log(`\n✅ Done! ${sceneCount} scenes written to:`)
  console.log(`   ${outPath}\n`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
