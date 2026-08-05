'use client'

import { useEffect, useState } from 'react'

const LOADER_STEPS = [
  { pct: 15, msg: 'Cargando módulos…' },
  { pct: 32, msg: 'Inicializando cámara…' },
  { pct: 50, msg: 'Cargando OpenCV.js…' },
  { pct: 68, msg: 'Preparando detección…' },
  { pct: 84, msg: 'Calibrando sistema…' },
  { pct: 94, msg: 'Sincronizando blanco…' },
  { pct: 100, msg: 'Listo para disparar 🎯' },
]

/**
 * Splash screen — shown for ~2.6s on app boot.
 *
 * Uses the official E-TARGET logo (`/logo1.png`) over a deep tactical
 * `#070911` background with a subtle animated grid + corner HUD brackets.
 * The loader steps mimic a real targeting system boot sequence.
 */
export function Splash() {
  const [step, setStep] = useState(0)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    let i = 0
    const advance = () => {
      if (i >= LOADER_STEPS.length) return
      const s = LOADER_STEPS[i]
      setPct(s.pct)
      setStep(i)
      i++
      const delay = i === LOADER_STEPS.length ? 700 : 320
      setTimeout(advance, delay)
    }
    const t = setTimeout(advance, 250)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ background: '#070911' }}
    >
      {/* Animated tactical grid */}
      <div
        className="absolute inset-[-50%] opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,58,40,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,58,40,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          animation: 'gridDrift 22s linear infinite',
        }}
      />
      {/* Radial vignette to deepen the background around the logo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(7,9,17,0.75) 65%, rgba(7,9,17,0.95) 100%)',
        }}
      />
      {/* Slow red glow pulse behind the logo */}
      <div
        className="absolute left-1/2 top-1/2 w-[360px] h-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,58,40,0.18) 0%, rgba(255,58,40,0) 70%)',
          animation: 'splashGlow 3.5s ease-in-out infinite',
        }}
      />

      {/* HUD corner brackets */}
      <div className="absolute top-5 left-5 w-7 h-7 opacity-50 border-t-[1.5px] border-l-[1.5px] border-[#ff3a28]" />
      <div className="absolute top-5 right-5 w-7 h-7 opacity-50 border-t-[1.5px] border-r-[1.5px] border-[#ff3a28]" />
      <div className="absolute bottom-5 left-5 w-7 h-7 opacity-50 border-b-[1.5px] border-l-[1.5px] border-[#ff3a28]" />
      <div className="absolute bottom-5 right-5 w-7 h-7 opacity-50 border-b-[1.5px] border-r-[1.5px] border-[#ff3a28]" />

      {/* Top status bar — tactical boot text */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.25em] uppercase">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#39ff7a] animate-pulse" />
          SYS · OK
        </span>
        <span className="text-[#1e2840]">|</span>
        <span>v2.4.1</span>
        <span className="text-[#1e2840]">|</span>
        <span className="text-[#ff3a28]">E-TARGET</span>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-4 animate-fade-in-up px-6">
        {/* Logo image with subtle entrance + scanline sweep */}
        <div className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] flex items-center justify-center">
          {/* Pulsing reticle ring behind the logo */}
          <div
            className="absolute inset-0 rounded-full border border-[rgba(255,58,40,0.35)]"
            style={{ animation: 'pulseRing 2.4s ease-in-out infinite' }}
          />
          <div
            className="absolute inset-3 rounded-full border border-[rgba(255,58,40,0.18)]"
            style={{ animation: 'pulseRing 2.4s ease-in-out infinite', animationDelay: '0.4s' }}
          />
          {/* The actual logo */}
          <img
            src="/logo1.png"
            alt="E-TARGET — Tactical Shooting Detection"
            className="relative z-10 w-[78%] h-[78%] object-contain"
            style={{
              filter: 'drop-shadow(0 0 18px rgba(255,58,40,0.55))',
              opacity: 1,
              animation: 'logoFloat 4s ease-in-out infinite',
            }}
            draggable={false}
          />
          {/* Scanline sweep over the logo */}
          <div
            className="absolute inset-0 overflow-hidden rounded-full pointer-events-none"
            style={{ opacity: 0.4 }}
          >
            <div
              className="absolute left-0 right-0 h-12"
              style={{
                background:
                  'linear-gradient(to bottom, transparent 0%, rgba(255,58,40,0.35) 50%, transparent 100%)',
                animation: 'splashScan 2.6s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-center leading-none tracking-[0.12em]">
          <span
            className="block font-black text-[#ff3a28] text-4xl sm:text-5xl"
            style={{ animation: 'textGlow 2.2s ease-in-out infinite' }}
          >
            E-TARGET
          </span>
        </h1>

        <p className="font-mono-tactical text-[10px] sm:text-[11px] text-[#3d4f68] tracking-[0.32em] uppercase text-center">
          Detección de Impactos · Tiempo Real
        </p>

        {/* Loader bar */}
        <div className="flex flex-col items-center gap-2 w-[240px] mt-3">
          <div className="w-full h-[3px] bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(to right, #ff3a28, #ff7240)',
                boxShadow: '0 0 10px #ff3a28',
              }}
            />
          </div>
          <div className="flex items-center justify-between w-full font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.12em]">
            <span>{LOADER_STEPS[step]?.msg || 'Listo'}</span>
            <span className="text-[#ff3a28]">{pct}%</span>
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono-tactical text-[9px] text-[#1e2840] tracking-[0.3em] uppercase text-center px-6">
        Tactical Shooting Detection System
      </div>

      <style jsx>{`
        @keyframes splashGlow {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes splashScan {
          0% { top: -20%; }
          50% { top: 80%; }
          100% { top: -20%; }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
