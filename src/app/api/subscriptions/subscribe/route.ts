import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readJson, withUser } from '@/lib/api'
import { createPreference } from '@/lib/mercadopago'

/**
 * POST /api/subscriptions/subscribe
 * Body: { planId }
 *
 * - For paid plans: creates a pending Payment + pending UserSubscription,
 *   then asks MercadoPago for a checkout preference and returns its init point.
 * - For free plans (priceARS === 0): auto-approves and activates the
 *   subscription immediately.
 */
export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = await readJson<{ planId?: string }>(req)
    if (!body || !body.planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    const plan = await db.subscriptionPlan.findUnique({ where: { id: body.planId } })
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Plan not found or inactive' }, { status: 404 })
    }

    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)

    // ─── Free plan: auto-approve ───────────────────────────────
    if (plan.priceARS === 0) {
      const result = await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            userId: user.id,
            planId: plan.id,
            amount: 0,
            currency: 'ARS',
            status: 'approved',
            method: 'free',
            description: `Plan ${plan.name} (gratuito)`,
          },
        })
        const subscription = await tx.userSubscription.create({
          data: {
            userId: user.id,
            planId: plan.id,
            status: 'active',
            startDate,
            endDate,
            autoRenew: false,
          },
        })
        return { payment, subscription }
      })

      return NextResponse.json({
        paymentId: result.payment.id,
        preferenceId: null,
        initPoint: null,
        status: 'approved',
        subscriptionId: result.subscription.id,
      })
    }

    // ─── Paid plan: create pending records + MP preference ─────
    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          planId: plan.id,
          amount: plan.priceARS,
          currency: 'ARS',
          status: 'pending',
          description: `Suscripción ${plan.name}`,
        },
      })
      const subscription = await tx.userSubscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: 'pending',
          startDate,
          endDate,
          autoRenew: false,
        },
      })
      return { payment, subscription }
    })

    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const preference = await createPreference({
      items: [
        {
          id: plan.id,
          title: `Suscripción E-TARGET — ${plan.name}`,
          description: plan.description,
          quantity: 1,
          unit_price: plan.priceARS,
          currency_id: 'ARS',
        },
      ],
      payer: { email: user.email, name: user.name || undefined },
      externalReference: result.payment.id,
      backUrls: {
        success: `${base}/api/subscriptions/return?paymentId=${result.payment.id}&status=approved`,
        pending: `${base}/api/subscriptions/return?paymentId=${result.payment.id}&status=pending`,
        failure: `${base}/api/subscriptions/return?paymentId=${result.payment.id}&status=failure`,
      },
    })

    await db.payment.update({
      where: { id: result.payment.id },
      data: { mpPreferenceId: preference.id },
    })

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint: preference.init_point || preference.sandbox_init_point,
      paymentId: result.payment.id,
      subscriptionId: result.subscription.id,
      status: 'pending',
    })
  })
}
