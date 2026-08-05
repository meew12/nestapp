/**
 * Shared helpers for API route handlers.
 */
import { NextResponse } from 'next/server'
import type { SessionUser } from './auth'
import { requireAdmin, requireUser } from './auth'
import { db } from './db'

/**
 * Run a handler that requires auth; convert known auth errors into proper
 * HTTP responses (401 / 403). All other errors become 500.
 *
 * The handler may return any NextResponse shape — error responses produced
 * by `toErrorResponse` are typed as `NextResponse<unknown>` so they don't
 * conflict with the success body type.
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
 * Returns the activated subscription id (if any) and the new payment status.
 */
export async function activatePendingSubscription(
  payment: PaymentWithPlan
): Promise<{ subscriptionId: string | null; paymentStatus: string }> {
  if (!payment.planId) {
    // No plan associated — just approve the payment.
    const updated = await db.payment.update({
      where: { id: payment.id },
      data: { status: 'approved' },
    })
    return { subscriptionId: null, paymentStatus: updated.status }
  }

  const planId = payment.planId
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })

  return await db.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'approved' },
    })

    // Look for the existing pending subscription for this user+plan.
    const existing = await tx.userSubscription.findFirst({
      where: { userId: payment.userId, planId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })

    const now = new Date()
    const endDate = plan
      ? new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let subId: string
    if (existing) {
      const updated = await tx.userSubscription.update({
        where: { id: existing.id },
        data: { status: 'active', startDate: now, endDate },
      })
      subId = updated.id
    } else {
      // No pending sub — create an active one (e.g. webhook fired first).
      const created = await tx.userSubscription.create({
        data: {
          userId: payment.userId,
          planId,
          status: 'active',
          startDate: now,
          endDate,
          autoRenew: false,
        },
      })
      subId = created.id
    }

    // Expire any other active subs the user has for other plans.
    await tx.userSubscription.updateMany({
      where: {
        userId: payment.userId,
        status: 'active',
        id: { not: subId },
      },
      data: { status: 'expired' },
    })

    return { subscriptionId: subId, paymentStatus: updatedPayment.status }
  })
}
