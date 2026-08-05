'use client'

import { useEffect, useRef, useState } from 'react'
import type { Tab } from './main-app'
import { scoreColor } from '@/lib/types'
import { ArrowLeft, Target } from 'lucide-react'

interface StatsScreenProps {
  onNavigate: (tab: Tab) => void
}

interface SessionAnalyticsItem {
  id: string
  createdAt: string
  totalScore: number
  bestScore: number
  avgScore: number
  shotCount: number
  durationSec: number
  trainingMode: boolean
}

interface AchievementItem {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: string
}

interface AnalyticsData {
  sessions: SessionAnalyticsItem[]
  scoreDistribution: Record<string, number>
  achievements: AchievementItem[]
  streak: { current: number; best: number; lastSessionDate: string | null }
  totals: {
    sessions: number
    shots: number
    bestScore: number
    avgScore: number
    totalDurationSec: number
    bullseyes: number
  }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

/** Short date: dd/mm */
const fmtDateShort = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function StatsScreen({ onNavigate }: StatsScreenProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 3

    const fetchAnalytics = () => {
      attempts++
      let gotData = false
      fetch('/api/sessions/analytics', { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) {
            // Retry on auth or server errors (compilation timing issue)
            if (attempts < maxAttempts && (res.status === 401 || res.status >= 500)) {
              setTimeout(fetchAnalytics, 1000 * attempts)
              return null
            }
            return null
          }
          return res.json()
        })
        .then((json: AnalyticsData | null) => {
          if (cancelled) return
          if (json) {
            gotData = true
            setData(json)
          }
        })
        .catch(() => {
          if (!cancelled && attempts < maxAttempts) {
            setTimeout(fetchAnalytics, 1000 * attempts)
          }
        })
        .finally(() => {
          if (cancelled) return
          if (gotData || attempts >= maxAttempts) {
            setLoading(false)
          }
        })
    }

    fetchAnalytics()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4 bg-[rgba(10,14,26,0.9)] backdrop-blur-xl border-b border-[var(--border-subtle)]"
        style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
      >
        <button
          onClick={() => onNavigate('menu')}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28]"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base tracking-[0.1em] glitch-text">ESTADÍSTICAS</h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">
            ANÁLISIS DE RENDIMIENTO
          </p>
        </div>
      </header>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 data-grid-bg"
        style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}
      >
        {loading ? (
          <LoadingState />
        ) : !data || data.totals.sessions === 0 ? (
          <EmptyState onNavigate={onNavigate} />
        ) : (
          <>
            <SectionResumen totals={data.totals} />
            <SectionPerformance totals={data.totals} sessionCount={data.totals.sessions} />
            <SectionTrend sessions={data.sessions} />
            <SectionDistribution distribution={data.scoreDistribution} totalShots={data.totals.shots} />
            <SectionFrequency sessions={data.sessions} />
            <SectionStreak streak={data.streak} />
            <SectionAchievements achievements={data.achievements} />
          </>
        )}
      </div>
    </div>
  )
}

export default StatsScreen

/* ─── Loading ─────────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative w-[56px] h-[56px] flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-[1.5px] border-[#ff3a28]"
          style={{ animation: 'crosshairSpin 2s linear infinite' }}
        />
        <div className="absolute left-0 right-0 h-px bg-[#ff3a28]" style={{ boxShadow: '0 0 6px #ff3a28' }} />
        <div className="absolute top-0 bottom-0 w-px bg-[#ff3a28]" style={{ boxShadow: '0 0 6px #ff3a28' }} />
        <div
          className="w-2 h-2 rounded-full bg-[#ff3a28]"
          style={{ boxShadow: '0 0 8px #ff3a28', animation: 'pulseRing 1.5s ease-in-out infinite' }}
        />
      </div>
      <p className="font-mono-tactical text-[11px] text-[#7a8ca8] tracking-[0.2em]">CARGANDO…</p>
    </div>
  )
}

/* ─── Empty ───────────────────────────────────────────────────────────────── */

function EmptyState({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Target size={48} className="text-[#3d4f68] mb-4" />
      <p className="font-display text-base text-[#e8ecf5] mb-1">SIN DATOS</p>
      <p className="text-sm text-[#7a8ca8] mb-6 max-w-xs">
        Aún no tienes sesiones registradas. Inicia tu primera sesión para ver tus estadísticas aquí.
      </p>
      <button onClick={() => onNavigate('menu')} className="tactical-btn tactical-btn-primary">
        INICIAR SESIÓN
      </button>
    </div>
  )
}

