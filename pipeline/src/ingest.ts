// ── LiquidFlow Book Ingestion CLI ────────────────────────────────────────────
// Usage: npm run ingest -- <book-id>
//        npm run ingest -- <id> <url> <title> <author> [emoji]
// e.g.:  npm run ingest -- time-machine
//        npm run ingest -- frankenstein https://www.gutenberg.org/cache/epub/84/pg84.txt "Frankenstein" "Mary Shelley" 🧟

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
import { annotateScene, generateEntityDescription } from './ai.js'
import { convertToAscii, generateProceduralAscii } from './ascii.js'
import { fetchAndConvert } from './image-fetcher.js'
import type { BookManifest, BookChapter, BookScene, EntityEntry, AsciiAsset } from '../../reader/src/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../../reader/public/books')

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
      console.log(`[${annotation.mood} | ${annotation.transitionStyle}]`)

      let illustration: AsciiAsset | undefined = undefined
      
      // First, try to load pre-generated image from temp folder
      const tempImg = join(__dirname, `../temp/${bookId}-${ci}-${si}.png`)
      try {
        illustration = await convertToAscii(tempImg, 60)
        console.log(`[🎨 ASCII from local image]`)
      } catch {
        // Second, try fetching from Unsplash/image API based on visualPrompt
        const fetched = await fetchAndConvert(annotation.visualPrompt, 60)
        if (fetched) {
          illustration = fetched
          console.log(`[🎨 ASCII from image search: ${annotation.visualPrompt}]`)
        } else {
          // Third, fallback to procedural based on mood
          illustration = generateProceduralAscii(annotation.mood, meta.theme || 'dark')
          console.log(`[🎨 ASCII procedural: ${annotation.mood}]`)
        }
      }

      annotatedScenes.push({
        id: `${bookId}-${ci}-${si}`,
        text: sceneText,
        mood: annotation.mood,
        visualPrompt: annotation.visualPrompt,
        entities: annotation.entities,
        animationHints: annotation,
        illustration
      })
      sceneCount++

      // Small delay to avoid hammering Ollama
      await new Promise(r => setTimeout(r, 100))
    }

    chapters.push({ title: ch.title, scenes: annotatedScenes })
  }

  // 5. Build Entity Manifest
  console.log('\n👤 Building Entity Manifest…')
  const entityManifest = await buildEntityManifest(chapters)
  console.log(`   Found ${entityManifest.length} unique entities.`)

  // 6. Write manifest
  const manifest: BookManifest = {
    id: bookId,
    title: meta.title,
    author: meta.author,
    emoji: meta.emoji,
    chapters,
    entityManifest
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, `${bookId}.manifest.json`)
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log(`\n✅ Done! ${sceneCount} scenes written to:`)
  console.log(`   ${outPath}\n`)
}

async function buildEntityManifest(chapters: BookChapter[]): Promise<EntityEntry[]> {
  const entityMap = new Map<string, { firstSeenScene: string; context: string }>()

  // Collect all unique entities
  for (const ch of chapters) {
    for (const scene of ch.scenes) {
      for (const ent of scene.entities) {
        if (!entityMap.has(ent)) {
          entityMap.set(ent, { 
            firstSeenScene: scene.id,
            context: scene.text
          })
        }
      }
    }
  }

  const manifest: EntityEntry[] = []
  const entities = Array.from(entityMap.entries())

  for (let i = 0; i < entities.length; i++) {
    const [name, data] = entities[i]
    process.stdout.write(`   [${i + 1}/${entities.length}] Describing ${name}… `)
    
    try {
      const description = await generateEntityDescription(name, data.context)
      manifest.push({
        name,
        type: 'character', // Defaulting to character for now, AI could determine this but keeping it simple
        description,
        firstSeenScene: data.firstSeenScene
      })
      console.log('done.')
    } catch (e) {
      console.log('failed (skipping).')
    }

    // Small delay
    await new Promise(r => setTimeout(r, 200))
  }

  return manifest
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
