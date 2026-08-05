'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Tab } from './main-app'
import { ShotHeatMap } from '@/components/shared/shot-heatmap'
import { ArrowLeft, Flame, Target, Calendar, Hash, MapPin } from 'lucide-react'

interface HeatmapScreenProps {
  onNavigate: (tab: Tab) => void
}

interface SessionWithShots {
  id: string
  trainingMode: boolean
  totalScore: number
  shotCount: number
  createdAt: string
  drillType?: string | null
  shots: Array<{
    index: number
    x: number
    y: number
    radius: number
    score: number
  }>
}

type DateRange = '7d' | '30d' | 'all'
type SessionFilter = 'all' | 'competition' | 'training'

const DATE_LABELS: Record<DateRange, string> = {
  '7d': '7 DÍAS',
  '30d': '30 DÍAS',
  'all': 'TODO',
}

const SESSION_LABELS: Record<SessionFilter, string> = {
  all: 'TODAS',
  competition: 'COMPETENCIA',
  training: 'ENTRENAMIENTO',
}

export function HeatmapScreen({ onNavigate }: HeatmapScreenProps) {
  const [allSessions, setAllSessions] = useState<SessionWithShots[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all')

  // Fetch all sessions with their shots
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 3

    const fetchData = async () => {
      attempts++
      try {
        // First, get the list of sessions
        const listRes = await fetch('/api/sessions', { credentials: 'include' })
        if (!listRes.ok) {
          if (attempts < maxAttempts && (listRes.status === 401 || listRes.status >= 500)) {
            setTimeout(fetchData, 1000 * attempts)
            return
          }
          setLoading(false)
          return
        }

        const sessionsList: Array<{
          id: string
          trainingMode: boolean
          totalScore: number
          shotCount: number
          createdAt: string
          drillType?: string | null
          shotsCount?: number
        }> = await listRes.json()

        // Then fetch each session's shots in parallel (batch of 5)
        const sessionsWithShots: SessionWithShots[] = []
        const batchSize = 5
        for (let i = 0; i < sessionsList.length; i += batchSize) {
          const batch = sessionsList.slice(i, i + batchSize)
          const results = await Promise.allSettled(
            batch.map(async (s) => {
              const res = await fetch(`/api/sessions/${s.id}`, { credentials: 'include' })
              if (!res.ok) return null
              return res.json() as Promise<SessionWithShots>
            })
          )
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              sessionsWithShots.push(result.value)
            }
          }
        }

        if (!cancelled) {
          setAllSessions(sessionsWithShots)
          setLoading(false)
        }
      } catch {
        if (!cancelled && attempts < maxAttempts) {
          setTimeout(fetchData, 1000 * attempts)
        } else {
          setLoading(false)
        }
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  // Filter sessions by date range and session type
  const filteredSessions = useMemo(() => {
    const now = Date.now()
    const msDay = 86400000

    return allSessions.filter((s) => {
      // Date filter
      if (dateRange !== 'all') {
        const sessionDate = new Date(s.createdAt).getTime()
        const daysBack = dateRange === '7d' ? 7 : 30
        if (sessionDate < now - daysBack * msDay) return false
      }

      // Session type filter
      if (sessionFilter === 'competition') {
        // Competition = not training mode AND not a drill
        if (s.trainingMode || s.drillType) return false
      } else if (sessionFilter === 'training') {
        // Training = training mode OR any drill type
        if (!s.trainingMode && !s.drillType) return false
      }

      return true
    })
  }, [allSessions, dateRange, sessionFilter])

  // Aggregate all shots from filtered sessions
  const allShots = useMemo(() => {
    const shots: Array<{ x: number; y: number; score: number }> = []
    for (const session of filteredSessions) {
      for (const shot of session.shots) {
        shots.push({ x: shot.x, y: shot.y, score: shot.score })
      }
    }
    return shots
  }, [filteredSessions])

  // Determine the coordinate space (use a standard 320x320 canvas as reference)
  const COORD_SPACE = { width: 320, height: 320 }

  // Compute which ring zone has the most shots
  const densestRing = useMemo(() => {
    if (allShots.length === 0) return null
    const ringCounts: Record<number, number> = {}
    for (let i = 1; i <= 10; i++) ringCounts[i] = 0
    for (const shot of allShots) {
      const ring = Math.max(1, Math.min(10, shot.score || 1))
      ringCounts[ring] = (ringCounts[ring] || 0) + 1
    }
    let maxRing = 1
    let maxCount = 0
    for (let i = 1; i <= 10; i++) {
      if (ringCounts[i] > maxCount) {
        maxCount = ringCounts[i]
        maxRing = i
      }
    }
    return { ring: maxRing, count: maxCount }
  }, [allShots])

  return (
    <div className="min-h-screen bg-[#060910] text-[#e8ecf5] flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ paddingTop: 'calc(12px + var(--safe-top))', background: 'rgba(6,9,16,0.92)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => onNavigate('menu')}
          className="w-[38px] h-[38px] rounded-lg flex items-center justify-center bg-[var(--bg-glass)] border border-[var(--border-subtle)] hover:border-[var(--border-glow)] transition-colors cursor-pointer"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold tracking-[0.08em] text-base text-[#e8ecf5]">
            MAPA DE CALOR
          </h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68]">
            DENSIDAD DE IMPACTOS
          </p>
        </div>
        <Flame size={22} className="text-[#ff3a28]" />
      </header>

      {/* Filters */}
      <div className="px-4 mt-2 space-y-2">
        {/* Date range filter */}
        <div className="flex gap-2">
          {(Object.keys(DATE_LABELS) as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`flex-1 py-2 rounded-lg text-xs font-display tracking-[0.06em] transition-all cursor-pointer border ${
                dateRange === range
                  ? 'tactical-btn tactical-btn-primary'
                  : 'tactical-btn tactical-btn-secondary'
              }`}
            >
              {DATE_LABELS[range]}
            </button>
          ))}
        </div>

        {/* Session type filter */}
        <div className="flex gap-2">
          {(Object.keys(SESSION_LABELS) as SessionFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setSessionFilter(filter)}
              className={`flex-1 py-2 rounded-lg text-xs font-display tracking-[0.06em] transition-all cursor-pointer border ${
                sessionFilter === filter
                  ? 'tactical-btn tactical-btn-primary'
                  : 'tactical-btn tactical-btn-secondary'
              }`}
            >
              {SESSION_LABELS[filter]}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 mt-3">
        {loading ? (
          <LoadingState />
        ) : allShots.length === 0 ? (
          <EmptyState onNavigate={onNavigate} />
        ) : (
          <>
            {/* Heat map */}
            <div className="tactical-card p-3">
              <ShotHeatMap
                shots={allShots}
                coordSpace={COORD_SPACE}
                width={640}
                height={640}
              />
            </div>

            {/* Summary stats */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatCard
                icon={<Hash size={14} className="text-[#00e5ff]" />}
                label="IMPACTOS"
                value={String(allShots.length)}
                color="#00e5ff"
              />
              <StatCard
                icon={<Calendar size={14} className="text-[#ffb830]" />}
                label="SESIONES"
                value={String(filteredSessions.length)}
                color="#ffb830"
              />
              <StatCard
                icon={<MapPin size={14} className="text-[#ff3a28]" />}
                label="ZONA TOP"
                value={densestRing ? `Anillo ${densestRing.ring}` : '—'}
                color="#ff3a28"
              />
            </div>

            {/* Densest ring detail */}
            {densestRing && (
              <div className="mt-2 tactical-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-[#39ff7a]" />
                  <span className="font-mono-tactical text-[10px] text-[#3d4f68]">
                    ZONA DE MAYOR DENSIDAD
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm text-[#39ff7a]">
                    Anillo {densestRing.ring}
                  </span>
                  <span className="font-mono-tactical text-[10px] text-[#3d4f68]">
                    ({densestRing.count} impactos)
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom safe area spacer */}
      <div style={{ paddingBottom: 'var(--safe-bottom)' }} />
    </div>
  )
}

/** Small stat card used in the summary row. */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="tactical-card p-3 flex flex-col items-center gap-1">
      {icon}
      <span className="font-display font-bold text-base" style={{ color }}>
        {value}
      </span>
      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.06em]">
        {label}
      </span>
    </div>
  )
}

/** Loading skeleton. */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {/* Animated flame spinner */}
      <div className="relative">
        <Flame size={48} className="text-[#ff3a28] animate-pulse" />
      </div>
      <p className="font-display text-sm tracking-[0.08em] text-[#3d4f68]">
        CARGANDO MAPA DE CALOR...
      </p>
      {/* Skeleton cards */}
      <div className="w-full mt-4 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="tactical-card p-3 h-20 animate-pulse rounded-lg" style={{ background: 'rgba(13,20,36,0.6)' }} />
        ))}
      </div>
    </div>
  )
}

/** Empty state when no shots are available. */
function EmptyState({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Target size={56} className="text-[#3d4f68]" />
      <div className="text-center">
        <p className="font-display text-sm tracking-[0.08em] text-[#e8ecf5]">
          SIN DATOS
        </p>
        <p className="font-mono-tactical text-[10px] text-[#3d4f68] mt-1">
          No hay impactos para mostrar en el mapa de calor
        </p>
      </div>
      <button
        onClick={() => onNavigate('menu')}
        className="tactical-btn tactical-btn-secondary mt-4 px-6 py-2 text-xs font-display tracking-[0.06em] cursor-pointer border"
      >
        VOLVER AL MENÚ
      </button>
    </div>
  )
}
