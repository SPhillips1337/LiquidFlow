import { chatCompletion } from './openrouter'
import { buildReferenceBrief, findGutenbergReferences } from './gutenbergReferences'
import type { StoryReferenceSearch } from './gutenbergReferences'

const META_PATTERNS = [
  /\b(as an ai|i am an ai|i can't|i cannot)\b/i,
  /\b(the task|this task|my task|the user asked|the prompt asks)\b/i,
  /\b(i need to|we need to|i should|we should|i will write|i'll write)\b/i,
  /\b(copyright|copyrighted|public domain|policy|guidelines)\b/i,
  /\b(reasoning|analysis|chain of thought|thinking)\b/i,
]

const FALLBACK_ANALYSIS: StoryReferenceSearch = {
  themes: [],
  gutendexTopics: [],
  searchQueries: [],
  motifs: [],
  archetypes: [],
}

export function cleanGeneratedStory(raw: string) {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:text|markdown)?/gi, '')
    .replace(/```/g, '')
    .replace(/\r/g, '')
    .trim()

  const lines = text.split('\n')
  const titleIndex = lines.findIndex((line) => /^(title\s*:|#\s+)?["“']?[A-Z0-9][^.!?]{3,90}["”']?\s*$/i.test(line.trim()))
  if (titleIndex > 0 && titleIndex <= 12) {
    text = lines.slice(titleIndex).join('\n').trim()
  }

  text = text
    .split('\n')
    .filter((line) => !/^\s*(final story|story|answer|draft)\s*:?\s*$/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

export function validateStoryText(text: string) {
  const opening = text.slice(0, 1400)
  const words = text.split(/\s+/).filter(Boolean)
  const ending = text.trim().slice(-1)
  const chapterCount = (text.match(/^chapter\s+/gim) || []).length

  if (text.split(/\s+/).filter(Boolean).length < 250) {
    return 'The generated story was too short.'
  }
  if (words.length < 1200) {
    return 'The generated story was shorter than the production minimum.'
  }
  if (chapterCount < 3) {
    return 'The generated story did not include enough chapters.'
  }
  if (!/[.!?”"']/.test(ending)) {
    return 'The generated story ended mid-sentence.'
  }
  if (META_PATTERNS.some((pattern) => pattern.test(opening))) {
    return 'The generated text included model notes instead of only story prose.'
  }
  return null
}

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return cleaned.slice(start, end + 1)
}

function stringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter((item) => item.length >= 3 && item.length <= 80)
    .slice(0, limit)
}

function parseStoryAnalysis(raw: string): StoryReferenceSearch {
  const json = extractJsonObject(raw)
  if (!json) return FALLBACK_ANALYSIS

  try {
    const parsed = JSON.parse(json) as Partial<StoryReferenceSearch>
    return {
      themes: stringList(parsed.themes, 6),
      gutendexTopics: stringList(parsed.gutendexTopics, 5),
      searchQueries: stringList(parsed.searchQueries, 5),
      motifs: stringList(parsed.motifs, 6),
      archetypes: stringList(parsed.archetypes, 5),
    }
  } catch {
    return FALLBACK_ANALYSIS
  }
}

function parseDraftAndAnalysis(raw: string) {
  const marker = 'REFERENCE_SIGNALS_JSON'
  const markerIndex = raw.indexOf(marker)
  if (markerIndex === -1) {
    return {
      draft: cleanGeneratedStory(raw),
      analysis: parseStoryAnalysis(raw),
    }
  }

  const draftPart = raw.slice(0, markerIndex).replace(/^FIRST_DRAFT\s*:?\s*/i, '').trim()
  const analysisPart = raw.slice(markerIndex + marker.length)
  return {
    draft: cleanGeneratedStory(draftPart),
    analysis: parseStoryAnalysis(analysisPart),
  }
}

async function generateDraftAndAnalysis(userId: string, isPaid: boolean, genre: string, premise: string) {
  const result = await chatCompletion(
    userId,
    [
      {
        role: 'system',
        content: [
          'You are a fiction writer inside LiquidFlow.',
          'Create a compact private first draft, then extract public-domain reference search signals from that draft.',
          'Do not include markdown fences, policy commentary, task notes, or explanations.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Genre: ${genre}`,
          `Premise: ${premise}`,
          'Return exactly these two sections:',
          'FIRST_DRAFT',
          'A 700-1100 word complete first draft with character, setting, conflict, tone, motifs, and ending.',
          'REFERENCE_SIGNALS_JSON',
          'A valid JSON object for Project Gutenberg/Gutendex search signals. Prefer broad public-domain themes and genres over proper nouns from the draft.',
          'Use this exact JSON shape:',
          '{"themes":[],"gutendexTopics":[],"searchQueries":[],"motifs":[],"archetypes":[]}',
        ].join('\n\n'),
      },
    ],
    isPaid,
    3200,
  )

  return parseDraftAndAnalysis(result.choices[0]?.message?.content || '')
}

