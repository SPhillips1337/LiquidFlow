'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function BookCardActions({ bookId, title }: { bookId: string; title: string }) {
  const router = useRouter()
  const [pending, setPending] = useState<'delete' | 'regenerate' | null>(null)
  const [error, setError] = useState('')

  async function readError(resp: Response) {
    try {
      const data = await resp.json()
      return data.error || `Request failed (${resp.status})`
    } catch {
      return `Request failed (${resp.status})`
    }
  }

  async function deleteBook() {
    if (!window.confirm(`Delete "${title}" from your bookshelf? This cannot be undone.`)) return

    setError('')
    setPending('delete')
    try {
      const resp = await fetch(`/api/books/${encodeURIComponent(bookId)}`, {
        method: 'DELETE',
      })
      if (!resp.ok) throw new Error(await readError(resp))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setPending(null)
    }
  }

  async function regenerateBook() {
    setError('')
    setPending('regenerate')
    try {
      const resp = await fetch(`/api/books/${encodeURIComponent(bookId)}/regenerate`, {
        method: 'POST',
      })
      if (!resp.ok) throw new Error(await readError(resp))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed')
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <button
        className="button button-secondary compact"
        type="button"
        disabled={pending !== null}
        onClick={regenerateBook}
      >
        {pending === 'regenerate' ? 'Regenerating...' : 'Regenerate'}
      </button>
      <button
        className="button button-danger compact"
        type="button"
        disabled={pending !== null}
        onClick={deleteBook}
      >
        {pending === 'delete' ? 'Deleting...' : 'Delete'}
      </button>
      {error ? <p className="card-error">{error}</p> : null}
    </>
  )
}
