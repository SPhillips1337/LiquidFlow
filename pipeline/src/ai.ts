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
    const envPath = join(__dirname, '../../pipeline/.env')
    const lines = readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim()
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // .env not found — rely on actual environment variables
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

async function requestAI(model: string, messages: any[]): Promise<string> {
  const url = AI_FORMAT === 'openai' 
    ? `${OLLAMA_BASE.replace(/\/+$/, '')}/v1/chat/completions`
    : `${OLLAMA_BASE.replace(/\/+$/, '')}/api/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    })
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  if (AI_FORMAT === 'openai') {
    return (data as any).choices?.[0]?.message?.content ?? ''
  } else {
    return (data as { message: { content: string } }).message.content
  }
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
