import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'

/**
 * GET /api/sessions/stats — aggregated stats for the current user.
 */
export async function GET() {
  return withUser(async (user) => {
    const [agg, sessions] = await Promise.all([
      db.session.aggregate({
        where: { userId: user.id },
        _sum: { durationSec: true },
        _max: { bestScore: true },
        _avg: { avgScore: true },
        _count: { _all: true },
      }),
      db.shot.aggregate({
        where: { session: { userId: user.id } },
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      totalShots: agg._count._all > 0 ? agg._count._all : 0,
      bestScore: agg._max.bestScore ?? 0,
      sessionCount: agg._count._all,
      totalDurationSec: agg._sum.durationSec ?? 0,
      avgScore: Number(agg._avg.avgScore ?? 0),
      totalShotRecords: sessions._count._all,
    })
  })
}
