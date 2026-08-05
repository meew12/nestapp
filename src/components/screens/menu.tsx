'use client'

import { useState } from 'react'
import { useAppStore, refreshStats } from '@/lib/store'
import type { Tab } from './main-app'
import { WEATHER_CONDITIONS } from '@/lib/types'
import type { WeatherData } from '@/lib/types'
import { Settings, Crosshair, History, CreditCard, User, Shield, Camera, Telescope, X, TrendingUp, Thermometer, Wind, Droplets, Target, Trophy, Ruler, Zap, Flame, Calculator, BookOpen, Timer } from 'lucide-react'
import { showToast } from '@/components/shared/toast'

interface MenuScreenProps {
  onNavigate: (tab: Tab) => void
}

export function MenuScreen({ onNavigate }: MenuScreenProps) {
  const user = useAppStore((s) => s.user)
  const stats = useAppStore((s) => s.stats)
  const subscription = useAppStore((s) => s.subscription)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const setCameraMode = useAppStore((s) => s.setCameraMode)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const setLiveSession = useAppStore((s) => s.setLiveSession)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [trainingMode, setTrainingMode] = useState(false)
  const [weather, setWeather] = useState<WeatherData>({})
  const [distanceM, setDistanceM] = useState<number>(10)
  const activeDrill = useAppStore((s) => s.activeDrill)
  const setActiveDrill = useAppStore((s) => s.setActiveDrill)

  // Common shooting distances (meters)
  const DISTANCE_PRESETS = [
    { v: 5, label: '5m' },
    { v: 10, label: '10m' },
    { v: 15, label: '15m' },
    { v: 25, label: '25m' },
    { v: 50, label: '50m' },
    { v: 100, label: '100m' },
  ]

  const startSession = () => {
    // Initialize a fresh live session
    setLiveSession({
      trainingMode,
      shots: [],
      totalScore: 0,
      durationSec: 0,
      bestScore: 0,
      avgScore: 0,
      shotCount: 0,
      targetSize: settings.targetSize,
      distanceM,
      startTime: Date.now(),
      weather,
    })
    onNavigate('scan')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a]">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-[rgba(10,14,26,0.9)] backdrop-blur-xl border-b border-[var(--border-subtle)]"
        style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative w-6 h-6 flex-shrink-0">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#ff3a28] -translate-y-1/2" style={{ boxShadow: '0 0 4px #ff3a28' }} />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#ff3a28] -translate-x-1/2" style={{ boxShadow: '0 0 4px #ff3a28' }} />
            <div className="absolute inset-1 rounded-full border border-[rgba(255,58,40,0.5)]" />
          </div>
          <span className="font-display font-bold text-sm tracking-[0.08em] glitch-text">E-TARGET</span>
        </div>
        <div className="flex items-center gap-2.5">
          {user?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#ffb830] hover:border-[rgba(255,184,0,0.4)] hover:text-[#ffb830] transition-all"
              aria-label="Panel admin"
            >
              <Shield size={18} />
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:border-[var(--border-glow)] hover:text-[#ff3a28] transition-all"
            aria-label="Ajustes"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className="relative w-10 h-10 rounded-full flex-shrink-0"
            aria-label="Perfil"
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center font-display font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${user?.avatarColor || '#ff3a28'}, #0a0e1a)`, border: `1.5px solid ${user?.avatarColor || '#ff3a28'}` }}
            >
              {(user?.name?.[0] || user?.email[0] || 'U').toUpperCase()}
            </div>
            <div
              className="absolute -inset-[3px] rounded-full border-[1.5px] pointer-events-none"
              style={{ borderColor: user?.avatarColor || '#ff3a28', animation: 'avatarPulse 3s ease-in-out infinite' }}
            />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-6 relative scanline-overlay">
        {/* Quick Stats Summary Bar */}
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[rgba(10,14,26,0.5)]">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-glass)]">
            <Target size={12} className="text-[#00e5ff]" />
            <span className="font-display font-bold text-sm text-[#00e5ff]">{stats?.sessionCount ?? 0}</span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68]">SESIONES</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-glass)]">
            <Trophy size={12} className="text-[#ffb830]" />
            <span className="font-display font-bold text-sm text-[#ffb830]">{stats?.bestScore ?? '—'}</span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68]">MEJOR</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-glass)]">
            <Crosshair size={12} className="text-[#ff3a28]" />
            <span className="font-display font-bold text-sm text-[#ff3a28]">{stats?.totalShots ?? 0}</span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68]">DISPAROS</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-glass)]">
            <Zap size={12} className="text-[#39ff7a]" />
            <span className="font-display font-bold text-sm text-[#39ff7a]">0</span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68]">RACHA</span>
          </div>
        </div>

        {/* Hero target with radar sweep */}
        <div className="flex items-center justify-center py-6">
          <div className="relative w-[180px] h-[180px] flex items-center justify-center holographic-shimmer">
            {/* Radar sweep glow */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,58,40,0.12) 30deg, transparent 60deg, transparent 360deg)',
                animation: 'radarSweep 4s linear infinite',
              }}
            />
            {/* Concentric rings */}
            <div className="absolute w-[180px] h-[180px] rounded-full border-[1.5px] border-[rgba(255,58,40,0.15)]" />
            <div className="absolute w-[144px] h-[144px] rounded-full border-[1.5px] border-[rgba(255,58,40,0.22)]" />
            <div className="absolute w-[108px] h-[108px] rounded-full border-[1.5px] border-[rgba(255,58,40,0.32)]" />
            <div className="absolute w-[72px] h-[72px] rounded-full border-[1.5px] border-[rgba(255,58,40,0.5)]" />
            <div className="absolute w-9 h-9 rounded-full border-[1.5px] border-[rgba(255,58,40,0.8)]" />
            {/* Crosshair lines */}
            <div className="absolute left-0 right-0 h-px bg-[rgba(255,58,40,0.15)]" />
            <div className="absolute top-0 bottom-0 w-px bg-[rgba(255,58,40,0.15)]" />
            {/* Center dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff3a28] z-10" style={{ boxShadow: '0 0 12px #ff3a28, 0 0 24px rgba(255,58,40,0.35)', animation: 'pulseRing 2s ease-in-out infinite' }} />
            {/* Scan sweep line */}
            <div
              className="absolute left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, #00e5ff, transparent)', boxShadow: '0 0 8px #00e5ff', animation: 'scanSweep 3s ease-in-out infinite' }}
            />
            {/* Tick marks at cardinal points */}
            {[0, 90, 180, 270].map((deg) => (
              <div
                key={deg}
                className="absolute w-0.5 h-3 bg-[rgba(255,58,40,0.4)]"
                style={{
                  top: '50%',
                  left: '50%',
                  transformOrigin: '0 0',
                  transform: `rotate(${deg}deg) translateY(-90px)`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Subscription banner */}
        {subscription && subscription.status === 'active' ? (
          <div className="mx-4 mb-4 tactical-card tactical-corners p-3 flex items-center gap-3 border-l-2 border-l-[#39ff7a]">
            <div className="w-8 h-8 rounded-full bg-[rgba(57,255,122,0.15)] flex items-center justify-center">
              <CreditCard size={16} className="text-[#39ff7a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#7a8ca8]">SUSCRIPCIÓN ACTIVA</p>
              <p className="text-sm font-semibold text-[#e8ecf5] truncate">{subscription.plan.name}</p>
            </div>
            <button
              onClick={() => onNavigate('subscription')}
              className="text-xs text-[#39ff7a] font-semibold hover:underline"
            >
              VER
            </button>
          </div>
        ) : (
          <div className="mx-4 mb-4 tactical-card p-3 flex items-center gap-3 border-l-2 border-l-[#ffb830]">
            <div className="w-8 h-8 rounded-full bg-[rgba(255,184,0,0.15)] flex items-center justify-center">
              <CreditCard size={16} className="text-[#ffb830]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#7a8ca8]">SIN SUSCRIPCIÓN</p>
              <p className="text-sm font-semibold text-[#e8ecf5]">Suscríbete para desbloquear todo</p>
            </div>
            <button
              onClick={() => onNavigate('subscription')}
              className="text-xs text-[#ffb830] font-semibold hover:underline"
            >
              VER PLANES
            </button>
          </div>
        )}

        {/* Active drill banner */}
        {activeDrill && (
          <div className="mx-4 mb-4 tactical-card p-3.5 relative overflow-hidden border-l-2 border-l-[#ffb830] animated-border-card">
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,184,0,0.08), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3.5s linear infinite',
              }}
            />
            <div className="relative flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,184,0,0.18), rgba(255,58,40,0.12))',
                  border: '1px solid rgba(255,184,0,0.4)',
                  boxShadow: '0 0 16px rgba(255,184,0,0.25)',
                }}
              >
                {activeDrill.type === 'bullseye' && '🎯'}
                {activeDrill.type === 'speed' && '⚡'}
                {activeDrill.type === 'precision' && '🎖️'}
                {activeDrill.type === 'rapid' && '🔥'}
                {activeDrill.type === 'marksman' && '🏆'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono-tactical text-[9px] text-[#ffb830] tracking-[0.2em] uppercase flex items-center gap-1.5">
                  <span className="live-dot live-dot-red" aria-hidden="true" />
                  DESAFÍO ACTIVO
                </p>
                <p className="text-sm font-semibold text-[#e8ecf5] truncate font-display">
                  {activeDrill.type === 'bullseye' && 'Reto Diana'}
                  {activeDrill.type === 'speed' && 'Disparo Rápido'}
                  {activeDrill.type === 'precision' && 'Grupo Preciso'}
                  {activeDrill.type === 'rapid' && 'Fuego Rápido'}
                  {activeDrill.type === 'marksman' && 'Tirador de Elite'}
                </p>
                <p className="text-[10px] text-[#7a8ca8] mt-0.5 truncate">
                  {activeDrill.type === 'bullseye' && '5 impactos en zona 9-10'}
                  {activeDrill.type === 'speed' && '≥30 pts en ≤30s'}
                  {activeDrill.type === 'precision' && 'Grupo ≤5cm'}
                  {activeDrill.type === 'rapid' && '≥60 pts en ≤60s'}
                  {activeDrill.type === 'marksman' && 'Promedio ≥8 en 10 disparos'}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveDrill(null)
                  showToast('Desafío cancelado', 'info')
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ca8] hover:text-[#ff3a28] hover:bg-[var(--red-dim)] transition-colors flex-shrink-0"
                aria-label="Cancelar desafío"
              >
                <X size={16} />
              </button>
            </div>
            <button
              onClick={startSession}
              className="relative w-full mt-3 py-2.5 rounded-lg font-display font-bold text-xs tracking-[0.18em] text-white transition-all active:scale-[0.98] overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #ffb830 0%, #ff7a30 100%)',
                boxShadow: '0 0 20px rgba(255,184,0,0.3)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Zap size={14} />
                CONTINUAR DESAFÍO
              </span>
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div className="mx-4 tactical-card flex items-center py-3.5 relative overflow-hidden">
          {/* Subtle shimmer */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,58,40,0.04), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 6s linear infinite',
            }}
          />
          <div className="relative flex-1 flex flex-col items-center gap-1">
            <span className="font-display font-bold text-2xl text-[#ff3a28]" style={{ textShadow: '0 0 12px rgba(255,58,40,0.3)' }}>
              {stats?.totalShots ?? 0}
            </span>
            <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">DISPAROS</span>
          </div>
          <div className="relative w-px h-10 bg-[var(--border-subtle)]" />
          <div className="relative flex-1 flex flex-col items-center gap-1">
            <span className="font-display font-bold text-2xl text-[#ff3a28]" style={{ textShadow: '0 0 12px rgba(255,58,40,0.3)' }}>
              {stats?.bestScore ?? '—'}
            </span>
            <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">MEJOR</span>
          </div>
          <div className="relative w-px h-10 bg-[var(--border-subtle)]" />
          <div className="relative flex-1 flex flex-col items-center gap-1">
            <span className="font-display font-bold text-2xl text-[#ff3a28]" style={{ textShadow: '0 0 12px rgba(255,58,40,0.3)' }}>
              {stats?.sessionCount ?? 0}
            </span>
            <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">SESIONES</span>
          </div>
        </div>

        {/* Camera mode selector */}
        <div className="mx-4 mt-4 tactical-card p-4">
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3">
            Cámara / Telescopio
          </p>
          <div className="bg-[var(--bg-glass)] rounded-xl p-1 grid grid-cols-2 gap-1">
            <button
              onClick={() => setCameraMode('mobile')}
              className={`flex flex-col items-center gap-2 py-3 rounded-lg border transition-all duration-200 ${
                cameraMode === 'mobile'
                  ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                  : 'border-transparent bg-transparent text-[#7a8ca8] hover:text-[#e8ecf5]'
              }`}
              style={cameraMode === 'mobile' ? { boxShadow: '0 0 12px rgba(255,58,40,0.2)' } : {}}
            >
              <Camera size={20} />
              <span className="text-xs font-semibold">MÓVIL</span>
            </button>
            <button
              onClick={() => setCameraMode('telescope')}
              className={`flex flex-col items-center gap-2 py-3 rounded-lg border transition-all duration-200 ${
                cameraMode === 'telescope'
                  ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                  : 'border-transparent bg-transparent text-[#7a8ca8] hover:text-[#e8ecf5]'
              }`}
              style={cameraMode === 'telescope' ? { boxShadow: '0 0 12px rgba(255,58,40,0.2)' } : {}}
            >
              <Telescope size={20} />
              <span className="text-xs font-semibold">TELESCOPIO</span>
            </button>
          </div>
        </div>

        {/* Training mode toggle */}
        <div className="mx-4 mt-3.5 tactical-card p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#e8ecf5] tracking-[0.08em]">
              <Crosshair size={16} />
              MODO ENTRENAMIENTO
            </label>
            <button
              onClick={() => setTrainingMode(!trainingMode)}
              className={`relative w-[46px] h-[26px] rounded-full border transition-all ${
                trainingMode
                  ? 'bg-[var(--red-dim)] border-[var(--border-glow)]'
                  : 'bg-white/8 border-[var(--border-subtle)]'
              }`}
            >
              <span
                className={`absolute top-[3px] w-[18px] h-[18px] rounded-full transition-all ${
                  trainingMode ? 'left-[calc(100%-21px)] bg-[#ff3a28]' : 'left-[3px] bg-[#3d4f68]'
                }`}
                style={trainingMode ? { boxShadow: '0 0 8px #ff3a28' } : {}}
              />
            </button>
          </div>
          <p className="text-xs text-[#7a8ca8] leading-relaxed">
            {trainingMode
              ? 'Modo entrenamiento — Sin puntuación, solo detección de impactos'
              : 'Modo competencia — Los impactos se puntúan automáticamente'}
          </p>
        </div>

        {/* Shooting distance selector */}
        <div className="mx-4 mt-3.5 tactical-card p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase flex items-center gap-1.5">
              <Ruler size={11} />
              Distancia de tiro
            </label>
            <span className="font-display font-bold text-base text-[#00e5ff]" style={{ textShadow: '0 0 12px rgba(0,229,255,0.35)' }}>
              {distanceM}<span className="text-[10px] text-[#3d4f68] ml-1 font-mono-tactical">m</span>
            </span>
          </div>
          {/* Distance presets */}
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {DISTANCE_PRESETS.map((d) => (
              <button
                key={d.v}
                onClick={() => setDistanceM(d.v)}
                className={`py-2 rounded-md border text-[10px] font-semibold transition-all ${
                  distanceM === d.v
                    ? 'border-[#00e5ff] bg-[rgba(0,229,255,0.12)] text-[#00e5ff]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8] hover:border-[rgba(0,229,255,0.3)]'
                }`}
                style={distanceM === d.v ? { boxShadow: '0 0 12px rgba(0,229,255,0.25)' } : {}}
              >
                {d.label}
              </button>
            ))}
          </div>
          {/* Custom distance slider + input */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={200}
              value={distanceM}
              onChange={(e) => setDistanceM(parseInt(e.target.value))}
              className="flex-1 h-1 rounded-full bg-white/8 appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00e5ff] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,229,255,0.5)]"
            />
            <div className="flex items-center gap-1 w-[70px] flex-shrink-0">
              <input
                type="number"
                min={1}
                max={500}
                value={distanceM}
                onChange={(e) => setDistanceM(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                className="tactical-input w-full text-center text-xs"
              />
              <span className="text-[10px] text-[#3d4f68] font-mono-tactical flex-shrink-0">m</span>
            </div>
          </div>
          <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] mt-2">
            ≈ {(distanceM * 3.281).toFixed(1)} ft · 1 MOA @ {distanceM}m = {(distanceM * 0.0291).toFixed(2)}cm
          </p>
        </div>

        {/* Environmental conditions */}
        <div className="mx-4 mt-3.5 tactical-card p-4">
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-3">
            Condiciones ambientales
          </p>
          {/* Weather condition selector */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {WEATHER_CONDITIONS.map((wc) => (
              <button
                key={wc.value}
                onClick={() => setWeather((prev) => ({ ...prev, condition: prev.condition === wc.value ? undefined : wc.value }))}
                className={`flex flex-col items-center gap-1.5 py-2 rounded-lg border transition-all text-center ${
                  weather.condition === wc.value
                    ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8]'
                }`}
              >
                <span className="text-lg leading-none">{wc.icon}</span>
                <span className="text-[10px] font-semibold leading-tight">{wc.label}</span>
              </button>
            ))}
          </div>
          {/* Temperature, wind, humidity inputs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] uppercase flex items-center gap-1">
                <Thermometer size={10} /> TEMP
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={weather.temp ?? ''}
                  onChange={(e) => setWeather((prev) => ({ ...prev, temp: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  placeholder="—"
                  className="tactical-input w-full text-center text-sm"
                />
                <span className="text-[10px] text-[#3d4f68] font-mono-tactical">°C</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] uppercase flex items-center gap-1">
                <Wind size={10} /> VIENTO
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={weather.wind ?? ''}
                  onChange={(e) => setWeather((prev) => ({ ...prev, wind: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  placeholder="—"
                  className="tactical-input w-full text-center text-sm"
                />
                <span className="text-[10px] text-[#3d4f68] font-mono-tactical">km/h</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em] uppercase flex items-center gap-1">
                <Droplets size={10} /> HUMEDAD
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={weather.humidity ?? ''}
                  onChange={(e) => setWeather((prev) => ({ ...prev, humidity: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  placeholder="—"
                  className="tactical-input w-full text-center text-sm"
                />
                <span className="text-[10px] text-[#3d4f68] font-mono-tactical">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions grid */}
        <div className="mx-4 mt-4 grid grid-cols-4 gap-2">
          <QuickAction icon={<History size={18} />} label="HISTORIAL" onClick={() => onNavigate('history')} />
          <QuickAction icon={<Target size={18} />} label="ENTRENAR" onClick={() => onNavigate('drills')} />
          <QuickAction icon={<Trophy size={18} />} label="RANKING" onClick={() => onNavigate('leaderboard')} />
          <QuickAction icon={<TrendingUp size={18} />} label="ESTADÍSTICAS" onClick={() => onNavigate('stats')} />
        </div>

        {/* Secondary actions row */}
        <div className="mx-4 mt-2 grid grid-cols-3 gap-2">
          <QuickAction icon={<Flame size={16} />} label="MAPA CALOR" onClick={() => onNavigate('heatmap')} compact />
          <QuickAction icon={<Calculator size={16} />} label="CALCULADORA" onClick={() => onNavigate('calculator')} compact />
          <QuickAction icon={<Timer size={16} />} label="METRÓNOMO" onClick={() => onNavigate('metronome')} compact />
          <QuickAction icon={<CreditCard size={16} />} label="PLANES" onClick={() => onNavigate('subscription')} compact />
          <QuickAction icon={<User size={16} />} label="PERFIL" onClick={() => onNavigate('profile')} compact />
          <QuickAction icon={<BookOpen size={16} />} label="CONSEJOS" onClick={() => onNavigate('tips')} compact />
        </div>

        {/* Start button */}
        <div className="mx-4 mt-6" style={{ paddingBottom: 'calc(24px + var(--safe-bottom))' }}>
          <button
            onClick={startSession}
            className="relative w-full overflow-hidden rounded-2xl border-0 cursor-pointer transition-all active:scale-[0.97] start-btn-pulse animated-border breathe-glow"
            style={{
              background: 'linear-gradient(135deg, #cc1a0a 0%, #ff3a28 50%, #ff7240 100%)',
            }}
          >
            <div className="flex items-center justify-center gap-3 py-[18px] px-6 relative z-10">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="font-display font-bold text-xl tracking-[0.15em] text-white">INICIAR</span>
            </div>
            {/* Animated gradient sweep overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 55%, transparent 60%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s linear infinite',
              }}
            />
          </button>
        </div>
      </main>

      {/* Settings bottom sheet */}
      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          setSettings={setSettings}
        />
      )}
    </div>
  )
}

