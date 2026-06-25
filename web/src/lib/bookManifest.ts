export interface ManifestInput {
  id: string
  title: string
  author: string
  text: string
}

const MAX_WORDS_PER_SCENE = 360
const MAX_SCENES = 18

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

  const words = normalized.split(/\s+/).filter(Boolean)
  const scenes = []

  for (let i = 0; i < words.length && scenes.length < MAX_SCENES; i += MAX_WORDS_PER_SCENE) {
    const sceneText = words.slice(i, i + MAX_WORDS_PER_SCENE).join(' ')
    scenes.push({
      id: `${input.id}-${scenes.length + 1}`,
      text: sceneText,
      mood: 'neutral',
      visualPrompt: `${input.title} literary scene`,
      entities: [],
      animationHints: {
        mood: 'neutral',
        visualPrompt: `${input.title} literary scene`,
        entities: [],
        transitionStyle: 'particle-drift',
      },
    })
  }

  return {
    id: input.id,
    title: input.title,
    author: input.author,
    emoji: '📖',
    chapters: [
      {
        title: input.title,
        scenes: scenes.length
          ? scenes
          : [
              {
                id: `${input.id}-1`,
                text: 'This book is being prepared.',
                mood: 'neutral',
                visualPrompt: `${input.title} literary scene`,
                entities: [],
                animationHints: {
                  mood: 'neutral',
                  visualPrompt: `${input.title} literary scene`,
                  entities: [],
                  transitionStyle: 'particle-drift',
                },
              },
            ],
      },
    ],
    entityManifest: [],
  }
}
