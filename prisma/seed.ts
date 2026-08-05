/**
 * Seed the database with admin user + default subscription plans.
 */
import { PrismaClient } from '@prisma/client'
import { scryptSync, randomBytes } from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  console.log('🌱 Seeding E-TARGET database…')

  // ─── Admin user ──────────────────────────────────────────
  const adminEmail = 'admin@etarget.app'
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Administrador',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      avatarColor: '#ff3a28',
    },
  })
  console.log(`  ✓ Admin user: ${admin.email} (pass: admin123)`)

  // ─── Demo user ───────────────────────────────────────────
  const demoEmail = 'tirador@etarget.app'
  const demo = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: 'Tirador Demo',
      passwordHash: hashPassword('demo123'),
      role: 'user',
      avatarColor: '#00e5ff',
    },
  })
  console.log(`  ✓ Demo user: ${demo.email} (pass: demo123)`)

  // ─── Subscription plans ──────────────────────────────────
  const plans = [
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

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findFirst({ where: { name: plan.name } })
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data: plan })
      console.log(`  ↻ Plan updated: ${plan.name}`)
    } else {
      await prisma.subscriptionPlan.create({ data: plan })
      console.log(`  ✓ Plan created: ${plan.name}`)
    }
  }

  // ─── Give demo user an active PRO subscription ───────────
  const proPlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'TIRADOR PRO' } })
  if (proPlan && demo) {
    const existingSub = await prisma.userSubscription.findFirst({
      where: { userId: demo.id, status: 'active' },
    })
    if (!existingSub) {
      await prisma.userSubscription.create({
        data: {
          userId: demo.id,
          planId: proPlan.id,
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: true,
        },
      })
      await prisma.payment.create({
        data: {
          userId: demo.id,
          planId: proPlan.id,
          amount: proPlan.priceARS,
          currency: 'ARS',
          status: 'approved',
          mpPaymentId: 'SEED-DEMO-001',
          description: 'Pago inicial demo (semilla)',
        },
      })
      console.log(`  ✓ Demo subscription activated (PRO)`)
    }
  }

  console.log('✅ Seed complete.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
