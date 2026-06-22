// ── Shared ingestion: text → annotated manifest ─────────────────────────────

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { splitChapters, splitScenes } from './gutenberg.js'
import { annotateScene, generateEntityDescription } from './ai.js'
import { convertToAscii, generateProceduralAscii } from './ascii.js'
import { fetchAndConvert } from './image-fetcher.js'
import type { BookManifest, BookChapter, BookScene, EntityEntry, AsciiAsset } from '../../reader/src/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../../reader/public/books')

export interface BookMeta {
  title: string
  author: string
  emoji: string
  theme?: string
}

export async function processBookText(
  bookId: string,
  meta: BookMeta,
  cleanText: string,
  options?: { skipAsciiFetch?: boolean }
): Promise<{ outPath: string; sceneCount: number }> {
  const rawChapters = splitChapters(cleanText)
  console.log(`📑 Found ${rawChapters.length} chapters.`)

  const chapters: BookChapter[] = []
  let sceneCount = 0

  for (const [ci, ch] of rawChapters.entries()) {
    const scenes = splitScenes(ch.body, 350)
    console.log(`\n  Chapter ${ci + 1}: "${ch.title}" — ${scenes.length} scenes`)

    const annotatedScenes: BookScene[] = []

    for (const [si, sceneText] of scenes.entries()) {
      process.stdout.write(`    Scene ${si + 1}/${scenes.length} annotating… `)
      const annotation = await annotateScene(sceneText)
      console.log(`[${annotation.mood} | ${annotation.transitionStyle}]`)

      let illustration: AsciiAsset | undefined = undefined
      const tempImg = join(__dirname, `../temp/${bookId}-${ci}-${si}.png`)
      try {
        illustration = await convertToAscii(tempImg, 60)
        console.log(`[🎨 ASCII from local image]`)
      } catch {
        if (!options?.skipAsciiFetch) {
          const fetched = await fetchAndConvert(annotation.visualPrompt, 60)
          if (fetched) {
            illustration = fetched
            console.log(`[🎨 ASCII from image search]`)
          } else {
            illustration = generateProceduralAscii(annotation.mood, meta.theme || 'dark')
            console.log(`[🎨 ASCII procedural: ${annotation.mood}]`)
          }
        } else {
          illustration = generateProceduralAscii(annotation.mood, meta.theme || 'dark')
        }
      }

      annotatedScenes.push({
        id: `${bookId}-${ci}-${si}`,
        text: sceneText,
        mood: annotation.mood,
        visualPrompt: annotation.visualPrompt,
        entities: annotation.entities,
        animationHints: annotation,
        illustration,
      })
      sceneCount++
      await new Promise((r) => setTimeout(r, 100))
    }

    chapters.push({ title: ch.title, scenes: annotatedScenes })
  }

  console.log('\n👤 Building Entity Manifest…')
  const entityManifest = await buildEntityManifest(chapters)
  console.log(`   Found ${entityManifest.length} unique entities.`)

  const manifest: BookManifest = {
    id: bookId,
    title: meta.title,
    author: meta.author,
    emoji: meta.emoji,
    chapters,
    entityManifest,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, `${bookId}.manifest.json`)
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8')

  return { outPath, sceneCount }
}

async function buildEntityManifest(chapters: BookChapter[]): Promise<EntityEntry[]> {
  const entityMap = new Map<string, { firstSeenScene: string; context: string }>()

  for (const ch of chapters) {
    for (const scene of ch.scenes) {
      for (const ent of scene.entities) {
        if (!entityMap.has(ent)) {
          entityMap.set(ent, {
            firstSeenScene: scene.id,
            context: scene.text,
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
        type: 'character',
        description,
        firstSeenScene: data.firstSeenScene,
      })
      console.log('done.')
    } catch {
      console.log('failed (skipping).')
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  return manifest
}