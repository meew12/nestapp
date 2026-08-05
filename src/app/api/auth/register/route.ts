import { NextResponse } from 'next/server'
import { queryFirst, execute, generateId, nowISO, toDate } from '@/lib/db-direct'
import { createToken, hashPassword, setSessionCookie } from '@/lib/auth'
import { readJson, toErrorResponse } from '@/lib/api'

export async function POST(req: Request) {
  try {
    const body = await readJson<{ email?: string; password?: string; name?: string }>(req)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    const name = (body.name || '').trim() || null

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const existing = await queryFirst<{ id: string }>(
      `SELECT id FROM "User" WHERE email = ?`,
      [email],
    )
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const id = generateId()
    const ts = nowISO()
    await execute(
      `INSERT INTO "User" (id, email, name, passwordHash, role, avatarColor, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'user', '#ff3a28', ?, ?)`,
      [id, email, name, passwordHash, ts, ts],
    )

    const token = createToken({ id, email, name, role: 'user' })

    const res = NextResponse.json({
      token,
      user: {
        id,
        email,
        name,
        role: 'user' as const,
        avatarColor: '#ff3a28',
        createdAt: toDate(ts).toISOString(),
      },
    })
    res.headers.set('Set-Cookie', setSessionCookie(token))
    return res
  } catch (err) {
    return toErrorResponse(err)
  }
}
