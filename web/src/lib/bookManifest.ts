export interface ManifestInput {
  id: string
  title: string
  author: string
  text: string
}

const MAX_WORDS_PER_SCENE = 360
const MAX_SCENES = 18
const CHAPTER_HEADING_PATTERN = /^(?:chapter\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*|part\s+(?:\d+|[ivxlcdm]+)\b.*)$/i

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || `book-${Date.now()}`
}

export function plainTextToManifest(input: ManifestInput) {
  const normalized = input.text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const chapterSources = splitIntoChapters(normalized, input.title)

  return {
    id: input.id,
    title: input.title,
    author: input.author,
    emoji: '📖',
    chapters: chapterSources.map((chapter, chapterIndex) => ({
      title: chapter.title,
      scenes: buildScenes(input.id, chapter.text, chapterIndex, input.title),
    })),
    entityManifest: [],
  }
}

function splitIntoChapters(text: string, fallbackTitle: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const chapters: Array<{ title: string; lines: string[] }> = []
  let current: { title: string; lines: string[] } | null = null

  for (const line of lines) {
    if (CHAPTER_HEADING_PATTERN.test(line) && line.length <= 120) {
      if (current && current.lines.length) chapters.push(current)
      current = { title: line.replace(/^#+\s*/, ''), lines: [] }
      continue
    }

    if (!current) current = { title: fallbackTitle, lines: [] }
    current.lines.push(line)
  }

  if (current && current.lines.length) chapters.push(current)

  if (chapters.length === 0) {
    return [{ title: fallbackTitle, text: text || 'This book is being prepared.' }]
  }

  return chapters.map((chapter, index) => ({
    title: chapter.title || `${fallbackTitle} ${index + 1}`,
    text: chapter.lines.join('\n\n'),
  }))
}

function buildScenes(bookId: string, chapterText: string, chapterIndex: number, title: string) {
  const words = chapterText.split(/\s+/).filter(Boolean)
  const scenes = []
  const maxScenes = Math.max(1, Math.ceil(MAX_SCENES / 4))

  for (let i = 0; i < words.length && scenes.length < maxScenes; i += MAX_WORDS_PER_SCENE) {
    const sceneText = words.slice(i, i + MAX_WORDS_PER_SCENE).join(' ')
    scenes.push({
      id: `${bookId}-${chapterIndex + 1}-${scenes.length + 1}`,
      text: sceneText,
      mood: 'neutral',
      visualPrompt: `${title} literary scene`,
      entities: [],
      animationHints: {
        mood: 'neutral',
        visualPrompt: `${title} literary scene`,
        entities: [],
        transitionStyle: 'particle-drift',
      },
    })
  }

  return scenes.length
    ? scenes
    : [
        {
          id: `${bookId}-${chapterIndex + 1}-1`,
          text: 'This book is being prepared.',
          mood: 'neutral',
          visualPrompt: `${title} literary scene`,
          entities: [],
          animationHints: {
            mood: 'neutral',
            visualPrompt: `${title} literary scene`,
            entities: [],
            transitionStyle: 'particle-drift',
          },
        },
      ]
}
