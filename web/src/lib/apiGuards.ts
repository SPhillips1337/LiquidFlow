import { NextRequest, NextResponse } from 'next/server'

const MAX_JSON_BYTES = 64 * 1024

export function requestTooLarge(req: NextRequest, maxBytes = MAX_JSON_BYTES) {
  const contentLength = req.headers.get('content-length')
  if (!contentLength) return false

  const bytes = Number(contentLength)
  return Number.isFinite(bytes) && bytes > maxBytes
}

export async function readJsonBody(req: NextRequest, maxBytes = MAX_JSON_BYTES) {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return { error: NextResponse.json({ error: 'Expected JSON body' }, { status: 415 }) }
  }

  const text = await req.text()
  if (requestTooLarge(req, maxBytes) || Buffer.byteLength(text, 'utf8') > maxBytes) {
    return { error: NextResponse.json({ error: 'Request body too large' }, { status: 413 }) }
  }

  try {
    return { body: JSON.parse(text) }
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
}

export function boundedString(value: unknown, maxLength: number) {
  const text = String(value || '').trim()
  return text.length <= maxLength ? text : ''
}

export function validateGutenbergTextUrl(value: unknown) {
  const raw = String(value || '').trim()

  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'www.gutenberg.org') return null
    if (!/^\/(?:cache\/epub\/\d+\/pg\d+\.txt|files\/\d+\/\d+(?:-0)?\.txt|ebooks\/\d+\.txt\.utf-8)$/.test(url.pathname)) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}
