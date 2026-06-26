import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { boundedString } from '@/lib/apiGuards'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = boundedString(searchParams.get('q'), 120)
  const topic = boundedString(searchParams.get('topic'), 80)
  const requestedPage = Number(searchParams.get('page') || '1')
  const page = String(Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), 20) : 1)
  const params = new URLSearchParams({ page })

  if (q) params.set('search', q)
  if (topic) params.set('topic', topic)

  const resp = await fetch(`https://gutendex.com/books?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10_000),
  })

  if (!resp.ok) {
    return NextResponse.json({ error: 'Gutenberg search failed' }, { status: 502 })
  }

  return NextResponse.json(await resp.json())
}
