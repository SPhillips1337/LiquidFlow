import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function Bookshelf() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <main className="page-shell narrow">
        <h1>Bookshelf</h1>
        <p className="muted">Please sign in to view your books.</p>
        <Link href="/api/auth/signin" className="button button-primary">Sign in</Link>
      </main>
    )
  }

  const userId = session.user.id
  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main className="page-shell">
      <h1>My Bookshelf</h1>
      <p className="muted">Books are private to your account.</p>

      {books.length === 0 ? (
        <p className="empty-state">No books yet. Use the ingestion pipeline or API to add books.</p>
      ) : (
        <div className="book-grid">
          {books.map((book) => (
            <article key={book.id} className="book-card">
              <h2>{book.title}</h2>
              <p className="meta">Slug: {book.slug}</p>
              <p className="meta">Added: {new Date(book.createdAt).toLocaleDateString()}</p>
              {/* Link to reader with user context (reader app can read ?userId or integrate later) */}
              <a
                href={`https://liquidflow.happymonkey.ai/reader?book=${book.slug}&user=${userId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-primary compact"
              >
                Open in Reader
              </a>
              <details className="manifest-details">
                <summary>Manifest preview</summary>
                <pre>
                  {JSON.stringify(book.manifest, null, 2)}
                </pre>
              </details>
            </article>
          ))}
        </div>
      )}

      <div className="back-link">
        <Link href="/">Back to home</Link>
      </div>
    </main>
  )
}
