import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'

/**
 * GET /api/sessions/[id] — return a session + its shots.
 * Allowed if the session belongs to the user OR the user is admin.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await params
    const session = await db.session.findUnique({
      where: { id },
      include: {
        shots: { orderBy: { index: 'asc' } },
      },
    })
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      id: session.id,
      trainingMode: session.trainingMode,
      totalScore: session.totalScore,
      durationSec: session.durationSec,
      bestScore: session.bestScore,
      avgScore: session.avgScore,
      shotCount: session.shotCount,
      targetSize: session.targetSize,
      distanceM: session.distanceM,
      captureMode: session.captureMode,
      weather: session.weather ? JSON.parse(session.weather) : null,
      notes: session.notes,
      createdAt: session.createdAt.toISOString(),
      shots: session.shots.map((s) => ({
        id: s.id,
        index: s.index,
        x: s.x,
        y: s.y,
        radius: s.radius,
        score: s.score,
        isLatest: s.isLatest,
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
    const session = await db.session.findUnique({ where: { id }, select: { userId: true } })
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cascade delete will remove the shots.
    await db.session.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  })
}
