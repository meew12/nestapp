import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken, setSessionCookie, verifyPassword } from '@/lib/auth'
import { readJson, toErrorResponse } from '@/lib/api'

export async function POST(req: Request) {
  try {
    const body = await readJson<{ email?: string; password?: string }>(req)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'user' | 'admin',
    })

    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'user' | 'admin',
        avatarColor: user.avatarColor,
        createdAt: user.createdAt.toISOString(),
      },
    })
    res.headers.set('Set-Cookie', setSessionCookie(token))
    return res
  } catch (err) {
    return toErrorResponse(err)
  }
}
