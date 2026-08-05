import { PrismaClient } from '@prisma/client'

/**
 * Prisma client factory.
 *
 * Supports TWO database backends via the same codebase:
 *
 * 1. **Local development — SQLite (file:)**
 *    Set `DATABASE_URL=file:./db/custom.db`
 *    Uses the standard Prisma SQLite connector.
 *
 * 2. **Production (Vercel) — Turso (libsql://)**
 *    Set `DATABASE_URL=libsql://your-db.turso.io`
 *    Set `DATABASE_AUTH_TOKEN=your-turso-token`
 *    Uses the Prisma libSQL driver adapter (@prisma/adapter-libsql).
 *
 * The backend is selected automatically based on the DATABASE_URL scheme.
 *
 * IMPORTANT: The adapter is constructed EAGERLY (not lazily) so that if
 * the adapter packages fail to load, we get a clear error at startup
 * instead of a cryptic "URL_INVALID: The URL 'undefined'" at query time.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || ''
  const isTurso = url.startsWith('libsql:') || url.startsWith('https://')

  if (isTurso) {
    // ── Turso / libSQL via driver adapter ───────────────────
    // Load the adapter packages eagerly and validate them.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const libsqlModule = require('@libsql/client') as typeof import('@libsql/client')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adapterModule = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')

    if (!libsqlModule || typeof libsqlModule.createClient !== 'function') {
      throw new Error('@libsql/client no se cargó correctamente — createClient no está disponible')
    }
    if (!adapterModule || typeof adapterModule.PrismaLibSQL !== 'function') {
      throw new Error('@prisma/adapter-libsql no se cargó correctamente — PrismaLibSQL no está disponible')
    }

    const libsql = libsqlModule.createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    })
    const adapter = new adapterModule.PrismaLibSQL(libsql)

    // Create PrismaClient with the adapter. This bypasses the
    // datasource URL from schema.prisma entirely.
    return new PrismaClient({ adapter })
  }

  // ── Local SQLite ─────────────────────────────────────────
  if (process.env.NODE_ENV === 'production' && !url) {
    throw new Error(
      'DATABASE_URL no está configurada. En Vercel → Settings → Environment Variables, ' +
      'agregá DATABASE_URL (libsql://...) y DATABASE_AUTH_TOKEN.'
    )
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
