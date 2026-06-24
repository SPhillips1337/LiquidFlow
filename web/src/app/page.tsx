import Link from 'next/link'

export default function Home() {
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
