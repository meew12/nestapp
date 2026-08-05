import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { activatePendingSubscription, readJson } from '@/lib/api'
import { processWebhook } from '@/lib/mercadopago'

/**
 * POST /api/payments/webhook
 *
 * MercadoPago notification endpoint.
 *
 * Body: `{ type, data: { id } }` (MP format) — also accepts the legacy
 * `{ topic, id }` shape or query-string form.
 *
 * MUST return 200 quickly. NEVER throw to the caller — wrap every step in
 * try/catch so a malformed payload doesn't cause MP to retry indefinitely.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const queryType = url.searchParams.get('type') || url.searchParams.get('topic')
    const queryId = url.searchParams.get('data.id') || url.searchParams.get('id')

    const body = await readJson<{
      type?: string
      topic?: string
      data?: { id?: string | number }
      data_id?: string
      id?: string
    }>(req)

    const type = body?.type || body?.topic || queryType || ''
    const dataId =
      (body?.data?.id !== undefined ? String(body.data.id) : undefined) ||
      body?.data_id ||
      body?.id ||
      queryId ||
      ''

    if (!type || !dataId) {
      // Missing info — still 200 so MP doesn't retry.
      return NextResponse.json({ ok: true, ignored: true, reason: 'missing-fields' })
    }

    const result = await processWebhook(type, dataId)
    const payment = result.payment
    const externalRef = result.externalReference

    if (!payment) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'no-payment-info' })
    }

    // Look up the matching Payment record by mpPaymentId OR external_reference.
    let paymentRow = null as Awaited<ReturnType<typeof db.payment.findFirst>>
    if (payment.id) {
      paymentRow = await db.payment.findFirst({
        where: { OR: [{ mpPaymentId: String(payment.id) }, { id: externalRef || undefined }] },
      })
    } else if (externalRef) {
      paymentRow = await db.payment.findUnique({ where: { id: externalRef } })
    }

    if (!paymentRow) {
      // Could be a payment created elsewhere — acknowledge and move on.
      return NextResponse.json({ ok: true, ignored: true, reason: 'payment-not-found' })
    }

    // Update raw MP status fields.
    await db.payment.update({
      where: { id: paymentRow.id },
      data: {
        mpPaymentId: paymentRow.mpPaymentId || String(payment.id),
        mpStatus: payment.status,
      },
    })

    if (payment.status === 'approved' && paymentRow.status !== 'approved') {
      await activatePendingSubscription({
        id: paymentRow.id,
        userId: paymentRow.userId,
        planId: paymentRow.planId,
        amount: paymentRow.amount,
        currency: paymentRow.currency,
        status: paymentRow.status,
        mpPaymentId: paymentRow.mpPaymentId,
      })
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await db.payment.update({
        where: { id: paymentRow.id },
        data: { status: payment.status === 'cancelled' ? 'cancelled' : 'rejected' },
      })
      if (paymentRow.planId) {
        await db.userSubscription.updateMany({
          where: { userId: paymentRow.userId, planId: paymentRow.planId, status: 'pending' },
          data: { status: 'cancelled' },
        })
      }
    }

    return NextResponse.json({ ok: true, processed: true })
  } catch (err) {
    // Never throw to the caller — MP just wants a 200.
    console.error('[webhook] error:', err)
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}
