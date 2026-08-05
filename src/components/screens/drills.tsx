'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import type { Tab } from './main-app'
import { DRILL_DEFINITIONS, type DrillDefinition, type DrillType } from '@/lib/types'
import { showToast } from '@/components/shared/toast'
import { ChevronLeft, ChevronDown, Check, Info, Target, Zap, Crosshair, Flame, Trophy, X } from 'lucide-react'

// ── Drill type → visual config ──────────────────────────
const DRILL_VISUAL: Record<
  DrillType,
  { gradient: string; glow: string; ring: string; Icon: typeof Target }
> = {
  bullseye:  { gradient: 'linear-gradient(135deg, #ff3a28, #ff7240)', glow: '#ff3a28', ring: 'rgba(255,58,40,0.4)',  Icon: Target },
  speed:     { gradient: 'linear-gradient(135deg, #ffb830, #ffd060)', glow: '#ffb830', ring: 'rgba(255,184,48,0.4)', Icon: Zap },
  precision: { gradient: 'linear-gradient(135deg, #00e5ff, #4da6ff)', glow: '#00e5ff', ring: 'rgba(0,229,255,0.4)',  Icon: Crosshair },
  rapid:     { gradient: 'linear-gradient(135deg, #39ff7a, #00e5ff)', glow: '#39ff7a', ring: 'rgba(57,255,122,0.4)', Icon: Flame },
  marksman:  { gradient: 'linear-gradient(135deg, #ff3a28, #ffb830)', glow: '#ff3a28', ring: 'rgba(255,58,40,0.4)',  Icon: Trophy },
}

// ── API record shape ────────────────────────────────────
interface DrillRecord {
  drillType: string
  bestScore: number
  bestAvg: number
  passedCount: number
  attempts: number
  lastAttemptAt: string
}

// ── Animated count-up hook ──────────────────────────────
function useCountUp(target: number, duration = 600) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic — when target is 0 this stays at 0
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

// ── Mini stat tile (with count-up) ──────────────────────
function MiniStat({
  label,
  value,
  suffix,
  color,
  delay,
}: {
  label: string
  value: number
  suffix?: string
  color: string
  delay: number
}) {
  const v = useCountUp(value)
  // Map stat color → glow-text class (Task 13-C)
  const glowClass =
    color === '#00e5ff' ? 'glow-text-cyan'
      : color === '#39ff7a' ? 'glow-text-green'
        : color === '#ffb830' ? 'glow-text-amber'
          : ''
  return (
    <div
      className="stat-card-glow stagger-fade-in relative flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-2 py-3 backdrop-blur-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`font-display text-2xl font-bold leading-none count-up-animate ${glowClass}`}
        style={{ color, textShadow: `0 0 16px ${color}66` }}
      >
        {v}
        {suffix}
      </div>
      <div className="mt-1.5 font-mono-tactical text-[9px] tracking-[0.12em] text-[#7a8ca8]">
        {label}
      </div>
    </div>
  )
}

// ── Skeleton card ───────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="tactical-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 rounded-full bg-[#1a2438]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-[#1a2438]" />
          <div className="h-3 w-2/3 rounded bg-[#1a2438]" />
          <div className="h-3 w-1/4 rounded bg-[#1a2438]" />
        </div>
      </div>
      <div className="mt-4 h-10 rounded-xl bg-[#1a2438]" />
    </div>
  )
}

