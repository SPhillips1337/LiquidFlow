import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const topic = searchParams.get('topic') || ''
  const page = searchParams.get('page') || '1'
  const params = new URLSearchParams({ page })

  if (q) params.set('search', q)
  if (topic) params.set('topic', topic)

  const resp = await fetch(`https://gutendex.com/books?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },
  })

  if (!resp.ok) {
    return NextResponse.json({ error: 'Gutenberg search failed' }, { status: 502 })
  }

  return NextResponse.json(await resp.json())
}
