'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useCameraDetection } from '@/lib/use-camera-detection'
import { TargetMap } from '@/components/shared/target-map'
import { ShotListPanel } from '@/components/shared/shot-list-panel'
import { TargetTypeSelector } from '@/components/shared/target-type-selector'
import type { Tab } from './main-app'
import { showToast } from '@/components/shared/toast'
import { Square, Save, Camera, AlertTriangle, CheckCircle2, Zap, MousePointerClick, Crosshair, Clock, Target, XCircle, ChevronDown, ChevronUp, Trophy, BarChart3, TrendingUp, Timer, Award, List, Undo2, Gauge, Wind, MapPin, Settings2 } from 'lucide-react'
import { DRILL_DEFINITIONS, TARGET_TYPE_PRESETS, type TargetTypePreset } from '@/lib/types'
import type { DrillGoal, DrillType, SessionData, ShotData } from '@/lib/types'
import { analyzeGroup } from '@/lib/scoring'

interface ScanScreenProps {
  onNavigate: (tab: Tab) => void
}

/** Internal canvas resolution for the simulator target. */
const SIMULATOR_SIZE = 600

export function ScanScreen({ onNavigate }: ScanScreenProps) {
  const {
    videoRef,
    canvasRef,
    flashRef,
    cvReady,
    running,
    error,
    cameraDims,
    detectFps,
    startCamera,
    stopCamera,
    ensureAudio,
    registerManualShot,
    undoLastShot,
    clearAllShots,
  } = useCameraDetection()

  const liveSession = useAppStore((s) => s.liveSession)
  const setLiveSession = useAppStore((s) => s.setLiveSession)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const activeDrill = useAppStore((s) => s.activeDrill)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const [countdown, setCountdown] = useState<number | null>(3)
  const [showCalibrate, setShowCalibrate] = useState(false)
  const [saving, setSaving] = useState(false)
  /** When true, shows an expanded live stats panel overlay during scanning. */
  const [showLiveStats, setShowLiveStats] = useState(false)
  /** When true, the scan screen runs in manual tap-to-mark mode instead of camera detection. */
  const [simulatorMode, setSimulatorMode] = useState(false)
  /** When true, the Accushoot-style shot list panel slides in from the right. */
  const [showShotList, setShowShotList] = useState(false)
  /** When true, shows the target type preset selector (ISSF/NRA/F-Class/IPSC). */
  const [showTargetSelector, setShowTargetSelector] = useState(false)
  /** Tracks the last shot index to trigger the "last shot detail" popup card. */
  const [lastShotPopup, setLastShotPopup] = useState<{ shotIndex: number; visible: boolean }>({ shotIndex: -1, visible: false })
  /** Track whether the user has been auto-offered simulator mode after a camera failure. */
  const simulatorOfferedRef = useRef(false)
  /** Live "now" timestamp — ticks while a timed drill is active & scanning, drives the timer UI + auto-stop checks. */
  const [now, setNow] = useState(() => Date.now())
  /** Prevents the auto-stop effect from firing twice for the same drill session. */
  const autoStopTriggeredRef = useRef(false)

  // Live group analysis for the HUD badge (cheap for <50 shots).
  // Coordinate space depends on capture mode: simulator uses SIMULATOR_SIZE²,
  // camera uses the native camera dimensions.
  const coordSpace = simulatorMode
    ? { w: SIMULATOR_SIZE, h: SIMULATOR_SIZE }
    : { w: cameraDims.width || SIMULATOR_SIZE, h: cameraDims.height || SIMULATOR_SIZE }
  const liveGroup = useMemo(
    () => analyzeGroup(
      liveSession?.shots ?? [],
      coordSpace.w,
      coordSpace.h,
      liveSession?.targetSize ?? 'standard',
      liveSession?.distanceM || 10,
    ),
    [liveSession?.shots, liveSession?.targetSize, liveSession?.distanceM, coordSpace.w, coordSpace.h],
  )

  // Countdown then start (camera OR simulator)
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      setCountdown(null)
      ensureAudio()
      if (!simulatorMode) {
        startCamera()
      }
      return
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, ensureAudio, startCamera, simulatorMode])

  // Handle camera errors — auto-suggest simulator mode once
  useEffect(() => {
    if (error && !simulatorOfferedRef.current) {
      simulatorOfferedRef.current = true
      showToast('Cámara no disponible — activa el Modo Simulador', 'info')
    }
  }, [error])

  // Tick "now" while a timed drill is active and scanning is running (camera or simulator).
  // Outside of active scanning (e.g. during the countdown) the timer pauses.
  useEffect(() => {
    if (!activeDrill?.goal.timeLimitSec) return
    if (!(running || simulatorMode)) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [activeDrill, running, simulatorMode])

  // Switch to simulator mode
  const enterSimulator = useCallback(() => {
    stopCamera()
    setSimulatorMode(true)
    ensureAudio()
    showToast('Modo Simulador activo — toca el blanco para marcar impactos', 'info')
  }, [stopCamera, ensureAudio])

  // Switch back to camera mode
  const enterCameraMode = useCallback(() => {
    setSimulatorMode(false)
    showToast('Reintentando cámara…', 'info')
    startCamera()
  }, [startCamera])

  // Select a target type preset — updates settings + live session distance
  const handleSelectTargetType = useCallback((preset: TargetTypePreset) => {
    setSettings({ targetType: preset.id })
    // Also update the live session's distanceM so group analysis / MOA uses
    // the preset's default distance (the user can still override later).
    if (liveSession) {
      setLiveSession({ ...liveSession, distanceM: preset.defaultDistanceM })
    }
    setShowTargetSelector(false)
    showToast(`Blanco: ${preset.shortName}`, 'success')
  }, [setSettings, liveSession, setLiveSession])

  // Handle a tap on the simulator target
  const handleSimulatorShot = useCallback(
    (x: number, y: number) => {
      registerManualShot(x, y, SIMULATOR_SIZE, SIMULATOR_SIZE)
    },
    [registerManualShot],
  )

  // Trigger the "last shot detail" popup whenever a new shot arrives.
  // The popup auto-hides after 3.5s. Accushoot shows a similar transient
  // card with score + POA offset after each impact.
  const shotCount = liveSession?.shots.length ?? 0
  useEffect(() => {
    if (shotCount === 0) return
    setLastShotPopup({ shotIndex: shotCount - 1, visible: true })
    const t = setTimeout(() => {
      setLastShotPopup((s) => (s.shotIndex === shotCount - 1 ? { ...s, visible: false } : s))
    }, 3500)
    return () => clearTimeout(t)
  }, [shotCount])

  const stopAndShowResults = useCallback(() => {
    stopCamera()
    if (liveSession) {
      const durationSec = liveSession.startTime
        ? Math.round((Date.now() - liveSession.startTime) / 1000)
        : 0
      setLiveSession({ ...liveSession, durationSec, captureMode: simulatorMode ? 'simulator' : 'camera' })
    }
    onNavigate('results')
  }, [stopCamera, liveSession, setLiveSession, onNavigate, simulatorMode])

  // Reset the auto-stop guard when the active drill changes (new drill session)
  useEffect(() => {
    autoStopTriggeredRef.current = false
  }, [activeDrill])

  // Auto-stop the drill when the goal shot count is reached, or when the time
  // limit expires before the shot count is met. Fires at most once per drill.
  useEffect(() => {
    if (!activeDrill || !liveSession) return
    if (autoStopTriggeredRef.current) return
    const goal = activeDrill.goal
    const shotsLen = liveSession.shots.length

    // 1) Shot-count reached → "DESAFÍO COMPLETADO" + auto-stop after a brief delay
    if (goal.shotCount && shotsLen >= goal.shotCount) {
      autoStopTriggeredRef.current = true
      showToast('DESAFÍO COMPLETADO', 'success')
      const t = setTimeout(() => stopAndShowResults(), 1200)
      return () => clearTimeout(t)
    }

    // 2) Time expired before shot count met → "TIEMPO AGOTADO" + auto-stop
    if (goal.timeLimitSec && liveSession.startTime) {
      const shotsNotMet = !goal.shotCount || shotsLen < goal.shotCount
      if (shotsNotMet) {
        const elapsedSec = (now - liveSession.startTime) / 1000
        if (elapsedSec >= goal.timeLimitSec) {
          autoStopTriggeredRef.current = true
          showToast('TIEMPO AGOTADO', 'error')
          const t = setTimeout(() => stopAndShowResults(), 800)
          return () => clearTimeout(t)
        }
      }
    }
  }, [activeDrill, liveSession, now, stopAndShowResults])

  const saveSession = useCallback(async () => {
    if (!liveSession) return
    setSaving(true)
    try {
      const activeDrill = useAppStore.getState().activeDrill
      // Evaluate drill pass/fail if a drill is active
      let drillPassed: boolean | null = null
      if (activeDrill) {
        const goal = activeDrill.goal
        const shots = liveSession.shots
        const bullseyes = shots.filter((s) => s.score >= 10).length
        const passedChecks: boolean[] = []
        if (goal.shotCount) passedChecks.push(shots.length >= goal.shotCount)
        if (goal.targetScore) passedChecks.push(liveSession.totalScore >= goal.targetScore)
        if (goal.targetAvg) passedChecks.push(liveSession.avgScore >= goal.targetAvg)
        if (goal.targetBullseyes) passedChecks.push(bullseyes >= goal.targetBullseyes)
        if (goal.timeLimitSec) {
          const dur = liveSession.startTime ? Math.round((Date.now() - liveSession.startTime) / 1000) : 0
          passedChecks.push(dur <= goal.timeLimitSec)
        }
        // Group size check requires analyzeGroup — skip if not met shot count
        if (goal.targetGroupCm && shots.length >= 2) {
          // Inline group calc (avoid importing here)
          let maxDist = 0
          for (let i = 0; i < shots.length; i++) {
            for (let j = i + 1; j < shots.length; j++) {
              const d = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y)
              if (d > maxDist) maxDist = d
            }
          }
          const maxR = SIMULATOR_SIZE * 0.45
          const targetCm = 25 // standard
          const groupCm = (maxDist / maxR) * (targetCm / 2)
          passedChecks.push(groupCm <= (goal.targetGroupCm || 0))
        }
        drillPassed = passedChecks.length > 0 && passedChecks.every(Boolean)
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingMode: liveSession.trainingMode,
          captureMode: simulatorMode ? 'simulator' : 'camera',
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
          durationSec: liveSession.startTime
            ? Math.round((Date.now() - liveSession.startTime) / 1000)
            : 0,
          bestScore: liveSession.bestScore,
          avgScore: liveSession.avgScore,
          shotCount: liveSession.shotCount,
          targetSize: liveSession.targetSize,
          distanceM: liveSession.distanceM,
          weather: liveSession.weather || null,
          drillType: activeDrill?.type ?? null,
          drillPassed,
          drillGoal: activeDrill?.goal ?? null,
        }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Error al guardar', 'error')
        return
      }
      // Clear active drill after saving
      useAppStore.getState().setActiveDrill(null)
      showToast('Sesión guardada ✓', 'success')
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }, [liveSession, simulatorMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const trainingMode = liveSession?.trainingMode
  const active = simulatorMode || running

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Drill HUD overlay (only when a drill is active) */}
      {activeDrill && liveSession && (
        <DrillHUD
          drill={activeDrill}
          liveSession={liveSession}
          active={running || simulatorMode}
          now={now}
        />
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#060910]">
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255,58,40,0.08) 0%, transparent 70%)',
              animation: 'cdBgPulse 1s ease-in-out infinite',
            }}
          />
          <div className="relative w-[200px] h-[200px] flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="100" cy="100" r="85" fill="none" stroke="#ff3a28" strokeWidth="3"
                strokeLinecap="round" strokeDasharray="534"
                style={{ filter: 'drop-shadow(0 0 6px #ff3a28)', transition: 'stroke-dashoffset 1s linear', strokeDashoffset: countdown === 0 ? 534 : 0 }}
              />
            </svg>
            <div
              key={countdown}
              className="font-display font-black text-[90px] text-[#ff3a28] leading-none"
              style={{ textShadow: '0 0 40px #ff3a28, 0 0 80px rgba(255,58,40,0.35)', animation: 'cdNumPop 0.3s cubic-bezier(0.4,0,0.2,1) forwards' }}
            >
              {countdown === 0 ? '¡YA!' : countdown}
            </div>
          </div>
          <p className="font-mono-tactical text-[11px] text-[#3d4f68] tracking-[0.2em] mt-6">
            {simulatorMode ? 'PREPARANDO SIMULADOR…' : 'PREPARANDO DETECCIÓN…'}
          </p>
        </div>
      )}

      {/* Camera / Simulator wrap */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {simulatorMode ? (
          /* ── SIMULATOR MODE ── */
          <div className="absolute inset-0 flex flex-col bg-[#070b16] overflow-hidden scan-line-effect holographic-shimmer">
            {/* Subtle grid background */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,58,40,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,58,40,0.06) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            {/* Instruction header */}
            <div
              className="relative flex items-center justify-center gap-2 px-4 flex-shrink-0"
              style={{ paddingTop: 'calc(64px + var(--safe-top))', paddingBottom: 8 }}
            >
              <MousePointerClick size={14} className="text-[#00e5ff] flex-shrink-0" />
              <span className="font-mono-tactical text-[10px] text-[#00e5ff] tracking-[0.2em] text-center">
                TOCA EL BLANCO PARA MARCAR IMPACTOS
              </span>
            </div>
            {/* Target — constrained to fit available space */}
            <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-3">
              <div
                className="relative flex flex-col items-center"
                style={{ width: '100%', maxWidth: 520, height: '100%' }}
              >
                <TargetMap
                  shots={liveSession?.shots ?? []}
                  width={SIMULATOR_SIZE}
                  height={SIMULATOR_SIZE}
                  interactive
                  onShot={handleSimulatorShot}
                  trainingMode={trainingMode}
                  showRingLabels
                  showShotNumbers
                  showLatestBadge
                  className="w-full"
                  style={{ height: '100%', width: 'auto', maxWidth: '100%' }}
                />
                <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mt-2 text-center flex-shrink-0 glitch-text">
                  MODO SIMULADOR · {liveSession?.shots.length ?? 0} IMPACTOS
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ── CAMERA MODE ── */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </>
        )}

        {/* HUD corners */}
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        {/* Top HUD */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center gap-2 pointer-events-none"
          style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
        >
          {trainingMode && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(255,184,0,0.2)] border border-[rgba(255,184,0,0.4)]">
              <Zap size={12} className="text-[#ffb830]" />
              <span className="font-mono-tactical text-[10px] text-[#ffb830] tracking-[0.1em]">ENTRENAMIENTO</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--bg-glass)] border border-[var(--border-subtle)] backdrop-blur-md">
            <span className={`status-dot ${active ? 'active' : ''} ${active ? 'pulse-ring' : ''}`} />
            <span className="font-mono-tactical text-[10px] text-[#7a8ca8] tracking-[0.1em]">
              {simulatorMode ? 'SIMULADOR' : running ? 'DETECTANDO' : 'STANDBY'}
            </span>
          </div>
          {simulatorMode ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(0,229,255,0.15)] border border-[rgba(0,229,255,0.4)]">
              <MousePointerClick size={12} className="text-[#00e5ff]" />
              <span className="font-mono-tactical text-[10px] text-[#00e5ff] tracking-[0.1em]">MANUAL</span>
            </div>
          ) : cameraMode === 'telescope' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(0,229,255,0.15)] border border-[rgba(0,229,255,0.4)]">
              <span className="font-mono-tactical text-[10px] text-[#00e5ff] tracking-[0.1em]">TELESCOPIO</span>
            </div>
          ) : null}
        </div>

        {/* Mode badge + target type selector (top-left) */}
        <div className="absolute top-16 left-4 flex flex-col gap-2 pointer-events-none">
          <div className="pointer-events-auto">
            {simulatorMode ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono-tactical bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border border-[rgba(0,229,255,0.3)]">
                <MousePointerClick size={10} />
                MODO SIMULADOR
              </div>
            ) : (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono-tactical ${
                cvReady ? 'bg-[rgba(57,255,122,0.15)] text-[#39ff7a] border border-[rgba(57,255,122,0.3)]' : 'bg-[rgba(255,184,0,0.15)] text-[#ffb830] border border-[rgba(255,184,0,0.3)]'
              }`}>
                {cvReady ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                {cvReady ? 'OPENCV ACTIVO' : 'MODO CANVAS'}
              </div>
            )}
          </div>
          {/* Target type button — opens preset selector */}
          <button
            onClick={() => setShowTargetSelector(true)}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono-tactical bg-[rgba(255,58,40,0.1)] text-[#ff3a28] border border-[rgba(255,58,40,0.3)] hover:bg-[rgba(255,58,40,0.18)] transition-colors"
            aria-label="Cambiar tipo de blanco"
          >
            <Settings2 size={10} />
            {(TARGET_TYPE_PRESETS.find(p => p.id === settings.targetType)?.shortName) ?? 'ISSF 10m'}
          </button>
        </div>

        {/* Scan animation line (camera mode only) */}
        {!simulatorMode && running && (
          <div
            className="absolute left-0 right-0 h-0.5 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, #00e5ff 30%, #00e5ff 70%, transparent 100%)',
              boxShadow: '0 0 10px #00e5ff',
              animation: 'scanMoveDown 4s ease-in-out infinite',
            }}
          />
        )}

        {/* Flash overlay */}
        <div
          ref={flashRef}
          className="absolute inset-0 pointer-events-none transition-opacity duration-75"
          style={{ background: 'rgba(255,58,40,0.5)', opacity: 0 }}
        />

        {/* Error overlay (camera mode only) */}
        {!simulatorMode && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(6,9,16,0.92)] p-8 text-center">
            <AlertTriangle size={48} className="text-[#ff3a28] mb-4" />
            <p className="font-display text-lg text-[#e8ecf5] mb-2">CÁMARA NO DISPONIBLE</p>
            <p className="text-sm text-[#7a8ca8] mb-6 max-w-xs">{error}</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={enterSimulator}
                className="tactical-btn tactical-btn-primary"
                style={{ background: 'linear-gradient(135deg, #0099b8 0%, #00e5ff 50%, #39ff7a 100%)' }}
              >
                <MousePointerClick size={16} />
                USAR MODO SIMULADOR
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { startCamera() }}
                  className="tactical-btn tactical-btn-secondary flex-1"
                >
                  REINTENTAR
                </button>
                <button
                  onClick={() => onNavigate('menu')}
                  className="tactical-btn tactical-btn-secondary flex-1"
                >
                  VOLVER
                </button>
              </div>
            </div>
            <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mt-5 max-w-xs">
              EL MODO SIMULADOR PERMITE MARCAR IMPACTOS MANUALMENTE TOCANDO EL BLANCO
            </p>
          </div>
        )}

        {/* Mode toggle (top-right) — switch between camera and simulator + shot list */}
        {active && !error && (
          <div className="absolute top-16 right-4 flex flex-col gap-2">
            {/* Shot list button — always available while scanning (Accushoot-style) */}
            <button
              onClick={() => setShowShotList(true)}
              className="tactical-btn tactical-btn-ghost text-xs py-2 px-3 relative"
              aria-label="Ver lista de disparos"
            >
              <List size={14} />
              LISTA
              {liveSession && liveSession.shots.length > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-display font-bold text-[9px]"
                  style={{
                    background: '#ff3a28',
                    color: '#fff',
                    boxShadow: '0 0 6px #ff3a2880',
                  }}
                >
                  {liveSession.shots.length}
                </span>
              )}
            </button>
            {/* Quick undo — removes last shot */}
            <button
              onClick={undoLastShot}
              disabled={!liveSession || liveSession.shots.length === 0}
              className="tactical-btn tactical-btn-ghost text-xs py-2 px-3 disabled:opacity-30"
              aria-label="Deshacer último disparo"
            >
              <Undo2 size={14} />
              DESHACER
            </button>
            {simulatorMode ? (
              <button
                onClick={enterCameraMode}
                className="tactical-btn tactical-btn-ghost text-xs py-2 px-3"
                aria-label="Usar cámara"
              >
                <Camera size={14} />
                CÁMARA
              </button>
            ) : (
              <button
                onClick={enterSimulator}
                className="tactical-btn tactical-btn-ghost text-xs py-2 px-3"
                aria-label="Activar modo simulador"
              >
                <MousePointerClick size={14} />
                SIMULADOR
              </button>
            )}
            {!simulatorMode && running && (
              <button
                onClick={() => setShowCalibrate(true)}
                className="tactical-btn tactical-btn-ghost text-xs py-2 px-3"
              >
                <Crosshair size={14} />
                CALIBRAR
              </button>
            )}
          </div>
        )}

        {/* Live group analysis badge (bottom-left of camera viewport) */}
        {active && liveSession && liveSession.shots.length >= 2 && !showShotList && (
          <div
            className="absolute bottom-4 left-4 pointer-events-none slide-in-up"
            style={{ animation: 'slideInUp 0.3s ease-out' }}
          >
            <div
              className="rounded-lg px-3 py-2 backdrop-blur-md"
              style={{
                background: 'rgba(10,14,26,0.85)',
                border: '1px solid var(--border-glow)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,229,255,0.15)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Gauge size={10} className="text-[#ff3a28]" />
                <span className="font-mono-tactical text-[8px] text-[#7a8ca8] tracking-[0.18em]">
                  GRUPO EN VIVO
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="font-display font-bold text-base text-[#ff3a28] leading-none">
                    {liveGroup.groupSizeCm.toFixed(1)}
                    <span className="font-mono-tactical text-[9px] text-[#7a8ca8] ml-0.5">cm</span>
                  </span>
                  <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-wider mt-0.5">EXTREME SPREAD</span>
                </div>
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <div className="flex flex-col">
                  <span className="font-display font-bold text-base text-[#ffb830] leading-none">
                    {liveGroup.moa.toFixed(2)}
                    <span className="font-mono-tactical text-[9px] text-[#7a8ca8] ml-0.5">MOA</span>
                  </span>
                  <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-wider mt-0.5">@ {liveSession.distanceM || 10}m</span>
                </div>
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <div className="flex flex-col">
                  <span className="font-display font-bold text-base text-[#00e5ff] leading-none">
                    {liveGroup.deviationCm.toFixed(1)}
                    <span className="font-mono-tactical text-[9px] text-[#7a8ca8] ml-0.5">cm</span>
                  </span>
                  <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-wider mt-0.5">DESV. MPI</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detection FPS badge (bottom-right of camera viewport) — performance transparency */}
        {!simulatorMode && running && (
          <div className="absolute bottom-4 right-4 pointer-events-none">
            <div
              className="rounded-md px-2 py-1 flex items-center gap-1.5"
              style={{
                background: 'rgba(10,14,26,0.8)',
                border: `1px solid ${detectFps >= 8 ? 'rgba(57,255,122,0.3)' : detectFps >= 5 ? 'rgba(255,184,48,0.3)' : 'rgba(255,58,40,0.3)'}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: detectFps >= 8 ? '#39ff7a' : detectFps >= 5 ? '#ffb830' : '#ff3a28',
                  boxShadow: `0 0 6px ${detectFps >= 8 ? '#39ff7a' : detectFps >= 5 ? '#ffb830' : '#ff3a28'}`,
                }}
              />
              <span
                className="font-mono-tactical text-[9px] tracking-wider"
                style={{ color: detectFps >= 8 ? '#39ff7a' : detectFps >= 5 ? '#ffb830' : '#ff3a28' }}
              >
                {detectFps} FPS
              </span>
            </div>
          </div>
        )}

        {/* Last shot detail popup — transient card showing score, distance, coords */}
        {active && liveSession && lastShotPopup.visible && liveSession.shots[lastShotPopup.shotIndex] && (
          <LastShotDetailCard
            shot={liveSession.shots[lastShotPopup.shotIndex]}
            session={liveSession}
            coordW={coordSpace.w}
            coordH={coordSpace.h}
          />
        )}
      </div>

      {/* Live scoreboard */}
      <div className="bg-[rgba(6,9,16,0.95)] border-t border-[var(--border-subtle)] flex-shrink-0">
        <div className="flex items-center py-3 px-2">
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="font-display font-bold text-2xl text-[#e8ecf5]">
              {liveSession ? (trainingMode ? liveSession.shotCount : liveSession.totalScore) : 0}
            </span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.12em]">
              {trainingMode ? 'DISPAROS' : 'PUNTAJE TOTAL'}
            </span>
          </div>
          <div className="w-px h-9 bg-[var(--border-subtle)]" />
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="font-display font-bold text-2xl text-[#ff3a28]" style={{ textShadow: '0 0 12px rgba(255,58,40,0.3)' }}>
              {liveSession && liveSession.shots.length > 0
                ? (trainingMode ? '—' : liveSession.shots[liveSession.shots.length - 1].score)
                : '—'}
            </span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.12em]">ÚLTIMO IMPACTO</span>
          </div>
          <div className="w-px h-9 bg-[var(--border-subtle)]" />
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="font-display font-bold text-2xl text-[#e8ecf5]">
              {liveSession?.shotCount ?? 0}
            </span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.12em]">DISPAROS</span>
          </div>
          <div className="w-px h-9 bg-[var(--border-subtle)]" />
          {/* Toggle expanded stats */}
          <button
            onClick={() => setShowLiveStats(!showLiveStats)}
            className="flex-1 flex flex-col items-center gap-1 group"
            aria-label={showLiveStats ? 'Ocultar estadísticas' : 'Ver estadísticas'}
          >
            <BarChart3 size={18} className="text-[#7a8ca8] group-hover:text-[#00e5ff] transition-colors" />
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.12em]">ESTADÍSTICAS</span>
          </button>
        </div>

        {/* Expanded live stats panel */}
        {showLiveStats && liveSession && liveSession.shots.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] px-3 py-3 slide-in-up">
            <div className="grid grid-cols-4 gap-2">
              {/* Best score */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1">
                  <Award size={10} className="text-[#39ff7a]" />
                  <span className="font-display font-bold text-lg text-[#39ff7a]">
                    {trainingMode ? '—' : liveSession.bestScore}
                  </span>
                </div>
                <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.12em]">MEJOR</span>
              </div>
              {/* Average score */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1">
                  <TrendingUp size={10} className="text-[#ffb830]" />
                  <span className="font-display font-bold text-lg text-[#ffb830]">
                    {trainingMode ? '—' : liveSession.avgScore.toFixed(1)}
                  </span>
                </div>
                <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.12em]">PROMEDIO</span>
              </div>
              {/* Elapsed time */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1">
                  <Timer size={10} className="text-[#00e5ff]" />
                  <span className="font-display font-bold text-lg text-[#00e5ff]">
                    {liveSession.startTime
                      ? `${Math.floor((Date.now() - liveSession.startTime) / 1000)}s`
                      : '0s'}
                  </span>
                </div>
                <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.12em]">TIEMPO</span>
              </div>
              {/* Bullseyes (10-ring hits) */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1">
                  <Target size={10} className="text-[#ff3a28]" />
                  <span className="font-display font-bold text-lg text-[#ff3a28]">
                    {liveSession.shots.filter(s => s.score >= 10).length}
                  </span>
                </div>
                <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.12em]">DIANAS</span>
              </div>
            </div>

            {/* Mini shot history - last 8 shots as score pills */}
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
              <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.12em] flex-shrink-0">HISTORIAL:</span>
              {liveSession.shots.slice(-8).map((shot, idx) => {
                const isLast = idx === Math.min(8, liveSession.shots.length) - 1
                const color = isLast ? '#ff3a28' : (shot.score >= 9 ? '#ff3a28' : shot.score >= 7 ? '#ffb830' : shot.score >= 4 ? '#00e5ff' : '#4da6ff')
                return (
                  <span
                    key={idx}
                    className="flex-shrink-0 font-display font-bold text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      color,
                      background: `${color}15`,
                      border: `1px solid ${color}40`,
                    }}
                  >
                    {trainingMode ? '●' : shot.score}
                  </span>
                )
              })}
              {liveSession.shots.length > 8 && (
                <span className="font-mono-tactical text-[8px] text-[#3d4f68] flex-shrink-0">
                  +{liveSession.shots.length - 8}
                </span>
              )}
            </div>

            {/* Score distribution mini bar */}
            {!trainingMode && liveSession.shots.length > 1 && (
              <div className="mt-2 flex items-center gap-1">
                <span className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.12em] flex-shrink-0">DISTRIB:</span>
                <div className="flex-1 flex items-end gap-px h-4">
                  {Array.from({ length: 10 }, (_, ring) => {
                    const ringNum = ring + 1
                    const count = liveSession.shots.filter(s => s.score === ringNum).length
                    const maxCount = Math.max(1, ...Array.from({ length: 10 }, (_, r) => liveSession.shots.filter(s => s.score === r + 1).length))
                    const pct = (count / maxCount) * 100
                    const color = ringNum >= 9 ? '#ff3a28' : ringNum >= 7 ? '#ffb830' : ringNum >= 4 ? '#00e5ff' : '#4da6ff'
                    return (
                      <div
                        key={ringNum}
                        className="flex-1 rounded-t-sm transition-all duration-300"
                        style={{
                          height: `${Math.max(2, pct)}%`,
                          background: color,
                          opacity: count > 0 ? 0.8 : 0.15,
                        }}
                        title={`Ring ${ringNum}: ${count} shots`}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="flex gap-2.5 px-4 py-3 bg-[rgba(6,9,16,0.95)] flex-shrink-0"
        style={{ paddingBottom: 'calc(12px + var(--safe-bottom))' }}
      >
        <button
          onClick={stopAndShowResults}
          className="tactical-btn tactical-btn-danger flex-1"
        >
          <Square size={16} fill="currentColor" />
          DETENER
        </button>
        <button
          onClick={saveSession}
          disabled={saving || !liveSession || liveSession.shots.length === 0}
          className="tactical-btn tactical-btn-secondary flex-1"
        >
          <Save size={16} />
          {saving ? 'GUARDANDO…' : 'GUARDAR'}
        </button>
      </div>

      {/* Calibration overlay */}
      {showCalibrate && (
        <CalibrateOverlay onClose={() => setShowCalibrate(false)} videoRef={videoRef} />
      )}

      {/* Accushoot-style shot list panel (slides in from right) */}
      <ShotListPanel
        open={showShotList}
        onClose={() => setShowShotList(false)}
        session={liveSession}
        onUndo={undoLastShot}
        onClear={clearAllShots}
        coordW={coordSpace.w}
        coordH={coordSpace.h}
      />

      {/* Target type preset selector (bottom sheet) */}
      <TargetTypeSelector
        open={showTargetSelector}
        onClose={() => setShowTargetSelector(false)}
        currentType={settings.targetType}
        onSelect={handleSelectTargetType}
      />
    </div>
  )
}

/**
 * Last shot detail card — a transient popup that appears for ~3.5s after
 * each new impact, showing the score, distance from center, coordinates,
 * and a mini offset indicator (where the shot landed relative to POA).
 *
 * Accushoot shows a similar card right after each shot — it gives the
 * shooter instant feedback without having to open the full shot list.
 */
function LastShotDetailCard({
  shot,
  session,
  coordW,
  coordH,
}: {
  shot: ShotData
  session: SessionData
  coordW: number
  coordH: number
}) {
  // Calculate offset from target center (in cm) for the mini-POA indicator
  const cx = coordW / 2
  const cy = coordH / 2
  const maxR = Math.min(coordW, coordH) * 0.45
  const dxPx = shot.x - cx
  const dyPx = shot.y - cy
  // Normalize offset to [-1, 1] for the mini indicator
  const nx = dxPx / maxR
  const ny = dyPx / maxR

  // Direction text (clock positions)
  const angle = Math.atan2(dyPx, dxPx) * (180 / Math.PI)
  const direction =
    angle >= -22.5 && angle < 22.5 ? 'DERECHA'
    : angle >= 22.5 && angle < 67.5 ? 'ABAJO-DER'
    : angle >= 67.5 && angle < 112.5 ? 'ABAJO'
    : angle >= 112.5 && angle < 157.5 ? 'ABAJO-IZQ'
    : angle >= -157.5 && angle < -112.5 ? 'ARRIBA-IZQ'
    : angle >= -112.5 && angle < -67.5 ? 'ARRIBA'
    : angle >= -67.5 && angle < -22.5 ? 'ARRIBA-DER'
    : 'IZQUIERDA'

  const scoreColor =
    shot.score >= 10 ? '#ff3a28'
    : shot.score >= 9 ? '#ff7240'
    : shot.score >= 7 ? '#ffb830'
    : shot.score >= 4 ? '#00e5ff'
    : '#4da6ff'

  return (
    <div
      className="absolute top-1/2 left-1/2 pointer-events-none z-40"
      style={{
        transform: 'translate(-50%, -50%)',
        animation: 'lastShotPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lastShotPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes lastShotFade {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}} />
      <div
        className="relative rounded-xl p-3 backdrop-blur-xl"
        style={{
          background: 'rgba(10,14,26,0.92)',
          border: `1.5px solid ${scoreColor}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${scoreColor}40, 0 0 30px ${scoreColor}30`,
          minWidth: 200,
          animation: 'lastShotFade 3.5s ease-out forwards',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono-tactical text-[8px] text-[#7a8ca8] tracking-[0.2em]">
            IMPACTO #{shot.index}
          </span>
          <span
            className="font-mono-tactical text-[8px] tracking-[0.15em]"
            style={{ color: scoreColor }}
          >
            {direction}
          </span>
        </div>

        {/* Score + distance row */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-display font-black text-2xl"
            style={{
              background: `${scoreColor}20`,
              border: `2px solid ${scoreColor}`,
              color: scoreColor,
              boxShadow: `0 0 12px ${scoreColor}60`,
            }}
          >
            {session.trainingMode ? '●' : shot.score}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="font-display font-bold text-lg text-[#e8ecf5]">
                {shot.distanceM?.toFixed(0) ?? '—'}
              </span>
              <span className="font-mono-tactical text-[9px] text-[#7a8ca8]">cm del centro</span>
            </div>
            <div className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-wider mt-0.5">
              x={shot.x.toFixed(0)} · y={shot.y.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Mini POA offset indicator — 60x60 crosshair with shot position */}
        <div className="flex items-center justify-center pt-1 pb-0.5">
          <div className="relative" style={{ width: 56, height: 56 }}>
            {/* Background ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(122,140,168,0.3)',
              }}
            />
            {/* Cross hairs */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[rgba(122,140,168,0.2)]" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[rgba(122,140,168,0.2)]" />
            {/* Center dot (POA) */}
            <div
              className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{ background: '#ffb830', boxShadow: '0 0 4px #ffb830' }}
            />
            {/* Shot marker */}
            <div
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: scoreColor,
                boxShadow: `0 0 6px ${scoreColor}`,
                left: `${50 + nx * 45}%`,
                top: `${50 + ny * 45}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Drill HUD overlay — sticky top strip + collapsible goal checklist.
 * Shown only while a training drill is active. Renders real-time progress,
 * a countdown timer (for timed drills), and a per-criterion pass/fail checklist.
 */
function DrillHUD({
  drill,
  liveSession,
  active,
  now,
}: {
  drill: { type: DrillType; goal: DrillGoal }
  liveSession: SessionData
  active: boolean
  now: number
}) {
  const [checklistOpen, setChecklistOpen] = useState(false)

  const goal = drill.goal
  // Elapsed / remaining time (only meaningful when a startTime exists) —
  // computed before the early return so derived values are stable across renders.
  const elapsedSec = liveSession.startTime ? Math.max(0, (now - liveSession.startTime) / 1000) : 0
  const remainingSec = goal.timeLimitSec ? Math.max(0, goal.timeLimitSec - elapsedSec) : null
  const expired = remainingSec !== null && remainingSec <= 0 && active

  const def = DRILL_DEFINITIONS.find((d) => d.type === drill.type)
  if (!def) return null

  const shots = liveSession.shots
  const shotsLen = shots.length
  const totalScore = liveSession.totalScore
  const avgScore = liveSession.avgScore
  const bullseyeCount = shots.filter((s) => s.score >= 10).length
  const lowTime = remainingSec !== null && remainingSec > 0 && remainingSec < 10

  // Shot progress (count vs goal) — color shifts cyan → amber → green
  const shotGoal = goal.shotCount || 0
  const progressPct = shotGoal > 0 ? Math.min(100, (shotsLen / shotGoal) * 100) : 0
  const progressColor =
    progressPct >= 100 ? '#39ff7a' : progressPct >= 50 ? '#ffb830' : '#00e5ff'

  // Format seconds as MM:SS
  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }

  // Build the goal checklist — each item has a pending / achieved / failed state
  type ChecklistItem = { label: string; detail?: string; state: 'pending' | 'achieved' | 'failed' }
  const checklist: ChecklistItem[] = []

  if (goal.shotCount) {
    checklist.push({
      label: `${goal.shotCount} disparos`,
      detail: `${shotsLen}/${goal.shotCount}`,
      state: shotsLen >= goal.shotCount ? 'achieved' : 'pending',
    })
  }
  if (goal.targetScore) {
    checklist.push({
      label: `≥${goal.targetScore} pts`,
      detail: `${totalScore} pts`,
      state: totalScore >= goal.targetScore ? 'achieved' : 'pending',
    })
  }
  if (goal.targetAvg) {
    checklist.push({
      label: `≥${goal.targetAvg} prom`,
      detail: shotsLen > 0 ? avgScore.toFixed(1) : '—',
      state: shotsLen > 0 && avgScore >= goal.targetAvg ? 'achieved' : 'pending',
    })
  }
  if (goal.targetBullseyes) {
    checklist.push({
      label: `${goal.targetBullseyes} dianas`,
      detail: `${bullseyeCount}/${goal.targetBullseyes}`,
      state: bullseyeCount >= goal.targetBullseyes ? 'achieved' : 'pending',
    })
  }
  if (goal.timeLimitSec) {
    const shotsMet = !goal.shotCount || shotsLen >= goal.shotCount
    const withinTime = elapsedSec <= goal.timeLimitSec
    const state: ChecklistItem['state'] =
      shotsMet && withinTime && shotsLen > 0 ? 'achieved'
      : !withinTime && !shotsMet ? 'failed'
      : 'pending'
    checklist.push({
      label: `≤${goal.timeLimitSec}s`,
      detail: `${Math.floor(elapsedSec)}s`,
      state,
    })
  }
  if (goal.targetGroupCm) {
    let groupCm: number | null = null
    if (shots.length >= 2) {
      let maxDist = 0
      for (let i = 0; i < shots.length; i++) {
        for (let j = i + 1; j < shots.length; j++) {
          const d = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y)
          if (d > maxDist) maxDist = d
        }
      }
      const maxR = SIMULATOR_SIZE * 0.45
      const targetCm = 25 // standard target diameter
      groupCm = (maxDist / maxR) * (targetCm / 2)
    }
    checklist.push({
      label: `≤${goal.targetGroupCm}cm grupo`,
      detail: groupCm !== null ? `${groupCm.toFixed(1)}cm` : '—',
      state:
        groupCm === null ? 'pending'
        : groupCm <= goal.targetGroupCm ? 'achieved'
        : 'failed',
    })
  }

  const stateColor = (s: ChecklistItem['state']) =>
    s === 'achieved' ? '#39ff7a' : s === 'failed' ? '#ff3a28' : '#7a8ca8'

  return (
    <div
      className="relative z-20 flex-shrink-0 backdrop-blur-md border-b"
      style={{
        background: 'rgba(10, 14, 26, 0.88)',
        borderBottomColor: 'rgba(255, 184, 48, 0.45)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
        paddingTop: 'calc(8px + var(--safe-top))',
      }}
    >
      {/* Inline keyframe for the expired-timer hard blink (scoped to this component) */}
      <style dangerouslySetInnerHTML={{ __html: '@keyframes drillBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.3; } }' }} />
      {/* Top row: badge + drill identity (left), progress + timer + toggle (right) */}
      <div className="flex items-center gap-2 px-3 pb-2 flex-wrap">
        {/* DESAFÍO badge */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(255,184,48,0.15)] border border-[rgba(255,184,48,0.4)] flex-shrink-0">
          <Trophy size={10} className="text-[#ffb830]" />
          <span className="font-mono-tactical text-[9px] text-[#ffb830] tracking-[0.18em]">DESAFÍO</span>
        </div>

        {/* Drill icon + name + pass criteria */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 text-base"
            style={{
              background: 'linear-gradient(135deg, rgba(255,58,40,0.25), rgba(255,184,48,0.2))',
              border: '1px solid rgba(255,184,48,0.45)',
              boxShadow: '0 0 10px rgba(255,184,48,0.2)',
            }}
            aria-hidden="true"
          >
            <span>{def.icon}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-display font-bold text-sm text-[#e8ecf5] truncate tracking-wide leading-tight">
              {def.name.toUpperCase()}
            </span>
            <span className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.1em] truncate leading-tight">
              {def.passLabel.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Shot progress counter */}
        {shotGoal > 0 && (
          <div className="flex flex-col items-end flex-shrink-0">
            <span
              className="font-display font-bold text-base leading-none"
              style={{ color: progressColor, textShadow: `0 0 10px ${progressColor}80`, transition: 'color 0.3s' }}
            >
              {shotsLen}
              <span className="text-[#3d4f68]">/{shotGoal}</span>
            </span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em] mt-0.5">DISPAROS</span>
          </div>
        )}

        {/* Timer (only for timed drills) */}
        {remainingSec !== null && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md flex-shrink-0"
            style={{
              background: expired ? 'rgba(255,58,40,0.18)' : lowTime ? 'rgba(255,184,48,0.15)' : 'rgba(0,229,255,0.1)',
              border: `1px solid ${expired ? 'rgba(255,58,40,0.5)' : lowTime ? 'rgba(255,184,48,0.4)' : 'rgba(0,229,255,0.3)'}`,
              animation: expired ? 'drillBlink 1s linear infinite' : 'none',
            }}
          >
            <Clock
              size={12}
              style={{ color: expired ? '#ff3a28' : lowTime ? '#ffb830' : '#00e5ff' }}
            />
            <span
              className="font-mono-tactical text-xs tracking-wider"
              style={{ color: expired ? '#ff3a28' : lowTime ? '#ffb830' : '#00e5ff' }}
            >
              {expired ? 'EXPIRADO' : formatTime(remainingSec)}
            </span>
          </div>
        )}

        {/* Checklist toggle */}
        <button
          onClick={() => setChecklistOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[var(--bg-glass)] border border-[var(--border-subtle)] flex-shrink-0 hover:border-[var(--border-glow)] transition-colors"
          aria-label={checklistOpen ? 'Ocultar criterios' : 'Mostrar criterios'}
          aria-expanded={checklistOpen}
        >
          <Target size={11} className="text-[#7a8ca8]" />
          <ChevronDown
            size={12}
            className="text-[#7a8ca8] transition-transform"
            style={{ transform: checklistOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      </div>

      {/* Progress bar */}
      {shotGoal > 0 && (
        <div className="px-3 pb-2">
          <div className="h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${progressColor}80, ${progressColor})`,
                boxShadow: `0 0 8px ${progressColor}80`,
                transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1), background 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Collapsible goal checklist */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: checklistOpen ? '280px' : '0px' }}
      >
        <div className="px-3 pb-3 pt-1">
          <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.2em] block mb-1.5">
            CRITERIOS DE APROBACIÓN
          </span>
          <div className="flex flex-wrap gap-1.5">
            {checklist.map((item, i) => {
              const color = stateColor(item.state)
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border"
                  style={{
                    background: item.state === 'achieved' ? 'rgba(57,255,122,0.08)'
                      : item.state === 'failed' ? 'rgba(255,58,40,0.08)'
                      : 'rgba(255,255,255,0.03)',
                    borderColor: item.state === 'achieved' ? 'rgba(57,255,122,0.35)'
                      : item.state === 'failed' ? 'rgba(255,58,40,0.35)'
                      : 'rgba(122,140,168,0.25)',
                  }}
                >
                  {item.state === 'achieved' ? (
                    <CheckCircle2
                      size={11}
                      className="flex-shrink-0 animate-in fade-in zoom-in-50 duration-300"
                      style={{ color }}
                    />
                  ) : (
                    <XCircle size={11} className="flex-shrink-0" style={{ color }} />
                  )}
                  <span
                    className="font-mono-tactical text-[10px] tracking-wider"
                    style={{ color }}
                  >
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-wider ml-0.5">
                      · {item.detail}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function CalibrateOverlay({
  onClose,
  videoRef,
}: {
  onClose: () => void
  videoRef: React.RefObject<HTMLVideoElement | null>
}) {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)

  const calibrate = () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      showToast('Cámara no lista', 'error')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let sum = 0
    for (let i = 0; i < img.data.length; i += 4) {
      sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
    }
    const avg = sum / (img.data.length / 4)
    if (avg < 60) {
      setSettings({ sensitivity: Math.max(2, settings.sensitivity - 2) })
      showToast('Calibrado: escena oscura detectada', 'info')
    } else if (avg > 180) {
      setSettings({ sensitivity: Math.min(10, settings.sensitivity + 1) })
      showToast('Calibrado: escena brillante detectada', 'info')
    } else {
      showToast('Calibración completada ✓', 'success')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-[rgba(6,9,16,0.75)] backdrop-blur-[6px]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-[#0d1424] rounded-t-2xl border-t border-[var(--border-subtle)] animate-slide-up-sheet" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mt-3" />
        <h2 className="font-display font-bold text-sm tracking-[0.1em] px-5 pt-4 pb-2">CALIBRACIÓN DE CÁMARA</h2>
        <p className="px-5 pb-4 text-[13px] text-[#7a8ca8] leading-relaxed">
          Apunta la cámara al centro del blanco y presiona <strong className="text-[#ff3a28]">CALIBRAR</strong>.
          El sistema ajustará los parámetros de detección automáticamente según la iluminación actual.
        </p>
        <div className="relative mx-4 mb-4 rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
          <CalibrateVideoMirror videoRef={videoRef} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute left-1/4 right-1/4 h-px bg-[rgba(255,58,40,0.8)]" style={{ boxShadow: '0 0 6px #ff3a28' }} />
            <div className="absolute top-1/4 bottom-1/4 w-px bg-[rgba(255,58,40,0.8)]" style={{ boxShadow: '0 0 6px #ff3a28' }} />
            <div className="w-1/2 pb-1/2 rounded-full border-[1.5px] border-[rgba(255,58,40,0.6)]" />
          </div>
        </div>
        <div className="flex gap-3 px-4 pb-6">
          <button onClick={calibrate} className="tactical-btn tactical-btn-primary flex-1">CALIBRAR</button>
          <button onClick={onClose} className="tactical-btn tactical-btn-secondary flex-1">CANCELAR</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders a mirrored copy of the live camera video for the calibration preview,
 * without creating a second camera stream.
 */
function CalibrateVideoMirror({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const sourceVideo = videoRef.current
      const canvas = canvasRef.current
      if (sourceVideo && canvas && sourceVideo.videoWidth) {
        if (canvas.width !== sourceVideo.videoWidth) {
          canvas.width = sourceVideo.videoWidth
          canvas.height = sourceVideo.videoHeight
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [videoRef])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-cover"
    />
  )
}
