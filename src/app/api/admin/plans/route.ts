import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseFeatures, readJson, withAdmin } from '@/lib/api'

/**
 * GET /api/admin/plans — list ALL plans (including inactive) with subscriber count.
 */
export async function GET() {
  return withAdmin(async () => {
    const plans = await db.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            subscriptions: { where: { status: 'active' } },
          },
        },
      },
    })

    return NextResponse.json(
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceARS: p.priceARS,
        durationDays: p.durationDays,
        mpPlanId: p.mpPlanId,
        features: parseFeatures(p.features),
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        maxShotsPerDay: p.maxShotsPerDay,
        sortOrder: p.sortOrder,
        subscriberCount: p._count.subscriptions,
        createdAt: p.createdAt.toISOString(),
      }))
    )
  })
}

/**
 * POST /api/admin/plans — create a plan.
 */
export async function POST(req: Request) {
  return withAdmin(async () => {
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
    }>(req)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    if (!body.name || !body.description) {
      return NextResponse.json({ error: 'name and description are required' }, { status: 400 })
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name: body.name,
        description: body.description,
        priceARS: Number(body.priceARS) || 0,
        durationDays: Number(body.durationDays) || 30,
        features: JSON.stringify(body.features || []),
        isActive: body.isActive ?? true,
        isFeatured: body.isFeatured ?? false,
        maxShotsPerDay: Number(body.maxShotsPerDay) || 0,
        sortOrder: Number(body.sortOrder) || 0,
      },
    })

    return NextResponse.json(
      {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceARS: plan.priceARS,
        durationDays: plan.durationDays,
        features: parseFeatures(plan.features),
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
        maxShotsPerDay: plan.maxShotsPerDay,
        sortOrder: plan.sortOrder,
      },
      { status: 201 }
    )
  })
}
