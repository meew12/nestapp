import { NextResponse } from 'next/server'
import { queryFirst, execute, batch, generateId, nowISO, isoFromNow } from '@/lib/db-direct'
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
 *
 * Implemented with @libsql/client directly (no Prisma). Multi-row inserts
 * run inside an atomic `batch()` write transaction.
 */
interface PlanRow {
  id: string
  name: string
  description: string
  priceARS: number
  durationDays: number
  isActive: number
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = await readJson<{ planId?: string }>(req)
    if (!body || !body.planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    const plan = await queryFirst<PlanRow>(
      `SELECT id, name, description, priceARS, durationDays, isActive
         FROM "SubscriptionPlan"
        WHERE id = ?`,
      [body.planId],
    )
    if (!plan || plan.isActive !== 1) {
      return NextResponse.json({ error: 'Plan not found or inactive' }, { status: 404 })
    }

    const paymentId = generateId()
    const subscriptionId = generateId()
    const startDate = nowISO()
    const endDate = isoFromNow(plan.durationDays)
    const ts = nowISO()

    // ─── Free plan: auto-approve ───────────────────────────────
    if (plan.priceARS === 0) {
      await batch([
        {
          sql: `INSERT INTO "Payment"
                  (id, userId, planId, amount, currency, status, method, description, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, 'ARS', 'approved', 'free', ?, ?, ?)`,
          args: [
            paymentId,
            user.id,
            plan.id,
            0,
            `Plan ${plan.name} (gratuito)`,
            ts,
            ts,
          ],
        },
        {
          sql: `INSERT INTO "UserSubscription"
                  (id, userId, planId, status, startDate, endDate, autoRenew, createdAt)
                VALUES (?, ?, ?, 'active', ?, ?, 0, ?)`,
          args: [subscriptionId, user.id, plan.id, startDate, endDate, ts],
        },
      ])

      return NextResponse.json({
        paymentId,
        preferenceId: null,
        initPoint: null,
        status: 'approved',
        subscriptionId,
      })
    }

    // ─── Paid plan: create pending records + MP preference ─────
    await batch([
      {
        sql: `INSERT INTO "Payment"
                (id, userId, planId, amount, currency, status, description, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, 'ARS', 'pending', ?, ?, ?)`,
        args: [paymentId, user.id, plan.id, plan.priceARS, `Suscripción ${plan.name}`, ts, ts],
      },
      {
        sql: `INSERT INTO "UserSubscription"
                (id, userId, planId, status, startDate, endDate, autoRenew, createdAt)
              VALUES (?, ?, ?, 'pending', ?, ?, 0, ?)`,
        args: [subscriptionId, user.id, plan.id, startDate, endDate, ts],
      },
    ])

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
      externalReference: paymentId,
      backUrls: {
        success: `${base}/api/subscriptions/return?paymentId=${paymentId}&status=approved`,
        pending: `${base}/api/subscriptions/return?paymentId=${paymentId}&status=pending`,
        failure: `${base}/api/subscriptions/return?paymentId=${paymentId}&status=failure`,
      },
    })

    await execute(
      `UPDATE "Payment" SET mpPreferenceId = ?, updatedAt = ? WHERE id = ?`,
      [preference.id, nowISO(), paymentId],
    )

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint: preference.init_point || preference.sandbox_init_point,
      paymentId,
      subscriptionId,
      status: 'pending',
    })
  })
}
