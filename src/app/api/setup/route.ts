// ═══════════════════════════════════════════════════════════
//  /api/setup — ZERO-INSTALL database initialization
//  ───────────────────────────────────────────────────────────
//  Visiting this URL (GET or POST) creates all database tables
//  and seeds default data (admin user, demo user, subscription
//  plans). Designed for Vercel + Turso deployment where the user
//  cannot run CLI scripts locally.
//
//  Idempotent: safe to run multiple times.
//  Works for both Turso (libsql://) and local SQLite (file:).
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

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
    isFeatured: false,
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
    isFeatured: true,
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
    isFeatured: false,
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
    isFeatured: false,
    sortOrder: 3,
  },
]

interface SetupStep {
  name: string
  status: 'ok' | 'skipped' | 'error'
  detail?: string
}

/**
 * Create all tables via the raw libsql client (bypasses Prisma,
 * which would fail if tables don't exist yet). Only runs for
 * Turso (libsql://) backends — local SQLite uses `db:push`.
 */
async function createTables(): Promise<SetupStep[]> {
  const url = process.env.DATABASE_URL || ''
  const isTurso = url.startsWith('libsql:') || url.startsWith('https:')

  if (!isTurso) {
    return [{
      name: 'create-tables',
      status: 'skipped',
      detail: 'Local SQLite — tables created via `bun run db:push`',
    }]
  }

  // Dynamically import libsql client (only needed for Turso)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client') as typeof import('@libsql/client')
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  })

  const steps: SetupStep[] = []
  for (let i = 0; i < DDL_STATEMENTS.length; i++) {
    const stmt = DDL_STATEMENTS[i]
    const label = stmt.match(/"(\w+)"/)?.[1] || `statement-${i + 1}`
    try {
      await client.execute(stmt)
      steps.push({ name: `ddl-${label}`, status: 'ok' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // "already exists" is fine — idempotent re-run
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
 * Seed admin + demo users (idempotent via upsert / findFirst).
 */
async function seedUsers(): Promise<SetupStep[]> {
  const steps: SetupStep[] = []

  // Admin
  try {
    const adminEmail = 'admin@etarget.app'
    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } })
    if (existingAdmin) {
      steps.push({ name: 'seed-admin', status: 'skipped', detail: `${adminEmail} already exists` })
    } else {
      await db.user.create({
        data: {
          email: adminEmail,
          name: 'Administrador',
          passwordHash: await hashPassword('admin123'),
          role: 'admin',
          avatarColor: '#ff3a28',
        },
      })
      steps.push({ name: 'seed-admin', status: 'ok', detail: `${adminEmail} / admin123` })
    }
  } catch (err: unknown) {
    steps.push({ name: 'seed-admin', status: 'error', detail: err instanceof Error ? err.message : String(err) })
  }

  // Demo user
  try {
    const demoEmail = 'tirador@etarget.app'
    const existingDemo = await db.user.findUnique({ where: { email: demoEmail } })
    if (existingDemo) {
      steps.push({ name: 'seed-demo', status: 'skipped', detail: `${demoEmail} already exists` })
    } else {
      const demo = await db.user.create({
        data: {
          email: demoEmail,
          name: 'Tirador Demo',
          passwordHash: await hashPassword('demo123'),
          role: 'user',
          avatarColor: '#00e5ff',
        },
      })
      // Give demo user an active PRO subscription
      const proPlan = await db.subscriptionPlan.findFirst({ where: { name: 'TIRADOR PRO' } })
      if (proPlan) {
        const existingSub = await db.userSubscription.findFirst({
          where: { userId: demo.id, status: 'active' },
        })
        if (!existingSub) {
          await db.userSubscription.create({
            data: {
              userId: demo.id,
              planId: proPlan.id,
              status: 'active',
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              autoRenew: true,
            },
          })
          await db.payment.create({
            data: {
              userId: demo.id,
              planId: proPlan.id,
              amount: proPlan.priceARS,
              currency: 'ARS',
              status: 'approved',
              mpPaymentId: 'SETUP-DEMO-001',
              description: 'Pago inicial demo (setup)',
            },
          })
        }
      }
      steps.push({ name: 'seed-demo', status: 'ok', detail: `${demoEmail} / demo123` })
    }
  } catch (err: unknown) {
    steps.push({ name: 'seed-demo', status: 'error', detail: err instanceof Error ? err.message : String(err) })
  }

  return steps
}

/**
 * Seed subscription plans (idempotent — updates if name exists).
 */
async function seedPlans(): Promise<SetupStep[]> {
  const steps: SetupStep[] = []
  try {
    for (const plan of DEFAULT_PLANS) {
      const existing = await db.subscriptionPlan.findFirst({ where: { name: plan.name } })
      if (existing) {
        await db.subscriptionPlan.update({ where: { id: existing.id }, data: plan })
        steps.push({ name: `seed-plan-${plan.name}`, status: 'skipped', detail: 'updated' })
      } else {
        await db.subscriptionPlan.create({ data: plan })
        steps.push({ name: `seed-plan-${plan.name}`, status: 'ok', detail: 'created' })
      }
    }
  } catch (err: unknown) {
    steps.push({ name: 'seed-plans', status: 'error', detail: err instanceof Error ? err.message : String(err) })
  }
  return steps
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

  // 1. Create tables (Turso only; local SQLite uses db:push)
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

  // 2. Seed plans (must come before demo user, which references PRO plan)
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
  let counts: Record<string, number> = {}
  try {
    const [users, plans, sessions, shots, subs, payments] = await Promise.all([
      db.user.count(),
      db.subscriptionPlan.count(),
      db.session.count(),
      db.shot.count(),
      db.userSubscription.count(),
      db.payment.count(),
    ])
    counts = { users, plans, sessions, shots, subscriptions: subs, payments }
  } catch {
    // ignore — tables might not exist if DDL failed
  }

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
