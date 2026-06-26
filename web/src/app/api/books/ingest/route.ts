import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { reserveIngest } from '@/lib/quotas'
import { plainTextToManifest, slugify } from '@/lib/bookManifest'
import { boundedString, readJsonBody, validateGutenbergTextUrl } from '@/lib/apiGuards'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await readJsonBody(req)
  if (parsed.error) return parsed.error

  const title = boundedString(parsed.body.title, 180)
  const author = boundedString(parsed.body.author || 'Project Gutenberg', 180)
  const url = validateGutenbergTextUrl(parsed.body.url)

  if (!title || !url) {
    return NextResponse.json({ error: 'Valid Gutenberg title and URL required' }, { status: 400 })
  }

  const allowed = await reserveIngest(session.user.id)
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason || 'Quota exceeded' }, { status: 429 })
  }

  const sourceResp = await fetch(url, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!sourceResp.ok) {
    return NextResponse.json({ error: 'Could not fetch Gutenberg text' }, { status: 502 })
  }

  const text = (await sourceResp.text()).slice(0, 140_000)
  const slug = slugify(`${title}-${Date.now().toString(36)}`)
  const manifest = plainTextToManifest({
    id: slug,
    title,
    author,
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
}
