import { prisma } from '../lib/prisma'
import { canIngest, recordUsage } from '../lib/quotas'
import { chatCompletion } from '../lib/openrouter'

/**
 * Simple Prisma-backed ingestion queue with paid priority.
 * For production replace with BullMQ + Redis or pg-boss.
 *
 * Jobs are stored in a lightweight DB table (add Job model if scaling).
 * Paid jobs (priority 10) always run before free (priority 1).
 */

export interface IngestionJob {
  id: string
  userId: string
  title: string
  slug: string
  manifest?: any
  priority: number // 10 = paid, 1 = free
  status: 'pending' | 'processing' | 'done' | 'failed'
  createdAt: Date
}

let jobs: IngestionJob[] = [] // in-memory for MVP; persist to DB in real impl

export async function enqueueIngestion(params: {
  userId: string
  title: string
  slug: string
  manifest?: any
  isPaid?: boolean
}) {
  const { userId, title, slug, manifest, isPaid = false } = params

  const allowed = await canIngest(userId)
  if (!allowed.allowed) {
    throw new Error(allowed.reason || 'Quota exceeded')
  }

  const job: IngestionJob = {
    id: crypto.randomUUID(),
    userId,
    title,
    slug,
    manifest,
    priority: isPaid ? 10 : 1,
    status: 'pending',
    createdAt: new Date(),
  }

  jobs.push(job)
  // In real impl: await prisma.job.create({ data: job })

  // Kick off processor (non-blocking)
  setImmediate(() => processQueue())

  return job
}

async function processQueue() {
  // Sort: highest priority first, then FIFO
  jobs.sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime())

  const next = jobs.find(j => j.status === 'pending')
  if (!next) return

  next.status = 'processing'

  try {
    // Example: call OpenRouter for annotation (placeholder)
    const result = await chatCompletion(
      next.userId,
      [{ role: 'user', content: `Summarize book: ${next.title}` }],
      next.priority === 10
    )

    // Persist book via existing ingest helper
    await prisma.book.create({
      data: {
        userId: next.userId,
        title: next.title,
        slug: next.slug,
        manifest: next.manifest || { summary: result.choices[0]?.message?.content },
      },
    })

    await recordUsage(next.userId, 'ingest', result.model, result.usage?.total_tokens)

    next.status = 'done'
  } catch (err) {
    next.status = 'failed'
    console.error('[Queue] Job failed', err)
  }

  // Continue with next job
  setImmediate(() => processQueue())
}

export function getQueueStatus() {
  return jobs.map(j => ({ ...j, manifest: undefined }))
}
