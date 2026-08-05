/**
 * Shared helpers for API route handlers.
 * Uses db-direct (@libsql/client) — no Prisma dependency.
 */
import { NextResponse } from 'next/server'
import type { SessionUser } from './auth'
import { requireAdmin, requireUser } from './auth'
import {
  queryFirst,
  query,
  execute,
  batch,
  generateId,
  nowISO,
  isoFromNow,
  toDate,
} from './db-direct'

/**
 * Run a handler that requires auth; convert known auth errors into proper
 * HTTP responses (401 / 403). All other errors become 500.
 */
export async function withUser(
  handler: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await requireUser()
    return await handler(user)
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * Run a handler that requires admin role.
 */
export async function withAdmin(
  handler: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await requireAdmin()
    return await handler(user)
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * Convert thrown errors into NextResponses with the right status code.
 */
export function toErrorResponse(err: unknown): NextResponse<{ error: string }> {
  const message = err instanceof Error ? err.message : String(err)
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  console.error('[api] error:', err)
  return NextResponse.json({ error: message || 'Internal Server Error' }, { status: 500 })
}

/**
 * Safely parse the JSON features field stored on SubscriptionPlan.
 */
export function parseFeatures(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string')
    return []
  } catch {
    return []
  }
}

/**
 * Read JSON body, returning null on parse failure.
 */
export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    const text = await req.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

type PaymentWithPlan = {
  id: string
  userId: string
  planId: string | null
  amount: number
  currency: string
  status: string
  mpPaymentId: string | null
}

/**
 * Given a Payment row, mark it approved and activate the user's pending
 * UserSubscription for the same plan (creating one if it doesn't yet exist).
 *
 * Implemented with direct libsql queries. The writes are executed as a
 * batch (atomic transaction) after we look up the plan + existing sub.
 *
 * Returns the activated subscription id (if any) and the new payment status.
 */
export async function activatePendingSubscription(
  payment: PaymentWithPlan
): Promise<{ subscriptionId: string | null; paymentStatus: string }> {
  // No plan — just approve the payment.
  if (!payment.planId) {
    await execute(
      `UPDATE "Payment" SET status = ?, updatedAt = ? WHERE id = ?`,
      ['approved', nowISO(), payment.id],
    )
    return { subscriptionId: null, paymentStatus: 'approved' }
  }

  // Look up the plan to get durationDays.
  const plan = await queryFirst<{ durationDays: number }>(
    `SELECT durationDays FROM "SubscriptionPlan" WHERE id = ?`,
    [payment.planId],
  )
  const durationDays = plan?.durationDays ?? 30
  const startDate = nowISO()
  const endDate = isoFromNow(durationDays)

  // Look for the existing pending subscription for this user+plan.
  const existing = await queryFirst<{ id: string }>(
    `SELECT id FROM "UserSubscription"
     WHERE userId = ? AND planId = ? AND status = 'pending'
     ORDER BY createdAt DESC LIMIT 1`,
    [payment.userId, payment.planId],
  )

  const statements: { sql: string; args: unknown[] }[] = [
    // Approve the payment.
    {
      sql: `UPDATE "Payment" SET status = ?, updatedAt = ? WHERE id = ?`,
      args: ['approved', nowISO(), payment.id],
    },
  ]

  let subId: string
  if (existing) {
    subId = existing.id
    statements.push({
      sql: `UPDATE "UserSubscription" SET status = 'active', startDate = ?, endDate = ? WHERE id = ?`,
      args: [startDate, endDate, subId],
    })
  } else {
    subId = generateId()
    statements.push({
      sql: `INSERT INTO "UserSubscription" (id, userId, planId, status, startDate, endDate, autoRenew, createdAt)
            VALUES (?, ?, ?, 'active', ?, ?, 0, ?)`,
      args: [subId, payment.userId, payment.planId, startDate, endDate, nowISO()],
    })
  }

  // Expire any OTHER active subs the user has (different id).
  statements.push({
    sql: `UPDATE "UserSubscription" SET status = 'expired' WHERE userId = ? AND status = 'active' AND id != ?`,
    args: [payment.userId, subId],
  })

  await batch(statements)

  return { subscriptionId: subId, paymentStatus: 'approved' }
}

// Re-export common helpers so routes can import from one place.
export { query, queryFirst, execute, generateId, nowISO, isoFromNow, toDate }
