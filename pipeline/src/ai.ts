// ── Pipeline AI annotation via Ollama ────────────────────────────────────────
// Config is read from pipeline/.env (never committed).
// See pipeline/.env.example for the required variables.

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Minimal dotenv loader — avoids adding a dependency
function loadDotenv() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const candidates = [
      join(__dirname, '../.env'),
      join(__dirname, '../../.env'),
    ]
    for (const envPath of candidates) {
      try {
        const lines = readFileSync(envPath, 'utf-8').split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eq = trimmed.indexOf('=')
          if (eq === -1) continue
          const key = trimmed.slice(0, eq).trim()
          const val = trimmed.slice(eq + 1).trim()
          if (!process.env[key]) process.env[key] = val
        }
      } catch {
        // try next path
      }
    }
  } catch {
    // .env optional
  }
}

loadDotenv()

const OLLAMA_BASE = process.env['OLLAMA_BASE_URL'] ?? ''
const AI_FORMAT   = (process.env['AI_FORMAT'] || 'ollama') as 'ollama' | 'openai'
const FAST_MODEL  = process.env['OLLAMA_FAST_MODEL'] ?? 'granite4:3b'
const MAIN_MODEL  = process.env['OLLAMA_MAIN_MODEL'] ?? 'llama3'

if (!OLLAMA_BASE) {
  console.warn('[pipeline] OLLAMA_BASE_URL is not set. Configure it in pipeline/.env')
}

