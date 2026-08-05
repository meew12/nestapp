import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'

/**
 * GET /api/sessions/analytics — aggregated analytics for the current user.
 *
 * Returns:
 *   - sessions:           list of the user's sessions (newest first)
 *   - scoreDistribution:  { "10": n, "9": n, ... "1": n }
 *   - achievements:       list of 10 achievement objects (unlocked first)
 *   - streak:             { current, best, lastSessionDate }
 *   - totals:             { sessions, shots, bestScore, avgScore, totalDurationSec, bullseyes }
 *
 * Everything is computed server-side from a single query that includes
 * each session's shots (only the `score` field is needed).
 */

interface SessionRow {
  id: string
  trainingMode: boolean
  totalScore: number
  bestScore: number
  avgScore: number
  shotCount: number
  durationSec: number
  targetSize: string
  distanceM: number
  createdAt: Date
  shots: Array<{ score: number }>
}

interface AchievementDef {
  id: string
  title: string
  description: string
  icon: string
}

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_session', title: 'Primer Disparo', description: 'Completa tu primera sesión', icon: '🎯' },
  { id: 'ten_shots', title: 'Diez Impactos', description: 'Registra 10 disparos en total', icon: '🔥' },
  { id: 'fifty_shots', title: 'Cincuenta Impactos', description: 'Registra 50 disparos en total', icon: '💪' },
  { id: 'hundred_shots', title: 'Centurión', description: 'Registra 100 disparos en total', icon: '🏆' },
  { id: 'first_bullseye', title: 'Diana', description: 'Logra un impacto de 10 puntos', icon: '🎯' },
  { id: 'five_sessions', title: 'Constante', description: 'Completa 5 sesiones', icon: '📅' },
  { id: 'ten_sessions', title: 'Dedicado', description: 'Completa 10 sesiones', icon: '📈' },
  { id: 'sharpshooter', title: 'Tirador de Elite', description: 'Promedio de 8+ en una sesión de 5+ disparos', icon: '⭐' },
  { id: 'streak_3', title: 'En Racha', description: '3 sesiones en días consecutivos', icon: '🔥' },
  { id: 'long_session', title: 'Maratoniano', description: 'Sesión de 5+ minutos', icon: '⏱️' },
]

interface AchievementResult extends AchievementDef {
  unlocked: boolean
  unlockedAt?: string
}

/**
 * Compute current and best consecutive-day streaks from a list of session
 * dates (sorted ascending). A "streak day" is the calendar day of a session.
 * Sessions on day D and day D+1 count as consecutive.
 */
function computeStreak(datesAsc: Date[]): { current: number; best: number; lastSessionDate: string | null } {
  if (datesAsc.length === 0) {
    return { current: 0, best: 0, lastSessionDate: null }
  }

  // Normalize to unique YYYY-MM-DD strings sorted ascending.
  const dayStrings = Array.from(
    new Set(datesAsc.map((d) => d.toISOString().slice(0, 10)))
  ).sort()

  const msPerDay = 24 * 60 * 60 * 1000
  let best = 1
  let runStartIdx = 0

  for (let i = 1; i < dayStrings.length; i++) {
    const prev = new Date(dayStrings[i - 1] + 'T00:00:00Z').getTime()
    const cur = new Date(dayStrings[i] + 'T00:00:00Z').getTime()
    if (cur - prev === msPerDay) {
      const runLen = i - runStartIdx + 1
      if (runLen > best) best = runLen
    } else {
      runStartIdx = i
    }
  }

  // Current streak: walk backwards from the last day to find the longest
  // consecutive tail ending at the most recent session date.
  let current = 1
  for (let i = dayStrings.length - 1; i > 0; i--) {
    const cur = new Date(dayStrings[i] + 'T00:00:00Z').getTime()
    const prev = new Date(dayStrings[i - 1] + 'T00:00:00Z').getTime()
    if (cur - prev === msPerDay) {
      current++
    } else {
      break
    }
  }

  return {
    current,
    best,
    lastSessionDate: datesAsc[datesAsc.length - 1].toISOString(),
  }
}

/**
 * Find the createdAt timestamp of the session in which the cumulative shot
 * count first reached `target`.
 */
function findTimestampAtShot(sessionsAsc: SessionRow[], target: number): Date | null {
  let running = 0
  for (const s of sessionsAsc) {
    running += s.shots.length
    if (running >= target) return s.createdAt
  }
  return null
}

/**
 * Find the createdAt of the session that completes a `target`-day streak.
 */
function findStreakDay(sessionsAsc: SessionRow[], target: number): Date | null {
  const dayStrings = Array.from(
    new Set(sessionsAsc.map((s) => s.createdAt.toISOString().slice(0, 10)))
  ).sort()

  const msPerDay = 24 * 60 * 60 * 1000
  let runStartIdx = 0
  let bestRunEndIdx = -1

  for (let i = 1; i < dayStrings.length; i++) {
    const prev = new Date(dayStrings[i - 1] + 'T00:00:00Z').getTime()
    const cur = new Date(dayStrings[i] + 'T00:00:00Z').getTime()
    if (cur - prev === msPerDay) {
      if (i - runStartIdx + 1 >= target) {
        bestRunEndIdx = i
      }
    } else {
      runStartIdx = i
    }
  }

  if (bestRunEndIdx < 0) return null
  // Find the first session whose day matches the streak-completing day.
  const targetDay = dayStrings[bestRunEndIdx]
  const match = sessionsAsc.find(
    (s) => s.createdAt.toISOString().slice(0, 10) === targetDay
  )
  return match ? match.createdAt : null
}

