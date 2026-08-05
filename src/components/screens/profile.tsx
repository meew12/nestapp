'use client'

import { useState, useEffect } from 'react'
import { useAppStore, bootstrapAuth, refreshStats } from '@/lib/store'
import type { Tab } from './main-app'
import { showToast } from '@/components/shared/toast'
import { scoreColor } from '@/lib/types'
import { ArrowLeft, LogOut, User, Mail, Calendar, Target, Award, Clock, Shield, Telescope, Camera, TrendingUp, Activity, PieChart, Timer } from 'lucide-react'

interface ProfileScreenProps {
  onNavigate: (tab: Tab) => void
}

/* ── Score ring colour map (exact spec colours) ─────────── */
const RING_COLORS: Record<number, string> = {
  10: '#ff3a28',
  9:  '#ff3a28',
  8:  '#ffb830',
  7:  '#ffb830',
  6:  '#ff7240',
  5:  '#ff7240',
  4:  '#00e5ff',
  3:  '#00e5ff',
  2:  '#4da6ff',
  1:  '#4da6ff',
}

interface AnalyticsData {
  scoreDistribution: Record<string, number>
  totals: {
    sessions: number
    shots: number
    bestScore: number
    avgScore: number
    totalDurationSec: number
    bullseyes: number
  }
}

