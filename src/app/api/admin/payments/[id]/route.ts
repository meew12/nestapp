import { NextResponse } from 'next/server'
import { queryFirst, execute, nowISO, toDate } from '@/lib/db-direct'
import { activatePendingSubscription, readJson, withAdmin } from '@/lib/api'

/**
 * Helper — load a payment + its plan name (no FK relation between the
 * Payment and SubscriptionPlan tables, so we resolve the plan name separately).
 */
async function loadPaymentWithPlan(paymentId: string) {
  const payment = await queryFirst<{
    id: string
    amount: number
    currency: string
    status: string
    mpPaymentId: string | null
    createdAt: string
    planId: string | null
    userId: string | null
    userEmail: string | null
    userName: string | null
  }>(
    `SELECT p.id, p.amount, p.currency, p.status, p.mpPaymentId, p.createdAt, p.planId,
            u.id as userId, u.email as userEmail, u.name as userName
     FROM "Payment" p
     LEFT JOIN "User" u ON u.id = p.userId
     WHERE p.id = ?`,
    [paymentId],
  )
  if (!payment) return null
  let plan: { id: string; name: string } | null = null
  if (payment.planId) {
    const p = await queryFirst<{ id: string; name: string }>(
      `SELECT id, name FROM "SubscriptionPlan" WHERE id = ?`,
      [payment.planId],
    )
    plan = p
  }
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    mpPaymentId: payment.mpPaymentId,
    createdAt: toDate(payment.createdAt).toISOString(),
    user:
      payment.userId != null
        ? { id: payment.userId, email: payment.userEmail, name: payment.userName }
        : null,
    plan,
  }
}

/**
 * PATCH /api/admin/payments/[id] — manually set a payment's status.
 *
 * Body: { status }
 *
 * When approving, also activate the related pending UserSubscription (if any).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await params
    const body = await readJson<{ status?: string }>(req)
    if (!body || !body.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const status = body.status
    const valid = ['pending', 'approved', 'rejected', 'refunded', 'cancelled']
    if (!valid.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const payment = await queryFirst<{
      id: string
      userId: string
      planId: string | null
      amount: number
      currency: string
      status: string
      mpPaymentId: string | null
    }>(`SELECT * FROM "Payment" WHERE id = ?`, [id])
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Approving: use the shared helper so the related sub is also activated.
    if (status === 'approved' && payment.status !== 'approved') {
      const result = await activatePendingSubscription({
        id: payment.id,
        userId: payment.userId,
        planId: payment.planId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        mpPaymentId: payment.mpPaymentId,
      })
      const enriched = await loadPaymentWithPlan(payment.id)
      return NextResponse.json({ payment: enriched, subscriptionId: result.subscriptionId })
    }

    // Non-approve transitions: just update the payment status.
    await execute(
      `UPDATE "Payment" SET status = ?, updatedAt = ? WHERE id = ?`,
      [status, nowISO(), payment.id],
    )

    // If rejected/cancelled, cancel any pending sub for the same plan+user.
    if ((status === 'rejected' || status === 'cancelled') && payment.planId) {
      await execute(
        `UPDATE "UserSubscription" SET status = ?
         WHERE userId = ? AND planId = ? AND status = ?`,
        ['cancelled', payment.userId, payment.planId, 'pending'],
      )
    }

    const enriched = await loadPaymentWithPlan(payment.id)
    return NextResponse.json({ payment: enriched })
  })
}
