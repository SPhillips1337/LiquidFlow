import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/books/:id - fetch single book (user-scoped)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const book = await prisma.book.findFirst({
    where: {
      id,
      userId: session.user.id, // strict filter - prevents cross-user access
    },
  })

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  return NextResponse.json({ book })
}

// DELETE /api/books/:id - delete single book (user-scoped)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const deleted = await prisma.book.deleteMany({
    where: {
      id,
      userId: session.user.id,
    },
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
