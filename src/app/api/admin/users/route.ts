import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

    const where = q
      ? {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : {}

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarColor: true,
          createdAt: true,
          subscriptions: {
            where: { status: 'active' },
            orderBy: { endDate: 'desc' },
            take: 1,
            include: { plan: { select: { id: true, name: true } } },
          },
        },
      }),
    ])

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'user' | 'admin',
        avatarColor: u.avatarColor,
        createdAt: u.createdAt.toISOString(),
        activeSubscription: u.subscriptions[0]
          ? {
              id: u.subscriptions[0].id,
              status: u.subscriptions[0].status as 'active' | 'expired' | 'cancelled' | 'pending',
              startDate: u.subscriptions[0].startDate.toISOString(),
              endDate: u.subscriptions[0].endDate.toISOString(),
              plan: u.subscriptions[0].plan,
            }
          : null,
      })),
    })
  })
}
