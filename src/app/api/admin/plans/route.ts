import { NextResponse } from 'next/server'
import { query, execute, generateId, nowISO, toDate, toBool, fromBool } from '@/lib/db-direct'
import { parseFeatures, readJson, withAdmin } from '@/lib/api'

/**
 * GET /api/admin/plans — list ALL plans (including inactive) with subscriber count.
 */
export async function GET() {
  return withAdmin(async () => {
    const plans = await query<{
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
      activeCount: number | bigint
    }>(
      `SELECT p.*,
              (SELECT COUNT(*) FROM "UserSubscription" us
               WHERE us.planId = p.id AND us.status = 'active') as activeCount
       FROM "SubscriptionPlan" p
       ORDER BY p.sortOrder ASC`,
    )

    return NextResponse.json(
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceARS: p.priceARS,
        durationDays: p.durationDays,
        mpPlanId: p.mpPlanId,
        features: parseFeatures(p.features),
        isActive: toBool(p.isActive),
        isFeatured: toBool(p.isFeatured),
        maxShotsPerDay: p.maxShotsPerDay,
        sortOrder: p.sortOrder,
        subscriberCount: Number(p.activeCount),
        createdAt: toDate(p.createdAt).toISOString(),
      })),
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

    const id = generateId()
    const now = nowISO()
    const name = body.name
    const description = body.description
    const priceARS = Number(body.priceARS) || 0
    const durationDays = Number(body.durationDays) || 30
    const features = JSON.stringify(body.features || [])
    const isActive = fromBool(body.isActive ?? true)
    const isFeatured = fromBool(body.isFeatured ?? false)
    const maxShotsPerDay = Number(body.maxShotsPerDay) || 0
    const sortOrder = Number(body.sortOrder) || 0

    await execute(
      `INSERT INTO "SubscriptionPlan"
        (id, name, description, priceARS, durationDays, features, isActive, isFeatured, maxShotsPerDay, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, priceARS, durationDays, features, isActive, isFeatured, maxShotsPerDay, sortOrder, now, now],
    )

    return NextResponse.json(
      {
        id,
        name,
        description,
        priceARS,
        durationDays,
        features: parseFeatures(features),
        isActive: toBool(isActive),
        isFeatured: toBool(isFeatured),
        maxShotsPerDay,
        sortOrder,
      },
      { status: 201 },
    )
  })
}
