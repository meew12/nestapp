import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { activatePendingSubscription, readJson, withAdmin } from '@/lib/api'

/**
 * Helper — load a payment + its plan name (no Prisma relation between the
 * two models, so we resolve the plan name separately).
 */
async function loadPaymentWithPlan(paymentId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  if (!payment) return null
  let plan: { id: string; name: string } | null = null
  if (payment.planId) {
    const p = await db.subscriptionPlan.findUnique({
      where: { id: payment.planId },
      select: { id: true, name: true },
    })
    plan = p
  }
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    mpPaymentId: payment.mpPaymentId,
    createdAt: payment.createdAt.toISOString(),
    user: payment.user ? { id: payment.user.id, email: payment.user.email, name: payment.user.name } : null,
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

    const payment = await db.payment.findUnique({ where: { id } })
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
    await db.payment.update({ where: { id: payment.id }, data: { status } })

    // If rejected/cancelled, cancel any pending sub for the same plan+user.
    if ((status === 'rejected' || status === 'cancelled') && payment.planId) {
      await db.userSubscription.updateMany({
        where: { userId: payment.userId, planId: payment.planId, status: 'pending' },
        data: { status: 'cancelled' },
      })
    }

    const enriched = await loadPaymentWithPlan(payment.id)
    return NextResponse.json({ payment: enriched })
  })
}
