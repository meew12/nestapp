// ═══════════════════════════════════════════════════════════
//  /api/setup — ZERO-INSTALL database initialization
//  ───────────────────────────────────────────────────────────
//  Visiting this URL (GET or POST) creates all database tables
//  and seeds default data (admin user, demo user, subscription
//  plans). Designed for Vercel + Turso deployment where the user
//  cannot run CLI scripts locally.
//
//  Uses @libsql/client DIRECTLY for all operations (both DDL
//  and seed data) to avoid any dependency on Prisma driver
//  adapter version compatibility. This makes the setup route
//  robust even if there's a Prisma/adapter version mismatch.
//
//  Idempotent: safe to run multiple times.
//  Works for both Turso (libsql://) and local SQLite (file:).
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { scryptSync, randomBytes } from 'crypto'

// ── DDL: CREATE TABLE statements (SQLite / libSQL compatible) ──
// Generated from prisma/schema.prisma via `prisma migrate diff`.
// Using IF NOT EXISTS so re-runs are safe.
const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "avatarColor" TEXT NOT NULL DEFAULT '#ff3a28',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trainingMode" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "avgScore" REAL NOT NULL DEFAULT 0,
    "shotCount" INTEGER NOT NULL DEFAULT 0,
    "targetSize" TEXT NOT NULL DEFAULT 'standard',
    "distanceM" REAL NOT NULL DEFAULT 0,
    "captureMode" TEXT NOT NULL DEFAULT 'camera',
    "weather" TEXT,
    "notes" TEXT,
    "drillType" TEXT,
    "drillPassed" BOOLEAN,
    "drillGoal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Shot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "radius" REAL NOT NULL,
    "score" INTEGER NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" INTEGER NOT NULL,
    "distanceM" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Shot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceARS" REAL NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "mpPlanId" TEXT,
    "features" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "maxShotsPerDay" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "UserSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mpPaymentId" TEXT,
    "mpPreferenceId" TEXT,
    "mpStatus" TEXT,
    "method" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Session_createdAt_idx" ON "Session"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Session_drillType_idx" ON "Session"("drillType")`,
  `CREATE INDEX IF NOT EXISTS "Shot_sessionId_idx" ON "Shot"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "UserSubscription_userId_idx" ON "UserSubscription"("userId")`,
  `CREATE INDEX IF NOT EXISTS "UserSubscription_status_idx" ON "UserSubscription"("status")`,
  `CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status")`,
]

// ── Default subscription plans ──
const DEFAULT_PLANS = [
  {
    name: 'GRATIS',
    description: 'Plan básico para probar la aplicación',
    priceARS: 0,
    durationDays: 9999,
    features: JSON.stringify([
      'Hasta 20 disparos por día',
      'Historial de 7 días',
      'Detección básica',
    ]),
    maxShotsPerDay: 20,
    isFeatured: 0,
    sortOrder: 0,
  },
  {
    name: 'TIRADOR PRO',
    description: 'Para tiradores que entrenan regularmente',
    priceARS: 4999,
    durationDays: 30,
    features: JSON.stringify([
      'Disparos ilimitados',
      'Historial completo',
      'Detección avanzada con OpenCV',
      'Calibración automática',
      'Estadísticas detalladas',
      'Exportación de sesiones',
    ]),
    maxShotsPerDay: 0,
    isFeatured: 1,
    sortOrder: 1,
  },
  {
    name: 'CLUB / INSTRUCTOR',
    description: 'Para instructores y clubes de tiro',
    priceARS: 14999,
    durationDays: 30,
    features: JSON.stringify([
      'Todo lo de Tirador Pro',
      'Multi-usuario (hasta 10 cuentas)',
      'Panel de control grupal',
      'Análisis comparativo',
      'Soporte prioritario',
      'Sin marcas de agua',
    ]),
    maxShotsPerDay: 0,
    isFeatured: 0,
    sortOrder: 2,
  },
  {
    name: 'COMPETICIÓN',
    description: 'Para competidores profesionales',
    priceARS: 24999,
    durationDays: 90,
    features: JSON.stringify([
      'Todo lo de Club / Instructor',
      'Análisis balístico avanzado',
      'Integración con telescopios digitales',
      'Modo competición oficial',
      'Reportes PDF oficiales',
      'API de integración',
    ]),
    maxShotsPerDay: 0,
    isFeatured: 0,
    sortOrder: 3,
  },
]

interface SetupStep {
  name: string
  status: 'ok' | 'skipped' | 'error'
  detail?: string
}

/**
 * Hash a password using scrypt (same format as src/lib/auth.ts).
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Get a libsql client for direct DB access.
 * Returns null for local SQLite (setup skips DDL in that case).
 */
function getLibsqlClient(): ReturnType<typeof import('@libsql/client')['createClient']> | null {
  const url = process.env.DATABASE_URL || ''
  const isTurso = url.startsWith('libsql:') || url.startsWith('https:')
  if (!isTurso) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client') as typeof import('@libsql/client')
  return createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  })
}