/* ─── Section heading helper ─────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-bold text-sm tracking-[0.1em] border-l-2 border-l-[#ff3a28] pl-3">
      {children}
    </h2>
  )
}

/* ─── Section 1: Resumen ──────────────────────────────────────────────────── */

function SectionResumen({ totals }: { totals: AnalyticsData['totals'] }) {
  const cards: Array<{ value: number | string; label: string; color: string }> = [
    { value: totals.sessions, label: 'SESIONES', color: '#00e5ff' },
    { value: totals.shots, label: 'DISPAROS', color: '#ff3a28' },
    { value: totals.bestScore || '—', label: 'MEJOR TIRO', color: '#ffb830' },
    { value: totals.bullseyes, label: 'DIANA', color: '#39ff7a' },
  ]
  return (
    <section className="grid grid-cols-2 gap-2.5 stagger-fade-in" style={{ animationDelay: '0ms' }}>
      {cards.map((c) => (
        <div key={c.label} className="tactical-card-enhanced p-4 flex flex-col items-center gap-1">
          <span
            className="font-display font-bold text-3xl"
            style={{ color: c.color, textShadow: `0 0 12px ${c.color}40` }}
          >
            {c.value}
          </span>
          <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">{c.label}</span>
        </div>
      ))}
    </section>
  )
}

/* ─── Section: Performance Rating (Índice de Rendimiento) ────────────────── */

