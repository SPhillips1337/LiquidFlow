import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canIngest, recordUsage } from '@/lib/quotas'
import { plainTextToManifest, slugify } from '@/lib/bookManifest'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const title = String(body.title || '').trim()
  const author = String(body.author || 'Project Gutenberg').trim()
  const url = String(body.url || '').trim()

  if (!title || !url.startsWith('https://www.gutenberg.org/')) {
    return NextResponse.json({ error: 'Valid Gutenberg title and URL required' }, { status: 400 })
  }

  const allowed = await canIngest(session.user.id)
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason || 'Quota exceeded' }, { status: 429 })
  }

  const sourceResp = await fetch(url, { headers: { Accept: 'text/plain' } })
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
  await recordUsage(session.user.id, 'ingest')

  return NextResponse.json({ success: true, slug })
}
