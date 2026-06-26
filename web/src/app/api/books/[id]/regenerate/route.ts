import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { reserveIngest } from '@/lib/quotas'
import { plainTextToManifest, slugify } from '@/lib/bookManifest'
import { generateReferencedStory } from '@/lib/storyGeneration'

async function userIsPaid(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  })

  return user?.subscription?.status === 'active' && ['paid_monthly', 'paid_yearly'].includes(user.subscription.tier)
}

function extractBookText(manifest: unknown) {
  const chapters = (manifest as { chapters?: Array<{ scenes?: Array<{ text?: unknown }> }> })?.chapters || []
  return chapters
    .flatMap((chapter) => chapter.scenes || [])
    .map((scene) => String(scene.text || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 9000)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const source = await prisma.book.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!source) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    const sourceText = extractBookText(source.manifest)
    if (sourceText.split(/\s+/).filter(Boolean).length < 120) {
      return NextResponse.json({ error: 'Book does not have enough text to regenerate' }, { status: 400 })
    }

    const allowed = await reserveIngest(session.user.id)
    if (!allowed.allowed) {
      return NextResponse.json({ error: allowed.reason || 'Quota exceeded' }, { status: 429 })
    }

    const isPaid = await userIsPaid(session.user.id)
    const premise = [
      `Regenerate and enrich this existing LiquidFlow book as a fresh original version.`,
      `Keep the core appeal and genre implied by "${source.title}", but create a distinct new telling with richer structure, sharper conflict, and a complete ending.`,
      `Source text:\n${sourceText}`,
    ].join('\n\n')

    const { text, validationError } = await generateReferencedStory({
      userId: session.user.id,
      isPaid,
      genre: 'Fiction',
      premise,
    })

    if (!text || validationError) {
      return NextResponse.json({ error: validationError || 'Regeneration returned no text' }, { status: 502 })
    }

    const firstLine = text.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').trim()
    const title = firstLine && firstLine.length <= 90 ? firstLine : `${source.title} Reimagined`
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

    return NextResponse.json({ success: true, slug })
  } catch (err) {
    console.error('[regenerate-book] failed', err)
    return NextResponse.json({ error: 'Book regeneration failed' }, { status: 500 })
  }
}
