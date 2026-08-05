import { NextResponse } from 'next/server'
import { queryFirst, query, execute, toDate, toBool } from '@/lib/db-direct'
import { withUser } from '@/lib/api'

/**
 * GET /api/sessions/[id] — return a session + its shots.
 * Allowed if the session belongs to the user OR the user is admin.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await params
    const session = await queryFirst<{
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
      createdAt: string
    }>(`SELECT * FROM "Session" WHERE id = ?`, [id])

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const shots = await query<{
      id: string
      index: number
      x: number
      y: number
      radius: number
      score: number
      isLatest: number
      timestamp: number
      distanceM: number
    }>(
      `SELECT id, index, x, y, radius, score, isLatest, timestamp, distanceM
       FROM "Shot" WHERE sessionId = ? ORDER BY index ASC`,
      [id],
    )

    let weather: unknown = null
    if (session.weather) {
      try { weather = JSON.parse(session.weather) } catch { weather = null }
    }

    return NextResponse.json({
      id: session.id,
      trainingMode: toBool(session.trainingMode),
      totalScore: session.totalScore,
      durationSec: session.durationSec,
      bestScore: session.bestScore,
      avgScore: session.avgScore,
      shotCount: session.shotCount,
      targetSize: session.targetSize,
      distanceM: session.distanceM,
      captureMode: session.captureMode,
      weather,
      notes: session.notes,
      createdAt: toDate(session.createdAt).toISOString(),
      shots: shots.map((s) => ({
        id: s.id,
        index: s.index,
        x: s.x,
        y: s.y,
        radius: s.radius,
        score: s.score,
        isLatest: s.isLatest === 1,
        timestamp: s.timestamp,
        distanceM: s.distanceM,
      })),
    })
  })
}

/**
 * DELETE /api/sessions/[id] — delete a session (owner or admin).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await params
    const session = await queryFirst<{ userId: string }>(
      `SELECT userId FROM "Session" WHERE id = ?`,
      [id],
    )
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cascade delete will remove the shots.
    await execute(`DELETE FROM "Session" WHERE id = ?`, [id])
    return NextResponse.json({ ok: true })
  })
}
