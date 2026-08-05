import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseFeatures, withUser } from '@/lib/api'

/**
 * GET /api/subscriptions/current — current active subscription for the user.
 */
export async function GET() {
  return withUser(async (user) => {
    const sub = await db.userSubscription.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    })

    if (!sub) return NextResponse.json({ subscription: null })

    return NextResponse.json({
      subscription: {
        id: sub.id,
        status: sub.status as 'active' | 'expired' | 'cancelled' | 'pending',
        startDate: sub.startDate.toISOString(),
        endDate: sub.endDate.toISOString(),
        autoRenew: sub.autoRenew,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          description: sub.plan.description,
          priceARS: sub.plan.priceARS,
          durationDays: sub.plan.durationDays,
          features: parseFeatures(sub.plan.features),
          isActive: sub.plan.isActive,
          isFeatured: sub.plan.isFeatured,
          maxShotsPerDay: sub.plan.maxShotsPerDay,
          sortOrder: sub.plan.sortOrder,
        },
      },
    })
  })
}
