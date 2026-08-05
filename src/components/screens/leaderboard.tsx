'use client'

import { useEffect, useState } from 'react'
import type { Tab } from './main-app'
import { ChevronLeft, Trophy, Medal } from 'lucide-react'

type Category = 'best' | 'average' | 'bullseyes'

interface BestEntry {
  userId: string
  name: string | null
  avatarColor: string
  score: number
  shotCount: number
  createdAt: string
}
interface AvgEntry {
  userId: string
  name: string | null
  avatarColor: string
  avgScore: number
  sessionCount: number
}
interface BullseyeEntry {
  userId: string
  name: string | null
  avatarColor: string
  count: number
}
interface LeaderboardData {
  best: BestEntry[]
  average: AvgEntry[]
  bullseyes: BullseyeEntry[]
  currentUser: {
    id: string
    name: string | null
    rank: { best: number | null; average: number | null; bullseyes: number | null }
    totals: { bestScore: number; avgScore: number; sessionCount: number; bullseyes: number }
  }
}

interface NormalizedEntry {
  userId: string
  name: string
  avatarColor: string
  valueLabel: string
  meta: string
}

const TABS: Array<{
  id: Category
  label: string
  color: string
  dim: string
  valueLabel: string
}> = [
  { id: 'best', label: 'MEJOR TIRO', color: '#ff3a28', dim: 'rgba(255, 58, 40, 0.15)', valueLabel: 'MEJOR' },
  { id: 'average', label: 'PROMEDIO', color: '#ffb830', dim: 'rgba(255, 184, 48, 0.15)', valueLabel: 'PROMEDIO' },
  { id: 'bullseyes', label: 'DIANAS', color: '#39ff7a', dim: 'rgba(57, 255, 122, 0.15)', valueLabel: 'DIANAS' },
]

function normalizeEntries(cat: Category, data: LeaderboardData): NormalizedEntry[] {
  if (cat === 'best') {
    return data.best.map((e) => ({
      userId: e.userId,
      name: e.name?.trim() || 'ANÓNIMO',
      avatarColor: e.avatarColor,
      valueLabel: String(e.score),
      meta: `${e.shotCount} disp.`,
    }))
  }
  if (cat === 'average') {
    return data.average.map((e) => ({
      userId: e.userId,
      name: e.name?.trim() || 'ANÓNIMO',
      avatarColor: e.avatarColor,
      valueLabel: e.avgScore.toFixed(1),
      meta: `${e.sessionCount} sesiones`,
    }))
  }
  return data.bullseyes.map((e) => ({
    userId: e.userId,
    name: e.name?.trim() || 'ANÓNIMO',
    avatarColor: e.avatarColor,
    valueLabel: String(e.count),
    meta: 'dianas 10',
  }))
}

function firstLetter(name: string): string {
  const c = name.trim()[0]
  return (c || '?').toUpperCase()
}

