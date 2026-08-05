/**
 * Turso setup script — creates all tables in a Turso (libSQL) database.
 *
 * Usage:
 *   1. Install Turso CLI:    https://docs.turso.tech/cli/installation
 *   2. Create a DB:           turso db create e-target
 *   3. Get the URL:           turso db show e-target --url
 *   4. Get the token:         turso db tokens create e-target
 *   5. Set env vars:
 *        export DATABASE_URL="libsql://e-target-<your-user>.turso.io"
 *        export DATABASE_AUTH_TOKEN="<your-token>"
 *   6. Run this script:       bun run db:setup-turso
 *
 * What it does:
 *   - Uses `prisma migrate diff` to generate the CREATE TABLE SQL from
 *     prisma/schema.prisma (SQLite-compatible DDL, which libSQL accepts).
 *   - Connects to Turso via @libsql/client and executes the SQL.
 *   - Idempotent: safe to re-run (uses CREATE TABLE IF NOT EXISTS semantics
 *     via Prisma's diff output).
 */

import { createClient } from '@libsql/client'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const DATABASE_URL = process.env.DATABASE_URL
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurada.')
  console.error('   Exportá las variables antes de correr este script:')
  console.error('   export DATABASE_URL="libsql://..."')
  console.error('   export DATABASE_AUTH_TOKEN="..."')
  process.exit(1)
}

if (!DATABASE_URL.startsWith('libsql:') && !DATABASE_URL.startsWith('https://')) {
  console.error(`❌ DATABASE_URL debe ser una URL de Turso (libsql://...), recibí: ${DATABASE_URL}`)
  console.error('   Este script es solo para crear tablas en Turso, no en SQLite local.')
  console.error('   Para SQLite local usá: bun run db:push')
  process.exit(1)
}

async function main() {
  console.log('🔧 Generando SQL desde prisma/schema.prisma...')

  // Generate the DDL SQL from the Prisma schema using migrate diff.
  // This outputs SQLite-compatible CREATE TABLE statements, which libSQL
  // (a SQLite fork) accepts natively.
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ No se encontró ${schemaPath}`)
    process.exit(1)
  }

  let sql: string
  try {
    sql = execSync(
      `npx prisma migrate diff --from-empty --to-schema-datamodel "${schemaPath}" --script`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
  } catch (err: any) {
    console.error('❌ Error generando SQL con prisma migrate diff:')
    console.error(err.stderr || err.message)
    process.exit(1)
  }

  if (!sql || sql.trim().length === 0) {
    console.error('❌ El SQL generado está vacío. Revisá prisma/schema.prisma')
    process.exit(1)
  }

  console.log(`📝 SQL generado (${sql.length} caracteres). Aplicando a Turso...`)
  console.log(`   Conectando a: ${DATABASE_URL}`)

  const client = createClient({
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN || undefined,
  })

  // Split the SQL into individual statements and execute them.
  // Prisma's migrate diff output separates statements with ";\n".
  // We strip SQL comments (-- ...) from each statement, then filter out
  // any that become empty.
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--[^\n]*$/gm, '').trim()) // strip comment-only lines
    .map((s) => s.replace(/^--[^\n]*/g, '').trim())       // strip leading comments on same line
    .filter((s) => s.length > 0)

  console.log(`   ${statements.length} declaraciones SQL a ejecutar.`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    try {
      await client.execute(stmt)
      console.log(`   ✓ [${i + 1}/${statements.length}] OK`)
    } catch (err: any) {
      // Ignore "table already exists" errors (idempotent re-runs)
      if (err.message?.includes('already exists')) {
        console.log(`   ⊙ [${i + 1}/${statements.length}] Ya existe (skip)`)
      } else {
        console.error(`   ✗ [${i + 1}/${statements.length}] Error:`, err.message)
        console.error('   SQL:', stmt.substring(0, 200))
      }
    }
  }

  console.log('')
  console.log('✅ ¡Tablas creadas en Turso!')
  console.log('')
  console.log('Próximos pasos:')
  console.log('  1. Cargar datos demo:  bun run db:seed')
  console.log('  2. Deployar a Vercel:  vercel --prod')
  console.log('')
  console.log('Recordá configurar estas variables en Vercel:')
  console.log(`  DATABASE_URL=${DATABASE_URL}`)
  console.log(`  DATABASE_AUTH_TOKEN=${DATABASE_AUTH_TOKEN ? '***' : '(sin token)'}`)
}

main().catch((err) => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
