import { prisma } from './prisma'

const FREE_LIMIT = parseInt(process.env.FREE_INGEST_LIMIT_PER_WEEK || '1', 10)

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

  if (isPaid) {
    return { allowed: true }
  }

  // Free tier weekly limit (simple rolling window)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const count = await prisma.usageLog.count({
    where: {
      userId,
      type: 'ingest',
      createdAt: { gte: oneWeekAgo },
    },
  })

  if (count >= FREE_LIMIT) {
    return { allowed: false, reason: `Free tier limit reached (${FREE_LIMIT}/week)` }
  }

  return { allowed: true }
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
