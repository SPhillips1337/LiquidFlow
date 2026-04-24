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
const FAST_MODEL  = process.env['OLLAMA_FAST_MODEL'] ?? 'granite4:3b'
const MAIN_MODEL  = process.env['OLLAMA_MAIN_MODEL'] ?? 'llama3'

if (!OLLAMA_BASE) {
  console.warn('[pipeline] OLLAMA_BASE_URL is not set. Copy pipeline/.env.example to pipeline/.env and configure it.')
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
  const snippet = text.slice(0, 1000) // Increase snippet size for better context

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: FAST_MODEL,
      messages: [
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
      ],
      stream: false
    })
  })

  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data = await res.json() as { message: { content: string } }
  const raw = data.message.content.replace(/```json?|```/g, '').trim()

  try {
    const parsed = JSON.parse(raw) as SceneAnnotation
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
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MAIN_MODEL,
      messages: [
        {
          role: 'user',
          content: `Based on this passage, provide a brief (max 30 words) description of the entity "${name}". 
Passage: ${contextText.slice(0, 800)}`
        }
      ],
      stream: false
    })
  })

  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data = await res.json() as { message: { content: string } }
  return data.message.content.trim()
}
