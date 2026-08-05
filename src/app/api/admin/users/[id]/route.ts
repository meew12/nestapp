import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readJson, withAdmin } from '@/lib/api'

/**
 * PATCH /api/admin/users/[id] — update a user.
 *
 * Body: { name?, role?, avatarColor? }
 *
 * Safeguard: cannot demote the last admin (returns 409).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await params
    const body = await readJson<{ name?: string | null; role?: string; avatarColor?: string }>(req)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const target = await db.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name?.trim() || null
    if (body.avatarColor !== undefined) updates.avatarColor = body.avatarColor
    if (body.role !== undefined) {
      const role = body.role
      if (role !== 'user' && role !== 'admin') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      // Demoting an admin? Make sure they're not the last one.
      if (role === 'user' && target.role === 'admin') {
        const adminCount = await db.user.count({ where: { role: 'admin' } })
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last admin' },
            { status: 409 }
          )
        }
      }
      updates.role = role
    }

    const updated = await db.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarColor: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ...updated,
      role: updated.role as 'user' | 'admin',
      createdAt: updated.createdAt.toISOString(),
    })
  })
}
