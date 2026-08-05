import { NextResponse } from 'next/server'
import { queryFirst, toDate, toBool } from '@/lib/db-direct'
import { parseFeatures, withUser } from '@/lib/api'

/**
 * GET /api/subscriptions/current — current active subscription for the user.
 *
 * Direct @libsql/client implementation (no Prisma). Mirrors the original
 * Prisma `userSubscription.findFirst({ where: { userId, status: 'active' },
 * orderBy: { endDate: 'desc' }, include: { plan: true } })` query.
 */
interface CurrentSubscriptionRow {
  // UserSubscription columns
  id: string
  status: string
  startDate: string
  endDate: string
  autoRenew: number
  // Joined plan columns (aliased)
  planId: string
  planName: string
  planDescription: string
  planPriceARS: number
  planDurationDays: number
  planFeatures: string
  planIsActive: number
  planIsFeatured: number
  planMaxShotsPerDay: number
  planSortOrder: number
}

export async function GET() {
  return withUser(async (user) => {
    const sub = await queryFirst<CurrentSubscriptionRow>(
      `SELECT us.id, us.status, us.startDate, us.endDate, us.autoRenew,
              p.id AS planId, p.name AS planName, p.description AS planDescription,
              p.priceARS AS planPriceARS, p.durationDays AS planDurationDays,
              p.features AS planFeatures, p.isActive AS planIsActive,
              p.isFeatured AS planIsFeatured, p.maxShotsPerDay AS planMaxShotsPerDay,
              p.sortOrder AS planSortOrder
         FROM "UserSubscription" us
         JOIN "SubscriptionPlan" p ON p.id = us.planId
        WHERE us.userId = ? AND us.status = 'active'
        ORDER BY us.endDate DESC
        LIMIT 1`,
      [user.id],
    )

    if (!sub) return NextResponse.json({ subscription: null })

    return NextResponse.json({
      subscription: {
        id: sub.id,
        status: sub.status as 'active' | 'expired' | 'cancelled' | 'pending',
        startDate: toDate(sub.startDate).toISOString(),
        endDate: toDate(sub.endDate).toISOString(),
        autoRenew: toBool(sub.autoRenew),
        plan: {
          id: sub.planId,
          name: sub.planName,
          description: sub.planDescription,
          priceARS: sub.planPriceARS,
          durationDays: sub.planDurationDays,
          features: parseFeatures(sub.planFeatures),
          isActive: toBool(sub.planIsActive),
          isFeatured: toBool(sub.planIsFeatured),
          maxShotsPerDay: sub.planMaxShotsPerDay,
          sortOrder: sub.planSortOrder,
        },
      },
    })
  })
}
