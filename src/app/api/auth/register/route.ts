import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: { email, name, passwordHash, role: 'user' },
      select: { id: true, email: true, name: true, role: true, avatarColor: true, createdAt: true },
    })

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'user' | 'admin',
    })

    const res = NextResponse.json({
      token,
      user: {
        ...user,
        role: user.role as 'user' | 'admin',
        createdAt: user.createdAt.toISOString(),
      },
    })
    res.headers.set('Set-Cookie', setSessionCookie(token))
    return res
  } catch (err) {
    return toErrorResponse(err)
  }
}
