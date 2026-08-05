'use client'

import type { SessionData } from '@/lib/types'
import { scoreColor } from '@/lib/types'

interface SessionStatsCardProps {
  session: SessionData
  className?: string
  /** If true, show minimal horizontal version */
  compact?: boolean
}

export function SessionStatsCard({ session, className, compact = false }: SessionStatsCardProps) {
  const { totalScore, bestScore, avgScore, shotCount, durationSec, shots, trainingMode } = session
  const bullseyes = shots.filter(s => s.score >= 10).length
  const maxPossible = shotCount * 10
  const pct = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0

  // Grade calculation
  const grade = pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : 'D'
  const gradeColor = pct >= 90 ? '#39ff7a' : pct >= 75 ? '#00e5ff' : pct >= 60 ? '#ffb830' : '#ff3a28'

  return (
    <div className={`tactical-card p-3 ${className ?? ''}`}>
      <div className={`flex ${compact ? 'flex-row items-center gap-4' : 'flex-col gap-3'}`}>
        {/* Score + Grade */}
        <div className="flex items-center gap-3">
          <span
            className="font-display font-bold text-2xl text-[#ff3a28]"
            style={{ textShadow: '0 0 12px rgba(255,58,40,0.3)' }}
          >
            {trainingMode ? shotCount : totalScore}
          </span>
          {!trainingMode && (
            <span
              className="font-display font-bold text-lg"
              style={{ color: gradeColor, textShadow: `0 0 8px ${gradeColor}` }}
            >
              {grade}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-3 text-xs">
          <div className="flex flex-col items-center">
            <span className="font-display font-bold text-sm text-[#00e5ff]">{shotCount}</span>
            <span className="font-mono-tactical text-[7px] text-[#3d4f68]">DISPAROS</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-display font-bold text-sm text-[#39ff7a]">{trainingMode ? '—' : bestScore}</span>
            <span className="font-mono-tactical text-[7px] text-[#3d4f68]">MEJOR</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-display font-bold text-sm text-[#ffb830]">{trainingMode ? '—' : avgScore.toFixed(1)}</span>
            <span className="font-mono-tactical text-[7px] text-[#3d4f68]">PROM.</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-display font-bold text-sm text-[#ff3a28]">{bullseyes}</span>
            <span className="font-mono-tactical text-[7px] text-[#3d4f68]">DIANAS</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-display font-bold text-sm text-[#7a8ca8]">{durationSec}s</span>
            <span className="font-mono-tactical text-[7px] text-[#3d4f68]">TIEMPO</span>
          </div>
        </div>

        {/* Score distribution mini bar (non-compact only) */}
        {!compact && !trainingMode && shots.length > 0 && (
          <div className="flex items-end gap-px h-3 mt-1">
            {Array.from({ length: 10 }, (_, i) => {
              const ring = i + 1
              const count = shots.filter(s => s.score === ring).length
              const max = Math.max(1, ...Array.from({ length: 10 }, (_, r) => shots.filter(s => s.score === r + 1).length))
              const color = ring >= 9 ? '#ff3a28' : ring >= 7 ? '#ffb830' : ring >= 4 ? '#00e5ff' : '#4da6ff'
              return (
                <div
                  key={ring}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(8, (count / max) * 100)}%`,
                    background: color,
                    opacity: count > 0 ? 0.8 : 0.15,
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
