import { NextResponse } from 'next/server'
import {
  query,
  batch,
  generateId,
  nowISO,
  toDate,
  toBool,
  fromBool,
} from '@/lib/db-direct'
import { readJson, withUser } from '@/lib/api'
import type { SessionData, ShotData } from '@/lib/types'

/**
 * GET /api/sessions — list the current user's sessions (latest 50).
 * Each session includes a `shotCount` derived from the DB.
 */
export async function GET() {
  return withUser(async (user) => {
    const rows = await query<{
      id: string
      userId: string
      trainingMode: number
      totalScore: number
      durationSec: number
      bestScore: number
      avgScore: number
      shotCount: number
      targetSize: string
      distanceM: number
      captureMode: string
      weather: string | null
      notes: string | null
      drillType: string | null
      drillPassed: number | null
      drillGoal: string | null
      createdAt: string
      shotCountActual: number
    }>(
      `SELECT s.*, (SELECT COUNT(*) FROM "Shot" sh WHERE sh.sessionId = s.id) AS shotCountActual
       FROM "Session" s WHERE s.userId = ? ORDER BY s.createdAt DESC LIMIT 50`,
      [user.id],
    )

    const data = rows.map((s) => {
      let weather: unknown = null
      if (s.weather) {
        try { weather = JSON.parse(s.weather) } catch { weather = null }
      }
      let drillGoal: unknown = null
      if (s.drillGoal) {
        try { drillGoal = JSON.parse(s.drillGoal) } catch { drillGoal = null }
      }
      return {
        id: s.id,
        trainingMode: toBool(s.trainingMode),
        totalScore: s.totalScore,
        durationSec: s.durationSec,
        bestScore: s.bestScore,
        avgScore: s.avgScore,
        shotCount: s.shotCount,
        targetSize: s.targetSize,
        distanceM: s.distanceM,
        captureMode: s.captureMode,
        weather,
        notes: s.notes,
        drillType: s.drillType,
        drillPassed: s.drillPassed == null ? null : toBool(s.drillPassed),
        drillGoal,
        createdAt: toDate(s.createdAt).toISOString(),
        shotsCount: s.shotCountActual,
      }
    })

    return NextResponse.json(data)
  })
}

/**
 * POST /api/sessions — create a session + its shots atomically.
 */
export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = await readJson<Partial<SessionData>>(req)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const {
      trainingMode = false,
      shots = [],
      totalScore = 0,
      durationSec = 0,
      bestScore = 0,
      avgScore = 0,
      shotCount = shots.length,
      targetSize = 'standard',
      distanceM = 0,
      captureMode = 'camera',
      weather = null,
      notes = null,
      drillType = null,
      drillPassed = null,
      drillGoal = null,
    } = body

    if (!Array.isArray(shots)) {
      return NextResponse.json({ error: 'shots must be an array' }, { status: 400 })
    }

    // Pre-generate ids + timestamp so we can insert the session and all its
    // shots in a single atomic batch.
    const sessionId = generateId()
    const createdAt = nowISO()
    const shotCountVal = Number(shotCount) || shots.length
    const captureModeVal = captureMode === 'simulator' ? 'simulator' : 'camera'
    const weatherText = weather ? JSON.stringify(weather) : null
    const drillGoalText = drillGoal ? JSON.stringify(drillGoal) : null
    const drillPassedVal = drillPassed == null ? null : fromBool(!!drillPassed)

    const statements: { sql: string; args: unknown[] }[] = [
      {
        sql: `INSERT INTO "Session"
              (id, userId, trainingMode, totalScore, durationSec, bestScore, avgScore, shotCount, targetSize, distanceM, captureMode, weather, notes, drillType, drillPassed, drillGoal, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sessionId,
          user.id,
          fromBool(!!trainingMode),
          Number(totalScore) || 0,
          Number(durationSec) || 0,
          Number(bestScore) || 0,
          Number(avgScore) || 0,
          shotCountVal,
          targetSize,
          Number(distanceM) || 0,
          captureModeVal,
          weatherText,
          notes ?? null,
          drillType ?? null,
          drillPassedVal,
          drillGoalText,
          createdAt,
        ],
      },
    ]

    if (shots.length > 0) {
      const lastIndex = Math.max(...shots.map((s) => Number(s.index) || 0))
      for (const s of shots as ShotData[]) {
        const shotId = generateId()
        const idx = Number(s.index) || 0
        statements.push({
          sql: `INSERT INTO "Shot"
                (id, sessionId, index, x, y, radius, score, isLatest, timestamp, distanceM)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            shotId,
            sessionId,
            idx,
            Number(s.x) || 0,
            Number(s.y) || 0,
            Number(s.radius) || 0,
            Number(s.score) || 0,
            fromBool(idx === lastIndex),
            Number(s.timestamp) || 0,
            Number(s.distanceM) || 0,
          ],
        })
      }
    }

    await batch(statements)

    return NextResponse.json(
      {
        id: sessionId,
        trainingMode: !!trainingMode,
        totalScore: Number(totalScore) || 0,
        durationSec: Number(durationSec) || 0,
        bestScore: Number(bestScore) || 0,
        avgScore: Number(avgScore) || 0,
        shotCount: shotCountVal,
        targetSize,
        distanceM: Number(distanceM) || 0,
        captureMode: captureModeVal,
        weather: weather ?? null,
        notes: notes ?? null,
        drillType: drillType ?? null,
        drillPassed: drillPassedVal == null ? null : drillPassedVal === 1,
        drillGoal: drillGoal ?? null,
        createdAt,
      },
      { status: 201 },
    )
  })
}

// (end of route module)
