import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/books - list current user's books
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const books = await prisma.book.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ books })
}

// POST /api/books - create new book for current user (ingest manifest)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { title, slug, manifest } = body

  if (!title || !slug || !manifest) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Enforce user isolation strictly
  const book = await prisma.book.create({
    data: {
      userId: session.user.id,
      title,
      slug,
      manifest,
    },
  })

  return NextResponse.json({ book }, { status: 201 })
}
