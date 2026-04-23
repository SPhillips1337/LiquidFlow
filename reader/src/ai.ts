// ── Ollama AI client ─────────────────────────────────────────────────────────
// Targets the remote Cloudflare-tunnelled Ollama instance.

const OLLAMA_BASE = 'https://knights-ventures-venice-sbjct.trycloudflare.com'
const FAST_MODEL  = 'granite4:3b'   // quick tasks: mood, entities
const MAIN_MODEL  = 'lfm2:latest'   // lore cards, richer generation

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
