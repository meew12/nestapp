import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAdmin } from '@/lib/api'

/**
 * GET /api/admin/payments — paginated list of all payments.
 * Query: ?page=1&limit=20&status=approved|pending|...
 */
export async function GET(req: Request) {
  return withAdmin(async () => {
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const status = url.searchParams.get('status') || undefined

    const where = status ? { status } : {}

    const [total, payments] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    ])

    // Payment → Plan has no Prisma relation; resolve plan names manually.
    const planIds = Array.from(
      new Set(payments.map((p) => p.planId).filter((x): x is string => !!x))
    )
    const planRows = planIds.length
      ? await db.subscriptionPlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : []
    const planMap = new Map(planRows.map((p) => [p.id, p]))

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      payments: payments.map((p) => {
        const plan = p.planId ? planMap.get(p.planId) : null
        return {
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status as 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled',
          mpPaymentId: p.mpPaymentId,
          mpPreferenceId: p.mpPreferenceId,
          mpStatus: p.mpStatus,
          method: p.method,
          description: p.description,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          user: p.user ? { id: p.user.id, email: p.user.email, name: p.user.name } : null,
          plan: plan ? { id: plan.id, name: plan.name } : null,
        }
      }),
    })
  })
}
