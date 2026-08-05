'use client'

import { useState, useEffect } from 'react'
import type { Tab } from '@/components/screens/main-app'
import { showToast } from '@/components/shared/toast'
import {
  ArrowLeft, Shield, Loader2, Users, DollarSign, TrendingUp,
  LayoutDashboard, UserCog, Wallet, Receipt, Search, ChevronLeft, ChevronRight,
  X, Check, Trash2, Plus, Edit3, Crown, Zap,
} from 'lucide-react'

interface AdminPanelProps {
  onNavigate: (tab: Tab) => void
}

type AdminTab = 'dashboard' | 'users' | 'plans' | 'payments'

// === API response shapes ===
interface RecentPayment {
  id: string
  amount: number
  currency: string
  status: string
  createdAt: string
  user: { email: string; name: string | null } | null
  plan: { id: string; name: string } | null
}

interface RecentUser {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin'
  avatarColor: string
  createdAt: string
}

interface StatsResponse {
  totalUsers: number
  totalSessions: number
  totalShots: number
  totalRevenue: number
  activeSubscriptions: number
  recentPayments: RecentPayment[]
  recentUsers: RecentUser[]
  planDistribution: { id: string; name: string; subscriberCount: number }[]
}

interface AdminUser {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin'
  avatarColor: string
  createdAt: string
  activeSubscription: {
    id: string
    status: 'active' | 'expired' | 'cancelled' | 'pending'
    startDate: string
    endDate: string
    plan: { id: string; name: string }
  } | null
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface AdminPlan {
  id: string
  name: string
  description: string
  priceARS: number
  durationDays: number
  mpPlanId?: string | null
  features: string[]
  isActive: boolean
  isFeatured: boolean
  maxShotsPerDay: number
  sortOrder: number
  subscriberCount?: number
  createdAt?: string
}

interface AdminPayment {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'
  mpPaymentId: string | null
  mpPreferenceId?: string | null
  mpStatus?: string | null
  method: string | null
  description: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string | null } | null
  plan: { id: string; name: string } | null
}

