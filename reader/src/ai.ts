// ── Ollama AI client ─────────────────────────────────────────────────────────
// Config is read from Vite env vars (set in reader/.env, never committed).
// See reader/.env.example for the required variables.

const OLLAMA_BASE = import.meta.env.VITE_OLLAMA_BASE_URL as string
const FAST_MODEL  = import.meta.env.VITE_OLLAMA_FAST_MODEL as string  // quick tasks: mood, entities
const MAIN_MODEL  = import.meta.env.VITE_OLLAMA_MAIN_MODEL as string  // lore cards, richer generation

if (!OLLAMA_BASE) {
  console.warn('[LiquidFlow] VITE_OLLAMA_BASE_URL is not set. Copy reader/.env.example to reader/.env and configure it.')
}

async function ollamaChat(
  model: string,
  prompt: string,
  system?: string,
  signal?: AbortSignal
): Promise<string> {
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal
  })

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json() as { message: { content: string } }
  return data.message.content.trim()
}

// ── Scene annotation (called during ingestion / lazy load) ──────────────────

export interface SceneAnnotation {
  mood: string
  visualPrompt: string
  entities: string[]
}

export async function annotateScene(text: string): Promise<SceneAnnotation> {
  const snippet = text.slice(0, 600)
  const raw = await ollamaChat(
    FAST_MODEL,
    `Analyse this passage and respond with ONLY valid JSON, no markdown fences:
{
  "mood": "<one word: e.g. tense, melancholic, wonder, ominous, joyful>",
  "visualPrompt": "<15 words max: high-contrast visual description for ASCII art>",
  "entities": ["<name1>", "<name2>", "<name3>"]
}

Passage:
${snippet}`
  )

  try {
    // strip any accidental markdown fences
    const cleaned = raw.replace(/```json?|```/g, '').trim()
    return JSON.parse(cleaned) as SceneAnnotation
  } catch {
    return { mood: 'unknown', visualPrompt: 'dark atmospheric scene', entities: [] }
  }
}

// ── Lore card (marginalia) ───────────────────────────────────────────────────
// Uses Chain-of-Density: anchor to specific entities, sensory detail.

export async function generateLoreCard(
  entity: string,
  context: string,
  bookTitle: string,
  signal?: AbortSignal
): Promise<string> {
  return ollamaChat(
    MAIN_MODEL,
    `In the context of "${bookTitle}", write a lore card for "${entity}".
Use the following passage as context:
---
${context.slice(0, 400)}
---
Rules:
- 3-4 sentences maximum
- Be specific and sensory — smells, textures, sounds
- Do NOT summarise the plot; reveal something the text implies but doesn't state
- Start directly with the content, no preamble`,
    'You are a literary scholar writing vivid, precise marginalia for an animated ebook.',
    signal
  )
}

// ── ASCII art prompt → dense text description ────────────────────────────────

export async function generateAsciiDescription(
  visualPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  return ollamaChat(
    FAST_MODEL,
    `Describe this scene as a 20x10 ASCII art composition using only printable ASCII characters.
Use density to suggest light/dark: dense chars (█▓#@) for shadows, sparse (·. ) for light.
Scene: ${visualPrompt}
Output ONLY the ASCII art, nothing else. Exactly 10 lines, each exactly 40 characters.`,
    undefined,
    signal
  )
}