export function LeaderboardScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Category>('best')

  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LeaderboardData | null) => {
        if (cancelled) return
        if (d) setData(d)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const tabMeta = TABS.find((t) => t.id === activeTab)!
  const entries = data ? normalizeEntries(activeTab, data) : []
  const podium = entries.slice(0, 3)
  const list = entries.slice(3)
  const hasData = entries.length > 0

  const currentUser = data?.currentUser
  const userHasCompetition = (currentUser?.totals.sessionCount ?? 0) > 0

  let userRank: number | null = null
  let userValueLabel = '0'
  let userHint: string | null = null
  if (currentUser) {
    if (activeTab === 'best') {
      userRank = currentUser.rank.best
      userValueLabel = String(currentUser.totals.bestScore)
    } else if (activeTab === 'average') {
      userRank = currentUser.rank.average
      userValueLabel = currentUser.totals.avgScore.toFixed(1)
      if (currentUser.totals.sessionCount > 0 && currentUser.totals.sessionCount < 3) {
        userHint = `Necesitas ${3 - currentUser.totals.sessionCount} sesión(es) más`
      }
    } else {
      userRank = currentUser.rank.bullseyes
      userValueLabel = String(currentUser.totals.bullseyes)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a]">
      {/* Header (sticky) */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-4 bg-[rgba(10,14,26,0.92)] backdrop-blur-xl border-b border-[var(--border-subtle)]"
        style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
      >
        <button
          onClick={() => onNavigate('menu')}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28] transition-colors shrink-0"
          aria-label="Volver"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[#ffb830]" />
            <h1 className="font-display font-bold text-base tracking-[0.1em] target-ring-bg">RANKING</h1>
          </div>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em] truncate">
            TABLA DE LIDERAZGO GLOBAL
          </p>
        </div>
      </header>

      {/* Tab selector (sticky, below header) */}
      <div className="sticky top-[calc(70px+var(--safe-top))] z-10 px-4 py-3 bg-[rgba(10,14,26,0.88)] backdrop-blur-xl border-b border-[var(--border-subtle)]">
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((t) => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-2 py-2 rounded-lg text-[11px] font-display font-bold tracking-[0.08em] transition-all border ${
                  active
                    ? ''
                    : 'bg-[var(--bg-glass)] border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#e8ecf5]'
                }`}
                style={
                  active
                    ? {
                        backgroundColor: t.dim,
                        borderColor: t.color,
                        color: t.color,
                        boxShadow: `0 0 18px ${t.color}40`,
                      }
                    : undefined
                }
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 px-4 py-4 space-y-4"
        style={{ paddingBottom: 'calc(104px + var(--safe-bottom))' }}
      >
        {loading ? (
          <LoadingState />
        ) : !hasData ? (
          <EmptyCategory />
        ) : (
          <>
            {podium.length > 0 && (
              <Podium entries={podium} color={tabMeta.color} currentUserId={currentUser?.id} />
            )}
            {list.length > 0 && (
              <div className="space-y-2">
                {list.map((entry, idx) => (
                  <ListRow
                    key={entry.userId}
                    entry={entry}
                    rank={idx + 4}
                    color={tabMeta.color}
                    isCurrentUser={entry.userId === currentUser?.id}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky current user card */}
      {!loading && currentUser && (
        <CurrentUserCard
          rank={userRank}
          valueLabel={userValueLabel}
          color={tabMeta.color}
          categoryLabel={tabMeta.valueLabel}
          hasCompetition={userHasCompetition}
          hint={userHint}
        />
      )}
    </div>
  )
}

export default LeaderboardScreen

/* ─── Podium ─────────────────────────────────────────────────────────── */

interface PodiumColumnDef {
  entry: NormalizedEntry | undefined
  rank: number
  height: number
  barColor: string
  avatarSize: number
  rankFontSize: number
  glow?: string
  gradient: string
}

function Podium({
  entries,
  color,
  currentUserId,
}: {
  entries: NormalizedEntry[]
  color: string
  currentUserId?: string
}) {
  // entries[0] = #1, entries[1] = #2, entries[2] = #3
  // Display order: [#2, #1, #3] (center is tallest)
  const cols: PodiumColumnDef[] = [
    {
      entry: entries[1],
      rank: 2,
      height: 100,
      barColor: '#7a8ca8',
      avatarSize: 48,
      rankFontSize: 36,
      gradient: 'linear-gradient(180deg, rgba(122,140,168,0.18), transparent)',
    },
    {
      entry: entries[0],
      rank: 1,
      height: 120,
      barColor: '#ffb830',
      avatarSize: 64,
      rankFontSize: 48,
      glow: '0 0 24px #ffb83080',
      gradient: 'linear-gradient(180deg, rgba(255,184,48,0.2), transparent)',
    },
    {
      entry: entries[2],
      rank: 3,
      height: 90,
      barColor: '#c08040',
      avatarSize: 48,
      rankFontSize: 36,
      gradient: 'linear-gradient(180deg, rgba(192,128,64,0.18), transparent)',
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {cols.map((c) => (
        <PodiumColumn key={c.rank} {...c} color={color} currentUserId={currentUserId} />
      ))}
    </div>
  )
}

function PodiumColumn({
  entry,
  rank,
  height,
  barColor,
  avatarSize,
  rankFontSize,
  glow,
  gradient,
  color,
  currentUserId,
}: PodiumColumnDef & { color: string; currentUserId?: string }) {
  if (!entry) {
    // Empty placeholder keeps grid alignment when fewer than 3 entries
    return <div aria-hidden style={{ minHeight: height }} />
  }
  const isCurrentUser = entry.userId === currentUserId
  // Rank-specific glow class (Task 13-C): gold=amber, silver, bronze
  const rankGlowClass = rank === 1 ? 'glow-text-amber' : rank === 2 ? 'glow-text-silver' : rank === 3 ? 'glow-text-bronze' : ''
  return (
    <div
      className="flex flex-col items-center justify-end stagger-fade-in"
      style={{ animationDelay: `${(rank - 1) * 80}ms` }}
    >
      {/* Avatar */}
      <div
        className="rounded-full flex items-center justify-center font-display font-bold text-white mb-2 shrink-0"
        style={{
          width: avatarSize,
          height: avatarSize,
          background: entry.avatarColor,
          boxShadow: glow,
          fontSize: Math.round(avatarSize * 0.4),
        }}
      >
        {firstLetter(entry.name)}
      </div>
      {/* Name */}
      <div
        className="text-xs text-[#e8ecf5] truncate max-w-full px-1 mb-1 text-center"
        title={entry.name}
      >
        {entry.name}
      </div>
      {/* Value */}
      <div
        className={`font-display font-bold mb-2 ${rank === 1 ? 'text-2xl' : 'text-base'}`}
        style={{ color }}
      >
        {entry.valueLabel}
      </div>
      {/* Podium bar */}
      <div
        className="w-full rounded-t-lg flex items-start justify-center pt-3 relative sweep-highlight"
        style={{
          height,
          background: gradient,
          borderTop: `2px solid ${barColor}`,
        }}
      >
        <span
          className={`font-display font-bold leading-none ${rankGlowClass}`}
          style={{ fontSize: rankFontSize, color: barColor }}
        >
          {rank}
        </span>
        {isCurrentUser && (
          <span
            className="absolute top-1.5 right-1.5 tactical-badge badge-pulse"
            style={{ borderColor: '#ff3a28', color: '#ff3a28' }}
          >
            TÚ
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── List row ───────────────────────────────────────────────────────── */

function ListRow({
  entry,
  rank,
  color,
  isCurrentUser,
  index,
}: {
  entry: NormalizedEntry
  rank: number
  color: string
  isCurrentUser: boolean
  index: number
}) {
  // Defensive: gold left accent if rank 1 ever lands in the list
  const extraBorder = isCurrentUser
    ? 'border-l-2 border-l-[#ff3a28] bg-[var(--red-dim)]'
    : rank === 1
      ? 'border-l-2 border-l-[#ffb830]'
      : ''
  return (
    <div
      className={`stagger-fade-in flex items-center gap-3 px-3 py-3 rounded-lg border bg-[var(--bg-glass)] border-[var(--border-subtle)] transition-colors hover:border-[var(--border-glow)] ${extraBorder}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className="font-display font-bold text-sm w-6 text-center text-[#7a8ca8] tabular-nums shrink-0">
        {rank}
      </span>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-white text-sm shrink-0"
        style={{ background: entry.avatarColor }}
      >
        {firstLetter(entry.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[#e8ecf5] truncate font-medium leading-tight">
          {entry.name}
        </div>
        <div className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-wider mt-0.5">
          {entry.meta}
        </div>
      </div>
      {isCurrentUser && (
        <span
          className="tactical-badge badge-pulse shrink-0"
          style={{ borderColor: '#ff3a28', color: '#ff3a28' }}
        >
          TÚ
        </span>
      )}
      <div
        className="font-display font-bold text-lg tabular-nums shrink-0"
        style={{ color }}
      >
        {entry.valueLabel}
      </div>
    </div>
  )
}

/* ─── Current user card (sticky bottom) ──────────────────────────────── */

function CurrentUserCard({
  rank,
  valueLabel,
  color,
  categoryLabel,
  hasCompetition,
  hint,
}: {
  rank: number | null
  valueLabel: string
  color: string
  categoryLabel: string
  hasCompetition: boolean
  hint: string | null
}) {
  return (
    <div
      className="sticky bottom-0 z-20 px-4 pt-2 pb-3 bg-[rgba(10,14,26,0.95)] backdrop-blur-xl border-t border-[var(--border-subtle)]"
      style={{ paddingBottom: 'calc(12px + var(--safe-bottom))' }}
    >
      <div
        className="relative rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] border-l-2 border-l-[#ff3a28] px-4 py-3 overflow-hidden"
        style={{ boxShadow: '0 -4px 30px rgba(255,58,40,0.15)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(255,58,40,0.08), transparent 60%)' }}
        />
        {!hasCompetition ? (
          <div className="relative flex items-center gap-3">
            <Trophy size={20} className="text-[#7a8ca8] shrink-0" />
            <p className="text-xs text-[#7a8ca8] leading-snug">
              Completá una sesión en modo competencia para aparecer en el ranking
            </p>
          </div>
        ) : (
          <div className="relative flex items-center gap-3">
            <div className="flex flex-col min-w-0">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">
                TU POSICIÓN
              </span>
              {rank !== null ? (
                <span
                  className="font-display font-bold text-2xl leading-tight tabular-nums"
                  style={{ color }}
                >
                  #{rank}
                </span>
              ) : hint ? (
                <span className="text-[#ffb830] text-xs font-medium leading-tight mt-0.5">
                  {hint}
                </span>
              ) : (
                <span className="text-[#7a8ca8] text-sm font-medium leading-tight mt-0.5">
                  Fuera del top 10
                </span>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex flex-col items-end shrink-0">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">
                {categoryLabel}
              </span>
              <span
                className="font-display font-bold text-xl tabular-nums leading-tight"
                style={{ color }}
              >
                {valueLabel}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Loading ────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="space-y-4">
      {/* Skeleton podium */}
      <div className="grid grid-cols-3 gap-2 items-end">
        <SkeletonColumn height={100} avatarSize={48} />
        <SkeletonColumn height={120} avatarSize={64} />
        <SkeletonColumn height={90} avatarSize={48} />
      </div>
      {/* Skeleton rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3 rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] animate-pulse"
          >
            <div className="w-6 h-3 rounded bg-[var(--border-subtle)]" />
            <div className="w-9 h-9 rounded-full bg-[var(--border-subtle)]" />
            <div className="flex-1 space-y-1.5">
              <div className="w-24 h-3 rounded bg-[var(--border-subtle)]" />
              <div className="w-16 h-2 rounded bg-[var(--border-subtle)]" />
            </div>
            <div className="w-10 h-5 rounded bg-[var(--border-subtle)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonColumn({ height, avatarSize }: { height: number; avatarSize: number }) {
  return (
    <div className="flex flex-col items-center justify-end">
      <div
        className="rounded-full bg-[var(--bg-glass)] mb-2 animate-pulse"
        style={{ width: avatarSize, height: avatarSize }}
      />
      <div className="w-16 h-3 rounded bg-[var(--bg-glass)] mb-2 animate-pulse" />
      <div className="w-12 h-4 rounded bg-[var(--bg-glass)] mb-2 animate-pulse" />
      <div
        className="w-full rounded-t-lg bg-[var(--bg-glass)] animate-pulse"
        style={{ height }}
      />
    </div>
  )
}

/* ─── Empty ──────────────────────────────────────────────────────────── */

function EmptyCategory() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Medal size={48} className="text-[#3d4f68] mb-4" />
      <p className="font-display text-base text-[#e8ecf5] mb-1 tracking-wider">SIN DATOS</p>
      <p className="text-sm text-[#7a8ca8] max-w-xs">
        Aún no hay datos en esta categoría
      </p>
    </div>
  )
}
