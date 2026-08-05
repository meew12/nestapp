// Diagnostic route — shows DB connection status without exposing secrets.
// Visit /api/db-debug to see what's wrong with the Prisma/DB setup.
import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.DATABASE_URL || ''
  const hasToken = !!process.env.DATABASE_AUTH_TOKEN
  const nodeEnv = process.env.NODE_ENV
  const isTurso = url.startsWith('libsql:') || url.startsWith('https:')

  const info: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv,
    databaseUrlSet: !!url,
    databaseUrlPrefix: url ? url.substring(0, 30) + '...' : '(empty)',
    databaseUrlScheme: url.split('://')[0] || '(none)',
    isTurso,
    authTokenSet: hasToken,
  }

  // Check if adapter packages are loadable
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const libsql = require('@libsql/client')
    info.libsqlClientLoaded = true
    info.libsqlHasCreateClient = typeof libsql.createClient === 'function'
  } catch (e) {
    info.libsqlClientLoaded = false
    info.libsqlError = e instanceof Error ? e.message : String(e)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adapter = require('@prisma/adapter-libsql')
    info.adapterLoaded = true
    info.adapterHasPrismaLibSQL = typeof adapter.PrismaLibSQL === 'function'
    // Check version
    info.adapterVersion = (adapter as { version?: string }).version || 'unknown'
  } catch (e) {
    info.adapterLoaded = false
    info.adapterError = e instanceof Error ? e.message : String(e)
  }

  // Try to create the Prisma client
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client')
    info.prismaClientLoaded = true
    info.prismaClientHasConstructor = typeof PrismaClient === 'function'

    if (isTurso) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@libsql/client')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSQL } = require('@prisma/adapter-libsql')
      const libsql = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined })
      const adapter = new PrismaLibSQL(libsql)
      const prisma = new PrismaClient({ adapter })
      info.prismaClientCreated = true

      // Try a simple query
      try {
        const count = await prisma.user.count()
        info.queryOk = true
        info.userCount = count
      } catch (queryErr) {
        info.queryOk = false
        info.queryError = queryErr instanceof Error ? queryErr.message : String(queryErr)
      }
    } else {
      info.prismaClientCreated = 'skipped (not turso)'
    }
  } catch (e) {
    info.prismaClientLoaded = false
    info.prismaClientError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(info, { status: 200 })
}
