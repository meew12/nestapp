import { NextResponse } from 'next/server'
import { getCurrentUser, getUserById } from '@/lib/auth'

export async function GET() {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return NextResponse.json({ user: null })
  }
  const user = await getUserById(sessionUser.id)
  if (!user) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({
    user: {
      ...user,
      role: user.role as 'user' | 'admin',
      createdAt: user.createdAt.toISOString(),
    },
  })
}
