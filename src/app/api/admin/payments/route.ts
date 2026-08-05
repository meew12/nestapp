import { NextResponse } from 'next/server'
import { query, queryFirst, toDate } from '@/lib/db-direct'
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
    const offset = (page - 1) * limit

    const whereClause = status ? 'WHERE p.status = ?' : ''
    const whereArgs = status ? [status] : []

    const [totalRow, payments] = await Promise.all([
      queryFirst<{ cnt: number | bigint }>(
        `SELECT COUNT(*) as cnt FROM "Payment" p${status ? ' WHERE p.status = ?' : ''}`,
        whereArgs,
      ),
      query<{
        id: string
        amount: number
        currency: string
        status: string
        mpPaymentId: string | null
        mpPreferenceId: string | null
        mpStatus: string | null
        method: string | null
        description: string | null
        createdAt: string
        updatedAt: string
        planId: string | null
        userId: string | null
        userEmail: string | null
        userName: string | null
      }>(
        `SELECT p.id, p.amount, p.currency, p.status, p.mpPaymentId, p.mpPreferenceId,
                p.mpStatus, p.method, p.description, p.createdAt, p.updatedAt, p.planId,
                u.id as userId, u.email as userEmail, u.name as userName
         FROM "Payment" p
         LEFT JOIN "User" u ON u.id = p.userId
         ${whereClause}
         ORDER BY p.createdAt DESC
         LIMIT ? OFFSET ?`,
        [...whereArgs, limit, offset],
      ),
    ])
    const total = Number(totalRow?.cnt ?? 0)

    // Payment → Plan has no FK relation; resolve plan names manually.
    const planIds = Array.from(
      new Set(payments.map((p) => p.planId).filter((x): x is string => !!x)),
    )
    const planRows = planIds.length
      ? await query<{ id: string; name: string }>(
          `SELECT id, name FROM "SubscriptionPlan" WHERE id IN (${planIds.map(() => '?').join(',')})`,
          planIds,
        )
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
          createdAt: toDate(p.createdAt).toISOString(),
          updatedAt: toDate(p.updatedAt).toISOString(),
          user:
            p.userId != null
              ? { id: p.userId, email: p.userEmail, name: p.userName }
              : null,
          plan: plan ? { id: plan.id, name: plan.name } : null,
        }
      }),
    })
  })
}
