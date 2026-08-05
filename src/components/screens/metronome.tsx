'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Tab } from './main-app'
import { ArrowLeft, Play, Pause, Plus, Minus, Volume2, Timer } from 'lucide-react'

interface MetronomeScreenProps {
  onNavigate: (tab: Tab) => void
}

type PatternMode = 'constante' | 'decima'

const BPM_PRESETS = [
  { bpm: 40, label: 'LENTO' },
  { bpm: 60, label: 'MEDIO' },
  { bpm: 90, label: 'RÁPIDO' },
  { bpm: 120, label: 'TÁCTICO' },
]

export function MetronomeScreen({ onNavigate }: MetronomeScreenProps) {
  const [bpm, setBpm] = useState(60)
  const [playing, setPlaying] = useState(false)
  const [pattern, setPattern] = useState<PatternMode>('constante')
  const [volume, setVolume] = useState(70)
  const [beatCount, setBeatCount] = useState(0)
  const [beatFlash, setBeatFlash] = useState(false)

  const audioCtx = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const beatRef = useRef(0)

  // Play a click using Web Audio API
  const playClick = useCallback((accent: boolean) => {
    if (!audioCtx.current) audioCtx.current = new AudioContext()
    const ctx = audioCtx.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = accent ? 1200 : 800
    osc.type = 'sine'
    gain.gain.value = (volume / 100) * (accent ? 0.5 : 0.3)
    const now = ctx.currentTime
    osc.start(now)
    osc.stop(now + 0.05)
  }, [volume])

  // Trigger a beat
  const triggerBeat = useCallback(() => {
    beatRef.current += 1
    const currentBeat = beatRef.current
    const isAccent = pattern === 'decima' && currentBeat % 10 === 0

    playClick(isAccent)
    setBeatCount(currentBeat)
    setBeatFlash(true)
    setTimeout(() => setBeatFlash(false), 100)
  }, [pattern, playClick])

  // Start / stop the metronome
  useEffect(() => {
    if (playing) {
      // Play first beat immediately
      triggerBeat()
      const intervalMs = 60000 / bpm
      intervalRef.current = setInterval(triggerBeat, intervalMs)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [playing, bpm, triggerBeat])

  // Update interval when bpm changes while playing
  useEffect(() => {
    if (playing && intervalRef.current) {
      clearInterval(intervalRef.current)
      const intervalMs = 60000 / bpm
      intervalRef.current = setInterval(triggerBeat, intervalMs)
    }
  }, [bpm, playing, triggerBeat])

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioCtx.current) {
        audioCtx.current.close()
        audioCtx.current = null
      }
    }
  }, [])

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
    } else {
      beatRef.current = 0
      setBeatCount(0)
      setPlaying(true)
    }
  }

  const adjustBpm = (delta: number) => {
    setBpm((prev) => Math.max(20, Math.min(180, prev + delta)))
  }

  const displayBeat = pattern === 'decima' ? (beatCount % 10 || (beatCount > 0 ? 10 : 0)) : beatCount

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a] relative">
      {/* Beat flash overlay */}
      {beatFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-100"
          style={{ background: 'rgba(255,58,40,0.08)' }}
        />
      )}

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
          <h1 className="font-display font-bold text-base tracking-[0.1em] glitch-text">METRÓNOMO</h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">
            ENTRENADOR DE CADENCIA
          </p>
        </div>
        <div className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)]">
          <Timer size={16} className="text-[#ffb830]" />
        </div>
      </header>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-5"
        style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}
      >
        {/* Main BPM display circle */}
        <div className="flex justify-center py-4">
          <div
            className={`relative w-48 h-48 rounded-full border-2 border-[var(--border-glow)] bg-[var(--red-dim)] flex items-center justify-center ${playing ? 'breathe-glow' : ''}`}
          >
            {/* Pulse ring when playing */}
            {playing && (
              <>
                <div
                  className="absolute inset-0 rounded-full border-2 border-[#ff3a28] opacity-0"
                  style={{ animation: 'pulseRing 1s ease-out infinite' }}
                />
                <div
                  className="absolute inset-[-8px] rounded-full border border-[rgba(255,58,40,0.3)] opacity-0"
                  style={{ animation: 'pulseRing 1s ease-out infinite 0.3s' }}
                />
              </>
            )}
            <div className="flex flex-col items-center relative z-10">
              <span
                className="font-display font-bold text-6xl tracking-[0.05em]"
                style={{
                  color: '#ff3a28',
                  textShadow: playing ? '0 0 20px rgba(255,58,40,0.5), 0 0 40px rgba(255,58,40,0.2)' : 'none',
                }}
              >
                {bpm}
              </span>
              <span className="font-mono-tactical text-xs text-[#3d4f68] tracking-[0.2em] mt-1">BPM</span>
            </div>
          </div>
        </div>

        {/* Pattern mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { setPattern('constante'); setBeatCount(0); beatRef.current = 0 }}
            className={`flex-1 py-2.5 rounded-lg border text-center transition-all ${
              pattern === 'constante'
                ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8] hover:border-[var(--border-glow)]'
            }`}
          >
            <span className="block text-sm font-semibold">CONSTANTE</span>
            <span className="block text-[10px] text-[#3d4f68]">Click continuo</span>
          </button>
          <button
            onClick={() => { setPattern('decima'); setBeatCount(0); beatRef.current = 0 }}
            className={`flex-1 py-2.5 rounded-lg border text-center transition-all ${
              pattern === 'decima'
                ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8] hover:border-[var(--border-glow)]'
            }`}
          >
            <span className="block text-sm font-semibold">DÉCIMA</span>
            <span className="block text-[10px] text-[#3d4f68]">10 disparos</span>
          </button>
        </div>

        {/* BPM Control */}
        <div className="tactical-card p-4 space-y-4">
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase">
            VELOCIDAD
          </p>

          {/* Slider with +/- buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustBpm(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:border-[var(--border-glow)] hover:text-[#ff3a28] transition-all active:scale-95"
              aria-label="BPM -1"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={20}
                max={180}
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                className="w-full h-2 rounded-full bg-white/8 appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ff3a28] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,58,40,0.4)]"
              />
              <div className="flex justify-between font-mono-tactical text-[9px] text-[#3d4f68] mt-1">
                <span>20</span>
                <span>180</span>
              </div>
            </div>
            <button
              onClick={() => adjustBpm(1)}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:border-[var(--border-glow)] hover:text-[#ff3a28] transition-all active:scale-95"
              aria-label="BPM +1"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Preset buttons */}
          <div className="grid grid-cols-4 gap-2">
            {BPM_PRESETS.map((preset) => (
              <button
                key={preset.bpm}
                onClick={() => setBpm(preset.bpm)}
                className={`py-2 rounded-lg border text-center transition-all active:scale-95 ${
                  bpm === preset.bpm
                    ? 'border-[var(--border-glow)] bg-[var(--red-dim)] text-[#ff3a28]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[#7a8ca8] hover:border-[var(--border-glow)]'
                }`}
              >
                <span className="block text-xs font-semibold">{preset.label}</span>
                <span className="block text-[10px] text-[#3d4f68]">{preset.bpm}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Volume control */}
        <div className="tactical-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase">
              VOLUMEN
            </p>
            <div className="flex items-center gap-1.5">
              <Volume2 size={12} className="text-[#00e5ff]" />
              <span className="font-mono-tactical text-xs text-[#00e5ff]">{volume}%</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full bg-white/8 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00e5ff] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,229,255,0.4)]"
          />
        </div>

        {/* Beat counter */}
        {playing && (
          <div className="flex justify-center">
            <div className="tactical-card px-6 py-3 flex items-center gap-3 border-[var(--border-subtle)]">
              <span className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">DISPARO</span>
              <span
                className="font-display font-bold text-2xl text-[#ffb830]"
                style={{ textShadow: '0 0 10px rgba(255,184,48,0.3)' }}
              >
                {displayBeat}
              </span>
              {pattern === 'decima' && (
                <span className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">/10</span>
              )}
            </div>
          </div>
        )}

        {/* Start/Stop button */}
        <div className="pt-2">
          <button
            onClick={togglePlay}
            className={`relative w-full overflow-hidden rounded-2xl border-0 cursor-pointer transition-all active:scale-[0.97] ${
              playing ? 'breathe-glow' : ''
            }`}
            style={{
              background: playing
                ? 'linear-gradient(135deg, #005566 0%, #00e5ff 50%, #00aaff 100%)'
                : 'linear-gradient(135deg, #cc1a0a 0%, #ff3a28 50%, #ff7240 100%)',
            }}
          >
            <div className="flex items-center justify-center gap-3 py-[18px] px-6 relative z-10">
              {playing ? <Pause size={24} className="text-white" /> : <Play size={24} className="text-white" />}
              <span className="font-display font-bold text-xl tracking-[0.15em] text-white">
                {playing ? 'DETENER' : 'INICIAR'}
              </span>
            </div>
            {/* Shimmer overlay */}
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

        {/* Info text */}
        <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.12em] text-center leading-relaxed">
          {pattern === 'constante'
            ? 'CADENCIA CONSTANTE · CLICK CONTINUO A LA VELOCIDAD SELECCIONADA'
            : 'CADENCIA DÉCIMA · 9 CLICKS REGULARES + 1 ACENTO CADA 10 DISPAROS'}
        </p>
      </div>
    </div>
  )
}
