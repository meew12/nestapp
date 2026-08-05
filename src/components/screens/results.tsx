'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useAppStore, refreshStats } from '@/lib/store'
import type { Tab } from './main-app'
import { scoreColor, LATEST_SHOT_COLOR, WEATHER_CONDITIONS, DRILL_DEFINITIONS } from '@/lib/types'
import type { WeatherData, DrillType, DrillGoal } from '@/lib/types'
import { TargetMap } from '@/components/shared/target-map'
import type { TargetMapHandle } from '@/components/shared/target-map'
import { exportSessionPNG } from '@/lib/export-session'
import { shareSession } from '@/lib/share-session'
import { showToast } from '@/components/shared/toast'
import { analyzeGroup } from '@/lib/scoring'
import type { GroupAnalysis } from '@/lib/scoring'
import { RefreshCw, Save, CheckCircle2, Play, Pause, RotateCcw, Download, ChevronLeft, ChevronRight, FileText, Thermometer, Wind, Droplets, Crosshair, Trophy, Share2 } from 'lucide-react'

interface ResultsScreenProps {
  onNavigate: (tab: Tab) => void
}

export function ResultsScreen({ onNavigate }: ResultsScreenProps) {
  const liveSession = useAppStore((s) => s.liveSession)
  const setLiveSession = useAppStore((s) => s.setLiveSession)
  const user = useAppStore((s) => s.user)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [displayScore, setDisplayScore] = useState(0)
  const [scoreProgress, setScoreProgress] = useState(0)

  // Session notes local state
  const [notesText, setNotesText] = useState('')

  // Pre-fill notes from liveSession if it exists
  useEffect(() => {
    if (liveSession?.notes) {
      setNotesText(liveSession.notes)
    }
  }, [])

  // Replay state: null = not replaying, number = showing shots[0..replayIndex]
  const [replayIndex, setReplayIndex] = useState<number | null>(null)
  const [replayPlaying, setReplayPlaying] = useState(false)
  const targetRef = useRef<TargetMapHandle>(null)

  const finalScore = liveSession
    ? (liveSession.trainingMode ? liveSession.shotCount : liveSession.totalScore)
    : 0

  // Calculate score progress for the circular ring
  const maxPossibleScore = liveSession
    ? (liveSession.trainingMode ? 10 : liveSession.shotCount * 10)
    : 1
  const targetProgress = liveSession
    ? Math.min(1, liveSession.trainingMode
        ? liveSession.shotCount / 10
        : (liveSession.totalScore / (Math.max(1, maxPossibleScore))))
    : 0

  // Animate count up
  useEffect(() => {
    let current = 0
    const target = finalScore
    const step = Math.max(1, Math.ceil(target / 30))
    const t = setInterval(() => {
      current = Math.min(current + step, target)
      setDisplayScore(current)
      if (current >= target) clearInterval(t)
    }, 40)
    return () => clearInterval(t)
  }, [finalScore])

  // Animate score progress ring from 0 → targetProgress
  useEffect(() => {
    const timer = setTimeout(() => setScoreProgress(targetProgress), 100)
    return () => clearTimeout(timer)
  }, [targetProgress])

  // Grade calculation based on percentage
  const scorePercent = targetProgress * 100
  const gradeInfo = useMemo(() => {
    if (scorePercent >= 90) return { grade: 'A', color: '#39ff7a' }
    if (scorePercent >= 75) return { grade: 'B', color: '#00e5ff' }
    if (scorePercent >= 60) return { grade: 'C', color: '#ffb830' }
    return { grade: 'D', color: '#ff3a28' }
  }, [scorePercent])

  // Running average for sparkline
  const runningAvgs = useMemo(() => {
    if (!liveSession || liveSession.shots.length <= 2) return []
    return liveSession.shots.reduce((acc: number[], shot, i) => {
      const sum = liveSession.shots.slice(0, i + 1).reduce((s, sh) => s + sh.score, 0)
      acc.push(sum / (i + 1))
      return acc
    }, [])
  }, [liveSession])

  // Refresh stats after viewing results
  useEffect(() => {
    refreshStats()
  }, [])

  // Replay animation effect
  useEffect(() => {
    if (!replayPlaying || replayIndex === null) return
    if (replayIndex >= (liveSession?.shots.length ?? 0) - 1) {
      setReplayPlaying(false)
      return
    }
    const t = setTimeout(() => {
      setReplayIndex((prev) => (prev === null ? null : prev + 1))
    }, 800)
    return () => clearTimeout(t)
  }, [replayPlaying, replayIndex, liveSession])

  const startReplay = useCallback(() => {
    if (!liveSession || liveSession.shots.length === 0) return
    setReplayIndex(0)
    setReplayPlaying(true)
  }, [liveSession])

  const pauseReplay = useCallback(() => {
    setReplayPlaying(false)
  }, [])

  const resumeReplay = useCallback(() => {
    if (replayIndex === null) {
      startReplay()
      return
    }
    if (replayIndex < (liveSession?.shots.length ?? 0) - 1) {
      setReplayPlaying(true)
    }
  }, [replayIndex, liveSession, startReplay])

  const resetReplay = useCallback(() => {
    setReplayIndex(null)
    setReplayPlaying(false)
  }, [])

  const stepReplay = useCallback((dir: 1 | -1) => {
    setReplayPlaying(false)
    setReplayIndex((prev) => {
      if (prev === null) return dir === 1 ? 0 : (liveSession?.shots.length ?? 1) - 1
      const next = prev + dir
      if (next < 0) return null
      if (next >= (liveSession?.shots.length ?? 0)) return (liveSession?.shots.length ?? 0) - 1
      return next
    })
  }, [liveSession])

  const handleExport = useCallback(() => {
    if (!liveSession) return
    try {
      exportSessionPNG({
        session: liveSession,
        userName: user?.name || user?.email || undefined,
        sourceCanvas: targetRef.current?.getCanvas() ?? null,
      })
      showToast('Reporte PNG descargado ✓', 'success')
    } catch {
      showToast('Error al exportar', 'error')
    }
  }, [liveSession, user])

  const handleShare = useCallback(async () => {
    if (!liveSession) return
    try {
      const result = await shareSession({
        session: liveSession,
        userName: user?.name || user?.email || undefined,
        sourceCanvas: targetRef.current?.getCanvas() ?? null,
      })
      if (result === 'shared') {
        showToast('Sesión compartida ✓', 'success')
      } else if (result === 'downloaded') {
        showToast('Reporte PNG descargado ✓', 'success')
      } else {
        showToast('Error al compartir', 'error')
      }
    } catch {
      showToast('Error al compartir', 'error')
    }
  }, [liveSession, user])

  const saveSession = async () => {
    if (!liveSession || saved) return
    setSaving(true)
    try {
      const activeDrill = useAppStore.getState().activeDrill
      // Evaluate drill pass/fail if a drill is active (or use liveSession.drillType if already set)
      let drillPassed: boolean | null = liveSession.drillPassed ?? null
      let drillType: string | null = liveSession.drillType ?? activeDrill?.type ?? null
      let drillGoal: object | null = liveSession.drillGoal ?? activeDrill?.goal ?? null
      if (activeDrill || liveSession.drillType) {
        const goal = activeDrill?.goal ?? liveSession.drillGoal
        if (goal) {
          const shots = liveSession.shots
          const bullseyes = shots.filter((s) => s.score >= 10).length
          const passedChecks: boolean[] = []
          if (goal.shotCount) passedChecks.push(shots.length >= goal.shotCount)
          if (goal.targetScore) passedChecks.push(liveSession.totalScore >= goal.targetScore)
          if (goal.targetAvg) passedChecks.push(liveSession.avgScore >= goal.targetAvg)
          if (goal.targetBullseyes) passedChecks.push(bullseyes >= goal.targetBullseyes)
          if (goal.timeLimitSec) passedChecks.push(liveSession.durationSec <= goal.timeLimitSec)
          if (goal.targetGroupCm && shots.length >= 2 && groupAnalysis) {
            passedChecks.push(groupAnalysis.groupSizeCm <= (goal.targetGroupCm || 0))
          }
          drillPassed = passedChecks.length > 0 && passedChecks.every(Boolean)
        }
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingMode: liveSession.trainingMode,
          captureMode: liveSession.captureMode || 'camera',
          shots: liveSession.shots.map((s, i) => ({
            index: i + 1,
            x: s.x,
            y: s.y,
            radius: s.radius,
            score: s.score,
            timestamp: s.timestamp,
            distanceM: s.distanceM || 0,
          })),
          totalScore: liveSession.totalScore,
          durationSec: liveSession.durationSec,
          bestScore: liveSession.bestScore,
          avgScore: liveSession.avgScore,
          shotCount: liveSession.shotCount,
          targetSize: liveSession.targetSize,
          distanceM: liveSession.distanceM,
          weather: liveSession.weather || null,
          notes: notesText,
          drillType,
          drillPassed,
          drillGoal,
        }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Error al guardar', 'error')
        return
      }
      setSaved(true)
      // Clear active drill after saving
      useAppStore.getState().setActiveDrill(null)
      showToast('Sesión guardada ✓', 'success')
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  const newSession = () => {
    setLiveSession(null)
    onNavigate('menu')
  }

  // Grouped score breakdown for the chart
  const scoreBreakdown = useMemo(() => {
    if (!liveSession) return [] as { range: string; count: number; color: string }[]
    const buckets = [
      { range: '10', min: 10, max: 10, color: '#ff3a28' },
      { range: '8-9', min: 8, max: 9, color: '#ffb830' },
      { range: '6-7', min: 6, max: 7, color: '#ff7240' },
      { range: '4-5', min: 4, max: 5, color: '#00e5ff' },
      { range: '1-3', min: 1, max: 3, color: '#4da6ff' },
    ]
    return buckets.map((b) => ({
      range: b.range,
      color: b.color,
      count: liveSession.shots.filter((s) => s.score >= b.min && s.score <= b.max).length,
    }))
  }, [liveSession])

  // Resolve weather condition label + icon
  const weatherInfo = useMemo(() => {
    if (!liveSession?.weather?.condition) return null
    return WEATHER_CONDITIONS.find((w) => w.value === liveSession.weather!.condition) ?? null
  }, [liveSession?.weather?.condition])

  // Shot grouping analysis (needs ≥2 shots to be meaningful)
  const groupAnalysis = useMemo<GroupAnalysis | null>(() => {
    if (!liveSession || liveSession.shots.length < 2) return null
    const coordW = liveSession.captureMode === 'simulator' ? 600 : 1280
    const coordH = liveSession.captureMode === 'simulator' ? 600 : 720
    return analyzeGroup(
      liveSession.shots,
      coordW,
      coordH,
      liveSession.targetSize,
      liveSession.distanceM || 10,
    )
  }, [liveSession])

  // MOA quality label based on group precision
  const moaQuality = useMemo<{ label: string; color: string }>(() => {
    const moa = groupAnalysis?.moa ?? 0
    if (moa < 1) return { label: '<1 MOA · TIRADOR DE ÉLITE', color: '#39ff7a' }
    if (moa < 2) return { label: '<2 MOA · EXCELENTE', color: '#39ff7a' }
    if (moa < 3) return { label: '<3 MOA · BUENO', color: '#ffb830' }
    return { label: '≥3 MOA · MEJORABLE', color: '#ff3a28' }
  }, [groupAnalysis])

  // ── Drill celebration state ──────────────────────────────────────
  // Capture the drill that was active when results loaded (activeDrill is
  // cleared after save). Compute pass/fail synchronously using the same
  // logic as saveSession so we can show the celebration BEFORE the user
  // clicks GUARDAR.
  const initialDrillRef = useRef<{ type: DrillType; goal: DrillGoal; passed: boolean | null } | null>(null)
  const [showCelebration, setShowCelebration] = useState(true)

  useEffect(() => {
    if (initialDrillRef.current) return // already captured on first mount
    if (!liveSession) return
    const activeDrill = useAppStore.getState().activeDrill
    const drillType: DrillType | null = liveSession.drillType ?? activeDrill?.type ?? null
    const goal: DrillGoal | null = activeDrill?.goal ?? liveSession.drillGoal ?? null
    if (!drillType || !goal) return

    // Replicate saveSession pass/fail evaluation
    const shots = liveSession.shots
    const bullseyes = shots.filter((s) => s.score >= 10).length
    const passedChecks: boolean[] = []
    if (goal.shotCount) passedChecks.push(shots.length >= goal.shotCount)
    if (goal.targetScore) passedChecks.push(liveSession.totalScore >= goal.targetScore)
    if (goal.targetAvg) passedChecks.push(liveSession.avgScore >= goal.targetAvg)
    if (goal.targetBullseyes) passedChecks.push(bullseyes >= goal.targetBullseyes)
    if (goal.timeLimitSec) passedChecks.push(liveSession.durationSec <= goal.timeLimitSec)
    if (goal.targetGroupCm && shots.length >= 2 && groupAnalysis) {
      passedChecks.push(groupAnalysis.groupSizeCm <= (goal.targetGroupCm || 0))
    }
    const passed = passedChecks.length > 0 && passedChecks.every(Boolean)
    initialDrillRef.current = { type: drillType, goal, passed }

    // Auto-skip celebration if the user already dismissed it for this session
    if (passed && liveSession.startTime) {
      try {
        const key = `drill-celebrated-${liveSession.startTime}`
        if (typeof window !== 'undefined' && window.localStorage.getItem(key) === '1') {
          setShowCelebration(false)
        }
      } catch {
        /* localStorage unavailable — ignore */
      }
    }
  }, [liveSession, groupAnalysis])

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false)
    if (liveSession?.startTime) {
      try {
        const key = `drill-celebrated-${liveSession.startTime}`
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, '1')
        }
      } catch {
        /* localStorage unavailable — ignore */
      }
    }
  }, [liveSession?.startTime])

  const retryDrill = useCallback(() => {
    const drillInfo = initialDrillRef.current
    if (!drillInfo) return
    // Re-arm the drill in the store with a fresh liveSession (mirrors
    // drills.tsx handleStart) and navigate back to the scan screen.
    useAppStore.getState().setActiveDrill({ type: drillInfo.type, goal: drillInfo.goal })
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
      drillType: drillInfo.type,
      drillGoal: drillInfo.goal,
    })
    onNavigate('scan')
  }, [onNavigate])

  if (!liveSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="text-center">
          <p className="text-[#7a8ca8] mb-4">No hay sesión activa</p>
          <button onClick={() => onNavigate('menu')} className="tactical-btn tactical-btn-primary">
            VOLVER AL MENÚ
          </button>
        </div>
      </div>
    )
  }

  // Determine which shots to show based on replay state
  const visibleShots = replayIndex !== null
    ? liveSession.shots.slice(0, replayIndex + 1)
    : liveSession.shots

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(255,58,40,0.06) 0%, transparent 60%)' }}
      />

      <div className="relative flex-1 overflow-y-auto">
        {/* Header */}
        <div
          className="flex flex-col items-center gap-3 px-4 pt-10 pb-5"
          style={{ paddingTop: 'calc(40px + var(--safe-top))' }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center success-check-glow"
            style={{
              background: 'rgba(57,255,122,0.1)',
              border: '2px solid #39ff7a',
              boxShadow: '0 0 20px rgba(57,255,122,0.2)',
            }}
          >
            <CheckCircle2 size={28} className="text-[#39ff7a]" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-[0.1em]">SESIÓN FINALIZADA</h2>
        </div>

        {/* Drill failure banner — shown only when a drill was active and not passed */}
        {initialDrillRef.current?.passed === false && (() => {
          const failedDef = DRILL_DEFINITIONS.find((d) => d.type === initialDrillRef.current!.type)
          return (
            <div className="px-4 mb-4">
              <div
                className="tactical-card p-3 flex items-center gap-3 slide-in-right"
                style={{
                  borderColor: 'rgba(255,184,48,0.4)',
                  background: 'linear-gradient(135deg, rgba(255,58,40,0.08) 0%, rgba(255,184,48,0.08) 100%)',
                }}
                role="alert"
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(255,184,48,0.12)',
                    border: '1px solid rgba(255,184,48,0.4)',
                  }}
                >
                  <RotateCcw size={18} className="text-[#ffb830]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-xs tracking-[0.1em] text-[#ffb830] uppercase">
                    DESAFÍO NO SUPERADO
                  </p>
                  <p className="font-mono-tactical text-[10px] text-[#7a8ca8] mt-0.5 truncate">
                    Intenta de nuevo{failedDef?.passLabel ? ` — ${failedDef.passLabel}` : ''}
                  </p>
                </div>
                <button
                  onClick={retryDrill}
                  className="flex-shrink-0 px-3 rounded-lg font-display font-bold text-[10px] tracking-[0.12em] uppercase flex items-center gap-1.5 transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, #ffb830, #ff7240)',
                    color: '#0a0e1a',
                    boxShadow: '0 0 12px rgba(255,184,48,0.3)',
                    minHeight: '44px',
                  }}
                  aria-label="Reintentar desafío"
                >
                  <RotateCcw size={12} />
                  REINTENTAR DESAFÍO
                </button>
              </div>
            </div>
          )
        })()}

        {/* Score hero — animated gradient border + spark particles + circular progress ring */}
        <div className="px-4 flex flex-col items-center gap-2.5 mb-5">
          <div
            className="w-[140px] h-[140px] rounded-full flex flex-col items-center justify-center relative score-hero-border animated-border"
            style={{
              boxShadow: '0 0 30px rgba(255,58,40,0.35), inset 0 0 20px rgba(255,58,40,0.15)',
            }}
          >
            {/* SVG Circular Progress Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
              {/* Background ring */}
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,58,40,0.1)" strokeWidth="4" />
              {/* Progress ring — animated */}
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke="#ff3a28"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - scoreProgress)}`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Spark particles behind the score */}
            <span className="score-spark" style={{ top: '10%', left: '15%' }} />
            <span className="score-spark" style={{ top: '5%', right: '20%' }} />
            <span className="score-spark" style={{ bottom: '15%', left: '10%' }} />
            <span className="score-spark" style={{ bottom: '8%', right: '12%' }} />
            <span className="score-spark" style={{ top: '50%', left: '2%' }} />
            <span className="score-spark" style={{ top: '50%', right: '2%' }} />
            <span className="score-spark" style={{ top: '2%', left: '50%' }} />
            <span className="score-spark" style={{ bottom: '2%', right: '50%' }} />

            {/* Animated ring */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: '1px solid rgba(255,58,40,0.3)',
                animation: 'pulseRing 2s ease-in-out infinite',
              }}
            />
            <span className="font-display font-black text-[50px] text-[#ff3a28] leading-none relative z-10 num-pop" style={{ textShadow: '0 0 20px #ff3a28' }}>
              {displayScore}
            </span>
            <span className="font-mono-tactical text-[11px] text-[#3d4f68] tracking-[0.2em] mt-1 relative z-10">
              {liveSession.trainingMode ? 'DISP' : 'PTS'}
            </span>
          </div>

          {/* Grade Badge */}
          <div
            className="font-display font-bold text-2xl px-3 py-0.5 rounded-md border"
            style={{
              color: gradeInfo.color,
              textShadow: `0 0 12px ${gradeInfo.color}`,
              borderColor: `${gradeInfo.color}40`,
              background: `${gradeInfo.color}10`,
            }}
          >
            {gradeInfo.grade}
          </div>

          <span className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em]">
            {liveSession.trainingMode ? 'IMPACTOS TOTALES' : 'PUNTAJE FINAL'}
          </span>
        </div>

        {/* Stats grid */}
        <div className="px-4 grid grid-cols-2 gap-2.5 mb-5">
          <StatCard value={String(liveSession.shotCount)} label="DISPAROS" color="#00e5ff" />
          <StatCard value={String(liveSession.bestScore || '—')} label="MEJOR" color="#39ff7a" />
          <StatCard
            value={liveSession.shots.length > 0 ? liveSession.avgScore.toFixed(1) : '—'}
            label="PROMEDIO"
            color="#ffb830"
          />
          <StatCard value={`${liveSession.durationSec}s`} label="DURACIÓN" color="#ff7240" />
        </div>

        {/* Weather conditions card */}
        {liveSession.weather && (
          <div className="px-4 mb-5">
            <div className="tactical-card p-4">
              <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3">
                Condiciones ambientales
              </h3>
              <div className="flex flex-wrap gap-2">
                {weatherInfo && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] flex items-center gap-1.5">
                    <span className="text-sm">{weatherInfo.icon}</span>
                    <span className="font-mono-tactical text-[11px] text-[#e8ecf5]">{weatherInfo.label}</span>
                  </div>
                )}
                {liveSession.weather.temp != null && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] flex items-center gap-1.5">
                    <Thermometer size={13} className="text-[#ffb830]" />
                    <span className="font-mono-tactical text-[11px] text-[#e8ecf5]">{liveSession.weather.temp}°C</span>
                  </div>
                )}
                {liveSession.weather.wind != null && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] flex items-center gap-1.5">
                    <Wind size={13} className="text-[#00e5ff]" />
                    <span className="font-mono-tactical text-[11px] text-[#e8ecf5]">{liveSession.weather.wind} km/h</span>
                  </div>
                )}
                {liveSession.weather.humidity != null && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] flex items-center gap-1.5">
                    <Droplets size={13} className="text-[#4da6ff]" />
                    <span className="font-mono-tactical text-[11px] text-[#e8ecf5]">{liveSession.weather.humidity}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Target visualization with replay controls */}
        {liveSession.shots.length > 0 && (
          <div className="px-4 mb-5">
            <div className="tactical-card p-4 holographic-shimmer">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase">
                  Visualización de impactos
                </h3>
                <div className="flex items-center gap-2">
                  {liveSession.captureMode === 'simulator' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border border-[rgba(0,229,255,0.3)]">
                      SIMULADOR
                    </span>
                  )}
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(57,255,122,0.1)] text-[#39ff7a] border border-[rgba(57,255,122,0.3)] hover:bg-[rgba(57,255,122,0.2)] transition-all"
                    aria-label="Descargar reporte PNG"
                  >
                    <Download size={10} />
                    PNG
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(0,229,255,0.1)] text-[#00e5ff] border border-[rgba(0,229,255,0.3)] hover:bg-[rgba(0,229,255,0.2)] transition-all"
                    aria-label="Compartir sesión"
                  >
                    <Share2 size={10} />
                    COMPARTIR
                  </button>
                </div>
              </div>

              {/* Target map — uses visibleShots for replay */}
              <div className="relative">
                <TargetMap
                  ref={targetRef}
                  shots={visibleShots}
                  width={360}
                  height={360}
                  coordSpace={
                    liveSession.captureMode === 'simulator'
                      ? { width: 600, height: 600 }
                      : { width: 1280, height: 720 }
                  }
                  trainingMode={liveSession.trainingMode}
                  className="w-full max-w-[360px] mx-auto"
                />
                {/* Replay progress indicator */}
                {replayIndex !== null && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[rgba(10,14,26,0.9)] border border-[var(--border-glow)] backdrop-blur-md">
                    <span className="font-mono-tactical text-[10px] text-[#ff3a28] tracking-[0.15em]">
                      DISPARO {replayIndex + 1} / {liveSession.shots.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Replay controls */}
              {liveSession.shots.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button
                    onClick={() => stepReplay(-1)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28] hover:border-[var(--border-glow)] transition-all"
                    aria-label="Impacto anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {replayPlaying ? (
                    <button
                      onClick={pauseReplay}
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-[var(--red-dim)] border border-[var(--border-glow)] text-[#ff3a28] hover:scale-105 transition-all"
                      style={{ boxShadow: '0 0 12px rgba(255,58,40,0.3)' }}
                      aria-label="Pausar replay"
                    >
                      <Pause size={18} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={resumeReplay}
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-[var(--red-dim)] border border-[var(--border-glow)] text-[#ff3a28] hover:scale-105 transition-all"
                      style={{ boxShadow: '0 0 12px rgba(255,58,40,0.3)' }}
                      aria-label={replayIndex === null ? 'Iniciar replay' : 'Reanudar replay'}
                    >
                      <Play size={18} fill="currentColor" />
                    </button>
                  )}
                  <button
                    onClick={() => stepReplay(1)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28] hover:border-[var(--border-glow)] transition-all"
                    aria-label="Impacto siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                  {replayIndex !== null && (
                    <button
                      onClick={resetReplay}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28] hover:border-[var(--border-glow)] transition-all ml-1"
                      aria-label="Reiniciar replay"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Trend Sparkline */}
        {runningAvgs.length > 2 && (
          <div className="px-4 mb-5">
            <div className="tactical-card p-4">
              <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3">
                Tendencia de rendimiento
              </h3>
              <svg
                viewBox={`0 0 ${runningAvgs.length * 20} 40`}
                className="w-full h-10"
                preserveAspectRatio="none"
                role="img"
                aria-label="Tendencia de puntaje promedio"
              >
                <polyline
                  fill="none"
                  stroke="#ff3a28"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={runningAvgs.map((avg, i) => {
                    const x = i * 20 + 10
                    const y = 40 - (avg / 10) * 36
                    return `${x},${y}`
                  }).join(' ')}
                />
                {/* Fill area under the line */}
                <polygon
                  fill="rgba(255,58,40,0.08)"
                  points={[
                    `10,40`,
                    ...runningAvgs.map((avg, i) => {
                      const x = i * 20 + 10
                      const y = 40 - (avg / 10) * 36
                      return `${x},${y}`
                    }),
                    `${(runningAvgs.length - 1) * 20 + 10},40`,
                  ].join(' ')}
                />
                {/* Dots at each data point */}
                {runningAvgs.map((avg, i) => {
                  const x = i * 20 + 10
                  const y = 40 - (avg / 10) * 36
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={i === runningAvgs.length - 1 ? 2.5 : 1.5}
                      fill={i === runningAvgs.length - 1 ? '#ff3a28' : 'rgba(255,58,40,0.5)'}
                    />
                  )
                })}
              </svg>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono-tactical text-[8px] text-[#3d4f68]">Disparo 1</span>
                <span className="font-mono-tactical text-[8px] text-[#ff3a28]">
                  Promedio final: {runningAvgs[runningAvgs.length - 1].toFixed(1)}
                </span>
                <span className="font-mono-tactical text-[8px] text-[#3d4f68]">Disparo {runningAvgs.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Score distribution chart */}
        {scoreBreakdown.length > 0 && liveSession.shots.length > 0 && (
          <div className="px-4 mb-5">
            <div className="tactical-card p-4">
              <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3">
                Distribución de impactos
              </h3>
              <div className="space-y-2">
                {scoreBreakdown.map((b) => {
                  const pct = liveSession.shots.length > 0 ? (b.count / liveSession.shots.length) * 100 : 0
                  return (
                    <div key={b.range} className="flex items-center gap-2">
                      <span className="font-mono-tactical text-[10px] text-[#7a8ca8] w-10">{b.range}</span>
                      <div className="flex-1 h-4 rounded bg-[var(--bg-glass)] overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: b.color,
                            boxShadow: `0 0 8px ${b.color}`,
                            minWidth: b.count > 0 ? '8px' : '0',
                          }}
                        />
                      </div>
                      <span className="font-mono-tactical text-[10px] text-[#e8ecf5] w-6 text-right">{b.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Shot grouping analysis */}
        {groupAnalysis && liveSession.shots.length >= 2 && (() => {
          const coordW = liveSession.captureMode === 'simulator' ? 600 : 1280
          const coordH = liveSession.captureMode === 'simulator' ? 600 : 720
          const distanceM = liveSession.distanceM || 10
          // Scale shot coordinates from canvas space → 120×120 SVG space
          const sx = (x: number) => (x / coordW) * 120
          const sy = (y: number) => (y / coordH) * 120

          return (
            <div className="px-4 mb-5">
              <div className="tactical-card p-4 stagger-fade-in">
                {/* Heading with red left accent */}
                <div className="flex items-center gap-2 border-l-2 border-l-[#ff3a28] pl-3 mb-1">
                  <Crosshair size={14} className="text-[#ff3a28]" />
                  <h3 className="font-display font-bold text-sm tracking-[0.1em] text-[#e8ecf5]">
                    ANÁLISIS DE AGRUPAMIENTO
                  </h3>
                </div>
                <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.2em] uppercase pl-3 mb-3">
                  Precisión técnica del grupo
                </p>

                {/* Metrics + extreme spread SVG */}
                <div className="flex flex-col md:flex-row gap-4">
                  {/* 2×2 metric grid */}
                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    <GroupMetricTile
                      value={groupAnalysis.groupSizeCm.toFixed(1)}
                      unit="cm"
                      label="Tamaño del Grupo"
                      color="#ff3a28"
                      sub="Dispersión máxima entre impactos"
                    />
                    <GroupMetricTile
                      value={groupAnalysis.moa.toFixed(2)}
                      unit="MOA"
                      label="MOA"
                      color="#ffb830"
                      sub={`Minute of Angle @ ${distanceM}m`}
                      qualityLabel={moaQuality.label}
                      qualityColor={moaQuality.color}
                    />
                    <GroupMetricTile
                      value={groupAnalysis.deviationCm.toFixed(1)}
                      unit="cm"
                      label="Desviación MPI"
                      color="#00e5ff"
                      sub="Error de cero (centro del grupo vs diana)"
                    />
                    <GroupMetricTile
                      value={groupAnalysis.stdDevCm.toFixed(1)}
                      unit="cm"
                      label="Consistencia"
                      color="#39ff7a"
                      sub="Desvío estándar desde el MPI"
                    />
                  </div>

                  {/* Extreme spread visualization */}
                  <div className="flex-shrink-0 mx-auto">
                    <svg
                      width="120"
                      height="120"
                      viewBox="0 0 120 120"
                      className="block"
                      role="img"
                      aria-label="Visualización del grupo con línea de dispersión extrema"
                    >
                      <rect width="120" height="120" rx="6" fill="#070b16" />
                      {/* Subtle vignette */}
                      <defs>
                        <radialGradient id="grp-vignette" cx="50%" cy="50%" r="60%">
                          <stop offset="0%" stopColor="rgba(255,58,40,0.06)" />
                          <stop offset="100%" stopColor="rgba(6,9,16,0)" />
                        </radialGradient>
                      </defs>
                      <rect width="120" height="120" rx="6" fill="url(#grp-vignette)" />

                      {/* Concentric rings (outer → inner, matching TargetMap compact style) */}
                      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => {
                        const r = 54 * (score / 10)
                        return (
                          <circle
                            key={score}
                            cx="60"
                            cy="60"
                            r={r}
                            fill={score % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.035)'}
                            stroke={score <= 2 ? 'rgba(255,58,40,0.55)' : 'rgba(122,140,168,0.28)'}
                            strokeWidth={score === 1 ? 1.5 : 1}
                          />
                        )
                      })}

                      {/* Center dot */}
                      <circle cx="60" cy="60" r="2" fill="#ff3a28" opacity="0.8" />

                      {/* Extreme spread line connecting the two furthest shots */}
                      {groupAnalysis.extremePair && (() => {
                        const [i, j] = groupAnalysis.extremePair
                        const s1 = liveSession.shots[i]
                        const s2 = liveSession.shots[j]
                        if (!s1 || !s2) return null
                        const x1 = sx(s1.x)
                        const y1 = sy(s1.y)
                        const x2 = sx(s2.x)
                        const y2 = sy(s2.y)
                        const midX = (x1 + x2) / 2
                        const midY = (y1 + y2) / 2
                        return (
                          <>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="#ff3a28"
                              strokeWidth="1.5"
                              strokeDasharray="2,2"
                              opacity="0.75"
                            />
                            <text
                              x={midX}
                              y={midY - 4}
                              fill="#ff3a28"
                              fontSize="7"
                              fontFamily="'Share Tech Mono', monospace"
                              textAnchor="middle"
                              opacity="0.95"
                            >
                              EXTREMO
                            </text>
                          </>
                        )
                      })()}

                      {/* All shots as dots (latest in red, others by score color) */}
                      {liveSession.shots.map((shot, idx) => {
                        const isLatest = idx === liveSession.shots.length - 1
                        const color = isLatest ? LATEST_SHOT_COLOR : scoreColor(shot.score)
                        const x = sx(shot.x)
                        const y = sy(shot.y)
                        return (
                          <g key={idx}>
                            <circle
                              cx={x}
                              cy={y}
                              r="4"
                              fill="none"
                              stroke={color}
                              strokeWidth={isLatest ? 2 : 1.5}
                              opacity={isLatest ? 1 : 0.75}
                            />
                            <circle
                              cx={x}
                              cy={y}
                              r="2.4"
                              fill={color}
                              opacity={isLatest ? 0.9 : 0.45}
                            />
                          </g>
                        )
                      })}

                      {/* MPI crosshair (cyan +) */}
                      {groupAnalysis.mpi && (() => {
                        const mx = sx(groupAnalysis.mpi.x)
                        const my = sy(groupAnalysis.mpi.y)
                        return (
                          <g stroke="#00e5ff" strokeWidth="1.2" opacity="0.95">
                            <line x1={mx - 6} y1={my} x2={mx + 6} y2={my} />
                            <line x1={mx} y1={my - 6} x2={mx} y2={my + 6} />
                          </g>
                        )
                      })()}
                    </svg>
                    <p className="font-mono-tactical text-[8.5px] text-[#3d4f68] tracking-[0.15em] uppercase text-center mt-1.5">
                      Dispersion · MPI
                    </p>
                  </div>
                </div>

                {/* Interpretation footer */}
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-center">
                  <span className="font-mono-tactical text-[10px] text-[#7a8ca8] tracking-[0.1em]">
                    Grupo de {liveSession.shots.length} impactos — dispersión{' '}
                    <span className="text-[#ff3a28]" style={{ textShadow: '0 0 8px rgba(255,58,40,0.5)' }}>
                      {groupAnalysis.groupSizeCm.toFixed(1)}cm
                    </span>
                    {' '}({' '}
                    <span style={{ color: moaQuality.color, textShadow: `0 0 8px ${moaQuality.color}80` }}>
                      {groupAnalysis.moa.toFixed(2)} MOA
                    </span>
                    {' '}) a {distanceM}m
                  </span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Shot log */}
        <div className="px-4 mb-5">
          <div className="tactical-card overflow-hidden">
            <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase px-3.5 py-3 border-b border-[var(--border-subtle)]">
              Registro de impactos
            </h3>
            <div className="max-h-[280px] overflow-y-auto">
              {liveSession.shots.length === 0 ? (
                <div className="p-4 text-center text-[#3d4f68] text-sm">
                  Sin impactos registrados
                </div>
              ) : (
                liveSession.shots.map((shot, i) => {
                  const isLatest = i === liveSession.shots.length - 1
                  const isReplayCurrent = replayIndex === i
                  const color = isLatest ? LATEST_SHOT_COLOR : scoreColor(shot.score)
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.03] last:border-0 transition-all cursor-pointer ${
                        isReplayCurrent ? 'bg-[rgba(255,58,40,0.08)]' : 'hover:bg-white/[0.02]'
                      }`}
                      style={{
                        animation: 'logItemSlideSmooth 0.4s cubic-bezier(0.4,0,0.2,1) forwards',
                        animationDelay: `${i * 40}ms`,
                        opacity: 0,
                      }}
                      onClick={() => { setReplayIndex(i); setReplayPlaying(false) }}
                    >
                      <span className="font-mono-tactical text-[11px] text-[#3d4f68] w-7">#{i + 1}</span>
                      <span className="font-mono-tactical text-[11px] text-[#7a8ca8] flex-1 px-2.5">
                        x:{Math.round(shot.x)} y:{Math.round(shot.y)}
                        {shot.distanceM ? ` · ${shot.distanceM}cm` : ''}
                      </span>
                      {isLatest && (
                        <span className="font-mono-tactical text-[9px] text-[#ff3a28] mr-2 tracking-wider">● ÚLTIMO</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {!liveSession.trainingMode && (
                          <div className="w-10 h-1.5 rounded-full bg-[rgba(255,58,40,0.1)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(shot.score / 10) * 100}%`,
                                background: scoreColor(shot.score),
                              }}
                            />
                          </div>
                        )}
                        <span
                          className="font-display font-bold text-base text-right min-w-[40px]"
                          style={{ color, textShadow: `0 0 8px ${color}40` }}
                        >
                          {liveSession.trainingMode ? '—' : `${shot.score}`}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Session notes */}
        <div className="px-4 pb-6">
          <div className="tactical-card p-4">
            <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
              <FileText size={13} className="text-[#7a8ca8]" />
              Notas de sesión
            </h3>
            <textarea
              className="tactical-input min-h-[80px]"
              placeholder="Agregar notas sobre esta sesión..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Sticky actions */}
      <div
        className="sticky bottom-0 flex gap-2.5 px-4 py-4 bg-[#0a0e1a] border-t border-[var(--border-subtle)] flex-shrink-0"
        style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}
      >
        <button onClick={newSession} className="tactical-btn tactical-btn-primary flex-1">
          <RefreshCw size={16} />
          NUEVA SESIÓN
        </button>
        <button
          onClick={saveSession}
          disabled={saving || saved}
          className="tactical-btn tactical-btn-secondary flex-1"
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? 'GUARDADO' : saving ? 'GUARDANDO…' : 'GUARDAR'}
        </button>
      </div>

      {/* Drill celebration overlay — pops up when a drill was passed */}
      {initialDrillRef.current?.passed === true && showCelebration && liveSession && (
        <DrillCelebrationOverlay
          drillType={initialDrillRef.current.type}
          totalScore={liveSession.totalScore}
          avgScore={liveSession.avgScore}
          bullseyeCount={liveSession.shots.filter((s) => s.score >= 10).length}
          onDismiss={dismissCelebration}
        />
      )}
    </div>
  )
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="tactical-card p-3.5 flex flex-col items-center gap-1.5 relative overflow-hidden group stat-card-glow">
      {/* Hover glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(circle at center, ${color}15 0%, transparent 70%)` }}
      />
      {/* Animated border glow on hover */}
      <div
        className="absolute inset-0 rounded-[var(--radius-md)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          boxShadow: `inset 0 0 0 1px ${color}30, 0 0 12px ${color}15`,
        }}
      />
      <span className="font-display font-bold text-3xl relative z-10" style={{ color, textShadow: `0 0 12px ${color}25` }}>
        {value}
      </span>
      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] relative z-10">{label}</span>
    </div>
  )
}

