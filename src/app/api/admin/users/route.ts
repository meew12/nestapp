import { NextResponse } from 'next/server'
import { query, queryFirst, toDate } from '@/lib/db-direct'
import { withAdmin } from '@/lib/api'

/**
 * GET /api/admin/users — paginated list of all users with active subscription.
 * Query params: ?page=1&limit=20&q=search
 */
export async function GET(req: Request) {
  return withAdmin(async () => {
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const q = (url.searchParams.get('q') || '').trim()
    const offset = (page - 1) * limit

    // Build WHERE clause + args based on optional search term.
    const whereClause = q ? `(email LIKE ? OR name LIKE ?)` : ''
    const whereArgs = q ? [`%${q}%`, `%${q}%`] : []

    const [totalRow, users] = await Promise.all([
      queryFirst<{ cnt: number | bigint }>(
        `SELECT COUNT(*) as cnt FROM "User"${whereClause ? ' WHERE ' + whereClause : ''}`,
        whereArgs,
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
         FROM "User"${whereClause ? ' WHERE ' + whereClause : ''}
         ORDER BY createdAt DESC
         LIMIT ? OFFSET ?`,
        [...whereArgs, limit, offset],
      ),
    ])
    const total = Number(totalRow?.cnt ?? 0)

    // Resolve each user's most-recent active subscription in a single query.
    const userIds = users.map((u) => u.id)
    let activeSubsByUser = new Map<
      string,
      {
        id: string
        status: string
        startDate: string
        endDate: string
        planId: string
        planName: string
      }
    >()
    if (userIds.length > 0) {
      const subs = await query<{
        id: string
        userId: string
        status: string
        startDate: string
        endDate: string
        planId: string
        planName: string
      }>(
        `SELECT us.id, us.userId, us.status, us.startDate, us.endDate,
                p.id as planId, p.name as planName
         FROM "UserSubscription" us
         JOIN "SubscriptionPlan" p ON p.id = us.planId
         WHERE us.status = 'active' AND us.userId IN (${userIds.map(() => '?').join(',')})
         ORDER BY us.endDate DESC`,
        userIds,
      )
      // Keep the first (most recent endDate) per user.
      for (const s of subs) {
        if (!activeSubsByUser.has(s.userId)) {
          activeSubsByUser.set(s.userId, {
            id: s.id,
            status: s.status,
            startDate: s.startDate,
            endDate: s.endDate,
            planId: s.planId,
            planName: s.planName,
          })
        }
      }
    }

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      users: users.map((u) => {
        const sub = activeSubsByUser.get(u.id)
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role as 'user' | 'admin',
          avatarColor: u.avatarColor,
          createdAt: toDate(u.createdAt).toISOString(),
          activeSubscription: sub
            ? {
                id: sub.id,
                status: sub.status as 'active' | 'expired' | 'cancelled' | 'pending',
                startDate: toDate(sub.startDate).toISOString(),
                endDate: toDate(sub.endDate).toISOString(),
                plan: { id: sub.planId, name: sub.planName },
              }
            : null,
        }
      }),
    })
  })
}
