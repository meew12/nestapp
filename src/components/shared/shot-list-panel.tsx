'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Undo2, Trash2, Clock, Crosshair, TrendingUp, Target, Activity } from 'lucide-react'
import type { ShotData, SessionData } from '@/lib/types'
import { analyzeGroup, TARGET_DIAMETER_CM } from '@/lib/scoring'
import { scoreColor } from '@/lib/types'

interface ShotListPanelProps {
  open: boolean
  onClose: () => void
  session: SessionData | null
  onUndo: () => void
  onClear: () => void
  /** Coordinate space the shots were recorded in (canvas w/h). */
  coordW: number
  coordH: number
}

/**
 * Accushoot-style slide-in panel showing the live shot list + group analysis.
 *
 * - Slides in from the right edge, full height.
 * - Each shot is a row: # | score chip | distance | time | coordinates.
 * - Group analysis card at top: extreme spread (cm/MOA), MPI deviation,
 *   std deviation, mean point of impact.
 * - Quick actions: UNDO last shot, CLEAR all.
 */
export function ShotListPanel({
  open,
  onClose,
  session,
  onUndo,
  onClear,
  coordW,
  coordH,
}: ShotListPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const listEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom when a list grows (new shot arrives)
  useEffect(() => {
    if (open && session?.shots.length) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [open, session?.shots.length])

  // Derive confirm-clear state: reset whenever the panel is closed.
  // Done via callback (onClose) rather than an effect to avoid cascading renders.
  const handleClose = () => {
    setConfirmClear(false)
    onClose()
  }

  if (!session) return null

  const shots = session.shots
  const trainingMode = session.trainingMode
  const targetSize = session.targetSize
  const distanceM = session.distanceM || 10

  // Live group analysis — recomputed on every render (cheap for <50 shots)
  const group = analyzeGroup(shots, coordW, coordH, targetSize, distanceM)
  const targetCm = TARGET_DIAMETER_CM[targetSize] || 25

  // Time format helper
  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-[101] w-[88%] max-w-[380px] bg-[#0a0e1a] border-l border-[var(--border-glow)] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          boxShadow: open ? '-10px 0 40px rgba(255,58,40,0.15), -2px 0 0 rgba(0,229,255,0.3)' : 'none',
        }}
        role="dialog"
        aria-label="Lista de disparos"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0"
          style={{ paddingTop: 'calc(12px + var(--safe-top))' }}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-[#00e5ff]" />
            <h2 className="font-display font-bold text-sm tracking-[0.15em] text-[#e8ecf5]">
              LISTA DE IMPACTOS
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--bg-glass)] border border-[var(--border-subtle)] hover:border-[var(--border-glow)] transition-colors"
            aria-label="Cerrar"
          >
            <X size={14} className="text-[#7a8ca8]" />
          </button>
        </div>

        {/* Group analysis card */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Crosshair size={11} className="text-[#ff3a28]" />
            <span className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.2em]">
              ANÁLISIS DE GRUPO
            </span>
          </div>
          {shots.length < 2 ? (
            <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-wider py-2 text-center">
              {shots.length === 1 ? 'NECESITAS 1 DISPARO MÁS' : 'SIN DISPAROS AÚN'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="EXTREME SPREAD"
                value={group.groupSizeCm.toFixed(1)}
                unit="cm"
                color="#ff3a28"
                highlight
              />
              <StatTile
                label="EQUIVALENTE"
                value={group.moa.toFixed(2)}
                unit="MOA"
                color="#ffb830"
              />
              <StatTile
                label="DESVIACIÓN MPI"
                value={group.deviationCm.toFixed(1)}
                unit="cm"
                color="#00e5ff"
              />
              <StatTile
                label="CONSISTENCIA"
                value={group.stdDevCm.toFixed(1)}
                unit="σ cm"
                color="#39ff7a"
              />
            </div>
          )}
          {/* MPI indicator */}
          {group.mpi && shots.length >= 2 && (
            <div className="mt-2 px-2 py-1.5 rounded-md bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.2)]">
              <div className="flex items-center justify-between">
                <span className="font-mono-tactical text-[8px] text-[#7a8ca8] tracking-[0.15em]">
                  PUNTO DE IMPACTO MEDIO
                </span>
                <span className="font-mono-tactical text-[9px] text-[#00e5ff]">
                  {group.deviationCm <= 1 ? 'CENTRADO' : group.deviationCm <= 3 ? 'ACEPTABLE' : 'DESCENTRADO'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 px-4 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
          <button
            onClick={onUndo}
            disabled={shots.length === 0}
            className="flex-1 tactical-btn tactical-btn-ghost text-xs py-2 disabled:opacity-40"
          >
            <Undo2 size={12} />
            DESHACER
          </button>
          {confirmClear ? (
            <button
              onClick={() => { onClear(); setConfirmClear(false) }}
              className="flex-1 tactical-btn tactical-btn-danger text-xs py-2"
            >
              <Trash2 size={12} />
              CONFIRMAR
            </button>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={shots.length === 0}
              className="flex-1 tactical-btn tactical-btn-ghost text-xs py-2 disabled:opacity-40"
            >
              <Trash2 size={12} />
              LIMPIAR
            </button>
          )}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-px bg-[var(--border-subtle)] flex-shrink-0">
          <div className="bg-[#0a0e1a] py-2 px-2 text-center">
            <div className="font-display font-bold text-base text-[#e8ecf5]">{shots.length}</div>
            <div className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.15em]">DISPAROS</div>
          </div>
          <div className="bg-[#0a0e1a] py-2 px-2 text-center">
            <div className="font-display font-bold text-base text-[#ff3a28]">
              {trainingMode ? '—' : session.totalScore}
            </div>
            <div className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.15em]">PUNTAJE</div>
          </div>
          <div className="bg-[#0a0e1a] py-2 px-2 text-center">
            <div className="font-display font-bold text-base text-[#39ff7a]">
              {trainingMode ? '—' : session.avgScore.toFixed(1)}
            </div>
            <div className="font-mono-tactical text-[7px] text-[#3d4f68] tracking-[0.15em]">PROMEDIO</div>
          </div>
        </div>

        {/* Shot list (scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {shots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Target size={40} className="text-[#1f2a3d] mb-3" />
              <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">
                SIN IMPACTOS REGISTRADOS
              </p>
              <p className="font-mono-tactical text-[9px] text-[#1f2a3d] tracking-wider mt-1">
                {trainingMode ? 'MODO ENTRENAMIENTO ACTIVO' : 'ESPERANDO DETECCIÓN…'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {shots.map((shot, idx) => {
                const isLatest = idx === shots.length - 1
                const color = isLatest ? '#ff3a28' : scoreColor(shot.score)
                return (
                  <li
                    key={shot.id ?? idx}
                    className={`px-3 py-2.5 flex items-center gap-3 transition-colors ${
                      isLatest ? 'bg-[rgba(255,58,40,0.06)]' : 'hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                  >
                    {/* Shot number */}
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-xs"
                      style={{
                        background: `${color}15`,
                        border: `1px solid ${color}40`,
                        color: color,
                      }}
                    >
                      {shot.index}
                    </div>
                    {/* Score chip */}
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center font-display font-black text-sm"
                      style={{
                        background: `${color}20`,
                        border: `1.5px solid ${color}`,
                        color: color,
                        boxShadow: isLatest ? `0 0 10px ${color}80` : 'none',
                      }}
                    >
                      {trainingMode ? '●' : shot.score}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-mono-tactical">
                        <span className="text-[#7a8ca8] flex items-center gap-1">
                          <Crosshair size={9} />
                          {shot.distanceM?.toFixed(0) ?? '—'}cm
                        </span>
                        <span className="text-[#3d4f68]">·</span>
                        <span className="text-[#7a8ca8] flex items-center gap-1">
                          <Clock size={9} />
                          {fmtTime(shot.timestamp)}
                        </span>
                      </div>
                      <div className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-wider mt-0.5">
                        x={shot.x.toFixed(0)} y={shot.y.toFixed(0)}
                      </div>
                    </div>
                    {isLatest && (
                      <span
                        className="flex-shrink-0 px-1.5 py-0.5 rounded text-[7px] font-mono-tactical tracking-[0.15em]"
                        style={{ background: '#ff3a2820', color: '#ff3a28', border: '1px solid #ff3a2840' }}
                      >
                        ÚLTIMO
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <div ref={listEndRef} />
        </div>

        {/* Footer — target info */}
        <div
          className="flex-shrink-0 px-4 py-2 border-t border-[var(--border-subtle)] bg-[rgba(6,9,16,0.6)]"
          style={{ paddingBottom: 'calc(8px + var(--safe-bottom))' }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">
              BLANCO: {targetSize.toUpperCase()} · ⌀{targetCm}cm
            </span>
            <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">
              DIST: {distanceM}m
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}

/** Small stat tile used in the group analysis card. */
function StatTile({
  label,
  value,
  unit,
  color,
  highlight,
}: {
  label: string
  value: string
  unit: string
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className="rounded-md px-2 py-1.5"
      style={{
        background: highlight ? `${color}12` : 'rgba(255,255,255,0.025)',
        border: `1px solid ${color}30`,
      }}
    >
      <div className="font-mono-tactical text-[7px] text-[#7a8ca8] tracking-[0.15em] mb-0.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="font-display font-bold text-base"
          style={{ color, textShadow: highlight ? `0 0 8px ${color}60` : 'none' }}
        >
          {value}
        </span>
        <span className="font-mono-tactical text-[8px] text-[#3d4f68]">{unit}</span>
      </div>
    </div>
  )
}