interface GroupMetricTileProps {
  value: string
  unit: string
  label: string
  color: string
  sub: string
  qualityLabel?: string
  qualityColor?: string
}

function GroupMetricTile({ value, unit, label, color, sub, qualityLabel, qualityColor }: GroupMetricTileProps) {
  return (
    <div className="bg-[var(--bg-glass)] border border-[var(--border-subtle)] rounded-lg p-3 stat-card-glow relative overflow-hidden group">
      {/* Hover radial glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(circle at center, ${color}12 0%, transparent 70%)` }}
      />
      <div className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] uppercase mb-1 relative z-10">
        {label}
      </div>
      <div className="flex items-baseline gap-1 relative z-10">
        <span
          className="font-display font-bold text-2xl"
          style={{ color, textShadow: `0 0 12px ${color}80` }}
        >
          {value}
        </span>
        <span className="font-mono-tactical text-[10px] text-[#7a8ca8]">{unit}</span>
      </div>
      <p className="text-[10px] text-[#7a8ca8] leading-tight mt-0.5 relative z-10">{sub}</p>
      {qualityLabel && qualityColor && (
        <p
          className="font-mono-tactical text-[8.5px] tracking-[0.12em] uppercase mt-1 relative z-10"
          style={{ color: qualityColor, textShadow: `0 0 8px ${qualityColor}40` }}
        >
          {qualityLabel}
        </p>
      )}
    </div>
  )
}

// ── Drill Celebration Overlay ──────────────────────────────────────
// Full-screen modal that pops up when a drill is passed. Renders only
// when initialDrillRef.current.passed === true and showCelebration is
// true. Backdrop click does NOT dismiss (force CONTINUAR button press).

interface DrillCelebrationOverlayProps {
  drillType: DrillType
  totalScore: number
  avgScore: number
  bullseyeCount: number
  onDismiss: () => void
}

function DrillCelebrationOverlay({
  drillType,
  totalScore,
  avgScore,
  bullseyeCount,
  onDismiss,
}: DrillCelebrationOverlayProps) {
  const drillDef = DRILL_DEFINITIONS.find((d) => d.type === drillType)

  // Confetti configuration — randomized once on mount
  const confetti = useMemo(() => {
    const colors = ['#ff3a28', '#ffb830', '#00e5ff', '#39ff7a', '#ffd700']
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.6,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 6,
      isCircle: i % 2 === 0,
    }))
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(6,9,16,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      <style>{`
        @keyframes celebrationCardIn {
          0% { transform: scale(0.85) translateY(20px); opacity: 0; }
          60% { transform: scale(1.03) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes trophyFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-3deg); }
        }
        @keyframes trophyGlowPulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(255,215,0,0.4)) drop-shadow(0 0 24px rgba(255,215,0,0.2)); }
          50% { filter: drop-shadow(0 0 20px rgba(255,215,0,0.7)) drop-shadow(0 0 36px rgba(255,215,0,0.4)); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes shimmerText {
          0%, 100% { text-shadow: 0 0 10px rgba(255,215,0,0.5), 0 0 24px rgba(255,215,0,0.3); }
          50% { text-shadow: 0 0 16px rgba(255,215,0,0.8), 0 0 36px rgba(255,215,0,0.5); }
        }
      `}</style>

      {/* Confetti layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {confetti.map((c) => (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              top: '-20px',
              left: `${c.left}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
              background: c.color,
              borderRadius: c.isCircle ? '50%' : '2px',
              boxShadow: `0 0 8px ${c.color}`,
              animation: `confettiFall ${c.duration}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Celebration card */}
      <div
        className="animated-border-card achievement-burst relative w-full max-w-[360px] p-6"
        style={{
          background: 'linear-gradient(180deg, #0d1424 0%, #0a0e1a 100%)',
          animation: 'celebrationCardIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 12px 60px rgba(255,215,0,0.15), 0 0 40px rgba(255,184,48,0.2)',
        }}
      >
        {/* Trophy icon */}
        <div className="flex justify-center mb-4">
          <div
            style={{
              animation: 'trophyFloat 3s ease-in-out infinite, trophyGlowPulse 2.5s ease-in-out infinite',
            }}
          >
            <Trophy size={88} color="#ffd700" strokeWidth={1.5} />
          </div>
        </div>

        {/* Header */}
        <h2
          id="celebration-title"
          className="font-display font-black text-xl text-center tracking-[0.12em] uppercase"
          style={{
            color: '#ffd700',
            animation: 'shimmerText 2.5s ease-in-out infinite',
          }}
        >
          DESAFÍO COMPLETADO
        </h2>

        {/* Drill name + icon */}
        <div className="flex items-center justify-center gap-2 mt-2 mb-5">
          {drillDef?.icon && (
            <span className="text-2xl" aria-hidden="true">{drillDef.icon}</span>
          )}
          <span className="font-display font-bold text-base tracking-[0.08em] text-[#e8ecf5]">
            {drillDef?.name ?? drillType}
          </span>
        </div>

        {/* 3-column stat row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <CelebrationStat value={String(totalScore)} label="PUNTAJE" color="#ff3a28" />
          <CelebrationStat value={avgScore.toFixed(1)} label="PROMEDIO" color="#ffb830" />
          <CelebrationStat value={String(bullseyeCount)} label="DIANAS" color="#39ff7a" />
        </div>

        {/* Pass criteria label */}
        {drillDef?.passLabel && (
          <div className="text-center mb-5">
            <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.2em] uppercase mb-1">
              Criterio de aprobación
            </p>
            <p
              className="font-mono-tactical text-[11px] text-[#39ff7a] tracking-[0.1em] flex items-center justify-center gap-1"
              style={{ textShadow: '0 0 8px rgba(57,255,122,0.4)' }}
            >
              <CheckCircle2 size={11} />
              {drillDef.passLabel}
            </p>
          </div>
        )}

        {/* CONTINUAR button — backdrop click does NOT dismiss */}
        <button
          onClick={onDismiss}
          className="w-full rounded-lg font-display font-bold text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            minHeight: '48px',
            background: 'linear-gradient(135deg, #b8860b 0%, #ffd700 50%, #ffdf5e 100%)',
            color: '#0a0e1a',
            boxShadow: '0 4px 20px rgba(255,215,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
            border: '1px solid rgba(255,215,0,0.6)',
          }}
          aria-label="Continuar"
        >
          CONTINUAR
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function CelebrationStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-2.5 rounded-lg"
      style={{
        background: 'rgba(13,20,36,0.6)',
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="font-display font-bold text-lg leading-none"
        style={{ color, textShadow: `0 0 12px ${color}80` }}
      >
        {value}
      </span>
      <span className="font-mono-tactical text-[8px] text-[#7a8ca8] tracking-[0.15em] mt-1 uppercase">
        {label}
      </span>
    </div>
  )
}
