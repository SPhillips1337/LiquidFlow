import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

const FREE_LIMIT = parseInt(process.env.FREE_INGEST_LIMIT_PER_WEEK || '1', 10)
const PAID_LIMIT = parseInt(process.env.PAID_INGEST_LIMIT_PER_WEEK || '50', 10)

export interface UsageRecord {
  type: string
  model?: string
  tokens?: number
  cost?: number
}

/**
 * Check if user can perform an ingestion (or other quota-limited action).
 * Free users limited to FREE_LIMIT per week.
 */
export async function canIngest(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  })

  const isPaid = user?.subscription?.status === 'active' && ['paid_monthly', 'paid_yearly'].includes(user.subscription.tier || '')

  // Free tier weekly limit (simple rolling window)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const count = await prisma.usageLog.count({
    where: {
      userId,
      type: 'ingest',
      createdAt: { gte: oneWeekAgo },
    },
  })

  const limit = isPaid ? PAID_LIMIT : FREE_LIMIT
  if (count >= limit) {
    return { allowed: false, reason: `${isPaid ? 'Paid' : 'Free'} tier limit reached (${limit}/week)` }
  }

  return { allowed: true }
}

/**
 * Atomically reserve an ingestion slot before expensive work starts.
 */
export async function reserveIngest(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  })

  const isPaid = user?.subscription?.status === 'active' && ['paid_monthly', 'paid_yearly'].includes(user.subscription.tier || '')
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  try {
    return await prisma.$transaction(async (tx) => {
      const count = await tx.usageLog.count({
        where: {
          userId,
          type: 'ingest',
          createdAt: { gte: oneWeekAgo },
        },
      })

      const limit = isPaid ? PAID_LIMIT : FREE_LIMIT
      if (count >= limit) {
        return { allowed: false, reason: `${isPaid ? 'Paid' : 'Free'} tier limit reached (${limit}/week)` }
      }

      await tx.usageLog.create({
        data: { userId, type: 'ingest' },
      })

      return { allowed: true }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch {
    return { allowed: false, reason: 'Quota reservation failed. Try again.' }
  }
}

/**
 * Record usage after an AI call or ingestion.
 */
export async function recordUsage(
  userId: string,
  type: string,
  model?: string,
  tokens?: number,
  cost?: number
) {
  await prisma.usageLog.create({
    data: {
      userId,
      type,
      model,
      tokens,
      cost,
    },
  })
}
