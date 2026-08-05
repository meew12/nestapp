/**
 * Generates a single SQL file (e-target-full.sql) containing:
 *   1. All CREATE TABLE statements (from the Prisma schema)
 *   2. All INSERT statements for seed data (read from the local SQLite DB)
 *
 * The resulting SQL can be copy-pasted into Turso's web shell
 * (https://app.turso.tech → your DB → "Edit Data" → SQL shell)
 * to set up the entire database without installing any CLI or running
 * any local scripts.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { db } from '../src/lib/db'

function sqlEscape(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? '1' : '0'
  if (typeof val === 'object') {
    // Date → ISO string
    if (val instanceof Date) return `'${val.toISOString()}'`
    // Object/array → JSON string
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  }
  // String — escape single quotes
  return `'${String(val).replace(/'/g, "''")}'`
}

function buildInsert(table: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const values = rows.map((row) => `  (${cols.map((c) => sqlEscape(row[c])).join(', ')})`).join(',\n')
  return `INSERT INTO "${table}" ("${cols.join('", "')}") VALUES\n${values};`
}

async function main() {
  console.log('📄 Generando SQL de schema con prisma migrate diff...')
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  const schemaSql = execSync(
    `npx prisma migrate diff --from-empty --to-schema-datamodel "${schemaPath}" --script`,
    { encoding: 'utf-8' },
  )

  console.log('📊 Leyendo datos de la DB local...')
  const [users, plans, sessions, shots, subs, payments] = await Promise.all([
    db.user.findMany(),
    db.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.session.findMany({ orderBy: { createdAt: 'asc' } }),
    db.shot.findMany({ orderBy: { index: 'asc' } }),
    db.userSubscription.findMany(),
    db.payment.findMany(),
  ])

  console.log(`   - ${users.length} usuarios`)
  console.log(`   - ${plans.length} planes`)
  console.log(`   - ${sessions.length} sesiones`)
  console.log(`   - ${shots.length} disparos`)
  console.log(`   - ${subs.length} suscripciones`)
  console.log(`   - ${payments.length} pagos`)

  const parts: string[] = []

  // Header
  parts.push('-- ═══════════════════════════════════════════════════════════')
  parts.push('--  E-TARGET — Full SQL dump (schema + seed data)')
  parts.push('--  Compatible with Turso (libSQL) / SQLite')
  parts.push('--')
  parts.push('--  Usage:')
  parts.push('--    1. Open https://app.turso.tech')
  parts.push('--    2. Select your database → "Edit Data" → SQL shell')
  parts.push('--    3. Copy this entire file and paste it into the shell')
  parts.push('--    4. Run it — all tables + demo data will be created')
  parts.push('-- ═══════════════════════════════════════════════════════════')
  parts.push('')

  // Schema (CREATE TABLE statements)
  parts.push('-- ─── SCHEMA ──────────────────────────────────────────────')
  parts.push(schemaSql.trim())
  parts.push('')

  // Seed data
  parts.push('-- ─── SEED DATA ──────────────────────────────────────────')

  // Plans first (no foreign key dependencies)
  const plansInsert = buildInsert(
    'SubscriptionPlan',
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceARS: p.priceARS,
      durationDays: p.durationDays,
      mpPlanId: p.mpPlanId,
      features: p.features,
      isActive: p.isActive ? 1 : 0,
      isFeatured: p.isFeatured ? 1 : 0,
      maxShotsPerDay: p.maxShotsPerDay,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  )
  if (plansInsert) parts.push('-- Subscription plans', plansInsert, '')

  // Users
  const usersInsert = buildInsert(
    'User',
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      passwordHash: u.passwordHash,
      role: u.role,
      avatarColor: u.avatarColor,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  )
  if (usersInsert) parts.push('-- Users', usersInsert, '')

  // Sessions
  const sessionsInsert = buildInsert(
    'Session',
    sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      trainingMode: s.trainingMode ? 1 : 0,
      totalScore: s.totalScore,
      durationSec: s.durationSec,
      bestScore: s.bestScore,
      avgScore: s.avgScore,
      shotCount: s.shotCount,
      targetSize: s.targetSize,
      distanceM: s.distanceM,
      captureMode: s.captureMode,
      weather: s.weather,
      notes: s.notes,
      drillType: s.drillType,
      drillPassed: s.drillPassed === null ? 'NULL' : s.drillPassed ? 1 : 0,
      drillGoal: s.drillGoal,
      createdAt: s.createdAt,
    })),
  )
  if (sessionsInsert) parts.push('-- Sessions', sessionsInsert, '')

  // Shots
  const shotsInsert = buildInsert(
    'Shot',
    shots.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      index: s.index,
      x: s.x,
      y: s.y,
      radius: s.radius,
      score: s.score,
      isLatest: s.isLatest ? 1 : 0,
      timestamp: s.timestamp,
      distanceM: s.distanceM,
    })),
  )
  if (shotsInsert) parts.push('-- Shots', shotsInsert, '')

  // Subscriptions
  const subsInsert = buildInsert(
    'UserSubscription',
    subs.map((s) => ({
      id: s.id,
      userId: s.userId,
      planId: s.planId,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      autoRenew: s.autoRenew ? 1 : 0,
      createdAt: s.createdAt,
    })),
  )
  if (subsInsert) parts.push('-- User subscriptions', subsInsert, '')

  // Payments
  const paymentsInsert = buildInsert(
    'Payment',
    payments.map((p) => ({
      id: p.id,
      userId: p.userId,
      planId: p.planId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      mpPaymentId: p.mpPaymentId,
      mpPreferenceId: p.mpPreferenceId,
      mpStatus: p.mpStatus,
      method: p.method,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  )
  if (paymentsInsert) parts.push('-- Payments', paymentsInsert, '')

  parts.push('')
  parts.push('-- ═══════════════════════════════════════════════════════════')
  parts.push('--  ✅ Fin del script — DB lista para usar')
  parts.push('-- ═══════════════════════════════════════════════════════════')

  const fullSql = parts.join('\n')
  const outPath = path.join(process.cwd(), 'e-target-full.sql')
  fs.writeFileSync(outPath, fullSql, 'utf-8')

  console.log('')
  console.log(`✅ SQL generado: ${outPath}`)
  console.log(`   Tamaño: ${(fullSql.length / 1024).toFixed(1)} KB`)
  console.log('')
  console.log('Próximos pasos (sin instalar nada):')
  console.log('  1. Abrí https://app.turso.tech')
  console.log('  2. Seleccioná tu DB → "Edit Data" → SQL shell')
  console.log('  3. Abrí e-target-full.sql, copiá TODO el contenido')
  console.log('  4. Pegalo en el shell de Turso y ejecutá')
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
