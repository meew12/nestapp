import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readJson, withUser } from '@/lib/api'
import type { SessionData, ShotData } from '@/lib/types'

/**
 * GET /api/sessions — list the current user's sessions (latest 50).
 * Each session includes a `shotCount` derived from the DB.
 */
export async function GET() {
  return withUser(async (user) => {
    const sessions = await db.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        trainingMode: true,
        totalScore: true,
        durationSec: true,
        bestScore: true,
        avgScore: true,
        shotCount: true,
        targetSize: true,
        distanceM: true,
        captureMode: true,
        weather: true,
        notes: true,
        drillType: true,
        drillPassed: true,
        drillGoal: true,
        createdAt: true,
        _count: { select: { shots: true } },
      },
    })

    const data = sessions.map((s) => ({
      id: s.id,
      trainingMode: s.trainingMode,
      totalScore: s.totalScore,
      durationSec: s.durationSec,
      bestScore: s.bestScore,
      avgScore: s.avgScore,
      shotCount: s.shotCount,
      targetSize: s.targetSize,
      distanceM: s.distanceM,
      captureMode: s.captureMode,
      weather: s.weather ? JSON.parse(s.weather) : null,
      notes: s.notes,
      drillType: s.drillType,
      drillPassed: s.drillPassed,
      drillGoal: s.drillGoal ? JSON.parse(s.drillGoal) : null,
      createdAt: s.createdAt.toISOString(),
      shotsCount: s._count.shots,
    }))

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

    const created = await db.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          userId: user.id,
          trainingMode,
          totalScore: Number(totalScore) || 0,
          durationSec: Number(durationSec) || 0,
          bestScore: Number(bestScore) || 0,
          avgScore: Number(avgScore) || 0,
          shotCount: Number(shotCount) || shots.length,
          targetSize,
          distanceM: Number(distanceM) || 0,
          captureMode: captureMode === 'simulator' ? 'simulator' : 'camera',
          weather: weather ? JSON.stringify(weather) : null,
          notes: notes ?? null,
          drillType: drillType ?? null,
          drillPassed: drillPassed ?? null,
          drillGoal: drillGoal ? JSON.stringify(drillGoal) : null,
        },
      })

      if (shots.length > 0) {
        const lastIndex = Math.max(...shots.map((s) => Number(s.index) || 0))
        await tx.shot.createMany({
          data: shots.map((s: ShotData) => ({
            sessionId: session.id,
            index: Number(s.index) || 0,
            x: Number(s.x) || 0,
            y: Number(s.y) || 0,
            radius: Number(s.radius) || 0,
            score: Number(s.score) || 0,
            isLatest: Number(s.index) === lastIndex,
            timestamp: Number(s.timestamp) || 0,
            distanceM: Number(s.distanceM) || 0,
          })),
        })
      }

      return session
    })

    return NextResponse.json(
      {
        id: created.id,
        trainingMode: created.trainingMode,
        totalScore: created.totalScore,
        durationSec: created.durationSec,
        bestScore: created.bestScore,
        avgScore: created.avgScore,
        shotCount: created.shotCount,
        targetSize: created.targetSize,
        distanceM: created.distanceM,
        captureMode: created.captureMode,
        weather: created.weather ? JSON.parse(created.weather) : null,
        notes: created.notes,
        drillType: created.drillType,
        drillPassed: created.drillPassed,
        drillGoal: created.drillGoal ? JSON.parse(created.drillGoal) : null,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    )
  })
}

// (end of route module)