async function generateExpandedStory(params: {
  userId: string
  isPaid: boolean
  genre: string
  premise: string
  draft: string
  referenceBrief: string
  retryText?: string
}) {
  const { userId, isPaid, genre, premise, draft, referenceBrief, retryText } = params
  return chatCompletion(
    userId,
    [
      {
        role: 'system',
        content: [
          'You are a fiction writer inside LiquidFlow.',
          'Return only the final story text.',
          'Do not include reasoning, analysis, task notes, safety notes, copyright commentary, markdown fences, or explanations.',
          'Use public-domain references only for high-level motifs, atmosphere, archetypes, and structural inspiration.',
          'Do not retell, closely imitate, or reuse distinctive scenes from any single source.',
          'The first non-empty line must be the story title.',
          'Then write exactly four chapters, each headed Chapter 1, Chapter 2, Chapter 3, and Chapter 4.',
          'The story must have a complete ending and must not stop mid-sentence.',
        ].join(' '),
      },
      {
        role: 'user',
        content: retryText
          ? [
              'Rewrite this into a complete reader-facing story with exactly four concise chapters.',
              'Remove all reasoning, analysis, task commentary, policy notes, and prefaces. Finish with a complete ending.',
              `Original premise: ${premise}`,
              `Reference brief:\n${referenceBrief}`,
              `Text to rewrite:\n${retryText}`,
            ].join('\n\n')
          : [
              `Genre: ${genre}`,
              `Original premise: ${premise}`,
              `First draft to preserve and deepen:\n${draft}`,
              `Public-domain reference brief for inspiration only:\n${referenceBrief}`,
              'Length: 2200-3200 words.',
              'Output only the story.',
            ].join('\n\n'),
      },
    ],
    isPaid,
    5600,
  )
}

export async function generateReferencedStory(params: {
  userId: string
  isPaid: boolean
  genre: string
  premise: string
}) {
  const { userId, isPaid, genre, premise } = params
  const { draft, analysis } = await generateDraftAndAnalysis(userId, isPaid, genre, premise)
  const references = await findGutenbergReferences(analysis).catch((err) => {
    console.warn('[story-generation] Gutenberg reference lookup skipped', err)
    return []
  })
  const referenceBrief = buildReferenceBrief(references)

  let result = await generateExpandedStory({
    userId,
    isPaid,
    genre,
    premise,
    draft,
    referenceBrief,
  })
  let text = cleanGeneratedStory(result.choices[0]?.message?.content || '')
  let validationError = result.choices[0]?.finish_reason === 'length'
    ? 'The model hit its output limit before finishing the story.'
    : validateStoryText(text)

  if (validationError) {
    result = await generateExpandedStory({
      userId,
      isPaid,
      genre,
      premise,
      draft,
      referenceBrief,
      retryText: result.choices[0]?.message?.content || '',
    })
    text = cleanGeneratedStory(result.choices[0]?.message?.content || '')
    validationError = result.choices[0]?.finish_reason === 'length'
      ? 'The model hit its output limit before finishing the story.'
      : validateStoryText(text)
  }

  return { text, validationError, references }
}
