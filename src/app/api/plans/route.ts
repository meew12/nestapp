import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseFeatures } from '@/lib/api'

/**
 * GET /api/plans — public list of active subscription plans.
 */
export async function GET() {
  const plans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceARS: p.priceARS,
      durationDays: p.durationDays,
      features: parseFeatures(p.features),
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      maxShotsPerDay: p.maxShotsPerDay,
      sortOrder: p.sortOrder,
    }))
  )
}
