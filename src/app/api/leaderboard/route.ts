import { NextResponse } from 'next/server'
import { query, queryFirst, toDate } from '@/lib/db-direct'
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
    const bestSessions = await query<{
      totalScore: number
      shotCount: number
      createdAt: string
      userId: string
      name: string | null
      avatarColor: string
    }>(
      `SELECT s.totalScore, s.shotCount, s.createdAt,
              u.id as userId, u.name, u.avatarColor
       FROM "Session" s
       JOIN "User" u ON u.id = s.userId
       WHERE s.trainingMode = 0
       ORDER BY s.totalScore DESC
       LIMIT 50`,
    )

    // Deduplicate: keep only each user's best session
    const bestByUser = new Map<
      string,
      {
        name: string | null
        avatarColor: string
        score: number
        shotCount: number
        createdAt: Date
      }
    >()
    for (const s of bestSessions) {
      const uid = s.userId
      if (!bestByUser.has(uid) || (bestByUser.get(uid)?.score ?? 0) < s.totalScore) {
        bestByUser.set(uid, {
          name: s.name,
          avatarColor: s.avatarColor,
          score: s.totalScore,
          shotCount: s.shotCount,
          createdAt: toDate(s.createdAt),
        })
      }
    }
    const bestRanked = Array.from(bestByUser.entries())
      .map(([uid, data]) => ({
        userId: uid,
        name: data.name,
        avatarColor: data.avatarColor,
        score: data.score,
        shotCount: data.shotCount,
        createdAt: data.createdAt,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    // ── Average session score (min 3 sessions) ──
    // SQLite groupBy with HAVING is possible but Prisma's groupBy is limited;
    // fetch all competition sessions and aggregate in JS (same as original).
    const allCompSessions = await query<{
      userId: string
      avgScore: number
      totalScore: number
      name: string | null
      avatarColor: string
    }>(
      `SELECT s.userId, s.avgScore, s.totalScore,
              u.name, u.avatarColor
       FROM "Session" s
       JOIN "User" u ON u.id = s.userId
       WHERE s.trainingMode = 0`,
    )
    const avgByUser = new Map<
      string,
      { name: string | null; avatarColor: string; sum: number; count: number }
    >()
    for (const s of allCompSessions) {
      const existing = avgByUser.get(s.userId)
      if (existing) {
        existing.sum += s.avgScore
        existing.count += 1
      } else {
        avgByUser.set(s.userId, {
          name: s.name,
          avatarColor: s.avatarColor,
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
    const allBullseyeShots = await query<{
      sessionId: string
      userId: string
      name: string | null
      avatarColor: string
    }>(
      `SELECT sh.sessionId, s.userId, u.name, u.avatarColor
       FROM "Shot" sh
       JOIN "Session" s ON s.id = sh.sessionId
       JOIN "User" u ON u.id = s.userId
       WHERE sh.score = 10`,
    )
    const userBullseyeCounts = new Map<
      string,
      { name: string | null; avatarColor: string; count: number }
    >()
    for (const shot of allBullseyeShots) {
      const uid = shot.userId
      const existing = userBullseyeCounts.get(uid)
      if (existing) {
        existing.count += 1
      } else {
        userBullseyeCounts.set(uid, {
          name: shot.name,
          avatarColor: shot.avatarColor,
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
    const userTotals = await queryFirst<{
      maxTotal: number | null
      avgAvg: number | null
      cnt: number | bigint
    }>(
      `SELECT MAX(totalScore) as maxTotal, AVG(avgScore) as avgAvg, COUNT(*) as cnt
       FROM "Session"
       WHERE userId = ? AND trainingMode = 0`,
      [user.id],
    )
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
          bestScore: userTotals?.maxTotal ?? 0,
          avgScore: userTotals?.avgAvg ?? 0,
          sessionCount: Number(userTotals?.cnt ?? 0),
          bullseyes: userBullseyeTotal,
        },
      },
    })
  })
}
