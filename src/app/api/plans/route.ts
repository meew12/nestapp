import { NextResponse } from 'next/server'
import { query } from '@/lib/db-direct'
import { parseFeatures } from '@/lib/api'

/**
 * GET /api/plans — public list of active subscription plans.
 */
export async function GET() {
  const plans = await query<{
    id: string
    name: string
    description: string
    priceARS: number
    durationDays: number
    features: string
    isActive: number
    isFeatured: number
    maxShotsPerDay: number
    sortOrder: number
  }>(
    `SELECT id, name, description, priceARS, durationDays, features, isActive, isFeatured, maxShotsPerDay, sortOrder
     FROM "SubscriptionPlan" WHERE isActive = 1 ORDER BY sortOrder ASC`,
  )

  return NextResponse.json(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceARS: p.priceARS,
      durationDays: p.durationDays,
      features: parseFeatures(p.features),
      isActive: p.isActive === 1,
      isFeatured: p.isFeatured === 1,
      maxShotsPerDay: p.maxShotsPerDay,
      sortOrder: p.sortOrder,
    }))
  )
}
