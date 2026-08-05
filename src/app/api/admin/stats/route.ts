import { NextResponse } from 'next/server'
import { query, queryFirst, toDate } from '@/lib/db-direct'
import { withAdmin } from '@/lib/api'

/**
 * GET /api/admin/stats — dashboard metrics for the admin panel.
 */
export async function GET() {
  return withAdmin(async () => {
    const [
      userCountRow,
      sessionCountRow,
      shotCountRow,
      revenueRow,
      activeSubsRow,
      recentPayments,
      recentUsers,
      plans,
    ] = await Promise.all([
      queryFirst<{ cnt: number | bigint }>('SELECT COUNT(*) as cnt FROM "User"'),
      queryFirst<{ cnt: number | bigint }>('SELECT COUNT(*) as cnt FROM "Session"'),
      queryFirst<{ cnt: number | bigint }>('SELECT COUNT(*) as cnt FROM "Shot"'),
      queryFirst<{ sumAmt: number | bigint | null }>(
        'SELECT COALESCE(SUM(amount),0) as sumAmt FROM "Payment" WHERE status=?',
        ['approved'],
      ),
      queryFirst<{ cnt: number | bigint }>(
        'SELECT COUNT(*) as cnt FROM "UserSubscription" WHERE status=?',
        ['active'],
      ),
      query<{
        id: string
        amount: number
        currency: string
        status: string
        createdAt: string
        planId: string | null
        userEmail: string | null
        userName: string | null
      }>(
        `SELECT p.id, p.amount, p.currency, p.status, p.createdAt, p.planId,
                u.email as userEmail, u.name as userName
         FROM "Payment" p
         LEFT JOIN "User" u ON u.id = p.userId
         ORDER BY p.createdAt DESC LIMIT 5`,
      ),
      query<{
        id: string
        email: string
        name: string | null
        role: string
        avatarColor: string
        createdAt: string
      }>(
        `SELECT id, email, name, role, avatarColor, createdAt
         FROM "User" ORDER BY createdAt DESC LIMIT 5`,
      ),
      query<{
        id: string
        name: string
        subCount: number | bigint
      }>(
        `SELECT p.id, p.name,
                (SELECT COUNT(*) FROM "UserSubscription" us WHERE us.planId = p.id) as subCount
         FROM "SubscriptionPlan" p
         ORDER BY p.sortOrder ASC`,
      ),
    ])

    // Payment → Plan has no FK relation, so resolve plan names manually.
    const planIds = Array.from(
      new Set(recentPayments.map((p) => p.planId).filter((x): x is string => !!x)),
    )
    const planRows = planIds.length
      ? await query<{ id: string; name: string }>(
          `SELECT id, name FROM "SubscriptionPlan" WHERE id IN (${planIds.map(() => '?').join(',')})`,
          planIds,
        )
      : []
    const planMap = new Map(planRows.map((p) => [p.id, p]))

    const planDistribution = plans.map((p) => ({
      id: p.id,
      name: p.name,
      subscriberCount: Number(p.subCount),
    }))

    return NextResponse.json({
      totalUsers: Number(userCountRow?.cnt ?? 0),
      totalSessions: Number(sessionCountRow?.cnt ?? 0),
      totalShots: Number(shotCountRow?.cnt ?? 0),
      totalRevenue: Number(revenueRow?.sumAmt ?? 0),
      activeSubscriptions: Number(activeSubsRow?.cnt ?? 0),
      recentPayments: recentPayments.map((p) => {
        const plan = p.planId ? planMap.get(p.planId) : null
        return {
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          createdAt: toDate(p.createdAt).toISOString(),
          user:
            p.userEmail != null || p.userName != null
              ? { email: p.userEmail, name: p.userName }
              : null,
          plan: plan ? { id: plan.id, name: plan.name } : null,
        }
      }),
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'user' | 'admin',
        avatarColor: u.avatarColor,
        createdAt: toDate(u.createdAt).toISOString(),
      })),
      planDistribution,
    })
  })
}
