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
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || ''
  const isTurso = url.startsWith('libsql:') || url.startsWith('https://')

  if (isTurso) {
    // ── Turso / libSQL via driver adapter ───────────────────
    // Use synchronous require for the adapter packages — they're regular
    // CommonJS modules in node_modules, so this works in both Next.js
    // server runtime and edge. On Vercel these packages are always installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client') as typeof import('@libsql/client')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')

    const libsql = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  // ── Local SQLite ─────────────────────────────────────────
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
