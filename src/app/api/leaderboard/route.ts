import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'

/**
 * GET /api/leaderboard — aggregated rankings across all users.
 *
 * Categories:
 *   - best:      best single-session score (competition mode only)
 *   - average:   avg session score (min 3 sessions)
 *   - bullseyes: total 10-ring hits (count of shots with score === 10)
 *
 * Returns the current user's rank in each category + top 10 entries.
 */
export async function GET() {
  return withUser(async (user) => {
    // ── Best single-session score ──
    const bestSessions = await db.session.findMany({
      where: { trainingMode: false },
      orderBy: { totalScore: 'desc' },
      take: 50,
      select: {
        totalScore: true,
        shotCount: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarColor: true } },
      },
    })

    // Deduplicate: keep only each user's best session
    const bestByUser = new Map<string, { name: string | null; avatarColor: string; score: number; shotCount: number; createdAt: Date }>()
    for (const s of bestSessions) {
      const uid = s.user.id
      if (!bestByUser.has(uid) || (bestByUser.get(uid)?.score ?? 0) < s.totalScore) {
        bestByUser.set(uid, {
          name: s.user.name,
          avatarColor: s.user.avatarColor,
          score: s.totalScore,
          shotCount: s.shotCount,
          createdAt: s.createdAt,
        })
      }
    }
    const bestRanked = Array.from(bestByUser.entries())
      .map(([uid, data]) => ({ userId: uid, ...data }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    // ── Average session score (min 3 sessions) ──
    // SQLite + Prisma groupBy having clause is limited; fetch and aggregate in JS.
    const allCompSessions = await db.session.findMany({
      where: { trainingMode: false },
      select: {
        userId: true,
        avgScore: true,
        totalScore: true,
        user: { select: { name: true, avatarColor: true } },
      },
    })
    const avgByUser = new Map<string, { name: string | null; avatarColor: string; sum: number; count: number }>()
    for (const s of allCompSessions) {
      const existing = avgByUser.get(s.userId)
      if (existing) {
        existing.sum += s.avgScore
        existing.count += 1
      } else {
        avgByUser.set(s.userId, {
          name: s.user.name,
          avatarColor: s.user.avatarColor,
          sum: s.avgScore,
          count: 1,
        })
      }
    }
    const avgRanked = Array.from(avgByUser.entries())
      .filter(([, d]) => d.count >= 3)
      .map(([userId, d]) => ({
        userId,
        name: d.name,
        avatarColor: d.avatarColor,
        avgScore: d.sum / d.count,
        sessionCount: d.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10)

    // ── Bullseyes (10-ring hits) ──
    const allBullseyeShots = await db.shot.findMany({
      where: { score: 10 },
      select: {
        sessionId: true,
        session: { select: { userId: true, user: { select: { name: true, avatarColor: true } } } },
      },
    })
    const userBullseyeCounts = new Map<string, { name: string | null; avatarColor: string; count: number }>()
    for (const shot of allBullseyeShots) {
      const uid = shot.session.userId
      const existing = userBullseyeCounts.get(uid)
      if (existing) {
        existing.count += 1
      } else {
        userBullseyeCounts.set(uid, {
          name: shot.session.user.name,
          avatarColor: shot.session.user.avatarColor,
          count: 1,
        })
      }
    }
    const bullseyeRanked = Array.from(userBullseyeCounts.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // ── Current user's rank ──
    const userBestRank = bestRanked.findIndex((r) => r.userId === user.id) + 1
    const userAvgRank = avgRanked.findIndex((r) => r.userId === user.id) + 1
    const userBullseyeRank = bullseyeRanked.findIndex((r) => r.userId === user.id) + 1

    // User's own totals (for display when not in top 10)
    const userTotals = await db.session.aggregate({
      where: { userId: user.id, trainingMode: false },
      _max: { totalScore: true },
      _avg: { avgScore: true },
      _count: { _all: true },
    })
    const userBullseyeTotal = userBullseyeCounts.get(user.id)?.count ?? 0

    return NextResponse.json({
      best: bestRanked,
      average: avgRanked,
      bullseyes: bullseyeRanked,
      currentUser: {
        id: user.id,
        name: user.name,
        rank: {
          best: userBestRank || null,
          average: userAvgRank || null,
          bullseyes: userBullseyeRank || null,
        },
        totals: {
          bestScore: userTotals._max.totalScore ?? 0,
          avgScore: userTotals._avg.avgScore ?? 0,
          sessionCount: userTotals._count._all,
          bullseyes: userBullseyeTotal,
        },
      },
    })
  })
}
