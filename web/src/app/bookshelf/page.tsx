import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { BookCardActions } from './BookCardActions'

const FREE_LIMIT = parseInt(process.env.FREE_INGEST_LIMIT_PER_WEEK || '1', 10)

function getReaderUrl(bookId?: string) {
  return bookId ? `/reader/?book=${encodeURIComponent(bookId)}` : '/reader/'
}

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
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [user, books, weeklyIngestions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    }),
    prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.usageLog.count({
      where: {
        userId,
        type: 'ingest',
        createdAt: { gte: weekStart },
      },
    }),
  ])

  const subscription = user?.subscription
  const isPaid = subscription?.status === 'active' && ['paid_monthly', 'paid_yearly'].includes(subscription.tier)
  const remainingFreeJobs = Math.max(FREE_LIMIT - weeklyIngestions, 0)
  const canCreate = isPaid || remainingFreeJobs > 0

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Private library</p>
          <h1>My Bookshelf</h1>
          <p className="muted">Books and generated stories are private to your account.</p>
        </div>
        <Link href="/" className="button button-secondary">Account</Link>
      </header>

      <section className="creation-panel" aria-labelledby="create-title">
        <div>
          <h2 id="create-title">Create or ingest</h2>
          <p className="muted">
            {isPaid
              ? 'Your paid tier has priority access to the ingestion queue.'
              : `Free tier includes ${FREE_LIMIT} AI ingestion per rolling week. You have ${remainingFreeJobs} remaining.`}
          </p>
        </div>
        <div className="creation-actions">
          {canCreate ? (
            <>
              <Link href="/bookshelf/create" className="button button-primary">Create AI story</Link>
              <Link href="/bookshelf/import" className="button button-secondary">Import Gutenberg book</Link>
            </>
          ) : (
            <>
              <button className="button button-primary" type="button" disabled>Create AI story</button>
              <button className="button button-secondary" type="button" disabled>Import Gutenberg book</button>
            </>
          )}
        </div>
        {!canCreate ? (
          <p className="quota-note">Your free quota is used for this week. Paid tiers will unlock priority creation.</p>
        ) : (
          <p className="quota-note">Creation opens in the reader workspace and is governed by your account quota.</p>
        )}
      </section>

      {books.length === 0 ? (
        <section className="empty-state">
          <h2>No books yet</h2>
          <p>
            This is where your generated and imported books will appear after the ingestion queue stores them against your account.
          </p>
        </section>
      ) : (
        <div className="book-grid">
          {books.map((book) => (
            <article key={book.id} className="book-card">
              <h2>{book.title}</h2>
              <p className="meta">Slug: {book.slug}</p>
              <p className="meta">Added: {new Date(book.createdAt).toLocaleDateString()}</p>
              <div className="book-card-actions">
                <a href={getReaderUrl(book.id)} className="button button-primary compact">
                  Open in Reader
                </a>
                <BookCardActions bookId={book.id} title={book.title} />
              </div>
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
