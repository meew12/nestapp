'use client'

import { useState } from 'react'
import { X, Check, Target } from 'lucide-react'
import { TARGET_TYPE_PRESETS, type TargetType, type TargetTypePreset } from '@/lib/types'

interface TargetTypeSelectorProps {
  open: boolean
  onClose: () => void
  currentType: TargetType
  onSelect: (preset: TargetTypePreset) => void
}

/**
 * Bottom-sheet selector for target type presets (ISSF 10m, NRA, F-Class, etc.).
 *
 * Shows a grid of preset cards with diameter, default distance, and ring count.
 * Selecting a preset updates the app settings and (optionally) the live
 * session's distanceM so group analysis / MOA math uses the correct values.
 */
export function TargetTypeSelector({
  open,
  onClose,
  currentType,
  onSelect,
}: TargetTypeSelectorProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200]">
      <div
        className="absolute inset-0 bg-[rgba(6,9,16,0.75)] backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#0d1424] rounded-t-2xl border-t border-[var(--border-glow)] animate-slide-up-sheet max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'var(--safe-bottom)', boxShadow: '0 -10px 40px rgba(255,58,40,0.15)' }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mt-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-[#ff3a28]" />
            <h2 className="font-display font-bold text-sm tracking-[0.15em] text-[#e8ecf5]">
              TIPO DE BLANCO
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--bg-glass)] border border-[var(--border-subtle)] hover:border-[var(--border-glow)] transition-colors"
            aria-label="Cerrar"
          >
            <X size={14} className="text-[#7a8ca8]" />
          </button>
        </div>

        {/* Description */}
        <p className="px-5 py-2.5 text-[11px] text-[#7a8ca8] font-mono-tactical tracking-wider flex-shrink-0">
          SELECCIONA EL BLANCO OFICIAL. AJUSTA EL DIÁMETRO Y DISTANCIA PARA ANÁLISIS PRECISO.
        </p>

        {/* Preset list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
          <div className="grid grid-cols-1 gap-2">
            {TARGET_TYPE_PRESETS.map((preset) => {
              const isSelected = preset.id === currentType
              return (
                <button
                  key={preset.id}
                  onClick={() => onSelect(preset)}
                  className={`relative text-left rounded-xl p-3 border transition-all ${
                    isSelected
                      ? 'bg-[rgba(255,58,40,0.08)] border-[#ff3a28]'
                      : 'bg-[rgba(255,255,255,0.02)] border-[var(--border-subtle)] hover:border-[var(--border-glow)]'
                  }`}
                  style={isSelected ? { boxShadow: '0 0 0 1px #ff3a28, 0 4px 20px rgba(255,58,40,0.2)' } : {}}
                >
                  {/* Selected check */}
                  {isSelected && (
                    <div
                      className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: '#ff3a28', boxShadow: '0 0 8px #ff3a2880' }}
                    >
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}

                  {/* Top row: name + X-ring badge */}
                  <div className="flex items-start gap-2 pr-7">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-sm text-[#e8ecf5] tracking-wide">
                        {preset.name.toUpperCase()}
                      </h3>
                      <p className="text-[10px] text-[#7a8ca8] mt-0.5 leading-snug">
                        {preset.description}
                      </p>
                    </div>
                  </div>

                  {/* Specs row */}
                  <div className="flex items-center gap-3 mt-2.5">
                    <Spec label="⌀" value={`${preset.diameterCm}cm`} color="#ff3a28" />
                    <Spec label="DIST" value={`${preset.defaultDistanceM}m`} color="#00e5ff" />
                    <Spec label="ANILLOS" value={`${preset.rings}`} color="#ffb830" />
                    {preset.hasXRing && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[8px] font-mono-tactical tracking-wider"
                        style={{ background: 'rgba(255,58,40,0.15)', color: '#ff3a28', border: '1px solid rgba(255,58,40,0.3)' }}
                      >
                        X-RING
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footnote */}
          <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-wider mt-3 text-center px-4">
            EL TIPO DE BLANCO AFECTA EL CÁLCULO DE GRUPO (cm/MOA) Y LA DISTANCIA RECOMENDADA
          </p>
        </div>
      </div>
    </div>
  )
}

function Spec({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-wider">{label}</span>
      <span className="font-mono-tactical text-[10px] font-bold" style={{ color }}>{value}</span>
    </div>
  )
}
