import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

    const existing = await db.subscriptionPlan.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.priceARS !== undefined) updates.priceARS = Number(body.priceARS)
    if (body.durationDays !== undefined) updates.durationDays = Number(body.durationDays)
    if (body.features !== undefined) updates.features = JSON.stringify(body.features)
    if (body.isActive !== undefined) updates.isActive = body.isActive
    if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured
    if (body.maxShotsPerDay !== undefined) updates.maxShotsPerDay = Number(body.maxShotsPerDay)
    if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder)
    if (body.mpPlanId !== undefined) updates.mpPlanId = body.mpPlanId

    const plan = await db.subscriptionPlan.update({ where: { id }, data: updates })

    return NextResponse.json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceARS: plan.priceARS,
      durationDays: plan.durationDays,
      mpPlanId: plan.mpPlanId,
      features: parseFeatures(plan.features),
      isActive: plan.isActive,
      isFeatured: plan.isFeatured,
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
    const plan = await db.subscriptionPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    })
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan._count.subscriptions > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete a plan with existing subscriptions.',
          subscriberCount: plan._count.subscriptions,
        },
        { status: 409 }
      )
    }

    // No subscriptions — soft-delete by deactivating.
    const updated = await db.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true, isActive: updated.isActive })
  })
}
