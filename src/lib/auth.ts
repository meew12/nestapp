// ═══════════════════════════════════════════════════════════
//  auth.ts — Authentication helpers (JWT + password hashing)
//  Uses db-direct (@libsql/client) instead of Prisma, so it works
//  reliably on Vercel + Turso.
// ═══════════════════════════════════════════════════════════
import { queryFirst, toDate } from './db-direct'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'e-target-dev-secret-change-me'
const COOKIE_NAME = 'etarget_session'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin'
}

/**
 * Hash a password using Node's built-in scrypt (no external dep).
 */
export async function hashPassword(password: string): Promise<string> {
  const crypto = await import('crypto')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verify a password against a stored hash.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const crypto = await import('crypto')
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  return test === hash
}

/**
 * Create a JWT token for a user.
 */
export function createToken(user: SessionUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Verify a JWT token.
 */
export function verifyToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionUser
    return payload
  } catch {
    return null
  }
}

/**
 * Get the currently authenticated user from the request cookies.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}

/**
 * Require authentication — throws redirect-like error for API routes.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

/**
 * Require admin role.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return user
}

/**
 * Set the session cookie on a response (used by Route Handlers).
 */
export function setSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; ${
    process.env.NODE_ENV === 'production' ? 'Secure;' : ''
  }`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export const AUTH_COOKIE = COOKIE_NAME

/**
 * Fetch the full user record from DB via direct libsql query.
 * Used by /api/auth/me and anywhere we need the persisted user.
 */
export async function getUserById(id: string) {
  const row = await queryFirst<{
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
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    avatarColor: row.avatarColor,
    createdAt: toDate(row.createdAt),
  }
}
