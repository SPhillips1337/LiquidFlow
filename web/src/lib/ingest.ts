import { prisma } from './prisma'

/**
 * Ingest wrapper for web: accepts userId and writes manifest to DB (user-scoped).
 * Legacy pipeline continues to write flat files to reader/public/books/ unchanged.
 * Call this from future API ingest endpoints.
 */
export async function ingestBookForUser(params: {
  userId: string
  title: string
  slug: string
  manifest: any
}) {
  const { userId, title, slug, manifest } = params

  if (!userId) throw new Error('userId required for per-user storage')

  const book = await prisma.book.create({
    data: { userId, title, slug, manifest },
  })

  return book
}
