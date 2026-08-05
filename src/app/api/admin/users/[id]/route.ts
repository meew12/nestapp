import { NextResponse } from 'next/server'
import type { InArgs } from '@libsql/client'
import { queryFirst, execute, nowISO, toDate } from '@/lib/db-direct'
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

    const target = await queryFirst<{ id: string; role: string }>(
      `SELECT id, role FROM "User" WHERE id = ?`,
      [id],
    )
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build dynamic UPDATE — only set fields that are present in the body.
    const sets: string[] = []
    const args: InArgs = []
    if (body.name !== undefined) {
      sets.push('name = ?')
      args.push(body.name?.trim() || null)
    }
    if (body.avatarColor !== undefined) {
      sets.push('avatarColor = ?')
      args.push(body.avatarColor)
    }
    if (body.role !== undefined) {
      const role = body.role
      if (role !== 'user' && role !== 'admin') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      // Demoting an admin? Make sure they're not the last one.
      if (role === 'user' && target.role === 'admin') {
        const adminRow = await queryFirst<{ cnt: number | bigint }>(
          `SELECT COUNT(*) as cnt FROM "User" WHERE role = ?`,
          ['admin'],
        )
        if (Number(adminRow?.cnt ?? 0) <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last admin' },
            { status: 409 },
          )
        }
      }
      sets.push('role = ?')
      args.push(role)
    }
    // updatedAt is NOT NULL → always set.
    sets.push('updatedAt = ?')
    args.push(nowISO())

    args.push(id)
    await execute(
      `UPDATE "User" SET ${sets.join(', ')} WHERE id = ?`,
      args,
    )

    const updated = await queryFirst<{
      id: string
      email: string
      name: string | null
      role: string
      avatarColor: string
      createdAt: string
    }>(
      `SELECT id, email, name, role, avatarColor, createdAt FROM "User" WHERE id = ?`,
      [id],
    )
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...updated,
      role: updated.role as 'user' | 'admin',
      createdAt: toDate(updated.createdAt).toISOString(),
    })
  })
}
