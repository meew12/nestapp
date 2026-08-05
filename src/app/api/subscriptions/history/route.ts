import { NextResponse } from 'next/server'
import { query, toDate } from '@/lib/db-direct'
import { withUser } from '@/lib/api'

/**
 * GET /api/subscriptions/history — list the current user's payments with plan info.
 *
 * Direct @libsql/client implementation (no Prisma). Mirrors the original
 * `db.payment.findMany` + `db.subscriptionPlan.findMany({ where: { id: { in } } })`.
 */
interface PaymentRow {
  id: string
  amount: number
  currency: string
  status: string
  mpPaymentId: string | null
  mpPreferenceId: string | null
  method: string | null
  description: string | null
  createdAt: string
  planId: string | null
}

interface PlanRow {
  id: string
  name: string
  priceARS: number
  durationDays: number
}

export async function GET() {
  return withUser(async (user) => {
    const payments = await query<PaymentRow>(
      `SELECT id, amount, currency, status, mpPaymentId, mpPreferenceId,
              method, description, createdAt, planId
         FROM "Payment"
        WHERE userId = ?
        ORDER BY createdAt DESC`,
      [user.id],
    )

    // Payment → Plan has no DB-level relation; resolve plan info manually.
    const planIds = Array.from(
      new Set(payments.map((p) => p.planId).filter((x): x is string => !!x)),
    )
    const planMap = new Map<string, PlanRow>()
    if (planIds.length) {
      const placeholders = planIds.map(() => '?').join(', ')
      const planRows = await query<PlanRow>(
        `SELECT id, name, priceARS, durationDays
           FROM "SubscriptionPlan"
          WHERE id IN (${placeholders})`,
        planIds,
      )
      for (const p of planRows) planMap.set(p.id, p)
    }

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
          createdAt: toDate(p.createdAt).toISOString(),
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                priceARS: plan.priceARS,
                durationDays: plan.durationDays,
              }
            : null,
        }
      }),
    )
  })
}
