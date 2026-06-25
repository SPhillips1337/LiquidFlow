import { auth } from '@/auth'
import Link from 'next/link'
import { GutenbergImportForm } from './GutenbergImportForm'

export default async function ImportBookPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <main className="page-shell narrow">
        <h1>Import a book</h1>
        <p className="muted">Please sign in to import books.</p>
        <Link href="/api/auth/signin" className="button button-primary">Sign in</Link>
      </main>
    )
  }

  return (
    <main className="page-shell form-shell">
      <div className="back-link">
        <Link href="/bookshelf">Back to bookshelf</Link>
      </div>
      <header className="page-header">
        <div>
          <p className="eyebrow">Project Gutenberg</p>
          <h1>Import a book</h1>
          <p className="muted">Search public-domain texts and add one to your private LiquidFlow bookshelf.</p>
        </div>
      </header>
      <GutenbergImportForm />
    </main>
  )
}
