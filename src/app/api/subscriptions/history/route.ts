import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'

/**
 * GET /api/subscriptions/history — list the current user's payments with plan info.
 */
export async function GET() {
  return withUser(async (user) => {
    const payments = await db.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    // Payment → Plan has no Prisma relation; resolve plan info manually.
    const planIds = Array.from(
      new Set(payments.map((p) => p.planId).filter((x): x is string => !!x))
    )
    const planRows = planIds.length
      ? await db.subscriptionPlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true, priceARS: true, durationDays: true },
        })
      : []
    const planMap = new Map(planRows.map((p) => [p.id, p]))

    return NextResponse.json(
      payments.map((p) => {
        const plan = p.planId ? planMap.get(p.planId) : null
        return {
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status as 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled',
          mpPaymentId: p.mpPaymentId,
          mpPreferenceId: p.mpPreferenceId,
          method: p.method,
          description: p.description,
          createdAt: p.createdAt.toISOString(),
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                priceARS: plan.priceARS,
                durationDays: plan.durationDays,
              }
            : null,
        }
      })
    )
  })
}
