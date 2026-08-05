import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { activatePendingSubscription, readJson, withUser } from '@/lib/api'

/**
 * POST /api/subscriptions/return
 *
 * Back-URL endpoint called by MercadoPago after the user completes (or
 * abandons) the checkout on MP's side. Accepts either a JSON body or query
 * string with `{ paymentId, status }`.
 *
 * If status === 'approved', the related Payment and pending UserSubscription
 * are activated.
 */
export async function POST(req: Request) {
  return withUser(async (user) => {
    const url = new URL(req.url)
    const queryPaymentId = url.searchParams.get('paymentId') || undefined
    const queryStatus = url.searchParams.get('status') || undefined

    const body = await readJson<{ paymentId?: string; status?: string }>(req)
    const paymentId = body?.paymentId || queryPaymentId
    const status = body?.status || queryStatus

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
    }

    const payment = await db.payment.findUnique({ where: { id: paymentId } })
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    if (payment.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (status === 'approved') {
      const result = await activatePendingSubscription(payment)
      return NextResponse.json({ ok: true, status: 'approved', ...result })
    }

    // Non-approved: just record the returned status on the payment if relevant.
    if (status === 'failure' || status === 'rejected' || status === 'cancelled') {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'rejected', mpStatus: status },
      })
      if (payment.planId) {
        await db.userSubscription.updateMany({
          where: { userId: payment.userId, planId: payment.planId, status: 'pending' },
          data: { status: 'cancelled' },
        })
      }
      return NextResponse.json({ ok: true, status: 'rejected' })
    }

    return NextResponse.json({ ok: true, status: status || 'pending' })
  })
}

/**
 * GET /api/subscriptions/return — MercadoPago may also issue a GET redirect
 * with the same query params. Mirror the POST behavior.
 */
export async function GET(req: Request) {
  return POST(req)
}