async function requestAI(
  model: string,
  messages: { role: string; content: string }[],
  options?: { num_predict?: number }
): Promise<string> {
  const url =
    AI_FORMAT === 'openai'
      ? `${OLLAMA_BASE.replace(/\/+$/, '')}/v1/chat/completions`
      : `${OLLAMA_BASE.replace(/\/+$/, '')}/api/chat`

  const body =
    AI_FORMAT === 'openai'
      ? { model, messages, stream: false, max_tokens: options?.num_predict ?? 1024 }
      : {
          model,
          messages,
          stream: false,
          options: { temperature: 0.7, num_predict: options?.num_predict ?? 1024 },
        }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  if (AI_FORMAT === 'openai') {
    return (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ''
  }
  return (data as { message: { content: string } }).message.content
}

export interface SceneAnnotation {
  mood: string
  visualPrompt: string
  entities: string[]
  transitionStyle: 'fluid-smoke' | 'typographic-ascii' | 'particle-drift'
}

export const DEFAULT_ANNOTATION: SceneAnnotation = {
  mood: 'neutral',
  visualPrompt: 'atmospheric literary scene',
  entities: [],
  transitionStyle: 'particle-drift'
}

export async function annotateScene(text: string): Promise<SceneAnnotation> {
  const snippet = text.slice(0, 1000)

  const raw = await requestAI(FAST_MODEL, [
    {
      role: 'user',
      content: `Analyse this passage. Respond with ONLY valid JSON (no markdown):
{
  "mood": "<one word: tense|melancholic|wonder|ominous|joyful|neutral>",
  "visualPrompt": "<15 words max, descriptive visual scene>",
  "entities": ["<name1>", "<name2>", "<name3>"],
  "transitionStyle": "<one of: fluid-smoke|typographic-ascii|particle-drift>"
}

Passage:
${snippet}`
    }
  ])

  const cleaned = raw.replace(/```json?|```/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as SceneAnnotation
    // Validate transitionStyle
    if (!['fluid-smoke', 'typographic-ascii', 'particle-drift'].includes(parsed.transitionStyle)) {
      parsed.transitionStyle = 'particle-drift'
    }
    return parsed
  } catch {
    return DEFAULT_ANNOTATION
  }
}

export async function generateEntityDescription(
  name: string,
  contextText: string
): Promise<string> {
  return requestAI(MAIN_MODEL, [
    {
      role: 'user',
      content: `Based on this passage, provide a brief (max 30 words) description of the entity "${name}". 
Passage: ${contextText.slice(0, 800)}`
    }
  ])
}

export interface GeneratedStory {
  title: string
  author: string
  text: string
}

/** Deconstruct a premise into themes + Gutendex search plan (FAST model). */
export async function deconstructPremise(premise: string): Promise<{
  themes: string[]
  gutendex_topics: string[]
  search_queries: string[]
  era?: string
  archetypes: string[]
}> {
  const raw = await requestAI(FAST_MODEL, [
    {
      role: 'user',
      content: `Analyse this fiction premise. Respond with ONLY valid JSON (no markdown):
{
  "themes": ["<3-6 thematic keywords>"],
  "gutendex_topics": ["<1-3 subject or bookshelf phrases for Gutendex>"],
  "search_queries": ["<1-3 title/author keywords>"],
  "era": "<optional era hint>",
  "archetypes": ["<1-4 character or situation archetypes>"]
}

Premise:
${premise.slice(0, 600)}`,
    },
  ])

  const cleaned = raw.replace(/```json?|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return {
      themes: [],
      gutendex_topics: [],
      search_queries: [],
      archetypes: [],
    }
  }
}

/** Generate original fiction from a user premise (LAN Ollama / MAIN_MODEL). */
export async function generateStoryFromPremise(
  premise: string,
  genre = 'Fiction'
): Promise<GeneratedStory> {
  const raw = await requestAI(MAIN_MODEL, [
    {
      role: 'system',
      content:
        'You are a skilled fiction writer. Write vivid, coherent prose with clear chapter breaks. No meta commentary.',
    },
    {
      role: 'user',
      content: `Write an original ${genre} short story from this premise:

"${premise}"

Requirements:
- 3 to 5 chapters, each chapter heading on its own line as "Chapter 1: <subtitle>" (then "Chapter 2:", etc.)
- Total length roughly 1200–2000 words
- Strong opening, satisfying ending
- First line after your title block must be the story title as a single line, then a blank line, then "by <pen name>", then blank line, then Chapter 1

Respond with ONLY the story text (title, byline, chapters). No markdown code fences.`,
    },
  ], { num_predict: 4096 })

  const text = raw.replace(/^```[\s\S]*?```$/gm, '').trim()
  const lines = text.split('\n')
  const title = (lines.find((l) => l.trim().length > 0) || 'Untitled Story')
    .trim()
    .replace(/^title:\s*/i, '')
  const byLine = lines.find((l) => /^by\s+/i.test(l.trim()))
  const author = byLine ? byLine.replace(/^by\s+/i, '').trim() : 'LiquidFlow AI'

  return { title, author, text }
}

// ── Crafted multi-phase story generation (story bible + outline + beats) ─────

export interface StoryBible {
  title: string
  premise: string
  genre: string
  themes: string[]
  characters: Array<{ name: string; role: string; core_trait: string }>
  world_rules: string[]
  tone: string
  references: Array<{ title: string; author: string; why: string }>
  unresolved_threads: string[]
}

export interface ChapterOutline {
  number: number
  title: string
  one_sentence: string
  key_change: string
}

export interface ChapterBeat {
  goal: string
  conflict: string
  outcome: string
}

export async function generateStoryBible(
  premise: string,
  genre = 'Fiction',
  references: any[] = []
): Promise<StoryBible> {
  const refText = references.length
    ? `References (use only for tone/motif, never copy plot):\n${references
        .map((r) => `- ${r.title} by ${r.author}`)
        .join('\n')}`
    : ''

  const raw = await requestAI(FAST_MODEL, [
    {
      role: 'user',
      content: `Create a compact story bible for an original ${genre} story.

Premise: ${premise}

${refText}

Respond with ONLY valid JSON:
{
  "title": "<working title>",
  "themes": ["<3-5>"],
  "characters": [{"name":"<short>","role":"<protagonist|antagonist|support>","core_trait":"<one phrase>"}],
  "world_rules": ["<2-4 concise rules>"],
  "tone": "<one word>",
  "unresolved_threads": []
}`,
    },
  ])

  const cleaned = raw.replace(/```json?|```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return {
      title: parsed.title || 'Untitled',
      premise,
      genre,
      themes: parsed.themes || [],
      characters: parsed.characters || [],
      world_rules: parsed.world_rules || [],
      tone: parsed.tone || 'neutral',
      references: references.map((r) => ({
        title: r.title,
        author: r.authors?.[0]?.name || 'Unknown',
        why: 'thematic resonance',
      })),
      unresolved_threads: parsed.unresolved_threads || [],
    }
  } catch {
    return {
      title: 'Untitled Story',
      premise,
      genre,
      themes: [],
      characters: [],
      world_rules: [],
      tone: 'neutral',
      references: [],
      unresolved_threads: [],
    }
  }
}

export async function generateOutline(
  bible: StoryBible,
  chapterCount = 4
): Promise<ChapterOutline[]> {
  const raw = await requestAI(FAST_MODEL, [
    {
      role: 'user',
      content: `Write a ${chapterCount}-chapter outline for this story. Respond with ONLY JSON array.

Bible: ${JSON.stringify(bible)}

Format:
[{"number":1,"title":"<subtitle>","one_sentence":"<what happens>","key_change":"<what changes for protagonist>"}]`,
    },
  ])

  const cleaned = raw.replace(/```json?|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return Array.from({ length: chapterCount }, (_, i) => ({
      number: i + 1,
      title: `Chapter ${i + 1}`,
      one_sentence: 'Story progresses.',
      key_change: 'Protagonist learns something.',
    }))
  }
}

export async function generateChapterBeats(
  bible: StoryBible,
  outline: ChapterOutline
): Promise<ChapterBeat[]> {
  const raw = await requestAI(FAST_MODEL, [
    {
      role: 'user',
      content: `Break this chapter into 4-6 beats. JSON array only.

Bible: ${JSON.stringify(bible)}
Chapter: ${JSON.stringify(outline)}

[{"goal":"...","conflict":"...","outcome":"win|lose|draw"}]`,
    },
  ])

  const cleaned = raw.replace(/```json?|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return [{ goal: 'Advance plot', conflict: 'Obstacle', outcome: 'draw' }]
  }
}

export async function generateChapterProse(
  bible: StoryBible,
  outline: ChapterOutline,
  beats: ChapterBeat[],
  previousSummary: string
): Promise<string> {
  const context = `
Story Bible: ${JSON.stringify(bible)}
Chapter: ${outline.number} — ${outline.title}
One sentence: ${outline.one_sentence}
Beats: ${JSON.stringify(beats)}
Previous chapter summary: ${previousSummary || 'None'}

Write vivid original prose for this chapter.
Target length: 900–1200 words.
Use the chapter heading format exactly: "Chapter ${outline.number}: ${outline.title}"
No meta commentary. End on a strong beat.`

  return requestAI(MAIN_MODEL, [
    {
      role: 'system',
      content: 'You are a skilled fiction writer. Write original prose only.',
    },
    { role: 'user', content: context },
  ], { num_predict: 3072 })
}

export async function summarizeChapter(text: string): Promise<string> {
  const raw = await requestAI(FAST_MODEL, [
    {
      role: 'user',
      content: `Summarize this chapter in 2-3 sentences for continuity:\n${text.slice(0, 2000)}`,
    },
  ])
  return raw.trim()
}

export async function updateBibleAfterChapter(
  bible: StoryBible,
  chapterText: string
): Promise<StoryBible> {
  const raw = await requestAI(FAST_MODEL, [
    {
      role: 'user',
      content: `Update this story bible with new threads or character changes from the chapter. Return full updated JSON bible.

Current bible: ${JSON.stringify(bible)}
Chapter text (first 1500 chars): ${chapterText.slice(0, 1500)}`,
    },
  ])

  const cleaned = raw.replace(/```json?|```/g, '').trim()
  try {
    const updated = JSON.parse(cleaned)
    return { ...bible, ...updated }
  } catch {
    return bible
  }
}

/** Full crafted story generation with bible, outline, beats, and per-chapter prose. */
export async function generateCraftedStory(
  premise: string,
  genre = 'Fiction',
  gutenbergRefs: any[] = []
): Promise<GeneratedStory> {
  const bible = await generateStoryBible(premise, genre, gutenbergRefs)
  const outline = await generateOutline(bible, 4)

  const chapters: string[] = []
  let previousSummary = ''

  for (const ch of outline) {
    const beats = await generateChapterBeats(bible, ch)
    const prose = await generateChapterProse(bible, ch, beats, previousSummary)
    chapters.push(prose.trim())

    const summary = await summarizeChapter(prose)
    previousSummary = summary

    // Update bible (non-blocking for speed)
    const updatedBible = await updateBibleAfterChapter(bible, prose)
    Object.assign(bible, updatedBible)
  }

  const fullText = chapters.join('\n\n')
  const titleLine = bible.title
  const authorLine = 'by LiquidFlow AI'

  return {
    title: titleLine,
    author: 'LiquidFlow AI',
    text: `${titleLine}\n\n${authorLine}\n\n${fullText}`,
  }
}
