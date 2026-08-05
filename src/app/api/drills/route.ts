import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
    const drillSessions = await db.session.findMany({
      where: { userId: user.id, drillType: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        drillType: true,
        drillPassed: true,
        totalScore: true,
        avgScore: true,
        shotCount: true,
        durationSec: true,
        createdAt: true,
      },
    })

    // Group by drillType and compute best records
    const byType = new Map<string, {
      drillType: string
      bestScore: number
      bestAvg: number
      passedCount: number
      attempts: number
      lastAttemptAt: Date
    }>()

    for (const s of drillSessions) {
      if (!s.drillType) continue
      const existing = byType.get(s.drillType)
      if (existing) {
        existing.bestScore = Math.max(existing.bestScore, s.totalScore)
        existing.bestAvg = Math.max(existing.bestAvg, s.avgScore)
        if (s.drillPassed) existing.passedCount += 1
        existing.attempts += 1
        if (s.createdAt > existing.lastAttemptAt) existing.lastAttemptAt = s.createdAt
      } else {
        byType.set(s.drillType, {
          drillType: s.drillType,
          bestScore: s.totalScore,
          bestAvg: s.avgScore,
          passedCount: s.drillPassed ? 1 : 0,
          attempts: 1,
          lastAttemptAt: s.createdAt,
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