function SectionPerformance({ totals, sessionCount }: { totals: AnalyticsData['totals']; sessionCount: number }) {
  // Calculate rating 0-100
  // avgScore weight 40% (avgScore is 0-10, normalize to 0-100)
  // bestScore weight 20% (0-10 → 0-100)
  // bullseyes/totalShots weight 20% (0-1 → 0-100)
  // sessionCount weight 20% (cap at 50 sessions → 0-100)
  const avgNorm = (totals.avgScore / 10) * 100
  const bestNorm = (totals.bestScore / 10) * 100
  const bullseyeRatio = totals.shots > 0 ? (totals.bullseyes / totals.shots) * 100 : 0
  const sessionNorm = Math.min(sessionCount / 50, 1) * 100

  const rating = Math.round(avgNorm * 0.4 + bestNorm * 0.2 + bullseyeRatio * 0.2 + sessionNorm * 0.2)
  const clamped = Math.max(0, Math.min(100, rating))

  // Color based on rating
  const ringColor = clamped > 75 ? '#39ff7a' : clamped > 50 ? '#ffb830' : '#ff3a28'
  const ringGlow = clamped > 75 ? 'rgba(57,255,122,0.3)' : clamped > 50 ? 'rgba(255,184,0,0.3)' : 'rgba(255,58,40,0.3)'
  // Glow-text class matching the rating tier (Task 13-C)
  const ringGlowClass = clamped > 75 ? 'glow-text-green' : clamped > 50 ? 'glow-text-amber' : 'glow-text-red'

  // SVG circular ring
  const R = 54
  const circumference = 2 * Math.PI * R
  const offset = circumference * (1 - clamped / 100)

  return (
    <section className="tactical-card-enhanced p-4 stagger-fade-in hud-frame animated-border" style={{ animationDelay: '60ms' }}>
      <SectionHeading>ÍNDICE DE RENDIMIENTO</SectionHeading>
      <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mb-3 pl-5">
        PUNTUACIÓN COMPUESTA 0-100
      </p>
      <div className="flex items-center justify-center py-2">
        <div className="relative w-[140px] h-[140px] flex items-center justify-center">
          <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background ring */}
            <circle cx={60} cy={60} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
            {/* Progress ring */}
            <circle
              cx={60}
              cy={60}
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="ring-animated"
              style={{
                ['--ring-circumference' as string]: circumference,
                ['--ring-offset' as string]: offset,
                filter: `drop-shadow(0 0 4px ${ringGlow})`,
              }}
            />
          </svg>
          {/* Center number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-display font-bold text-4xl number-glow ${ringGlowClass}`}
              style={{ color: ringColor, textShadow: `0 0 16px ${ringGlow}` }}
            >
              {clamped}
            </span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">/100</span>
          </div>
        </div>
      </div>
      {/* Sub-metrics */}
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        {[
          { label: 'PROM', value: Math.round(avgNorm), pct: 40 },
          { label: 'MEJOR', value: Math.round(bestNorm), pct: 20 },
          { label: 'DIANA', value: Math.round(bullseyeRatio), pct: 20 },
          { label: 'SESS', value: Math.round(sessionNorm), pct: 20 },
        ].map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-0.5">
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.12em]">{m.label}</span>
            <span className="font-display font-bold text-sm text-[#e8ecf5]">{m.value}</span>
            <span className="font-mono-tactical text-[7px] text-[#3d4f68]">({m.pct}%)</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── Section 2: Tendencia de Puntaje (SVG line chart) ────────────────────── */

function SectionTrend({ sessions }: { sessions: SessionAnalyticsItem[] }) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Take last 12 sessions, oldest → newest
  const last = sessions.slice(0, 12).reverse()
  const scores = last.map((s) => s.totalScore)
  const maxScore = Math.max(10, ...scores)

  // SVG layout constants
  const W = 300
  const H = 150
  const padL = 22
  const padR = 18
  const padT = 22
  const padB = 30
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const points = last.map((s, i) => {
    const x = padL + (last.length === 1 ? innerW / 2 : (i / (last.length - 1)) * innerW)
    const y = padT + (1 - s.totalScore / maxScore) * innerH
    return { x, y, score: s.totalScore, date: s.createdAt }
  })

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  // Build area fill polygon (line points + bottom-right + bottom-left)
  const areaPoints =
    points.map((p) => `${p.x},${p.y}`).join(' ') +
    ` ${points[points.length - 1]?.x ?? 0},${padT + innerH} ${points[0]?.x ?? 0},${padT + innerH}`

  // Calculate approximate polyline length for stroke-dasharray animation
  let lineLength = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    lineLength += Math.sqrt(dx * dx + dy * dy)
  }

  return (
    <section className="tactical-card-enhanced p-4 stagger-fade-in" style={{ animationDelay: '120ms' }}>
      <SectionHeading>TENDENCIA DE PUNTAJE</SectionHeading>
      <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mb-3 pl-5">
        ÚLTIMAS {last.length} SESIONES
      </p>

      {last.length < 2 ? (
        <div className="py-8 text-center text-xs text-[#7a8ca8]">
          Necesitas al menos 2 sesiones para ver la tendencia
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Tendencia de puntaje por sesión"
        >
          <defs>
            {/* Area gradient */}
            <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,58,40,0.15)" />
              <stop offset="100%" stopColor="rgba(255,58,40,0)" />
            </linearGradient>
            {/* Glow filter for line */}
            <filter id="trendGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal baseline gridlines */}
          <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <line
            x1={padL}
            y1={padT + innerH / 2}
            x2={W - padR}
            y2={padT + innerH / 2}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

          {/* Vertical dotted gridlines for each data point */}
          {points.map((p, i) => (
            <line
              key={`grid-${i}`}
              x1={p.x}
              y1={padT}
              x2={p.x}
              y2={padT + innerH}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          {/* Y-axis labels (0 and max) */}
          <text
            x={padL - 4}
            y={padT + 3}
            fill="#3d4f68"
            fontSize="8"
            textAnchor="end"
            fontFamily="var(--font-share-tech), monospace"
          >
            {maxScore}
          </text>
          <text
            x={padL - 4}
            y={padT + innerH + 3}
            fill="#3d4f68"
            fontSize="8"
            textAnchor="end"
            fontFamily="var(--font-share-tech), monospace"
          >
            0
          </text>

          {/* Area fill below the line */}
          <polygon points={areaPoints} fill="url(#trendAreaGrad)" />

          {/* Trend line with glow filter and draw animation */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#ff3a28"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#trendGlow)"
            strokeDasharray={lineLength}
            strokeDashoffset={lineLength}
            className="trend-line-draw"
            style={{ ['--line-length' as string]: lineLength }}
          />

          {/* Points + score labels + date labels */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={2.8} fill="#ff3a28" stroke="#0a0e1a" strokeWidth={0.8} />
              <text
                x={p.x}
                y={p.y - 7}
                fill="#ff3a28"
                fontSize="9"
                textAnchor="middle"
                fontFamily="var(--font-share-tech), monospace"
              >
                {p.score}
              </text>
              {/* Date label below: dd/mm format */}
              <text
                x={p.x}
                y={H - 6}
                fill="#3d4f68"
                fontSize="7"
                textAnchor="middle"
                fontFamily="var(--font-share-tech), monospace"
              >
                {fmtDateShort(p.date)}
              </text>
            </g>
          ))}
        </svg>
      )}
    </section>
  )
}

/* ─── Section 3: Distribución de Puntajes (horizontal bars) ───────────────── */

