// ── Pipeline AI annotation via Ollama ────────────────────────────────────────

const OLLAMA_BASE = 'https://knights-ventures-venice-sbjct.trycloudflare.com'
const MODEL = 'granite4:3b'  // fast model for bulk annotation

export interface SceneAnnotation {
  mood: string
  visualPrompt: string
  entities: string[]
}

export async function annotateScene(text: string): Promise<SceneAnnotation> {
  const snippet = text.slice(0, 500)

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: `Analyse this passage. Respond with ONLY valid JSON (no markdown):
{
  "mood": "<one word>",
  "visualPrompt": "<15 words max, high-contrast visual for ASCII art>",
  "entities": ["<name1>", "<name2>", "<name3>"]
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
    return JSON.parse(raw) as SceneAnnotation
  } catch {
    return { mood: 'unknown', visualPrompt: 'atmospheric literary scene', entities: [] }
  }
}