/**
 * Execute all DDL statements via @libsql/client directly.
 */
async function createTables(): Promise<SetupStep[]> {
  const client = getLibsqlClient()
  if (!client) {
    return [{
      name: 'create-tables',
      status: 'skipped',
      detail: 'Local SQLite — tables created via `bun run db:push`',
    }]
  }

  const steps: SetupStep[] = []
  for (let i = 0; i < DDL_STATEMENTS.length; i++) {
    const stmt = DDL_STATEMENTS[i]
    const label = stmt.match(/"(\w+)"/)?.[1] || `statement-${i + 1}`
    try {
      await client.execute(stmt)
      steps.push({ name: `ddl-${label}`, status: 'ok' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists')) {
        steps.push({ name: `ddl-${label}`, status: 'skipped', detail: 'already exists' })
      } else {
        steps.push({ name: `ddl-${label}`, status: 'error', detail: msg })
      }
    }
  }
  return steps
}

/**
 * Generate a CUID-like ID (sufficient for seed records).
 */
function generateId(): string {
  return 'c' + Date.now().toString(36) + randomBytes(8).toString('hex')
}

/**
 * Seed subscription plans via @libsql/client directly.
 */
async function seedPlans(): Promise<SetupStep[]> {
  const client = getLibsqlClient()
  if (!client) {
    return [{ name: 'seed-plans', status: 'skipped', detail: 'Local SQLite — use bun run db:seed' }]
  }

  const steps: SetupStep[] = []
  for (const plan of DEFAULT_PLANS) {
    try {
      // Check if plan exists by name
      const existing = await client.execute({
        sql: 'SELECT id FROM SubscriptionPlan WHERE name = ?',
        args: [plan.name],
      })
      if (existing.rows.length > 0) {
        // Update existing
        await client.execute({
          sql: `UPDATE SubscriptionPlan SET
            description = ?, priceARS = ?, durationDays = ?, features = ?,
            maxShotsPerDay = ?, isFeatured = ?, sortOrder = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?`,
          args: [
            plan.description, plan.priceARS, plan.durationDays, plan.features,
            plan.maxShotsPerDay, plan.isFeatured, plan.sortOrder,
            existing.rows[0].id as string,
          ],
        })
        steps.push({ name: `seed-plan-${plan.name}`, status: 'skipped', detail: 'updated' })
      } else {
        // Insert new (updatedAt is NOT NULL without default, must set explicitly)
        await client.execute({
          sql: `INSERT INTO SubscriptionPlan
            (id, name, description, priceARS, durationDays, features, isActive, isFeatured, maxShotsPerDay, sortOrder, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [
            generateId(), plan.name, plan.description, plan.priceARS,
            plan.durationDays, plan.features, plan.isFeatured, plan.maxShotsPerDay, plan.sortOrder,
          ],
        })
        steps.push({ name: `seed-plan-${plan.name}`, status: 'ok', detail: 'created' })
      }
    } catch (err: unknown) {
      steps.push({
        name: `seed-plan-${plan.name}`,
        status: 'error',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return steps
}

/**
 * Seed admin + demo users via @libsql/client directly.
 */
async function seedUsers(): Promise<SetupStep[]> {
  const client = getLibsqlClient()
  if (!client) {
    return [{ name: 'seed-users', status: 'skipped', detail: 'Local SQLite — use bun run db:seed' }]
  }

  const steps: SetupStep[] = []

  // ── Admin user ──
  try {
    const adminEmail = 'admin@etarget.app'
    const existing = await client.execute({
      sql: 'SELECT id FROM User WHERE email = ?',
      args: [adminEmail],
    })
    if (existing.rows.length > 0) {
      steps.push({ name: 'seed-admin', status: 'skipped', detail: `${adminEmail} already exists` })
    } else {
      await client.execute({
        sql: `INSERT INTO User (id, email, name, passwordHash, role, avatarColor, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [generateId(), adminEmail, 'Administrador', hashPassword('admin123'), 'admin', '#ff3a28'],
      })
      steps.push({ name: 'seed-admin', status: 'ok', detail: `${adminEmail} / admin123` })
    }
  } catch (err: unknown) {
    steps.push({ name: 'seed-admin', status: 'error', detail: err instanceof Error ? err.message : String(err) })
  }

  // ── Demo user ──
  let demoUserId: string | null = null
  let proPlanId: string | null = null
  try {
    const demoEmail = 'tirador@etarget.app'
    const existing = await client.execute({
      sql: 'SELECT id FROM User WHERE email = ?',
      args: [demoEmail],
    })
    if (existing.rows.length > 0) {
      demoUserId = existing.rows[0].id as string
      steps.push({ name: 'seed-demo', status: 'skipped', detail: `${demoEmail} already exists` })
    } else {
      demoUserId = generateId()
      await client.execute({
        sql: `INSERT INTO User (id, email, name, passwordHash, role, avatarColor, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [demoUserId, demoEmail, 'Tirador Demo', hashPassword('demo123'), 'user', '#00e5ff'],
      })
      steps.push({ name: 'seed-demo', status: 'ok', detail: `${demoEmail} / demo123` })
    }
  } catch (err: unknown) {
    steps.push({ name: 'seed-demo', status: 'error', detail: err instanceof Error ? err.message : String(err) })
  }

  // ── Give demo user active PRO subscription ──
  if (demoUserId) {
    try {
      // Find PRO plan
      const proPlan = await client.execute({
        sql: 'SELECT id, priceARS FROM SubscriptionPlan WHERE name = ?',
        args: ['TIRADOR PRO'],
      })
      if (proPlan.rows.length > 0) {
        proPlanId = proPlan.rows[0].id as string
        const priceARS = proPlan.rows[0].priceARS as number

        // Check if demo already has active subscription
        const existingSub = await client.execute({
          sql: 'SELECT id FROM UserSubscription WHERE userId = ? AND status = ?',
          args: [demoUserId, 'active'],
        })
        if (existingSub.rows.length === 0) {
          await client.execute({
            sql: `INSERT INTO UserSubscription (id, userId, planId, status, startDate, endDate, autoRenew, createdAt)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', '+30 days'), ?, CURRENT_TIMESTAMP)`,
            args: [generateId(), demoUserId, proPlanId, 'active', 1],
          })
          await client.execute({
            sql: `INSERT INTO Payment (id, userId, planId, amount, currency, status, mpPaymentId, description, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            args: [
              generateId(), demoUserId, proPlanId, priceARS, 'ARS', 'approved',
              'SETUP-DEMO-001', 'Pago inicial demo (setup)',
            ],
          })
          steps.push({ name: 'seed-demo-sub', status: 'ok', detail: 'PRO subscription activated' })
        } else {
          steps.push({ name: 'seed-demo-sub', status: 'skipped', detail: 'already has active sub' })
        }
      }
    } catch (err: unknown) {
      steps.push({ name: 'seed-demo-sub', status: 'error', detail: err instanceof Error ? err.message : String(err) })
    }
  }

  return steps
}

/**
 * Count records in each table for confirmation.
 */
async function countRecords(): Promise<Record<string, number>> {
  const client = getLibsqlClient()
  if (!client) return {}

  const counts: Record<string, number> = {}
  const tables = ['User', 'SubscriptionPlan', 'Session', 'Shot', 'UserSubscription', 'Payment']
  for (const table of tables) {
    try {
      const result = await client.execute(`SELECT COUNT(*) as cnt FROM "${table}"`)
      counts[table.toLowerCase()] = Number(result.rows[0]?.cnt || 0)
    } catch {
      // table might not exist
    }
  }
  return counts
}

export async function GET() {
  return runSetup()
}

export async function POST() {
  return runSetup()
}

async function runSetup() {
  const startedAt = Date.now()
  const log: SetupStep[] = []

  // 0. Preflight — check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        error: 'DATABASE_URL no está configurada.',
        hint: 'En Vercel: Settings → Environment Variables → DATABASE_URL (libsql://...) y DATABASE_AUTH_TOKEN',
      },
      { status: 500 },
    )
  }

  // 1. Create tables
  try {
    const tableSteps = await createTables()
    log.push(...tableSteps)
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Error creando tablas',
        detail: err instanceof Error ? err.message : String(err),
        log,
      },
      { status: 500 },
    )
  }

  // 2. Seed plans
  try {
    const planSteps = await seedPlans()
    log.push(...planSteps)
  } catch (err: unknown) {
    log.push({ name: 'seed-plans', status: 'error', detail: err instanceof Error ? err.message : String(err) })
  }

  // 3. Seed users + demo subscription
  try {
    const userSteps = await seedUsers()
    log.push(...userSteps)
  } catch (err: unknown) {
    log.push({ name: 'seed-users', status: 'error', detail: err instanceof Error ? err.message : String(err) })
  }

  // 4. Final status
  const errors = log.filter((s) => s.status === 'error')
  const ok = errors.length === 0
  const elapsedMs = Date.now() - startedAt

  // Count records for confirmation
  const counts = await countRecords()

  return NextResponse.json({
    ok,
    elapsedMs,
    backend: process.env.DATABASE_URL?.startsWith('libsql:') || process.env.DATABASE_URL?.startsWith('https:')
      ? 'turso'
      : 'sqlite',
    databaseUrl: process.env.DATABASE_URL?.replace(/:[^@]*@/, ':***@'),
    steps: log,
    counts,
    credentials: ok
      ? {
          admin: { email: 'admin@etarget.app', password: 'admin123' },
          demo: { email: 'tirador@etarget.app', password: 'demo123' },
        }
      : undefined,
    nextSteps: ok
      ? [
          '✅ Base de datos lista. Visita la app y probá iniciar sesión.',
          'Admin: admin@etarget.app / admin123',
          'Demo: tirador@etarget.app / demo123',
        ]
      : [
          '❌ Hubo errores. Revisá los steps con status "error".',
          'Si es un error de autenticación, verificá DATABASE_AUTH_TOKEN en Vercel.',
        ],
  })
}
