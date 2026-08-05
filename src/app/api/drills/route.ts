import { NextResponse } from 'next/server'
import { query, toDate, toBool } from '@/lib/db-direct'
import { withUser } from '@/lib/api'

/**
 * GET /api/drills — current user's drill records (best per type).
 *
 * Returns:
 *   - records: array of { drillType, bestScore, bestAvg, passedCount, attempts, lastAttemptAt }
 *   - stats: { totalAttempts, totalPassed, passRate }
 */
export async function GET() {
  return withUser(async (user) => {
    // Fetch all drill sessions for this user
    const drillSessions = await query<{
      id: string
      drillType: string | null
      drillPassed: number | null
      totalScore: number
      avgScore: number
      shotCount: number
      durationSec: number
      createdAt: string
    }>(
      `SELECT id, drillType, drillPassed, totalScore, avgScore, shotCount, durationSec, createdAt
       FROM "Session"
       WHERE userId = ? AND drillType IS NOT NULL
       ORDER BY createdAt DESC`,
      [user.id],
    )

    // Group by drillType and compute best records
    const byType = new Map<
      string,
      {
        drillType: string
        bestScore: number
        bestAvg: number
        passedCount: number
        attempts: number
        lastAttemptAt: Date
      }
    >()

    for (const s of drillSessions) {
      if (!s.drillType) continue
      const existing = byType.get(s.drillType)
      if (existing) {
        existing.bestScore = Math.max(existing.bestScore, s.totalScore)
        existing.bestAvg = Math.max(existing.bestAvg, s.avgScore)
        if (toBool(s.drillPassed)) existing.passedCount += 1
        existing.attempts += 1
        if (toDate(s.createdAt) > existing.lastAttemptAt) {
          existing.lastAttemptAt = toDate(s.createdAt)
        }
      } else {
        byType.set(s.drillType, {
          drillType: s.drillType,
          bestScore: s.totalScore,
          bestAvg: s.avgScore,
          passedCount: toBool(s.drillPassed) ? 1 : 0,
          attempts: 1,
          lastAttemptAt: toDate(s.createdAt),
        })
      }
    }

    const records = Array.from(byType.values())
    const totalAttempts = records.reduce((s, r) => s + r.attempts, 0)
    const totalPassed = records.reduce((s, r) => s + r.passedCount, 0)

    return NextResponse.json({
      records,
      stats: {
        totalAttempts,
        totalPassed,
        passRate: totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0,
      },
    })
  })
}
