import { auth } from '@/auth'
import Link from 'next/link'
import { CreateStoryForm } from './CreateStoryForm'

export default async function CreateStoryPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <main className="page-shell narrow">
        <h1>Create a story</h1>
        <p className="muted">Please sign in to create stories.</p>
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
          <p className="eyebrow">AI creation</p>
          <h1>Create a story</h1>
          <p className="muted">Write a premise and LiquidFlow will create a reader-ready book in your private bookshelf.</p>
        </div>
      </header>
      <CreateStoryForm />
    </main>
  )
}
