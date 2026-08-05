import { NextResponse } from 'next/server'
import type { InArgs } from '@libsql/client'
import { queryFirst, execute, nowISO, toBool, fromBool } from '@/lib/db-direct'
import { parseFeatures, readJson, withAdmin } from '@/lib/api'

/**
 * PATCH /api/admin/plans/[id] — update any plan field.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await params
    const body = await readJson<{
      name?: string
      description?: string
      priceARS?: number
      durationDays?: number
      features?: string[]
      isActive?: boolean
      isFeatured?: boolean
      maxShotsPerDay?: number
      sortOrder?: number
      mpPlanId?: string | null
    }>(req)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const existing = await queryFirst<{ id: string }>(
      `SELECT id FROM "SubscriptionPlan" WHERE id = ?`,
      [id],
    )
    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Build dynamic UPDATE — only set fields that are present in the body.
    const sets: string[] = []
    const args: InArgs = []
    if (body.name !== undefined) {
      sets.push('name = ?')
      args.push(body.name)
    }
    if (body.description !== undefined) {
      sets.push('description = ?')
      args.push(body.description)
    }
    if (body.priceARS !== undefined) {
      sets.push('priceARS = ?')
      args.push(Number(body.priceARS))
    }
    if (body.durationDays !== undefined) {
      sets.push('durationDays = ?')
      args.push(Number(body.durationDays))
    }
    if (body.features !== undefined) {
      sets.push('features = ?')
      args.push(JSON.stringify(body.features))
    }
    if (body.isActive !== undefined) {
      sets.push('isActive = ?')
      args.push(fromBool(body.isActive))
    }
    if (body.isFeatured !== undefined) {
      sets.push('isFeatured = ?')
      args.push(fromBool(body.isFeatured))
    }
    if (body.maxShotsPerDay !== undefined) {
      sets.push('maxShotsPerDay = ?')
      args.push(Number(body.maxShotsPerDay))
    }
    if (body.sortOrder !== undefined) {
      sets.push('sortOrder = ?')
      args.push(Number(body.sortOrder))
    }
    if (body.mpPlanId !== undefined) {
      sets.push('mpPlanId = ?')
      args.push(body.mpPlanId)
    }
    // updatedAt is NOT NULL → always set.
    sets.push('updatedAt = ?')
    args.push(nowISO())

    args.push(id)
    await execute(
      `UPDATE "SubscriptionPlan" SET ${sets.join(', ')} WHERE id = ?`,
      args,
    )

    const plan = await queryFirst<{
      id: string
      name: string
      description: string
      priceARS: number
      durationDays: number
      mpPlanId: string | null
      features: string
      isActive: number
      isFeatured: number
      maxShotsPerDay: number
      sortOrder: number
      createdAt: string
      updatedAt: string
    }>(`SELECT * FROM "SubscriptionPlan" WHERE id = ?`, [id])

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceARS: plan.priceARS,
      durationDays: plan.durationDays,
      mpPlanId: plan.mpPlanId,
      features: parseFeatures(plan.features),
      isActive: toBool(plan.isActive),
      isFeatured: toBool(plan.isFeatured),
      maxShotsPerDay: plan.maxShotsPerDay,
      sortOrder: plan.sortOrder,
    })
  })
}

/**
 * DELETE /api/admin/plans/[id] — soft-delete (isActive = false).
 *
 * If the plan has any subscriptions (active OR historical), return 409 —
 * we never hard-delete plans with billing history.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await params
    const plan = await queryFirst<{ id: string; subCount: number | bigint }>(
      `SELECT p.id,
              (SELECT COUNT(*) FROM "UserSubscription" us WHERE us.planId = p.id) as subCount
       FROM "SubscriptionPlan" p WHERE p.id = ?`,
      [id],
    )
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (Number(plan.subCount) > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete a plan with existing subscriptions.',
          subscriberCount: Number(plan.subCount),
        },
        { status: 409 },
      )
    }

    // No subscriptions — soft-delete by deactivating.
    await execute(
      `UPDATE "SubscriptionPlan" SET isActive = 0, updatedAt = ? WHERE id = ?`,
      [nowISO(), id],
    )
    return NextResponse.json({ ok: true, isActive: false })
  })
}
