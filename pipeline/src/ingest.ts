// ── LiquidFlow Book Ingestion CLI ────────────────────────────────────────────
// Usage: npm run ingest -- <book-id>
// e.g.:  npm run ingest -- time-machine
//        npm run ingest -- alice
//        npm run ingest -- moby-dick

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  GUTENBERG_BOOKS,
  fetchGutenbergText,
  stripBoilerplate,
  splitChapters,
  splitScenes
} from './gutenberg.js'
import { annotateScene } from './ai.js'
import type { BookManifest, BookChapter, BookScene } from '../../reader/src/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../../reader/public/books')

async function main() {
  const bookId = process.argv[2]

  if (!bookId || !GUTENBERG_BOOKS[bookId]) {
    console.error(`Usage: npm run ingest -- <book-id>`)
    console.error(`Available: ${Object.keys(GUTENBERG_BOOKS).join(', ')}`)
    process.exit(1)
  }

  const meta = GUTENBERG_BOOKS[bookId]
  console.log(`\n📖 Ingesting: ${meta.title} by ${meta.author}`)
  console.log(`   Source: ${meta.url}\n`)

  // 1. Fetch
  process.stdout.write('⬇  Fetching from Project Gutenberg… ')
  const raw = await fetchGutenbergText(meta.url)
  console.log(`done (${Math.round(raw.length / 1024)}KB)`)

  // 2. Strip boilerplate
  const clean = stripBoilerplate(raw)
  console.log(`✂  Stripped boilerplate. ${Math.round(clean.length / 1024)}KB remaining.`)

  // 3. Split chapters
  const rawChapters = splitChapters(clean)
  console.log(`📑 Found ${rawChapters.length} chapters.`)

  // 4. Annotate scenes with AI
  const chapters: BookChapter[] = []
  let sceneCount = 0

  for (const [ci, ch] of rawChapters.entries()) {
    const scenes = splitScenes(ch.body)
    console.log(`\n  Chapter ${ci + 1}: "${ch.title}" — ${scenes.length} scenes`)

    const annotatedScenes: BookScene[] = []

    for (const [si, sceneText] of scenes.entries()) {
      process.stdout.write(`    Scene ${si + 1}/${scenes.length} annotating… `)
      const annotation = await annotateScene(sceneText)
      console.log(`[${annotation.mood}]`)

      annotatedScenes.push({
        id: `${bookId}-${ci}-${si}`,
        text: sceneText,
        mood: annotation.mood,
        visualPrompt: annotation.visualPrompt,
        entities: annotation.entities
      })
      sceneCount++

      // Small delay to avoid hammering Ollama
      await new Promise(r => setTimeout(r, 200))
    }

    chapters.push({ title: ch.title, scenes: annotatedScenes })
  }

  // 5. Write manifest
  const manifest: BookManifest = {
    id: bookId,
    title: meta.title,
    author: meta.author,
    emoji: meta.emoji,
    chapters
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, `${bookId}.manifest.json`)
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log(`\n✅ Done! ${sceneCount} scenes written to:`)
  console.log(`   ${outPath}\n`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