interface PaymentsResponse {
  payments: AdminPayment[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const AVATAR_SWATCHES = ['#ff3a28', '#00e5ff', '#ffb830', '#39ff7a', '#ff7240', '#4da6ff']
const DIST_COLORS = ['#ff3a28', '#ffb830', '#00e5ff', '#39ff7a', '#ff7240', '#4da6ff']

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtMoney = (n: number) => `$${n.toLocaleString('es-AR')}`

function statusColor(status: string): { bg: string; text: string; border: string; label: string } {
  switch (status) {
    case 'approved':
      return { bg: 'rgba(57,255,122,0.15)', text: '#39ff7a', border: 'rgba(57,255,122,0.3)', label: 'APROBADO' }
    case 'pending':
      return { bg: 'rgba(255,184,0,0.15)', text: '#ffb830', border: 'rgba(255,184,0,0.3)', label: 'PENDIENTE' }
    case 'rejected':
      return { bg: 'rgba(255,58,40,0.15)', text: '#ff3a28', border: 'rgba(255,58,40,0.3)', label: 'RECHAZADO' }
    case 'cancelled':
      return { bg: 'rgba(255,58,40,0.15)', text: '#ff3a28', border: 'rgba(255,58,40,0.3)', label: 'CANCELADO' }
    case 'refunded':
      return { bg: 'rgba(0,229,255,0.15)', text: '#00e5ff', border: 'rgba(0,229,255,0.3)', label: 'REEMBOLSADO' }
    default:
      return { bg: 'rgba(122,140,168,0.15)', text: '#7a8ca8', border: 'rgba(122,140,168,0.3)', label: status.toUpperCase() }
  }
}

// ═══════════════════════════════════════════════════════════
// Shared UI primitives
// ═══════════════════════════════════════════════════════════
function StatusBadge({ status }: { status: string }) {
  const c = statusColor(status)
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider border whitespace-nowrap"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {c.label}
    </span>
  )
}

function RoleBadge({ role }: { role: 'user' | 'admin' }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider border bg-[rgba(255,184,0,0.15)] text-[#ffb830] border-[rgba(255,184,0,0.3)]">
        ADMIN
      </span>
    )
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider border bg-[rgba(122,140,168,0.15)] text-[#7a8ca8] border-[rgba(122,140,168,0.3)]">
      USER
    </span>
  )
}

function Avatar({ name, color, size = 36 }: { name: string | null; color: string; size?: number }) {
  const initial = (name?.[0] || '?').toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center font-display font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        color: '#fff',
        fontSize: size * 0.4,
        boxShadow: `0 0 12px ${color}40`,
      }}
    >
      {initial}
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-[#3d4f68] mb-3">{icon}</div>
      <p className="font-display text-sm text-[#e8ecf5] mb-1 tracking-[0.08em]">{title}</p>
      <p className="text-xs text-[#7a8ca8]">{subtitle}</p>
    </div>
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-3">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] disabled:opacity-40 hover:text-[#ff3a28] hover:border-[var(--border-glow)]"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="font-mono-tactical text-xs text-[#7a8ca8] px-2">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] disabled:opacity-40 hover:text-[#ff3a28] hover:border-[var(--border-glow)]"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

function SheetShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(6,9,16,0.8)] backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-[#0d1424] rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] max-h-[90vh] overflow-y-auto animate-slide-up-sheet"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)] sticky top-0 bg-[#0d1424] z-10">
          <div>
            <h2 className="font-display font-bold text-base tracking-[0.08em]">{title}</h2>
            {subtitle && <p className="font-mono-tactical text-[10px] text-[#3d4f68] mt-0.5 break-all">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ca8] hover:text-[#ff3a28] hover:bg-[var(--red-dim)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
        checked
          ? 'bg-[rgba(57,255,122,0.12)] border-[rgba(57,255,122,0.3)]'
          : 'bg-[var(--bg-glass)] border-[var(--border-subtle)]'
      }`}
    >
      <span className={`font-mono-tactical text-[10px] tracking-[0.15em] ${checked ? 'text-[#39ff7a]' : 'text-[#7a8ca8]'}`}>
        {label}
      </span>
      <div className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-[#39ff7a]' : 'bg-[#1a2540]'}`}>
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </div>
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[var(--border-subtle)]">
      <span className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em] flex-shrink-0">{label}</span>
      <span className="text-xs text-[#e8ecf5] text-right break-all">{value}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Main AdminPanel