export function ProfileScreen({ onNavigate }: ProfileScreenProps) {
  const user = useAppStore((s) => s.user)
  const stats = useAppStore((s) => s.stats)
  const subscription = useAppStore((s) => s.subscription)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const setCameraMode = useAppStore((s) => s.setCameraMode)
  const [loggingOut, setLoggingOut] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)

  /* Fetch shot-level analytics on mount */
  useEffect(() => {
    fetch('/api/sessions/analytics', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAnalytics(d))
      .catch(() => {})
  }, [])

  const logout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      await bootstrapAuth()
      showToast('Sesión cerrada', 'info')
    } catch {
      showToast('Error al cerrar sesión', 'error')
    } finally {
      setLoggingOut(false)
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  /* ── Derived analytics helpers ────────────────────────── */
  const totalDurSec = analytics?.totals.totalDurationSec ?? stats?.totalDurationSec ?? 0
  const sessionCount = analytics?.totals.sessions ?? stats?.sessionCount ?? 0
  const avgScore = analytics?.totals.avgScore ?? stats?.avgScore ?? 0

  const totalHours = Math.floor(totalDurSec / 3600)
  const totalMins = Math.floor((totalDurSec % 3600) / 60)
  const avgSessionMin = sessionCount > 0 ? Math.round(totalDurSec / sessionCount / 60) : 0
  const sessionsPerWeek = sessionCount > 0 ? (sessionCount / Math.max(1, Math.ceil(totalDurSec / 3600 / 24 / 7) || 1)).toFixed(1) : '0'

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
          <h1 className="font-display font-bold text-base tracking-[0.1em]">PERFIL</h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">CUENTA Y ESTADÍSTICAS</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: 'calc(24px + var(--safe-bottom))' }}>
        {/* User card — with rotating gradient border */}
        <div className="tactical-card stagger-fade-in p-5 flex items-center gap-4" style={{ animationDelay: '0ms' }}>
          <div className="relative hud-frame rounded-full">
            <div className="score-hero-border w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-2xl text-white"
              style={{
                background: `linear-gradient(135deg, ${user?.avatarColor || '#ff3a28'}, #0a0e1a)`,
              }}
            >
              {(user?.name?.[0] || user?.email[0] || 'U').toUpperCase()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-lg text-[#e8ecf5] truncate glow-text-amber">
              {user?.name || 'Sin nombre'}
            </p>
            <p className="text-sm text-[#7a8ca8] truncate">{user?.email}</p>
            {user?.role === 'admin' && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider bg-[rgba(255,184,0,0.15)] text-[#ffb830] border border-[rgba(255,184,0,0.3)]">
                <Shield size={10} /> ADMINISTRADOR
              </span>
            )}
          </div>
        </div>

        {/* Account info */}
        <div className="tactical-card stagger-fade-in overflow-hidden" style={{ animationDelay: '100ms' }}>
          <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase px-4 py-3 border-b border-[var(--border-subtle)]">
            Información de cuenta
          </h3>
          <div className="divide-y divide-white/[0.03]">
            <InfoRow icon={<Mail size={14} />} label="Email" value={user?.email || ''} />
            <InfoRow icon={<User size={14} />} label="Nombre" value={user?.name || 'No especificado'} />
            <InfoRow icon={<Calendar size={14} />} label="Miembro desde" value={user ? fmtDate(user.createdAt) : ''} />
          </div>
        </div>

        {/* Stats */}
        <div className="tactical-card stagger-fade-in overflow-hidden corner-bracket corner-bracket-br" style={{ animationDelay: '200ms' }}>
          <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase px-4 py-3 border-b border-[var(--border-subtle)]">
            Estadísticas totales
          </h3>
          <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
            <StatTile icon={<Target size={16} />} value={stats?.totalShots ?? 0} label="DISPAROS" color="#ff3a28" />
            <StatTile icon={<Award size={16} />} value={stats?.bestScore ?? '—'} label="MEJOR" color="#ffb830" />
            <StatTile icon={<Target size={16} />} value={stats?.sessionCount ?? 0} label="SESIONES" color="#00e5ff" />
            <StatTile icon={<Clock size={16} />} value={`${Math.floor((stats?.totalDurationSec ?? 0) / 60)}m`} label="TIEMPO" color="#39ff7a" />
          </div>
          <button
            onClick={() => onNavigate('stats')}
            className="tactical-btn tactical-btn-secondary w-full mt-3 mx-4 mb-4 border-l-2 border-l-[#ff3a28]"
            style={{ width: 'calc(100% - 32px)' }}
          >
            <TrendingUp size={16} />
            VER ESTADÍSTICAS DETALLADAS
          </button>
        </div>

        {/* ── Accuracy Ring Visualization ──────────────── */}
        <div className="tactical-card stagger-fade-in overflow-hidden" style={{ animationDelay: '300ms' }}>
          <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
            <PieChart size={12} />
            Distribución de precisión
          </h3>
          <div className="flex items-center justify-center py-5">
            <AccuracyRing
              distribution={analytics?.scoreDistribution ?? null}
              avgScore={avgScore}
            />
          </div>
        </div>

        {/* ── Session Activity Summary ─────────────────── */}
        <div className="tactical-card stagger-fade-in overflow-hidden" style={{ animationDelay: '400ms' }}>
          <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
            <Activity size={12} />
            Actividad de sesiones
          </h3>
          <div className="grid grid-cols-3 divide-x divide-white/[0.03]">
            <MiniStat
              icon={<Timer size={14} />}
              value={totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`}
              label="TIEMPO TOTAL"
            />
            <MiniStat
              icon={<Clock size={14} />}
              value={`${avgSessionMin}m`}
              label="PROM. SESIÓN"
            />
            <MiniStat
              icon={<Activity size={14} />}
              value={sessionsPerWeek}
              label="POR SEMANA"
            />
          </div>
        </div>

        {/* Camera mode */}
        <div className="tactical-card stagger-fade-in p-4" style={{ animationDelay: '500ms' }}>
          <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3">
            Modo de cámara preferido
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCameraMode('mobile')}
              className={`flex flex-col items-center gap-2 py-3 rounded-lg border transition-all ${
                cameraMode === 'mobile'
                  ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8]'
              }`}
            >
              <Camera size={20} />
              <span className="text-xs font-semibold">CÁMARA MÓVIL</span>
            </button>
            <button
              onClick={() => setCameraMode('telescope')}
              className={`flex flex-col items-center gap-2 py-3 rounded-lg border transition-all ${
                cameraMode === 'telescope'
                  ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8]'
              }`}
            >
              <Telescope size={20} />
              <span className="text-xs font-semibold">TELESCOPIO</span>
            </button>
          </div>
        </div>

        {/* Subscription */}
        {subscription && (
          <div className="tactical-card stagger-fade-in p-4" style={{ animationDelay: '600ms' }}>
            <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3">
              Suscripción
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-base text-[#e8ecf5]">{subscription.plan.name}</p>
                <p className="text-xs text-[#7a8ca8] mt-0.5">
                  {subscription.status === 'active' ? 'Vence' : 'Estado'}: {fmtDate(subscription.endDate)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold tracking-wider badge-pulse ${
                subscription.status === 'active'
                  ? 'bg-[rgba(57,255,122,0.15)] text-[#39ff7a] border border-[rgba(57,255,122,0.3)]'
                  : 'bg-[rgba(255,184,0,0.15)] text-[#ffb830] border border-[rgba(255,184,0,0.3)]'
              }`}>
                {subscription.status === 'active' && <span className="live-dot" aria-hidden="true" />}
                {subscription.status.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => onNavigate('subscription')}
              className="tactical-btn tactical-btn-secondary w-full mt-3"
            >
              GESTIONAR SUSCRIPCIÓN
            </button>
          </div>
        )}

        {/* Admin link */}
        {user?.role === 'admin' && (
          <button
            onClick={() => onNavigate('admin')}
            className="tactical-card stagger-fade-in w-full p-4 flex items-center gap-3 hover:border-[rgba(255,184,0,0.4)] transition-all"
            style={{ animationDelay: '700ms' }}
          >
            <div className="w-10 h-10 rounded-full bg-[rgba(255,184,0,0.15)] flex items-center justify-center">
              <Shield size={18} className="text-[#ffb830]" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-display font-bold text-sm text-[#e8ecf5]">PANEL DE ADMINISTRACIÓN</p>
              <p className="text-xs text-[#7a8ca8]">Gestionar planes, usuarios y pagos</p>
            </div>
            <ArrowLeft size={16} className="text-[#3d4f68] rotate-180" />
          </button>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          disabled={loggingOut}
          className="tactical-btn tactical-btn-danger w-full"
        >
          <LogOut size={16} />
          {loggingOut ? 'CERRANDO…' : 'CERRAR SESIÓN'}
        </button>

        <p className="text-center font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mt-2 flex items-center justify-center gap-1.5">
          <Target size={10} className="text-[#3d4f68]" />
          E-TARGET v2.0 · Detección de Impactos
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Accuracy Ring — concentric arc segments
   ═══════════════════════════════════════════════════════════ */
function AccuracyRing({ distribution, avgScore }: { distribution: Record<string, number> | null; avgScore: number }) {
  const cx = 60
  const cy = 60
  const baseRadius = 14   // innermost ring (score 10)
  const ringGap = 4.2     // gap between rings
  const strokeWidth = 3

  /* If no data, render empty ring with placeholder */
  if (!distribution) {
    return (
      <svg viewBox="0 0 120 120" className="w-[120px] h-[120px]">
        <circle cx={cx} cy={cy} r={50} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" className="font-display" fill="#3d4f68" fontSize="18">—</text>
      </svg>
    )
  }

  /* Total shots for percentage calculation */
  const totalShots = Object.values(distribution).reduce((s, v) => s + v, 0)
  const circumference = (radius: number) => 2 * Math.PI * radius

  /* Build arcs from score 10 (innermost) to 1 (outermost) */
  const arcs: Array<{ score: number; r: number; color: string; dashArray: string; dashOffset: number }> = []
  for (let score = 10; score >= 1; score--) {
    const count = distribution[String(score)] ?? 0
    const idx = 10 - score          // 0 = score 10 (innermost)
    const r = baseRadius + idx * ringGap
    const circ = circumference(r)
    const fraction = totalShots > 0 ? count / totalShots : 0
    const arcLen = fraction * circ
    arcs.push({
      score,
      r,
      color: RING_COLORS[score] ?? scoreColor(score),
      dashArray: `${arcLen} ${circ - arcLen}`,
      dashOffset: 0,
    })
  }

  return (
    <svg viewBox="0 0 120 120" className="w-[120px] h-[120px]">
      {/* Background circles */}
      {arcs.map((a) => (
        <circle
          key={`bg-${a.score}`}
          cx={cx}
          cy={cy}
          r={a.r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
      ))}
      {/* Foreground arcs */}
      {arcs.map((a) => (
        <circle
          key={`fg-${a.score}`}
          cx={cx}
          cy={cy}
          r={a.r}
          fill="none"
          stroke={a.color}
          strokeWidth={strokeWidth}
          strokeDasharray={a.dashArray}
          strokeDashoffset={a.dashOffset}
          strokeLinecap="round"
          className="accuracy-ring-fill"
          style={{ opacity: a.dashArray.startsWith('0 ') ? 0 : 1 }}
        />
      ))}
      {/* Center average score */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-display"
        fill={avgScore > 0 ? scoreColor(Math.round(avgScore)) : '#3d4f68'}
        fontSize="18"
        style={avgScore > 0 ? { textShadow: `0 0 12px ${scoreColor(Math.round(avgScore))}40` } : undefined}
      >
        {avgScore > 0 ? avgScore.toFixed(1) : '—'}
      </text>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════ */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="text-[#3d4f68]">{icon}</div>
      <span className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em] uppercase w-24">{label}</span>
      <span className="text-sm text-[#e8ecf5] flex-1 text-right truncate">{value}</span>
    </div>
  )
}

function StatTile({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div className="stat-card-glow bg-[#0a0e1a] p-4 flex flex-col items-center gap-1.5 transition-all">
      <div style={{ color }}>{icon}</div>
      <span className="font-display font-bold text-2xl" style={{ color, textShadow: `0 0 12px ${color}25` }}>{value}</span>
      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">{label}</span>
    </div>
  )
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-3.5 px-2 gap-1">
      <div className="text-[#7a8ca8]">{icon}</div>
      <span className="font-display font-bold text-sm text-[#e8ecf5]">{value}</span>
      <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.12em] uppercase">{label}</span>
    </div>
  )
}