export async function GET() {
  return withUser(async (user) => {
    const rows = await db.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { shots: { select: { score: true } } },
    })

    const sessions = rows as SessionRow[]

    // Score distribution: buckets 10..1
    const scoreDistribution: Record<string, number> = {
      '10': 0, '9': 0, '8': 0, '7': 0, '6': 0,
      '5': 0, '4': 0, '3': 0, '2': 0, '1': 0,
    }
    let bullseyes = 0
    let totalShotCount = 0
    let firstBullseyeAt: Date | null = null
    let sharpshooterAt: Date | null = null
    let longSessionAt: Date | null = null

    for (const s of sessions) {
      for (const shot of s.shots) {
        totalShotCount++
        if (shot.score >= 1 && shot.score <= 10) {
          scoreDistribution[String(shot.score)]++
        }
        if (shot.score === 10) {
          bullseyes++
          if (!firstBullseyeAt || s.createdAt < firstBullseyeAt) {
            firstBullseyeAt = s.createdAt
          }
        }
      }
      if (
        !s.trainingMode &&
        s.avgScore >= 8 &&
        s.shotCount >= 5 &&
        !sharpshooterAt
      ) {
        sharpshooterAt = s.createdAt
      }
      if (s.durationSec >= 300 && !longSessionAt) {
        longSessionAt = s.createdAt
      }
    }

    const sessionCount = sessions.length
    const bestScore = sessions.reduce((m, s) => Math.max(m, s.bestScore), 0)
    const totalDurationSec = sessions.reduce((sum, s) => sum + s.durationSec, 0)
    const avgScore =
      sessionCount > 0
        ? sessions.reduce((sum, s) => sum + s.avgScore, 0) / sessionCount
        : 0

    // Streak: use dates in ascending order (already ordered by createdAt asc).
    const streak = computeStreak(sessions.map((s) => s.createdAt))

    // Map achievements to unlocked/locked state with timestamps.
    const firstSessionAt = sessions.length > 0 ? sessions[0].createdAt : null
    const tenShotsAt =
      totalShotCount >= 10 ? findTimestampAtShot(sessions, 10) : null
    const fiftyShotsAt =
      totalShotCount >= 50 ? findTimestampAtShot(sessions, 50) : null
    const hundredShotsAt =
      totalShotCount >= 100 ? findTimestampAtShot(sessions, 100) : null
    const fiveSessionsAt =
      sessionCount >= 5 ? sessions[4].createdAt : null
    const tenSessionsAt =
      sessionCount >= 10 ? sessions[9].createdAt : null
    const streak3At =
      streak.best >= 3 ? findStreakDay(sessions, 3) : null

    const unlockedMap: Record<string, { unlocked: boolean; unlockedAt?: string }> = {
      first_session: { unlocked: sessionCount >= 1, unlockedAt: firstSessionAt?.toISOString() },
      ten_shots: { unlocked: totalShotCount >= 10, unlockedAt: tenShotsAt?.toISOString() },
      fifty_shots: { unlocked: totalShotCount >= 50, unlockedAt: fiftyShotsAt?.toISOString() },
      hundred_shots: { unlocked: totalShotCount >= 100, unlockedAt: hundredShotsAt?.toISOString() },
      first_bullseye: { unlocked: bullseyes > 0, unlockedAt: firstBullseyeAt?.toISOString() },
      five_sessions: { unlocked: sessionCount >= 5, unlockedAt: fiveSessionsAt?.toISOString() },
      ten_sessions: { unlocked: sessionCount >= 10, unlockedAt: tenSessionsAt?.toISOString() },
      sharpshooter: { unlocked: !!sharpshooterAt, unlockedAt: sharpshooterAt?.toISOString() },
      streak_3: { unlocked: streak.best >= 3, unlockedAt: streak3At?.toISOString() },
      long_session: { unlocked: !!longSessionAt, unlockedAt: longSessionAt?.toISOString() },
    }

    const achievements: AchievementResult[] = ACHIEVEMENTS.map((def) => {
      const state = unlockedMap[def.id]
      return {
        ...def,
        unlocked: state?.unlocked ?? false,
        unlockedAt: state?.unlockedAt,
      }
    }).sort((a, b) => {
      // Unlocked first; among unlocked, by unlockedAt desc.
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
      if (a.unlocked && b.unlocked) {
        return (b.unlockedAt || '').localeCompare(a.unlockedAt || '')
      }
      return 0
    })

    // Sessions payload (newest first, like the /api/sessions list).
    const sessionsPayload = sessions
      .slice()
      .reverse()
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        totalScore: s.totalScore,
        bestScore: s.bestScore,
        avgScore: s.avgScore,
        shotCount: s.shotCount,
        durationSec: s.durationSec,
        trainingMode: s.trainingMode,
      }))

    return NextResponse.json({
      sessions: sessionsPayload,
      scoreDistribution,
      achievements,
      streak,
      totals: {
        sessions: sessionCount,
        shots: totalShotCount,
        bestScore,
        avgScore: Number(avgScore.toFixed(2)),
        totalDurationSec,
        bullseyes,
      },
    })
  })
}