function QuickAction({ icon, label, onClick, compact }: { icon: React.ReactNode; label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-2 ${compact ? 'py-2.5' : 'py-3.5'} rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:scale-105 hover:border-[var(--border-glow)] active:scale-95 transition-all overflow-hidden tactical-card-enhanced card-hover-lift`}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(255,58,40,0.1) 0%, transparent 70%)' }}
      />
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-[#ff3a28] opacity-0 group-hover:opacity-60 transition-opacity" style={{ boxShadow: '0 0 4px #ff3a28' }} />
      <div className="relative transition-transform group-hover:scale-110">
        {icon}
      </div>
      <span className="relative font-mono-tactical text-[10px] tracking-[0.12em] group-hover:text-[#ff3a28] transition-colors">{label}</span>
    </button>
  )
}

function SettingsSheet({
  onClose,
  settings,
  setSettings,
}: {
  onClose: () => void
  settings: ReturnType<typeof useAppStore.getState>['settings']
  setSettings: ReturnType<typeof useAppStore.getState>['setSettings']
}) {
  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-[rgba(6,9,16,0.75)] backdrop-blur-[6px]" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#0d1424] rounded-t-2xl border-t border-[var(--border-subtle)] max-h-[90vh] overflow-y-auto animate-slide-up-sheet"
        style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mt-3" />

        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[var(--border-subtle)]">
          <h2 className="font-display font-bold text-sm tracking-[0.1em]">CALIBRACIÓN Y AJUSTES</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#7a8ca8] hover:text-[#ff3a28]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Target size */}
          <div className="flex flex-col gap-2.5">
            <label className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase">
              Tamaño del blanco
            </label>
            <div className="flex gap-2">
              {([
                { v: 'standard', label: 'Estándar', sub: '25 cm' },
                { v: 'large', label: 'Grande', sub: '50 cm' },
                { v: 'small', label: 'Pequeño', sub: '10 cm' },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setSettings({ targetSize: opt.v })}
                  className={`flex-1 py-2.5 px-1 rounded-lg border text-center transition-all ${
                    settings.targetSize === opt.v
                      ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8]'
                  }`}
                >
                  <span className="block text-[13px] font-semibold">{opt.label}</span>
                  <span className="block text-[10px] text-[#3d4f68]">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity */}
          <div className="flex flex-col gap-2">
            <label className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase">
              Sensibilidad de detección
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={settings.sensitivity}
              onChange={(e) => setSettings({ sensitivity: parseInt(e.target.value) })}
              className="w-full h-1 rounded-full bg-white/8 appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ff3a28] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,58,40,0.4)]"
            />
            <div className="flex justify-between font-mono-tactical text-[10px] text-[#3d4f68]">
              <span>Baja</span>
              <span className="text-[#ff3a28]">{settings.sensitivity}</span>
              <span>Alta</span>
            </div>
          </div>

          {/* Min area */}
          <div className="flex flex-col gap-2">
            <label className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase">
              Umbral de área (px²)
            </label>
            <input
              type="range"
              min={10}
              max={500}
              value={settings.minArea}
              onChange={(e) => setSettings({ minArea: parseInt(e.target.value) })}
              className="w-full h-1 rounded-full bg-white/8 appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ff3a28] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,58,40,0.4)]"
            />
            <div className="flex justify-between font-mono-tactical text-[10px] text-[#3d4f68]">
              <span>10</span>
              <span className="text-[#ff3a28]">{settings.minArea}</span>
              <span>500</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="bg-[var(--bg-glass)] border border-[var(--border-subtle)] rounded-lg p-3.5 space-y-3.5">
            {([
              { key: 'soundEnabled', label: 'Sonido de impacto' },
              { key: 'vibration', label: 'Vibración' },
              { key: 'flashEnabled', label: 'Flash en impacto' },
            ] as const).map((t) => (
              <div key={t.key} className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#7a8ca8]">{t.label}</span>
                <button
                  onClick={() => setSettings({ [t.key]: !settings[t.key] } as any)}
                  className={`relative w-[38px] h-[22px] rounded-full border transition-all ${
                    settings[t.key]
                      ? 'bg-[var(--red-dim)] border-[var(--border-glow)]'
                      : 'bg-white/8 border-[var(--border-subtle)]'
                  }`}
                >
                  <span
                    className={`absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all ${
                      settings[t.key] ? 'left-[calc(100%-17px)] bg-[#ff3a28]' : 'left-[3px] bg-[#3d4f68]'
                    }`}
                    style={settings[t.key] ? { boxShadow: '0 0 8px #ff3a28' } : {}}
                  />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              showToast('Calibración automática disponible en pantalla de escaneo', 'info')
              onClose()
            }}
            className="tactical-btn tactical-btn-secondary w-full"
          >
            CALIBRAR CÁMARA
          </button>
        </div>
      </div>
    </div>
  )
}