function SectionDistribution({
  distribution,
  totalShots,
}: {
  distribution: Record<string, number>
  totalShots: number
}) {
  const scores = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  const maxCount = Math.max(1, ...scores.map((s) => distribution[String(s)] || 0))

  // Compute total from distribution for display
  const distTotal = scores.reduce((sum, s) => sum + (distribution[String(s)] || 0), 0)

  return (
    <section className="tactical-card-enhanced p-4 stagger-fade-in" style={{ animationDelay: '180ms' }}>
      <SectionHeading>DISTRIBUCIÓN DE PUNTAJES</SectionHeading>
      <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mb-3 pl-5">
        IMPACTOS POR VALOR
      </p>
      <div className="space-y-1.5">
        {scores.map((score) => {
          const count = distribution[String(score)] || 0
          const pct = (count / maxCount) * 100
          const pctOfTotal = distTotal > 0 ? ((count / distTotal) * 100).toFixed(1) : '0.0'
          const color = scoreColor(score)
          return (
            <div key={score} className="flex items-center gap-2">
              <span className="font-mono-tactical text-[10px] text-[#7a8ca8] w-4 text-center">{score}</span>
              <div className="flex-1 h-3.5 bg-[var(--bg-glass)] rounded-sm overflow-hidden relative">
                <div
                  className="h-full rounded-sm transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    boxShadow: count > 0 ? `0 0 8px ${color}60, inset 0 0 4px ${color}30` : 'none',
                  }}
                />
              </div>
              <span className="font-mono-tactical text-[10px] text-[#e8ecf5] w-5 text-right">{count}</span>
              {count > 0 && (
                <span className="font-mono-tactical text-[8px] text-[#3d4f68] w-8 text-right">{pctOfTotal}%</span>
              )}
              {count === 0 && <span className="w-8" />}
            </div>
          )
        })}
      </div>
      {/* Total shots summary */}
      <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.12em]">TOTAL DISPAROS</span>
        <span
          className="font-display font-bold text-lg text-[#ff3a28]"
          style={{ textShadow: '0 0 10px rgba(255,58,40,0.3)' }}
        >
          {totalShots || distTotal}
        </span>
      </div>
    </section>
  )
}

/* ─── Section: Actividad Semanal (7-day heatmap) ──────────────────────────── */

