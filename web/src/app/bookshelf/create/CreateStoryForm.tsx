'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

const GENRES = ['Fiction', 'Science Fiction', 'Fantasy', 'Mystery', 'Romance', 'Historical Fiction', 'Adventure', 'Horror']

async function readResponse(resp: Response) {
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return resp.json()
  }

  const text = await resp.text()
  return {
    error: text.startsWith('<!DOCTYPE')
      ? `Server returned an HTML error page (${resp.status}). The request may have timed out or crashed server-side.`
      : text || `Request failed with status ${resp.status}`,
  }
}

export function CreateStoryForm() {
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const premise = String(formData.get('premise') || '').trim()
    const genre = String(formData.get('genre') || 'Fiction')

    setError('')
    setStatus('')

    if (premise.length < 8) {
      setError('Enter a longer premise first.')
      return
    }

    setIsSubmitting(true)
    setStatus('Creating your story. This can take a few minutes.')

    try {
      const resp = await fetch('/api/books/create-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premise, genre }),
      })
      const data = await readResponse(resp)
      if (!resp.ok) throw new Error(data.error || 'Story creation failed')

      setStatus('Story created. Returning to your bookshelf.')
      router.push('/bookshelf')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Story creation failed')
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flow-form" onSubmit={onSubmit}>
      <fieldset disabled={isSubmitting}>
        <legend>Story details</legend>
        <div className="field-row">
          <label htmlFor="genre">Genre</label>
          <select id="genre" name="genre" defaultValue="Fiction">
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label htmlFor="premise">Premise</label>
          <textarea
            id="premise"
            name="premise"
            rows={7}
            minLength={8}
            maxLength={1200}
            required
            aria-describedby="premise-help create-status create-error"
            placeholder="A quiet mystery in a seaside bookshop where the map inside an old atlas begins changing each night."
          />
          <p id="premise-help" className="field-help">Describe the characters, setting, tone, or conflict you want the story to follow.</p>
        </div>
        <button className="button button-primary" type="submit">
          {isSubmitting ? 'Creating story...' : 'Create story'}
        </button>
      </fieldset>
      <div className="form-status" aria-live="polite">
        {status ? <p id="create-status">{status}</p> : null}
        {error ? <p id="create-error" className="form-error">{error}</p> : null}
      </div>
    </form>
  )
}
