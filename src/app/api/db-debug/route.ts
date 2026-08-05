// Diagnostic route — shows DB connection status using the DIRECT
// @libsql/client (the same path the rest of the app now uses).
// Visit /api/db-debug to verify the DB is reachable.
import { NextResponse } from 'next/server'
import { getClient } from '@/lib/db-direct'

export async function GET() {
  const url = process.env.DATABASE_URL || ''
  const hasToken = !!process.env.DATABASE_AUTH_TOKEN
  const nodeEnv = process.env.NODE_ENV
  const jwtSet = !!process.env.JWT_SECRET
  const isTurso = url.startsWith('libsql:') || url.startsWith('https:')

  const info: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv,
    databaseUrlSet: !!url,
    databaseUrlPrefix: url ? url.substring(0, 30) + '...' : '(empty)',
    databaseUrlScheme: url.split('://')[0] || '(none)',
    isTurso,
    authTokenSet: hasToken,
    jwtSecretSet: jwtSet,
    dataLayer: '@libsql/client (direct, no Prisma)',
  }

  // Try a direct libsql query (the exact path the app uses).
  try {
    const client = getClient()
    info.libsqlClientCreated = true

    // Count users
    try {
      const userCountRes = await client.execute('SELECT COUNT(*) as cnt FROM "User"')
      info.queryOk = true
      info.userCount = Number((userCountRes.rows[0] as { cnt: number | bigint }).cnt || 0)

      const planCountRes = await client.execute('SELECT COUNT(*) as cnt FROM "SubscriptionPlan"')
      info.planCount = Number((planCountRes.rows[0] as { cnt: number | bigint }).cnt || 0)
    } catch (queryErr) {
      info.queryOk = false
      info.queryError = queryErr instanceof Error ? queryErr.message : String(queryErr)
    }
  } catch (e) {
    info.libsqlClientCreated = false
    info.libsqlError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(info, { status: 200 })
}