function SectionFrequency({ sessions }: { sessions: SessionAnalyticsItem[] }) {
  // Get last 7 days (Mon-Sun or just last 7 calendar days)
  const dayLabels = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
  const now = new Date()
  const days: Array<{ label: string; date: string; count: number }> = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10) // YYYY-MM-DD
    const dayOfWeek = d.getDay() // 0=Sun, 1=Mon...
    // Map to our labels: Mon=0, Tue=1...Sun=6
    const labelIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    days.push({ label: dayLabels[labelIdx], date: dateStr, count: 0 })
  }

  // Count sessions per day
  const dayMap = new Map(days.map((d) => [d.date, d]))
  for (const s of sessions) {
    const sessionDate = new Date(s.createdAt).toISOString().slice(0, 10)
    const entry = dayMap.get(sessionDate)
    if (entry) entry.count++
  }

  const maxDayCount = Math.max(1, ...days.map((d) => d.count))

  return (
    <section className="tactical-card p-4 stagger-fade-in" style={{ animationDelay: '240ms' }}>
      <SectionHeading>ACTIVIDAD SEMANAL</SectionHeading>
      <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mb-4 pl-5">
        ÚLTIMOS 7 DÍAS
      </p>
      <div className="flex items-end justify-between gap-1.5">
        {days.map((d) => {
          const intensity = d.count / maxDayCount // 0 to 1
          // Color: from dim to bright red
          const bg =
            d.count === 0
              ? 'rgba(255,255,255,0.04)'
              : `rgba(255, 58, 40, ${0.15 + intensity * 0.7})`
          const glow = d.count > 0 ? `0 0 ${4 + intensity * 8}px rgba(255,58,40,${0.2 + intensity * 0.3})` : 'none'
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className="w-full aspect-square rounded-sm"
                style={{
                  background: bg,
                  boxShadow: glow,
                  minHeight: '28px',
                }}
              />
              <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.1em]">{d.label}</span>
              {d.count > 0 && (
                <span className="font-mono-tactical text-[9px] text-[#ff3a28] font-bold">{d.count}</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ─── Section 4: Racha ────────────────────────────────────────────────────── */

function SectionStreak({ streak }: { streak: AnalyticsData['streak'] }) {
  return (
    <section className="tactical-card-enhanced p-4 stagger-fade-in" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg fire-pulse" aria-hidden>
          🔥
        </span>
        <SectionHeading>RACHA</SectionHeading>
      </div>
      <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mb-3 pl-5">
        SESIONES EN DÍAS CONSECUTIVOS
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="tactical-card p-3.5 flex flex-col items-center gap-1">
          <span
            className="font-display font-bold text-3xl text-[#ff7240]"
            style={{ textShadow: '0 0 12px rgba(255,114,64,0.4)' }}
          >
            {streak.current}
          </span>
          <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">ACTUAL</span>
        </div>
        <div className="tactical-card p-3.5 flex flex-col items-center gap-1">
          <span
            className="font-display font-bold text-3xl text-[#ffb830]"
            style={{ textShadow: '0 0 12px rgba(255,184,0,0.4)' }}
          >
            {streak.best}
          </span>
          <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">MEJOR</span>
        </div>
      </div>
      {streak.lastSessionDate && (
        <p className="text-[10px] text-[#3d4f68] font-mono-tactical tracking-[0.1em] mt-2.5 text-center">
          ÚLTIMA: {fmtDate(streak.lastSessionDate)}
        </p>
      )}
    </section>
  )
}

/* ─── Section 5: Logros ───────────────────────────────────────────────────── */

function SectionAchievements({ achievements }: { achievements: AchievementItem[] }) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const total = achievements.length
  const unlockPct = total > 0 ? (unlockedCount / total) * 100 : 0

  return (
    <section className="tactical-card-enhanced p-4 stagger-fade-in" style={{ animationDelay: '360ms' }}>
      <div className="relative flex items-center justify-between mb-2 px-1 py-1">
        {/* Corner-bracket decorations (all 4 corners) — Task 13-C */}
        <span className="corner-bracket corner-bracket-tr absolute inset-0 pointer-events-none" aria-hidden="true" />
        <span className="corner-bracket corner-bracket-bl corner-bracket-br absolute inset-0 pointer-events-none" aria-hidden="true" />
        <SectionHeading>LOGROS</SectionHeading>
        <span className="font-mono-tactical text-[10px] text-[#ffb830] tracking-[0.12em] count-up-animate">
          {unlockedCount}/{total} DESBLOQUEADOS
        </span>
      </div>
      {/* Progress bar showing unlock percentage */}
      <div className="h-1.5 bg-[var(--bg-glass)] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${unlockPct}%`,
            background: 'linear-gradient(90deg, #ffb830, #ff7240)',
            boxShadow: '0 0 6px rgba(255,184,0,0.4)',
          }}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {achievements.map((a) => (
          <AchievementCard key={a.id} achievement={a} />
        ))}
      </div>
    </section>
  )
}

function AchievementCard({ achievement }: { achievement: AchievementItem }) {
  if (achievement.unlocked) {
    return (
      <div
        className="tactical-card achievement-golden-shimmer p-3 flex flex-col items-center text-center"
        style={{ borderColor: 'rgba(255,184,0,0.5)', boxShadow: '0 0 12px rgba(255,184,0,0.15)' }}
      >
        <span className="text-2xl mb-1" aria-hidden>
          {achievement.icon}
        </span>
        <p className="font-display font-bold text-[11px] text-[#e8ecf5] leading-tight">{achievement.title}</p>
        <p className="text-[9px] text-[#7a8ca8] leading-snug mt-0.5 mb-1.5">{achievement.description}</p>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono-tactical bg-[rgba(255,184,0,0.15)] text-[#ffb830] border border-[rgba(255,184,0,0.3)] tracking-[0.1em]">
          ✓ DESBLOQUEADO
        </span>
        {achievement.unlockedAt && (
          <p className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.1em] mt-1">
            {fmtDate(achievement.unlockedAt)}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="tactical-card achievement-locked-stripes p-3 flex flex-col items-center text-center opacity-60">
      <span className="text-2xl mb-1 grayscale" aria-hidden>
        {achievement.icon}
      </span>
      <p className="font-display font-bold text-[11px] text-[#7a8ca8] leading-tight">{achievement.title}</p>
      <p className="text-[9px] text-[#3d4f68] leading-snug mt-0.5 mb-1.5">{achievement.description}</p>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono-tactical bg-[var(--bg-glass)] text-[#3d4f68] border border-[var(--border-subtle)] tracking-[0.1em]">
        🔒 BLOQUEADO
      </span>
    </div>
  )
}
