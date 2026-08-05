'use client'

import { useEffect, useState } from 'react'
import { useAppStore, bootstrapAuth } from '@/lib/store'
import type { Tab } from './main-app'
import type { Plan, PaymentInfo } from '@/lib/types'
import { showToast } from '@/components/shared/toast'
import { ArrowLeft, Check, Zap, CreditCard, Calendar, Loader2, Crown, Receipt } from 'lucide-react'

interface SubscriptionScreenProps {
  onNavigate: (tab: Tab) => void
}

export function SubscriptionScreen({ onNavigate }: SubscriptionScreenProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentInfo[]>([])
  const [tab, setTab] = useState<'plans' | 'history'>('plans')

  const subscription = useAppStore((s) => s.subscription)

  const loadPlans = async () => {
    try {
      const res = await fetch('/api/plans')
      if (res.ok) setPlans(await res.json())
    } catch {} finally { setLoading(false) }
  }

  const loadPayments = async () => {
    try {
      const res = await fetch('/api/subscriptions/history', { credentials: 'include' })
      if (res.ok) setPayments(await res.json())
    } catch {}
  }

  useEffect(() => {
    loadPlans()
    loadPayments()
  }, [])

  const subscribe = async (planId: string) => {
    setSubscribing(planId)
    try {
      const res = await fetch('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Error al procesar', 'error')
        return
      }
      if (data.initPoint) {
        // Free plan auto-approved — refresh and stay
        if (data.paymentId && data.freePlan) {
          showToast('Suscripción activada ✓', 'success')
          await bootstrapAuth()
          await loadPayments()
          return
        }
        // Paid plan — redirect to MercadoPago
        showToast('Redirigiendo a MercadoPago…', 'info')
        window.location.href = data.initPoint
      } else {
        showToast('Suscripción activada ✓', 'success')
        await bootstrapAuth()
        await loadPayments()
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSubscribing(null)
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtMoney = (n: number) => `$${n.toLocaleString('es-AR')}`

  const activePlanId = subscription?.plan.id

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4 bg-[rgba(10,14,26,0.9)] backdrop-blur-xl border-b border-[var(--border-subtle)]"
        style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
      >
        <button
          onClick={() => onNavigate('menu')}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base tracking-[0.1em]">SUSCRIPCIÓN</h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">PLANES Y PAGOS</p>
        </div>
      </header>

      {/* Current subscription banner */}
      {subscription && subscription.status === 'active' && (
        <div className="mx-4 mt-4 tactical-card p-4 border-l-2 border-l-[#39ff7a]">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={16} className="text-[#39ff7a]" />
            <span className="font-display font-bold text-sm text-[#39ff7a] tracking-[0.08em]">PLAN ACTIVO</span>
          </div>
          <p className="font-display font-bold text-xl text-[#e8ecf5] mb-2">{subscription.plan.name}</p>
          <div className="flex items-center gap-2 text-xs text-[#7a8ca8]">
            <Calendar size={12} />
            <span>Vence: {fmtDate(subscription.endDate)}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mx-4 mt-4 flex gap-1 p-1 bg-[var(--bg-glass)] rounded-lg">
        <button
          onClick={() => setTab('plans')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
            tab === 'plans' ? 'bg-[var(--red-dim)] text-[#ff3a28] border border-[var(--border-glow)]' : 'text-[#7a8ca8]'
          }`}
        >
          PLANES
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
            tab === 'history' ? 'bg-[var(--red-dim)] text-[#ff3a28] border border-[var(--border-glow)]' : 'text-[#7a8ca8]'
          }`}
        >
          PAGOS
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: 'calc(24px + var(--safe-bottom))' }}>
        {tab === 'plans' ? (
          loading ? (
            <div className="text-center py-12 text-[#7a8ca8]">Cargando planes…</div>
          ) : (
            plans.map((plan) => {
              const isCurrent = plan.id === activePlanId
              const isFree = plan.priceARS === 0
              return (
                <div
                  key={plan.id}
                  className={`relative tactical-card p-5 ${
                    plan.isFeatured ? 'border-[var(--border-glow)]' : ''
                  }`}
                  style={plan.isFeatured ? { boxShadow: '0 0 30px rgba(255,58,40,0.15)' } : {}}
                >
                  {plan.isFeatured && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#cc1a0a] to-[#ff7240] text-[9px] font-bold tracking-wider text-white">
                      MÁS POPULAR
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-bold text-lg text-[#e8ecf5] tracking-[0.05em]">{plan.name}</h3>
                      <p className="text-xs text-[#7a8ca8] mt-1">{plan.description}</p>
                    </div>
                    {isCurrent && (
                      <span className="px-2 py-1 rounded-md text-[9px] font-bold tracking-wider bg-[rgba(57,255,122,0.15)] text-[#39ff7a] border border-[rgba(57,255,122,0.3)]">
                        ACTUAL
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="font-display font-black text-3xl text-[#ff3a28]" style={{ textShadow: '0 0 16px rgba(255,58,40,0.3)' }}>
                      {isFree ? 'GRATIS' : fmtMoney(plan.priceARS)}
                    </span>
                    {!isFree && (
                      <span className="text-xs text-[#3d4f68]">/ {plan.durationDays} días</span>
                    )}
                  </div>

                  <ul className="space-y-2 mb-4">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#7a8ca8]">
                        <Check size={14} className="text-[#39ff7a] flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => subscribe(plan.id)}
                    disabled={isCurrent || subscribing === plan.id}
                    className={`tactical-btn w-full ${
                      isCurrent ? 'tactical-btn-secondary' : plan.isFeatured ? 'tactical-btn-primary' : 'tactical-btn-secondary'
                    }`}
                  >
                    {subscribing === plan.id ? (
                      <><Loader2 size={16} className="animate-spin" /> PROCESANDO…</>
                    ) : isCurrent ? (
                      'PLAN ACTUAL'
                    ) : isFree ? (
                      'ACTIVAR GRATIS'
                    ) : (
                      <><CreditCard size={16} /> SUSCRIBIR CON MERCADOPAGO</>
                    )}
                  </button>
                </div>
              )
            })
          )
        ) : (
          payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt size={48} className="text-[#3d4f68] mb-4" />
              <p className="font-display text-base text-[#e8ecf5] mb-1">SIN PAGOS</p>
              <p className="text-sm text-[#7a8ca8]">Aún no has realizado pagos.</p>
            </div>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="tactical-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        p.status === 'approved' ? 'bg-[rgba(57,255,122,0.15)]' :
                        p.status === 'pending' ? 'bg-[rgba(255,184,0,0.15)]' :
                        'bg-[rgba(255,58,40,0.15)]'
                      }`}
                    >
                      {p.status === 'approved' ? (
                        <Check size={14} className="text-[#39ff7a]" />
                      ) : p.status === 'pending' ? (
                        <Loader2 size={14} className="text-[#ffb830]" />
                      ) : (
                        <Zap size={14} className="text-[#ff3a28]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#e8ecf5]">{p.plan?.name || 'Plan'}</p>
                      <p className="font-mono-tactical text-[10px] text-[#3d4f68]">{fmtDate(p.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-base text-[#e8ecf5]">{fmtMoney(p.amount)}</p>
                    <p className="font-mono-tactical text-[9px] text-[#3d4f68] uppercase tracking-wider">
                      {p.status === 'approved' ? 'APROBADO' : p.status === 'pending' ? 'PENDIENTE' : p.status}
                    </p>
                  </div>
                </div>
                {p.mpPaymentId && (
                  <p className="font-mono-tactical text-[9px] text-[#3d4f68] mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    ID: {p.mpPaymentId} · {p.method || 'N/A'}
                  </p>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
