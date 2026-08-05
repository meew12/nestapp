// ═══════════════════════════════════════════════════════════
//  db-direct.ts — Direct @libsql/client data access layer
//  ───────────────────────────────────────────────────────────
//  WHY THIS EXISTS:
//  Prisma + @prisma/adapter-libsql fails on Vercel serverless with
//  `URL_INVALID: The URL 'undefined'` even when DATABASE_URL is set
//  and the adapter is constructed correctly. The generated Prisma
//  client still tries to resolve env("DATABASE_URL") internally for
//  the query engine, and Vercel's bundling breaks that resolution.
//
//  This module bypasses Prisma ENTIRELY and talks to the database
//  through @libsql/client directly — the exact same approach that
//  already works in /api/setup. This is guaranteed to work on both
//  Vercel (Turso libsql://) and local dev (file: SQLite).
//
//  @libsql/client supports BOTH:
//    - libsql://your-db.turso.io  (Turso / remote)
//    - file:./db/custom.db        (local SQLite)
//  with the same createClient() call.
// ═══════════════════════════════════════════════════════════

import { createClient, type Client, type ResultSet, type InArgs } from '@libsql/client'
import { randomBytes } from 'crypto'

// ── Row type definitions (mirror prisma/schema.prisma) ──────────
export interface UserRow {
  id: string
  email: string
  name: string | null
  passwordHash: string
  role: string
  avatarColor: string
  createdAt: string
  updatedAt: string
}

export interface SessionRow {
  id: string
  userId: string
  trainingMode: number // 0 | 1
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
  drillType: string | null
  drillPassed: number | null // 0 | 1 | null
  drillGoal: string | null
  createdAt: string
}

export interface ShotRow {
  id: string
  sessionId: string
  index: number
  x: number
  y: number
  radius: number
  score: number
  isLatest: number // 0 | 1
  timestamp: number
  distanceM: number
}

export interface SubscriptionPlanRow {
  id: string
  name: string
  description: string
  priceARS: number
  durationDays: number
  mpPlanId: string | null
  features: string
  isActive: number // 0 | 1
  isFeatured: number // 0 | 1
  maxShotsPerDay: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface UserSubscriptionRow {
  id: string
  userId: string
  planId: string
  status: string
  startDate: string
  endDate: string
  autoRenew: number // 0 | 1
  createdAt: string
}

export interface PaymentRow {
  id: string
  userId: string
  planId: string | null
  amount: number
  currency: string
  status: string
  mpPaymentId: string | null
  mpPreferenceId: string | null
  mpStatus: string | null
  method: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

// ── Client singleton ───────────────────────────────────────────
let _client: Client | null = null

/**
 * Get the shared libsql client. Works for both Turso (libsql://)
 * and local SQLite (file:).
 */
export function getClient(): Client {
  if (_client) return _client
  const url = process.env.DATABASE_URL || ''
  if (!url) {
    throw new Error(
      'DATABASE_URL no está configurada. En Vercel → Settings → Environment Variables.'
    )
  }
  _client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  })
  return _client
}

// ── Query helpers ──────────────────────────────────────────────

/**
 * Run a SELECT, returning all matching rows typed as T.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = [],
): Promise<T[]> {
  const client = getClient()
  const result = await client.execute({ sql, args })
  return result.rows as unknown as T[]
}

/**
 * Run a SELECT, returning the first row or null.
 */
export async function queryFirst<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = [],
): Promise<T | null> {
  const rows = await query<T>(sql, args)
  return rows[0] ?? null
}

/**
 * Run an INSERT/UPDATE/DELETE, returning rowsAffected + lastInsertRowid.
 */
export async function execute(
  sql: string,
  args: InArgs = [],
): Promise<{ rowsAffected: number; lastInsertRowid: number | bigint | null }> {
  const client = getClient()
  const result = await client.execute({ sql, args })
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid,
  }
}

/**
 * Run multiple statements as an atomic write transaction (batch).
 * Use for multi-table inserts that must succeed or fail together.
 *
 * NOTE: All statements run "together" — you must pre-generate any
 * IDs needed across statements before calling this.
 */
export async function batch(
  statements: { sql: string; args: InArgs }[],
): Promise<ResultSet[]> {
  const client = getClient()
  return client.batch(statements, 'write')
}

// ── Scalar / value helpers ─────────────────────────────────────

/**
 * Generate a CUID-like ID (compatible with Prisma's @default(cuid())).
 */
export function generateId(): string {
  return 'c' + Date.now().toString(36) + randomBytes(8).toString('hex')
}

/**
 * Normalize a stored datetime value into a JS Date.
 * Handles both ISO ("2024-01-01T00:00:00.000Z") and SQLite
 * CURRENT_TIMESTAMP ("2024-01-01 00:00:00") formats.
 */
export function toDate(val: unknown): Date {
  if (val instanceof Date) return val
  if (typeof val === 'number') return new Date(val)
  if (typeof val === 'string') {
    const s = val.includes('T') ? val : val.replace(' ', 'T')
    return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
  }
  return new Date(0)
}

/** Current UTC time as ISO string (for storing in DATETIME columns). */
export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Format a Date as an ISO string suitable for storing.
 * Accepts Date | string | null.
 */
export function toISO(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  return val
}

/** Convert a stored 0/1 integer to a boolean. */
export function toBool(val: unknown): boolean {
  return val === 1 || val === true || val === '1' || val === 'true'
}

/** Convert a boolean to a 0/1 integer for storage. */
export function fromBool(val: boolean): number {
  return val ? 1 : 0
}

/**
 * Compute an ISO datetime string `days` from now.
 */
export function isoFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}
