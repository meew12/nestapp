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
 * Animated tactical reticle (SVG) over a deep `#070911` background with a
 * subtle animated grid + corner HUD brackets. The loader steps mimic a
 * real targeting system boot sequence.
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
        {/* Animated tactical reticle (SVG) */}
        <div className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] flex items-center justify-center">
          {/* Pulsing reticle rings */}
          <div
            className="absolute inset-0 rounded-full border border-[rgba(255,58,40,0.35)]"
            style={{ animation: 'pulseRing 2.4s ease-in-out infinite' }}
          />
          <div
            className="absolute inset-3 rounded-full border border-[rgba(255,58,40,0.18)]"
            style={{ animation: 'pulseRing 2.4s ease-in-out infinite', animationDelay: '0.4s' }}
          />

          {/* SVG animated crosshair reticle */}
          <svg
            viewBox="0 0 200 200"
            className="relative z-10 w-[85%] h-[85%]"
            style={{
              filter: 'drop-shadow(0 0 18px rgba(255,58,40,0.55))',
              animation: 'logoFloat 4s ease-in-out infinite',
            }}
          >
            {/* Outer rotating ring with tick marks */}
            <g style={{ transformOrigin: '100px 100px', animation: 'reticleSpin 12s linear infinite' }}>
              <circle cx="100" cy="100" r="88" fill="none" stroke="#ff3a28" strokeWidth="1.2" opacity="0.55" strokeDasharray="3 6" />
              {/* Cardinal tick marks (long) */}
              <line x1="100" y1="6" x2="100" y2="20" stroke="#ff3a28" strokeWidth="2" />
              <line x1="100" y1="180" x2="100" y2="194" stroke="#ff3a28" strokeWidth="2" />
              <line x1="6" y1="100" x2="20" y2="100" stroke="#ff3a28" strokeWidth="2" />
              <line x1="180" y1="100" x2="194" y2="100" stroke="#ff3a28" strokeWidth="2" />
              {/* Diagonal tick marks (short) */}
              <line x1="36.4" y1="36.4" x2="46.3" y2="46.3" stroke="#ff3a28" strokeWidth="1.4" opacity="0.7" />
              <line x1="163.6" y1="36.4" x2="153.7" y2="46.3" stroke="#ff3a28" strokeWidth="1.4" opacity="0.7" />
              <line x1="36.4" y1="163.6" x2="46.3" y2="153.7" stroke="#ff3a28" strokeWidth="1.4" opacity="0.7" />
              <line x1="163.6" y1="163.6" x2="153.7" y2="153.7" stroke="#ff3a28" strokeWidth="1.4" opacity="0.7" />
            </g>

            {/* Middle ring (counter-rotating) */}
            <g style={{ transformOrigin: '100px 100px', animation: 'reticleSpinRev 9s linear infinite' }}>
              <circle cx="100" cy="100" r="62" fill="none" stroke="#ff3a28" strokeWidth="1" opacity="0.4" strokeDasharray="2 4" />
              {/* Crosshair lines (gap in center) */}
              <line x1="100" y1="30" x2="100" y2="82" stroke="#ff3a28" strokeWidth="1.5" opacity="0.8" />
              <line x1="100" y1="118" x2="100" y2="170" stroke="#ff3a28" strokeWidth="1.5" opacity="0.8" />
              <line x1="30" y1="100" x2="82" y2="100" stroke="#ff3a28" strokeWidth="1.5" opacity="0.8" />
              <line x1="118" y1="100" x2="170" y2="100" stroke="#ff3a28" strokeWidth="1.5" opacity="0.8" />
            </g>

            {/* Inner solid ring */}
            <circle cx="100" cy="100" r="40" fill="none" stroke="#ff3a28" strokeWidth="1.5" opacity="0.7" />

            {/* Center bullseye */}
            <circle cx="100" cy="100" r="14" fill="none" stroke="#ff3a28" strokeWidth="2" opacity="0.9" />
            <circle cx="100" cy="100" r="6" fill="#ff3a28" opacity="0.9" style={{ animation: 'corePulse 1.6s ease-in-out infinite' }} />

            {/* Small corner brackets on inner ring (HUD style) */}
            <path d="M 64 52 L 56 52 L 56 60" fill="none" stroke="#ff3a28" strokeWidth="1.4" opacity="0.6" />
            <path d="M 136 52 L 144 52 L 144 60" fill="none" stroke="#ff3a28" strokeWidth="1.4" opacity="0.6" />
            <path d="M 64 148 L 56 148 L 56 140" fill="none" stroke="#ff3a28" strokeWidth="1.4" opacity="0.6" />
            <path d="M 136 148 L 144 148 L 144 140" fill="none" stroke="#ff3a28" strokeWidth="1.4" opacity="0.6" />
          </svg>

          {/* Scanline sweep over the reticle */}
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
        @keyframes reticleSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes reticleSpinRev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes corePulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
