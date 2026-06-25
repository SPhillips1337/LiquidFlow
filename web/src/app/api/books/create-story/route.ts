import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletion } from '@/lib/openrouter'
import { canIngest, recordUsage } from '@/lib/quotas'
import { plainTextToManifest, slugify } from '@/lib/bookManifest'

const META_PATTERNS = [
  /\b(as an ai|i am an ai|i can't|i cannot)\b/i,
  /\b(the task|this task|my task|the user asked|the prompt asks)\b/i,
  /\b(i need to|we need to|i should|we should|i will write|i'll write)\b/i,
  /\b(copyright|copyrighted|public domain|policy|guidelines)\b/i,
  /\b(reasoning|analysis|chain of thought|thinking)\b/i,
]

async function userIsPaid(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  })

  return user?.subscription?.status === 'active' && ['paid_monthly', 'paid_yearly'].includes(user.subscription.tier)
}

function cleanGeneratedStory(raw: string) {
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

function validateStoryText(text: string) {
  const opening = text.slice(0, 1400)
  if (text.split(/\s+/).filter(Boolean).length < 250) {
    return 'The generated story was too short.'
  }
  if (META_PATTERNS.some((pattern) => pattern.test(opening))) {
    return 'The generated text included model notes instead of only story prose.'
  }
  return null
}

async function generateStory(userId: string, isPaid: boolean, genre: string, premise: string, retryText?: string) {
  return chatCompletion(
    userId,
    [
      {
        role: 'system',
        content: [
          'You are a fiction writer inside LiquidFlow.',
          'Return only the final story text.',
          'Do not include reasoning, analysis, task notes, safety notes, copyright commentary, markdown fences, or explanations.',
          'The first non-empty line must be the story title. The rest must be prose for readers.',
        ].join(' '),
      },
      {
        role: 'user',
        content: retryText
          ? `Rewrite this into only the final reader-facing story. Remove all reasoning, analysis, task commentary, policy notes, and prefaces.\n\n${retryText}`
          : `Genre: ${genre}\nPremise: ${premise}\nLength: 1200-1800 words.\nOutput only the story.`,
      },
    ],
    isPaid,
    2600,
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const premise = String(body.premise || '').trim()
  const genre = String(body.genre || 'Fiction').trim()

  if (premise.length < 8) {
    return NextResponse.json({ error: 'Enter a longer premise first' }, { status: 400 })
  }

  const allowed = await canIngest(session.user.id)
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason || 'Quota exceeded' }, { status: 429 })
  }

  const isPaid = await userIsPaid(session.user.id)
  let result = await generateStory(session.user.id, isPaid, genre, premise)
  let text = cleanGeneratedStory(result.choices[0]?.message?.content || '')
  let validationError = validateStoryText(text)

  if (validationError) {
    result = await generateStory(session.user.id, isPaid, genre, premise, result.choices[0]?.message?.content || '')
    text = cleanGeneratedStory(result.choices[0]?.message?.content || '')
    validationError = validateStoryText(text)
  }

  if (!text || validationError) {
    return NextResponse.json({ error: validationError || 'Story generation returned no text' }, { status: 502 })
  }

  const firstLine = text.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').trim()
  const title = firstLine && firstLine.length <= 90 ? firstLine : `${genre} Story`
  const slug = slugify(`${title}-${Date.now().toString(36)}`)
  const manifest = plainTextToManifest({
    id: slug,
    title,
    author: 'LiquidFlow AI',
    text,
  })

  await prisma.book.create({
    data: {
      userId: session.user.id,
      title,
      slug,
      manifest,
    },
  })
  await recordUsage(session.user.id, 'ingest', result.model, result.usage?.total_tokens)

  return NextResponse.json({ success: true, slug })
}
