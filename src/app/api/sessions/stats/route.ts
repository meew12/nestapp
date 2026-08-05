import { NextResponse } from 'next/server'
import { queryFirst } from '@/lib/db-direct'
import { withUser } from '@/lib/api'

/**
 * GET /api/sessions/stats — aggregated stats for the current user.
 */
export async function GET() {
  return withUser(async (user) => {
    const [agg, shotAgg] = await Promise.all([
      queryFirst<{ cnt: number; sumDur: number; maxBest: number; avgAvg: number }>(
        `SELECT COUNT(*) AS cnt,
                COALESCE(SUM(durationSec), 0) AS sumDur,
                COALESCE(MAX(bestScore), 0) AS maxBest,
                COALESCE(AVG(avgScore), 0) AS avgAvg
         FROM "Session" WHERE userId = ?`,
        [user.id],
      ),
      queryFirst<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt
         FROM "Shot" sh JOIN "Session" s ON s.id = sh.sessionId
         WHERE s.userId = ?`,
        [user.id],
      ),
    ])

    const sessionCount = agg?.cnt ?? 0
    const sumDur = agg?.sumDur ?? 0
    const maxBest = agg?.maxBest ?? 0
    const avgAvg = agg?.avgAvg ?? 0
    const shotRecords = shotAgg?.cnt ?? 0

    return NextResponse.json({
      totalShots: sessionCount > 0 ? sessionCount : 0,
      bestScore: maxBest,
      sessionCount,
      totalDurationSec: sumDur,
      avgScore: Number(avgAvg),
      totalShotRecords: shotRecords,
    })
  })
}
