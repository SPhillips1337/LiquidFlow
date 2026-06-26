import { prisma } from './prisma'
import { recordUsage } from './quotas'

const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

const FREE_MODELS = (process.env.FREE_MODELS || 'meta-llama/llama-3.1-8b-instruct,google/gemini-flash-1.5').split(',')
const PAID_MODELS = (process.env.PAID_MODELS || 'anthropic/claude-3.5-sonnet,openai/gpt-4o').split(',')

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterResponse {
  id: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  model: string
}

/**
 * Route to appropriate model based on user tier.
 * Free users get cheap/free models; paid get priority/premium.
 */
export function selectModelForUser(isPaid: boolean): string {
  const pool = isPaid ? PAID_MODELS : FREE_MODELS
  return pool[Math.floor(Math.random() * pool.length)].trim()
}

/**
 * Call OpenRouter chat completion.
 * Logs usage via quotas helper.
 */
export async function chatCompletion(
  userId: string,
  messages: ChatMessage[],
  isPaid: boolean = false,
  maxTokens = 2048
): Promise<OpenRouterResponse> {
  if (!OPENROUTER_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const model = selectModelForUser(isPaid)

  const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://liquidflow.happymonkey.ai',
      'X-Title': 'LiquidFlow',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!resp.ok) {
    const err = await resp.text()
    console.error(`[openrouter] ${resp.status}: ${err.slice(0, 500)}`)
    throw new Error(`OpenRouter request failed (${resp.status})`)
  }

  const data: OpenRouterResponse = await resp.json()

  // Record usage for quotas
  if (data.usage) {
    await recordUsage(userId, 'chat', model, data.usage.total_tokens, 0)
  }

  return data
}
