import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAdmin } from '@/lib/api'

/**
 * GET /api/admin/stats — dashboard metrics for the admin panel.
 */
export async function GET() {
  return withAdmin(async () => {
    const [
      totalUsers,
      totalSessions,
      totalShots,
      revenueAgg,
      activeSubscriptions,
      recentPayments,
      recentUsers,
      plans,
    ] = await Promise.all([
      db.user.count(),
      db.session.count(),
      db.shot.count(),
      db.payment.aggregate({
        where: { status: 'approved' },
        _sum: { amount: true },
      }),
      db.userSubscription.count({ where: { status: 'active' } }),
      db.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { email: true, name: true } },
        },
      }),
      db.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarColor: true,
          createdAt: true,
        },
      }),
      db.subscriptionPlan.findMany({
        include: { _count: { select: { subscriptions: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
    ])

    // Payment → Plan has no Prisma relation, so resolve plan names manually.
    const planIds = Array.from(
      new Set(recentPayments.map((p) => p.planId).filter((x): x is string => !!x))
    )
    const planRows = planIds.length
      ? await db.subscriptionPlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : []
    const planMap = new Map(planRows.map((p) => [p.id, p]))

    const planDistribution = plans.map((p) => ({
      id: p.id,
      name: p.name,
      subscriberCount: p._count.subscriptions,
    }))

    return NextResponse.json({
      totalUsers,
      totalSessions,
      totalShots,
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      activeSubscriptions,
      recentPayments: recentPayments.map((p) => {
        const plan = p.planId ? planMap.get(p.planId) : null
        return {
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          user: p.user ? { email: p.user.email, name: p.user.name } : null,
          plan: plan ? { id: plan.id, name: plan.name } : null,
        }
      }),
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'user' | 'admin',
        avatarColor: u.avatarColor,
        createdAt: u.createdAt.toISOString(),
      })),
      planDistribution,
    })
  })
}