// ═══════════════════════════════════════════════════════════
export function AdminPanel({ onNavigate }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard')

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <header
        className="sticky top-0 z-10 bg-[rgba(10,14,26,0.92)] backdrop-blur-xl border-b border-[var(--border-subtle)]"
        style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
      >
        <div className="flex items-center gap-3 px-4 pb-3">
          <button
            onClick={() => onNavigate('menu')}
            className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28]"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <Shield size={18} className="text-[#ffb830]" />
            <div>
              <h1 className="font-display font-bold text-base tracking-[0.1em]">ADMIN</h1>
              <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">PANEL DE CONTROL</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-3">
          <div className="flex gap-1 p-1 bg-[var(--bg-glass)] rounded-lg">
            <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<LayoutDashboard size={14} />} label="DASHBOARD" />
            <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<Users size={14} />} label="USUARIOS" />
            <TabButton active={tab === 'plans'} onClick={() => setTab('plans')} icon={<Crown size={14} />} label="PLANES" />
            <TabButton active={tab === 'payments'} onClick={() => setTab('payments')} icon={<Receipt size={14} />} label="PAGOS" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'calc(24px + var(--safe-bottom))' }}>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'payments' && <PaymentsTab />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-bold tracking-wider rounded-md transition-all ${
        active
          ? 'bg-[var(--red-dim)] text-[#ff3a28] border border-[var(--border-glow)]'
          : 'text-[#7a8ca8] border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// Dashboard tab
// ═══════════════════════════════════════════════════════════
function DashboardTab() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/stats', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: StatsResponse | null) => {
        if (!cancelled) setStats(d)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#7a8ca8]">
        <Loader2 size={24} className="animate-spin mr-2" /> Cargando…
      </div>
    )
  }

  if (!stats) {
    return <EmptyState icon={<Shield size={40} />} title="SIN DATOS" subtitle="No se pudieron cargar las estadísticas." />
  }

  const distMax = Math.max(1, ...stats.planDistribution.map((p) => p.subscriberCount))

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-2.5">
        <KPI icon={<Users size={18} />} value={stats.totalUsers} label="USUARIOS" color="#00e5ff" />
        <KPI icon={<TrendingUp size={18} />} value={stats.totalSessions} label="SESIONES" color="#ff3a28" />
        <KPI icon={<Zap size={18} />} value={stats.totalShots} label="DISPAROS" color="#ffb830" />
        <KPI icon={<DollarSign size={18} />} value={fmtMoney(stats.totalRevenue)} label="INGRESOS" color="#39ff7a" />
      </div>

      {/* Secondary cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <SmallCard icon={<Crown size={16} />} value={stats.activeSubscriptions} label="SUSCRIPCIONES ACTIVAS" color="#39ff7a" />
        <SmallCard icon={<Zap size={16} />} value={stats.totalShots} label="DISPAROS TOTALES" color="#ffb830" />
        <SmallCard icon={<UserCog size={16} />} value={stats.recentUsers.length} label="USUARIOS NUEVOS" color="#00e5ff" />
        <SmallCard icon={<Receipt size={16} />} value={stats.recentPayments.length} label="PAGOS RECIENTES" color="#ff3a28" />
      </div>

      {/* Plan distribution */}
      <div className="tactical-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <LayoutDashboard size={14} className="text-[#ffb830]" />
          <h3 className="font-display font-bold text-sm tracking-[0.08em]">DISTRIBUCIÓN DE PLANES</h3>
        </div>
        {stats.planDistribution.length === 0 ? (
          <p className="text-xs text-[#7a8ca8] text-center py-4">No hay planes.</p>
        ) : (
          <div className="space-y-3">
            {stats.planDistribution.map((p, i) => (
              <PlanDistributionBar
                key={p.id}
                name={p.name}
                count={p.subscriberCount}
                max={distMax}
                color={DIST_COLORS[i % DIST_COLORS.length]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent payments */}
      <div className="tactical-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={14} className="text-[#39ff7a]" />
          <h3 className="font-display font-bold text-sm tracking-[0.08em]">PAGOS RECIENTES</h3>
        </div>
        {stats.recentPayments.length === 0 ? (
          <p className="text-xs text-[#7a8ca8] text-center py-4">Sin pagos recientes.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-glass)]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#e8ecf5] truncate">{p.user?.email || '—'}</p>
                  <p className="font-mono-tactical text-[10px] text-[#3d4f68] truncate">
                    {p.plan?.name || '—'} · {fmtDate(p.createdAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-display font-bold text-sm text-[#e8ecf5]">{fmtMoney(p.amount)}</p>
                  <div className="mt-0.5">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent users */}
      <div className="tactical-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserCog size={14} className="text-[#00e5ff]" />
          <h3 className="font-display font-bold text-sm tracking-[0.08em]">USUARIOS RECIENTES</h3>
        </div>
        {stats.recentUsers.length === 0 ? (
          <p className="text-xs text-[#7a8ca8] text-center py-4">Sin usuarios recientes.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-glass)]">
                <Avatar name={u.name || u.email} color={u.avatarColor} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#e8ecf5] truncate">{u.email}</p>
                  <p className="font-mono-tactical text-[10px] text-[#3d4f68]">{fmtDate(u.createdAt)}</p>
                </div>
                <RoleBadge role={u.role} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div className="tactical-card p-3.5 flex flex-col gap-1.5">
      <div style={{ color }}>{icon}</div>
      <span className="font-display font-bold text-xl" style={{ color, textShadow: `0 0 12px ${color}25` }}>
        {value}
      </span>
      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">{label}</span>
    </div>
  )
}

function SmallCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  color: string
}) {
  return (
    <div className="tactical-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="font-display font-bold text-lg" style={{ color }}>
          {value}
        </span>
      </div>
      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.1em] leading-tight">{label}</span>
    </div>
  )
}

function PlanDistributionBar({
  name,
  count,
  max,
  color,
}: {
  name: string
  count: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#e8ecf5] truncate pr-2">{name}</span>
        <span className="font-mono-tactical text-[11px] flex-shrink-0" style={{ color }}>
          {count}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-glass)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Users tab
// ═══════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (debouncedQ) params.set('q', debouncedQ)
    fetch(`/api/admin/users?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsersResponse | null) => {
        if (cancelled || !d) return
        setUsers(d.users)
        setTotal(d.total)
        setTotalPages(d.totalPages)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, debouncedQ, reloadKey])

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3d4f68]" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por email o nombre…"
          className="tactical-input pl-9"
        />
      </div>

      <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em] px-1">
        {total} USUARIO{total === 1 ? '' : 'S'}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#7a8ca8]">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando…
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="SIN USUARIOS" subtitle="No se encontraron usuarios." />
      ) : (
        <>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setEditing(u)}
                className="w-full tactical-card p-3 flex items-center gap-3 text-left hover:border-[var(--border-glow)] transition-colors"
              >
                <Avatar name={u.name || u.email} color={u.avatarColor} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#e8ecf5] truncate">{u.name || 'Sin nombre'}</p>
                  <p className="text-xs text-[#7a8ca8] truncate">{u.email}</p>
                  <p className="font-mono-tactical text-[9px] text-[#3d4f68] mt-0.5 truncate">
                    {u.activeSubscription
                      ? `${u.activeSubscription.plan.name} · ${u.activeSubscription.status}`
                      : 'SIN SUSCRIPCIÓN'}{' '}
                    · {fmtDate(u.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RoleBadge role={u.role} />
                  <Edit3 size={12} className="text-[#3d4f68]" />
                </div>
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {editing && (
        <EditUserSheet
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function EditUserSheet({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(user.name || '')
  const [role, setRole] = useState<'user' | 'admin'>(user.role)
  const [avatarColor, setAvatarColor] = useState(user.avatarColor)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, avatarColor }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Error al actualizar', 'error')
        return
      }
      showToast('Usuario actualizado ✓', 'success')
      onSaved()
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetShell title="EDITAR USUARIO" subtitle={user.email} onClose={onClose}>
      <div className="space-y-4">
        {/* Avatar preview */}
        <div className="flex items-center gap-3">
          <Avatar name={name || user.email} color={avatarColor} size={48} />
          <div className="min-w-0">
            <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">VISTA PREVIA</p>
            <p className="text-sm text-[#e8ecf5] truncate">{name || user.email}</p>
          </div>
        </div>

        {/* Name */}
        <FormField label="NOMBRE">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del usuario"
            className="tactical-input"
          />
        </FormField>

        {/* Role */}
        <FormField label="ROL">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={`py-2.5 rounded-lg text-xs font-bold tracking-wider border transition-all ${
                role === 'user'
                  ? 'bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border-[rgba(0,229,255,0.3)]'
                  : 'bg-[var(--bg-glass)] text-[#7a8ca8] border-[var(--border-subtle)]'
              }`}
            >
              USER
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`py-2.5 rounded-lg text-xs font-bold tracking-wider border transition-all ${
                role === 'admin'
                  ? 'bg-[rgba(255,184,0,0.15)] text-[#ffb830] border-[rgba(255,184,0,0.3)]'
                  : 'bg-[var(--bg-glass)] text-[#7a8ca8] border-[var(--border-subtle)]'
              }`}
            >
              ADMIN
            </button>
          </div>
        </FormField>

        {/* Avatar color */}
        <FormField label="COLOR DE AVATAR">
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={`aspect-square rounded-lg transition-all ${
                  avatarColor === c ? 'ring-2 ring-white scale-105' : 'opacity-70'
                }`}
                style={{
                  background: c,
                  boxShadow: avatarColor === c ? `0 0 12px ${c}` : 'none',
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </FormField>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="tactical-btn tactical-btn-secondary flex-1">
            CANCELAR
          </button>
          <button onClick={save} disabled={saving} className="tactical-btn tactical-btn-primary flex-1">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> GUARDANDO…
              </>
            ) : (
              <>
                <Check size={16} /> GUARDAR
              </>
            )}
          </button>
        </div>
      </div>
    </SheetShell>
  )
}

// ═══════════════════════════════════════════════════════════
// Plans tab
// ═══════════════════════════════════════════════════════════
function PlansTab() {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [creating, setCreating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/plans', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AdminPlan[] | null) => {
        if (!cancelled && Array.isArray(d)) setPlans(d)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const handleDelete = async (plan: AdminPlan) => {
    if (!window.confirm(`¿Eliminar el plan "${plan.name}"? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'No se puede eliminar: tiene suscripciones.', 'error')
        return
      }
      if (!res.ok) {
        showToast('Error al eliminar', 'error')
        return
      }
      showToast('Plan eliminado ✓', 'success')
      reload()
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">
          {plans.length} PLAN{plans.length === 1 ? '' : 'ES'}
        </p>
        <button onClick={() => setCreating(true)} className="tactical-btn tactical-btn-primary py-2 px-3 text-xs">
          <Plus size={14} /> CREAR PLAN
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#7a8ca8]">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando…
        </div>
      ) : plans.length === 0 ? (
        <EmptyState icon={<Crown size={40} />} title="SIN PLANES" subtitle="Crea el primer plan." />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {plans.map((p) => (
            <div key={p.id} className="tactical-card p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-display font-bold text-sm text-[#e8ecf5] tracking-[0.05em]">{p.name}</h3>
                    {p.isFeatured && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[rgba(255,58,40,0.15)] text-[#ff3a28] border border-[rgba(255,58,40,0.3)]">
                        DESTACADO
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[rgba(122,140,168,0.15)] text-[#7a8ca8] border border-[rgba(122,140,168,0.3)]">
                        INACTIVO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7a8ca8] mt-1 line-clamp-1">{p.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-display font-bold text-base text-[#ff3a28]">
                    {p.priceARS === 0 ? 'GRATIS' : fmtMoney(p.priceARS)}
                  </p>
                  <p className="font-mono-tactical text-[9px] text-[#3d4f68]">{p.durationDays}d</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-3 text-[10px] text-[#7a8ca8]">
                  <span className="flex items-center gap-1">
                    <Check size={10} className="text-[#39ff7a]" /> {p.features.length} feats
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={10} className="text-[#00e5ff]" /> {p.subscriberCount ?? 0} subs
                  </span>
                  <span className="font-mono-tactical text-[9px] text-[#3d4f68]">orden #{p.sortOrder}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(p)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-[#7a8ca8] hover:text-[#00e5ff] hover:bg-[var(--cyan-dim)]"
                    aria-label="Editar plan"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-[#7a8ca8] hover:text-[#ff3a28] hover:bg-[var(--red-dim)]"
                    aria-label="Eliminar plan"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <PlanFormSheet
          plan={editing}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSaved={() => {
            setEditing(null)
            setCreating(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

interface PlanForm {
  name: string
  description: string
  priceARS: string
  durationDays: string
  features: string
  maxShotsPerDay: string
  sortOrder: string
  isActive: boolean
  isFeatured: boolean
}

function PlanFormSheet({
  plan,
  onClose,
  onSaved,
}: {
  plan: AdminPlan | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<PlanForm>({
    name: plan?.name || '',
    description: plan?.description || '',
    priceARS: plan ? String(plan.priceARS) : '0',
    durationDays: plan ? String(plan.durationDays) : '30',
    features: plan?.features.join('\n') || '',
    maxShotsPerDay: plan ? String(plan.maxShotsPerDay) : '0',
    sortOrder: plan ? String(plan.sortOrder) : '0',
    isActive: plan?.isActive ?? true,
    isFeatured: plan?.isFeatured ?? false,
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof PlanForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      showToast('Nombre y descripción son obligatorios', 'error')
      return
    }
    setSaving(true)
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      priceARS: Number(form.priceARS) || 0,
      durationDays: Number(form.durationDays) || 30,
      features: form.features
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      maxShotsPerDay: Number(form.maxShotsPerDay) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
    }
    try {
      const url = plan ? `/api/admin/plans/${plan.id}` : '/api/admin/plans'
      const method = plan ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Error al guardar', 'error')
        return
      }
      showToast(plan ? 'Plan actualizado ✓' : 'Plan creado ✓', 'success')
      onSaved()
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetShell title={plan ? 'EDITAR PLAN' : 'CREAR PLAN'} subtitle={plan?.name} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="NOMBRE">
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ej: Pro Monthly"
            className="tactical-input"
          />
        </FormField>
        <FormField label="DESCRIPCIÓN">
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Descripción del plan"
            rows={2}
            className="tactical-input resize-none"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="PRECIO (ARS)">
            <input
              type="number"
              min={0}
              value={form.priceARS}
              onChange={(e) => set('priceARS', e.target.value)}
              className="tactical-input"
            />
          </FormField>
          <FormField label="DURACIÓN (DÍAS)">
            <input
              type="number"
              min={1}
              value={form.durationDays}
              onChange={(e) => set('durationDays', e.target.value)}
              className="tactical-input"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="DISPAROS/DÍA">
            <input
              type="number"
              min={0}
              value={form.maxShotsPerDay}
              onChange={(e) => set('maxShotsPerDay', e.target.value)}
              className="tactical-input"
            />
          </FormField>
          <FormField label="ORDEN">
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
              className="tactical-input"
            />
          </FormField>
        </div>
        <FormField label="FEATURES (una por línea)">
          <textarea
            value={form.features}
            onChange={(e) => set('features', e.target.value)}
            placeholder={'Feature 1\nFeature 2\nFeature 3'}
            rows={5}
            className="tactical-input resize-none font-mono-tactical text-xs"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <ToggleField label="ACTIVO" checked={form.isActive} onChange={(v) => set('isActive', v)} />
          <ToggleField label="DESTACADO" checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="tactical-btn tactical-btn-secondary flex-1">
            CANCELAR
          </button>
          <button onClick={save} disabled={saving} className="tactical-btn tactical-btn-primary flex-1">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> GUARDANDO…
              </>
            ) : (
              <>
                <Check size={16} /> GUARDAR
              </>
            )}
          </button>
        </div>
      </div>
    </SheetShell>
  )
}

// ═══════════════════════════════════════════════════════════
// Payments tab
// ═══════════════════════════════════════════════════════════
const PAYMENT_STATUSES = ['all', 'pending', 'approved', 'rejected', 'refunded', 'cancelled'] as const
type PaymentFilter = (typeof PAYMENT_STATUSES)[number]

function PaymentsTab() {
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState<PaymentFilter>('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminPayment | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (status !== 'all') params.set('status', status)
    fetch(`/api/admin/payments?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PaymentsResponse | null) => {
        if (cancelled || !d) return
        setPayments(d.payments)
        setTotal(d.total)
        setTotalPages(d.totalPages)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, status, reloadKey])

  const onStatusChange = (s: PaymentFilter) => {
    setStatus(s)
    setPage(1)
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Wallet size={14} className="text-[#39ff7a] flex-shrink-0" />
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as PaymentFilter)}
          className="tactical-input py-2 px-3 text-sm flex-1"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
          <option value="refunded">Reembolsados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>

      <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em] px-1">
        {total} PAGO{total === 1 ? '' : 'S'}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#7a8ca8]">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando…
        </div>
      ) : payments.length === 0 ? (
        <EmptyState icon={<Receipt size={40} />} title="SIN PAGOS" subtitle="No hay pagos para este filtro." />
      ) : (
        <>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {payments.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full tactical-card p-3 text-left hover:border-[var(--border-glow)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-[#e8ecf5] truncate">{p.user?.email || '—'}</p>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[#7a8ca8] truncate">{p.plan?.name || 'Sin plan'}</p>
                    <p className="font-mono-tactical text-[9px] text-[#3d4f68] truncate">
                      {fmtDate(p.createdAt)} · {p.method || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-display font-bold text-sm text-[#e8ecf5]">{fmtMoney(p.amount)}</p>
                    <p className="font-mono-tactical text-[9px] text-[#3d4f68] uppercase">{p.currency}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {selected && (
        <PaymentDetailSheet
          payment={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function PaymentDetailSheet({
  payment,
  onClose,
  onUpdated,
}: {
  payment: AdminPayment
  onClose: () => void
  onUpdated: () => void
}) {
  const [updating, setUpdating] = useState(false)

  const updateStatus = async (newStatus: 'approved' | 'refunded' | 'cancelled') => {
    const verb =
      newStatus === 'approved' ? 'aprobar' : newStatus === 'refunded' ? 'reembolsar' : 'cancelar'
    if (!window.confirm(`¿${verb.charAt(0).toUpperCase()}${verb.slice(1)} este pago?`)) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Error al actualizar', 'error')
        return
      }
      showToast(
        `Pago ${newStatus === 'approved' ? 'aprobado' : newStatus === 'refunded' ? 'reembolsado' : 'cancelado'} ✓`,
        'success',
      )
      onUpdated()
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <SheetShell title="PAGO" subtitle={payment.mpPaymentId || payment.id} onClose={onClose}>
      <div className="space-y-4">
        {/* Amount + status */}
        <div className="tactical-card p-4 flex items-center justify-between">
          <div>
            <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">MONTO</p>
            <p className="font-display font-bold text-2xl text-[#ff3a28]">{fmtMoney(payment.amount)}</p>
            <p className="font-mono-tactical text-[10px] text-[#3d4f68] uppercase">{payment.currency}</p>
          </div>
          <StatusBadge status={payment.status} />
        </div>

        {/* Info rows */}
        <div className="space-y-1">
          <InfoRow label="USUARIO" value={payment.user?.email || '—'} />
          <InfoRow label="PLAN" value={payment.plan?.name || '—'} />
          <InfoRow label="MÉTODO" value={payment.method || 'N/A'} />
          <InfoRow label="MP PAYMENT ID" value={payment.mpPaymentId || '—'} />
          <InfoRow label="DESCRIPCIÓN" value={payment.description || '—'} />
          <InfoRow label="FECHA" value={fmtDate(payment.createdAt)} />
        </div>

        {/* Actions */}
        {payment.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => updateStatus('cancelled')}
              disabled={updating}
              className="tactical-btn tactical-btn-secondary flex-1"
            >
              {updating ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} CANCELAR
            </button>
            <button
              onClick={() => updateStatus('approved')}
              disabled={updating}
              className="tactical-btn tactical-btn-primary flex-1"
            >
              {updating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} APROBAR
            </button>
          </div>
        )}
        {payment.status === 'approved' && (
          <div className="pt-2">
            <button
              onClick={() => updateStatus('refunded')}
              disabled={updating}
              className="tactical-btn tactical-btn-danger w-full"
            >
              {updating ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />} REEMBOLSAR
            </button>
          </div>
        )}
      </div>
    </SheetShell>
  )
}
