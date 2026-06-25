import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'

const FREE_LIMIT = parseInt(process.env.FREE_INGEST_LIMIT_PER_WEEK || '1', 10)

function tierLabel(tier?: string) {
  if (tier === 'paid_monthly') return 'Paid monthly'
  if (tier === 'paid_yearly') return 'Paid yearly'
  return 'Free'
}

function formatDate(value?: Date | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(value)
}

async function getDashboard(userId: string) {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [user, bookCount, weeklyIngestions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    }),
    prisma.book.count({ where: { userId } }),
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
  const remaining = isPaid ? 'Priority' : Math.max(FREE_LIMIT - weeklyIngestions, 0).toString()

  return {
    user,
    bookCount,
    weeklyIngestions,
    subscription,
    isPaid,
    remaining,
  }
}

export default async function Home() {
  const session = await auth()

  if (session?.user?.id) {
    const dashboard = await getDashboard(session.user.id)
    const displayName = dashboard.user?.name || session.user.email || 'Reader'

    return (
      <main className="page-shell dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">LiquidFlow account</p>
            <h1>Welcome back, {displayName}</h1>
            <p className="muted">
              Your personal bookshelf, quota, and reader access are tied to this account.
            </p>
          </div>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/' })
            }}
          >
            <button className="button button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </header>

        <section className="dashboard-grid" aria-label="Account summary">
          <article className="stat-card">
            <span className="stat-label">Current tier</span>
            <strong>{tierLabel(dashboard.subscription?.tier)}</strong>
            <p>{dashboard.isPaid ? 'Priority queue and expanded AI access.' : 'One AI ingestion per rolling week.'}</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Bookshelf</span>
            <strong>{dashboard.bookCount}</strong>
            <p>{dashboard.bookCount === 1 ? 'Book in your private library.' : 'Books in your private library.'}</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Creation quota</span>
            <strong>{dashboard.remaining}</strong>
            <p>{dashboard.isPaid ? 'Paid jobs are processed first.' : `${dashboard.weeklyIngestions}/${FREE_LIMIT} used this week.`}</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Plan renewal</span>
            <strong>{formatDate(dashboard.subscription?.currentPeriodEnd)}</strong>
            <p>{dashboard.subscription?.status || 'Free access active.'}</p>
          </article>
        </section>

        <section className="workflow-panel" aria-labelledby="next-actions-title">
          <div>
            <h2 id="next-actions-title">Continue reading or create a book</h2>
            <p className="muted">
              Open your bookshelf to read existing books, import a Project Gutenberg title, or queue a new AI-generated story when your tier allows it.
            </p>
          </div>
          <Link href="/bookshelf" className="button button-primary">
            Open My Bookshelf
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="home-shell">
      <section className="hero-panel" aria-labelledby="home-title">
        <p className="eyebrow">Premium AI ebook reader</p>
        <h1 id="home-title">LiquidFlow</h1>
        <p className="hero-copy">
        AI-enhanced ebook reader with personal bookshelves and secure access.
        </p>

        <div className="action-row">
          <Link href="/api/auth/signin" className="button button-primary">
            Sign in
          </Link>
          <Link href="/bookshelf" className="button button-secondary">
            My Bookshelf
          </Link>
        </div>

        <p className="footnote">Protected by Auth.js. Multi-user isolation enabled.</p>
      </section>
    </main>
  )
}