// ── Drill card ──────────────────────────────────────────
function DrillCard({
  drill,
  record,
  index,
  onStart,
}: {
  drill: DrillDefinition
  record: DrillRecord | undefined
  index: number
  onStart: () => void
}) {
  const [tipsOpen, setTipsOpen] = useState(false)
  const visual = DRILL_VISUAL[drill.type]
  const Icon = visual.Icon
  const hasRecord = !!record

  const handleStart = () => {
    useAppStore.getState().setActiveDrill({ type: drill.type, goal: drill.goal })
    // Initialize a fresh live session for the drill (competition mode for scoring)
    useAppStore.getState().setLiveSession({
      trainingMode: false,
      shots: [],
      totalScore: 0,
      durationSec: 0,
      bestScore: 0,
      avgScore: 0,
      shotCount: 0,
      targetSize: useAppStore.getState().settings.targetSize,
      distanceM: 0,
      startTime: Date.now(),
      weather: null,
      drillType: drill.type,
      drillGoal: drill.goal,
    })
    showToast(`${drill.name} iniciado — ¡prepará tu puntería!`, 'info')
    onStart()
  }

  return (
    <div
      className="tactical-card-enhanced stagger-fade-in p-4"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header row: icon + content */}
      <div className="flex items-start gap-3.5">
        {/* Icon circle */}
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full corner-bracket corner-bracket-br"
          style={{
            background: visual.gradient,
            boxShadow: `0 0 20px ${visual.ring}`,
          }}
        >
          {/* Radar ping (Task 13-C) — small expanding ring centered on the icon */}
          <span className="radar-ping" aria-hidden="true" />
          <span className="text-2xl leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
            {drill.icon}
          </span>
          {/* Subtle ring overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold tracking-wide text-[#e8ecf5]">
              {drill.name}
            </h3>
          </div>
          <p className="mt-0.5 text-sm leading-snug text-[#7a8ca8]">
            {drill.description}
          </p>

          {/* Pass criteria badge */}
          <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#ffb830]/40 bg-[#ffb830]/10 px-2 py-0.5">
            <Check className="h-3 w-3 text-[#ffb830]" strokeWidth={3} />
            <span className="font-mono-tactical text-[10px] tracking-[0.1em] text-[#ffb830]">
              {drill.passLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row: best / attempts / passed */}
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[#060910]/60 px-2.5 py-2">
          <div className="font-mono-tactical text-[8px] tracking-[0.12em] text-[#7a8ca8]">
            MEJOR
          </div>
          <div
            className="font-display text-lg font-bold leading-tight"
            style={
              hasRecord
                ? { color: '#39ff7a', textShadow: '0 0 12px rgba(57,255,122,0.45)' }
                : { color: '#3d4f68' }
            }
          >
            {hasRecord ? record!.bestScore : '—'}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[#060910]/60 px-2.5 py-2">
          <div className="font-mono-tactical text-[8px] tracking-[0.12em] text-[#7a8ca8]">
            INTENTOS
          </div>
          <div className="font-display text-lg font-bold leading-tight text-[#e8ecf5]">
            {hasRecord ? record!.attempts : 0}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[#060910]/60 px-2.5 py-2">
          <div className="font-mono-tactical text-[8px] tracking-[0.12em] text-[#7a8ca8]">
            APROBADO
          </div>
          <div className="flex items-center gap-1">
            {hasRecord && record!.passedCount > 0 ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#39ff7a]" strokeWidth={3} />
                <span
                  className="font-display text-lg font-bold leading-tight text-[#39ff7a]"
                  style={{ textShadow: '0 0 10px rgba(57,255,122,0.4)' }}
                >
                  {record!.passedCount}x
                </span>
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5 text-[#3d4f68]" strokeWidth={3} />
                <span className="font-display text-lg font-bold leading-tight text-[#3d4f68]">
                  0
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {!hasRecord && (
        <div className="mt-2 text-center font-mono-tactical text-[10px] tracking-[0.12em] text-[#3d4f68]">
          SIN REGISTROS
        </div>
      )}

      {/* Tips expandable */}
      <button
        onClick={() => setTipsOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-3 py-2 text-left transition-colors hover:border-[var(--border-glow)]"
        aria-expanded={tipsOpen}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#7a8ca8]">
          <Info className="h-3.5 w-3.5 text-[#00e5ff]" />
          CONSEJOS TÁCTICOS
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#7a8ca8] transition-transform duration-300 ${tipsOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: tipsOpen ? 200 : 0 }}
      >
        <ul className="mt-2 space-y-1.5 pl-1">
          {drill.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#a8b8d0]">
              <span className="mt-0.5 font-mono-tactical text-[#00e5ff]">›</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        className="start-btn-pulse tactical-pulse relative mt-4 w-full cursor-pointer overflow-hidden rounded-xl border-0 transition-transform active:scale-[0.97]"
        style={{
          background: 'linear-gradient(135deg, #cc1a0a 0%, #ff3a28 50%, #ff7240 100%)',
        }}
      >
        <div className="relative z-10 flex items-center justify-center gap-2.5 px-4 py-3">
          <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
          <span className="font-display text-sm font-bold tracking-[0.14em] text-white">
            INICIAR DESAFÍO
          </span>
        </div>
        {/* Shimmer sweep overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 55%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s linear infinite',
          }}
        />
      </button>
    </div>
  )
}

// ── Main screen ─────────────────────────────────────────
export function DrillsScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [records, setRecords] = useState<Record<string, DrillRecord>>({})
  const [stats, setStats] = useState({ totalAttempts: 0, totalPassed: 0, passRate: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/drills', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const map: Record<string, DrillRecord> = {}
        for (const r of data.records || []) map[r.drillType] = r
        setRecords(map)
        setStats(data.stats || { totalAttempts: 0, totalPassed: 0, passRate: 0 })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasAnyRecord = Object.keys(records).length > 0

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0e1a]">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[#0a0e1a]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => onNavigate('menu')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8] transition-colors hover:border-[var(--border-glow)] hover:text-[#ff3a28]"
            aria-label="Volver al menú"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold tracking-[0.18em] text-[#e8ecf5]">
              ENTRENAMIENTOS
            </h1>
            <p className="font-mono-tactical text-[10px] tracking-[0.18em] text-[#7a8ca8]">
              DESAFÍOS DE PRECISIÓN
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ff3a28]/30 bg-[#ff3a28]/10">
            <Target className="h-4 w-4 text-[#ff3a28]" />
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        {/* Stats summary card */}
        <section className="stagger-fade-in tactical-card p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="h-3 w-1 rounded-full bg-[#ff3a28]" />
            <h2 className="font-mono-tactical text-[10px] tracking-[0.18em] text-[#7a8ca8]">
              RESUMEN DE RENDIMIENTO
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <MiniStat
              label="TOTAL INTENTOS"
              value={stats.totalAttempts}
              color="#00e5ff"
              delay={0}
            />
            <MiniStat
              label="APROBADOS"
              value={stats.totalPassed}
              color="#39ff7a"
              delay={80}
            />
            <MiniStat
              label="TASA DE ÉXITO"
              value={stats.passRate}
              suffix="%"
              color="#ffb830"
              delay={160}
            />
          </div>
        </section>

        {/* Drill cards section */}
        <section className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-3 w-1 rounded-full bg-[#ffb830]" />
            <h2 className="font-mono-tactical text-[10px] tracking-[0.18em] text-[#7a8ca8]">
              DESAFÍOS DISPONIBLES
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {DRILL_DEFINITIONS.map((drill, i) => (
                  <DrillCard
                    key={drill.type}
                    drill={drill}
                    record={records[drill.type]}
                    index={i}
                    onStart={() => onNavigate('scan')}
                  />
                ))}
              </div>

              {/* Empty state hint */}
              {!hasAnyRecord && (
                <div className="stagger-fade-in mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-glass)]/50 px-4 py-3 text-center">
                  <Info className="h-4 w-4 shrink-0 text-[#00e5ff]" />
                  <p className="text-xs text-[#7a8ca8]">
                    Completá un desafío para ver tus records aquí
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* Footer note */}
        <footer
          className="mt-6 flex items-center justify-center gap-2 px-4 pb-2 pt-2 text-center"
          style={{ marginBottom: 'calc(20px + var(--safe-bottom))' }}
        >
          <Info className="h-3.5 w-3.5 text-[#3d4f68]" />
          <p className="font-mono-tactical text-[10px] tracking-[0.1em] text-[#3d4f68]">
            Los desafíos se evalúan al finalizar la sesión
          </p>
        </footer>
      </main>
    </div>
  )
}
