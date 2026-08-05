'use client'

import { useEffect, useState, useRef } from 'react'
import type { Tab } from './main-app'
import { scoreColor, WEATHER_CONDITIONS } from '@/lib/types'
import { TargetMap } from '@/components/shared/target-map'
import type { TargetMapHandle } from '@/components/shared/target-map'
import { exportSessionPNG } from '@/lib/export-session'
import { shareSession } from '@/lib/share-session'
import { showToast } from '@/components/shared/toast'
import { ArrowLeft, Trash2, Calendar, Target, Clock, ChevronRight, X, Download, GitCompare, Check, Thermometer, Wind, Droplets, FileText, LayoutList, GitCommitHorizontal, Share2 } from 'lucide-react'

interface HistoryScreenProps {
  onNavigate: (tab: Tab) => void
}

interface SessionListItem {
  id: string
  trainingMode: boolean
  totalScore: number
  bestScore: number
  avgScore: number
  shotCount: number
  durationSec: number
  targetSize: string
  distanceM: number
  captureMode?: 'camera' | 'simulator'
  weather?: { temp?: number; wind?: number; condition?: string; humidity?: number } | null
  createdAt: string
  _count?: { shots: number }
}

interface SessionDetail extends SessionListItem {
  shots: Array<{
    index: number
    x: number
    y: number
    radius: number
    score: number
    timestamp: number
    distanceM: number
  }>
  notes?: string | null
}

export function HistoryScreen({ onNavigate }: HistoryScreenProps) {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SessionDetail | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareData, setCompareData] = useState<[SessionDetail, SessionDetail] | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')
  const [timelineSessions, setTimelineSessions] = useState<SessionDetail[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  const loadSessions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch {
      showToast('Error al cargar historial', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSessions() }, [])

  // Batch-fetch session details when timeline view is activated
  useEffect(() => {
    if (viewMode !== 'timeline' || sessions.length === 0) return
    let cancelled = false
    const fetchTimelineDetails = async () => {
      setTimelineLoading(true)
      const toFetch = sessions.slice(0, 10)
      const results: SessionDetail[] = []
      // Concurrency limiter — 5 at a time
      for (let i = 0; i < toFetch.length; i += 5) {
        if (cancelled) break
        const batch = toFetch.slice(i, i + 5)
        const batchResults = await Promise.all(
          batch.map(async (s) => {
            try {
              const res = await fetch(`/api/sessions/${s.id}`, { credentials: 'include' })
              if (res.ok) return (await res.json()) as SessionDetail
            } catch { /* ignore individual failures */ }
            return null
          })
        )
        for (const r of batchResults) {
          if (r) results.push(r)
        }
      }
      if (!cancelled) {
        setTimelineSessions(results)
        setTimelineLoading(false)
      }
    }
    fetchTimelineDetails()
    return () => { cancelled = true }
  }, [viewMode, sessions])

  const openSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, { credentials: 'include' })
      if (res.ok) {
        setSelected(await res.json())
      } else {
        showToast('No se pudo abrir la sesión', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const toggleCompareSelect = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const runCompare = async () => {
    if (compareIds.length !== 2) return
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/sessions/${compareIds[0]}`, { credentials: 'include' }),
        fetch(`/api/sessions/${compareIds[1]}`, { credentials: 'include' }),
      ])
      if (r1.ok && r2.ok) {
        setCompareData([await r1.json(), await r2.json()])
      } else {
        showToast('No se pudieron cargar las sesiones', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const exitCompareMode = () => {
    setCompareMode(false)
    setCompareIds([])
    setCompareData(null)
  }

  const deleteSession = async (id: string) => {
    if (!confirm('¿Eliminar esta sesión? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id))
        setSelected(null)
        showToast('Sesión eliminada', 'success')
      } else {
        showToast('Error al eliminar', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4 bg-[rgba(10,14,26,0.9)] backdrop-blur-xl border-b border-[var(--border-subtle)]"
        style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
      >
        <button
          onClick={() => compareMode ? exitCompareMode() : onNavigate('menu')}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#ff3a28]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base tracking-[0.1em]">HISTORIAL</h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.15em]">
            {compareMode ? `${compareIds.length}/2 SELECCIONADAS` : `${sessions.length} SESIONES GUARDADAS`}
          </p>
        </div>
        {/* View toggle */}
        {!compareMode && sessions.length > 0 && (
          <div className="flex items-center gap-1 mr-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 h-[38px] rounded-lg border transition-all text-xs font-semibold ${
                viewMode === 'list'
                  ? 'bg-[var(--red-dim)] text-[#ff3a28] border-[var(--border-glow)]'
                  : 'bg-[var(--bg-glass)] text-[#7a8ca8] border-[var(--border-subtle)] hover:text-[#e8ecf5]'
              }`}
            >
              <LayoutList size={14} />
              <span className="hidden sm:inline">LISTA</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1 px-2.5 h-[38px] rounded-lg border transition-all text-xs font-semibold ${
                viewMode === 'timeline'
                  ? 'bg-[var(--red-dim)] text-[#ff3a28] border-[var(--border-glow)]'
                  : 'bg-[var(--bg-glass)] text-[#7a8ca8] border-[var(--border-subtle)] hover:text-[#e8ecf5]'
              }`}
            >
              <GitCommitHorizontal size={14} />
              <span className="hidden sm:inline">LÍNEA</span>
            </button>
          </div>
        )}
        {!compareMode && sessions.length >= 2 && (
          <button
            onClick={() => setCompareMode(true)}
            className="flex items-center gap-1.5 px-3 h-[38px] rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:text-[#00e5ff] hover:border-[rgba(0,229,255,0.4)] transition-all text-xs font-semibold"
          >
            <GitCompare size={14} />
            <span className="hidden sm:inline">COMPARAR</span>
          </button>
        )}
        {compareMode && (
          <button
            onClick={runCompare}
            disabled={compareIds.length !== 2}
            className="flex items-center gap-1.5 px-3 h-[38px] rounded-lg bg-[var(--red-dim)] border border-[var(--border-glow)] text-[#ff3a28] hover:scale-105 transition-all text-xs font-bold disabled:opacity-40 disabled:hover:scale-100"
          >
            <Check size={14} />
            <span className="hidden sm:inline">COMPARAR</span>
          </button>
        )}
      </header>

      {/* Sessions list / Timeline */}
      <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}>
        {loading ? (
          <div className="text-center py-12 text-[#7a8ca8]">Cargando…</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Target size={48} className="text-[#3d4f68] mb-4" />
            <p className="font-display text-base text-[#e8ecf5] mb-1">SIN SESIONES</p>
            <p className="text-sm text-[#7a8ca8] mb-6 max-w-xs">
              Realiza tu primera sesión de tiro para verla aquí.
            </p>
            <button
              onClick={() => onNavigate('menu')}
              className="tactical-btn tactical-btn-primary"
            >
              INICIAR SESIÓN
            </button>
          </div>
        ) : viewMode === 'timeline' ? (
          /* ─── TIMELINE VIEW ─── */
          <TimelineView
            sessions={sessions}
            timelineSessions={timelineSessions}
            timelineLoading={timelineLoading}
            onOpenSession={openSession}
            fmtDate={fmtDate}
          />
        ) : (
          /* ─── LIST VIEW (original) ─── */
          <div className="space-y-3">
            {sessions.map((s) => {
              const isSelected = compareIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => compareMode ? toggleCompareSelect(s.id) : openSession(s.id)}
                  className={`w-full tactical-card p-4 flex items-center gap-3 transition-all text-left active:scale-[0.98] relative sweep-highlight holographic-shimmer ${
                    isSelected
                      ? 'border-[var(--border-glow)] bg-[var(--red-dim)]'
                      : 'hover:border-[var(--border-glow)]'
                  }`}
                >
                  {/* Selection check */}
                  {compareMode && (
                    <div
                      className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-[#ff3a28] border-[#ff3a28]'
                          : 'bg-transparent border-[var(--border-subtle)]'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                  )}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: s.trainingMode ? 'rgba(255,184,0,0.15)' : 'rgba(255,58,40,0.15)',
                      border: `1.5px solid ${s.trainingMode ? '#ffb830' : '#ff3a28'}`,
                    }}
                  >
                    <span className="font-display font-bold text-base text-[#ff3a28] glow-text-cyan">
                      {s.trainingMode ? s.shotCount : s.totalScore}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {s.trainingMode && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(255,184,0,0.15)] text-[#ffb830] border border-[rgba(255,184,0,0.3)]">
                          ENTREN.
                        </span>
                      )}
                      {s.captureMode === 'simulator' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border border-[rgba(0,229,255,0.3)]">
                          SIM.
                        </span>
                      )}
                      <span className="font-mono-tactical text-[10px] text-[#3d4f68]">
                        {s.weather?.condition
                          ? `${WEATHER_CONDITIONS.find(w => w.value === s.weather!.condition)?.icon ?? ''} `
                          : ''}
                        {fmtDate(s.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#7a8ca8]">
                      <span className="flex items-center gap-1">
                        <Target size={11} /> {s.shotCount} disparos
                      </span>
                      {!s.trainingMode && (
                        <span className="flex items-center gap-1">
                          <span className="text-[#ff3a28]">★</span> {s.bestScore}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {s.durationSec}s
                      </span>
                    </div>
                  </div>
                  {!compareMode && <ChevronRight size={16} className="text-[#3d4f68]" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <SessionDetailModal
          session={selected}
          onClose={() => setSelected(null)}
          onDelete={() => deleteSession(selected.id)}
          fmtDate={fmtDate}
        />
      )}

      {/* Comparison modal */}
      {compareData && (
        <CompareModal
          sessions={compareData}
          onClose={() => setCompareData(null)}
          fmtDate={fmtDate}
        />
      )}
    </div>
  )
}

function SessionDetailModal({
  session,
  onClose,
  onDelete,
  fmtDate,
}: {
  session: SessionDetail
  onClose: () => void
  onDelete: () => void
  fmtDate: (iso: string) => string
}) {
  const targetRef = useRef<TargetMapHandle>(null)

  const handleExport = () => {
    try {
      exportSessionPNG({
        session: session as any,
        sourceCanvas: targetRef.current?.getCanvas() ?? null,
      })
      showToast('Reporte PNG descargado ✓', 'success')
    } catch {
      showToast('Error al exportar', 'error')
    }
  }

  const handleShare = async () => {
    try {
      const result = await shareSession({
        session: session as any,
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
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(6,9,16,0.8)] backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-[#0d1424] rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] max-h-[90vh] overflow-y-auto animate-slide-up-sheet"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)] sticky top-0 bg-[#0d1424] z-10 corner-bracket corner-bracket-br">
          <div>
            <h2 className="font-display font-bold text-base tracking-[0.08em]">SESIÓN</h2>
            <p className="font-mono-tactical text-[10px] text-[#3d4f68] mt-0.5">
              {fmtDate(session.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ca8] hover:text-[#39ff7a] hover:bg-[rgba(57,255,122,0.1)]"
              aria-label="Descargar PNG"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleShare}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ca8] hover:text-[#00e5ff] hover:bg-[rgba(0,229,255,0.1)]"
              aria-label="Compartir sesión"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ca8] hover:text-[#ff3a28] hover:bg-[var(--red-dim)]"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ca8] hover:text-[#ff3a28]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 slide-in-right data-grid-bg">
          {/* Score hero */}
          <div className="flex items-center justify-center">
            <div
              className="w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center"
              style={{
                border: '2.5px solid #ff3a28',
                boxShadow: '0 0 24px rgba(255,58,40,0.3), inset 0 0 16px rgba(255,58,40,0.15)',
              }}
            >
              <span className="font-display font-black text-4xl text-[#ff3a28]" style={{ textShadow: '0 0 16px #ff3a28' }}>
                {session.trainingMode ? session.shotCount : session.totalScore}
              </span>
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.2em] mt-1">
                {session.trainingMode ? 'DISP' : 'PTS'}
              </span>
            </div>
          </div>

          {/* Capture mode badge */}
          {session.captureMode === 'simulator' && (
            <div className="flex justify-center">
              <span className="px-2 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border border-[rgba(0,229,255,0.3)] tracking-[0.15em]">
                CAPTURADO EN MODO SIMULADOR
              </span>
            </div>
          )}

          {/* Weather conditions */}
          {session.weather && (
            <div className="flex flex-wrap gap-2 justify-center">
              {session.weather.condition && (() => {
                const wc = WEATHER_CONDITIONS.find(w => w.value === session.weather!.condition)
                return wc ? (
                  <span className="px-2 py-1 rounded-md bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-xs flex items-center gap-1">
                    {wc.icon} {wc.label}
                  </span>
                ) : null
              })()}
              {session.weather.temp != null && (
                <span className="px-2 py-1 rounded-md bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-xs flex items-center gap-1">
                  <Thermometer size={12} className="text-[#ff7240]" /> {session.weather.temp}°C
                </span>
              )}
              {session.weather.wind != null && (
                <span className="px-2 py-1 rounded-md bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-xs flex items-center gap-1">
                  <Wind size={12} className="text-[#00e5ff]" /> {session.weather.wind} km/h
                </span>
              )}
              {session.weather.humidity != null && (
                <span className="px-2 py-1 rounded-md bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-xs flex items-center gap-1">
                  <Droplets size={12} className="text-[#4da6ff]" /> {session.weather.humidity}%
                </span>
              )}
            </div>
          )}

          {/* Target visualization */}
          {session.shots.length > 0 && (
            <TargetMap
              ref={targetRef}
              shots={session.shots}
              width={320}
              height={320}
              coordSpace={
                session.captureMode === 'simulator'
                  ? { width: 600, height: 600 }
                  : { width: 1280, height: 720 }
              }
              trainingMode={session.trainingMode}
              className="w-full max-w-[320px] mx-auto"
            />
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="tactical-card p-3 flex flex-col items-center">
              <span className="font-display font-bold text-xl text-[#00e5ff]">{session.shotCount}</span>
              <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">DISPAROS</span>
            </div>
            <div className="tactical-card p-3 flex flex-col items-center">
              <span className="font-display font-bold text-xl text-[#39ff7a]">{session.bestScore || '—'}</span>
              <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">MEJOR</span>
            </div>
            <div className="tactical-card p-3 flex flex-col items-center">
              <span className="font-display font-bold text-xl text-[#ffb830]">
                {session.shots.length > 0 ? session.avgScore.toFixed(1) : '—'}
              </span>
              <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">PROMEDIO</span>
            </div>
            <div className="tactical-card p-3 flex flex-col items-center">
              <span className="font-display font-bold text-xl text-[#ff7240]">{session.durationSec}s</span>
              <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">DURACIÓN</span>
            </div>
          </div>

          {/* Shot log */}
          {session.shots.length > 0 && (
            <div className="tactical-card overflow-hidden">
              <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase px-3.5 py-2.5 border-b border-[var(--border-subtle)]">
                Impactos
              </h3>
              <div className="max-h-64 overflow-y-auto">
                {session.shots.map((shot, i) => {
                  const isLatest = i === session.shots.length - 1
                  const color = isLatest ? '#ff3a28' : scoreColor(shot.score)
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.03] last:border-0"
                    >
                      <span className="font-mono-tactical text-[11px] text-[#3d4f68] w-7">#{i + 1}</span>
                      <span className="font-mono-tactical text-[11px] text-[#7a8ca8] flex-1 px-2">
                        x:{Math.round(shot.x)} y:{Math.round(shot.y)}
                        {shot.distanceM ? ` · ${shot.distanceM}cm` : ''}
                      </span>
                      {isLatest && (
                        <span className="font-mono-tactical text-[9px] text-[#ff3a28] mr-2">● ÚLTIMO</span>
                      )}
                      <span
                        className="font-display font-bold text-base text-right min-w-[32px]"
                        style={{ color }}
                      >
                        {session.trainingMode ? '—' : shot.score}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {session.notes && (
            <div className="tactical-card p-3">
              <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-2 flex items-center gap-1.5">
                <FileText size={11} /> Notas
              </h3>
              <p className="text-sm text-[#7a8ca8] leading-relaxed">{session.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompareModal({
  sessions,
  onClose,
  fmtDate,
}: {
  sessions: [SessionDetail, SessionDetail]
  onClose: () => void
  fmtDate: (iso: string) => string
}) {
  const [a, b] = sessions

  // Determine winner for each stat
  const scoreDiff = (a.totalScore - b.totalScore)
  const avgDiff = (a.avgScore - b.avgScore)
  const shotsDiff = (a.shotCount - b.shotCount)
  const bestDiff = (a.bestScore - b.bestScore)
  const durDiff = (a.durationSec - b.durationSec)

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(6,9,16,0.85)] backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl bg-[#0d1424] rounded-t-2xl sm:rounded-2xl border border-[var(--border-subtle)] max-h-[92vh] overflow-y-auto animate-slide-up-sheet"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)] sticky top-0 bg-[#0d1424] z-10">
          <div>
            <h2 className="font-display font-bold text-base tracking-[0.08em]">COMPARACIÓN</h2>
            <p className="font-mono-tactical text-[10px] text-[#3d4f68] mt-0.5">
              ANÁLISIS COMPARATIVO
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7a8ca8] hover:text-[#ff3a28]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Session labels */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">SESIÓN A</p>
              <p className="text-xs text-[#7a8ca8] mt-1">{fmtDate(a.createdAt)}</p>
              {a.weather && (
                <p className="text-[10px] text-[#3d4f68] mt-0.5">
                  {a.weather.condition
                    ? `${WEATHER_CONDITIONS.find(w => w.value === a.weather!.condition)?.icon ?? ''} `
                    : ''}
                  {a.weather.temp != null ? `${a.weather.temp}°C` : ''}
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">SESIÓN B</p>
              <p className="text-xs text-[#7a8ca8] mt-1">{fmtDate(b.createdAt)}</p>
              {b.weather && (
                <p className="text-[10px] text-[#3d4f68] mt-0.5">
                  {b.weather.condition
                    ? `${WEATHER_CONDITIONS.find(w => w.value === b.weather!.condition)?.icon ?? ''} `
                    : ''}
                  {b.weather.temp != null ? `${b.weather.temp}°C` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Side-by-side targets */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center">
              {a.shots.length > 0 ? (
                <TargetMap
                  shots={a.shots}
                  width={160}
                  height={160}
                  variant="compact"
                  showRingLabels={false}
                  showShotNumbers={false}
                  showLatestBadge={false}
                  coordSpace={a.captureMode === 'simulator' ? { width: 600, height: 600 } : { width: 1280, height: 720 }}
                  trainingMode={a.trainingMode}
                  className="w-full max-w-[160px]"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-[#070b16] flex items-center justify-center text-[#3d4f68] text-xs">
                  Sin impactos
                </div>
              )}
              <p className="font-display font-bold text-2xl text-[#ff3a28] mt-2">
                {a.trainingMode ? a.shotCount : a.totalScore}
              </p>
              <p className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">
                {a.trainingMode ? 'DISPAROS' : 'PUNTOS'}
              </p>
            </div>
            <div className="flex flex-col items-center">
              {b.shots.length > 0 ? (
                <TargetMap
                  shots={b.shots}
                  width={160}
                  height={160}
                  variant="compact"
                  showRingLabels={false}
                  showShotNumbers={false}
                  showLatestBadge={false}
                  coordSpace={b.captureMode === 'simulator' ? { width: 600, height: 600 } : { width: 1280, height: 720 }}
                  trainingMode={b.trainingMode}
                  className="w-full max-w-[160px]"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-[#070b16] flex items-center justify-center text-[#3d4f68] text-xs">
                  Sin impactos
                </div>
              )}
              <p className="font-display font-bold text-2xl text-[#ff3a28] mt-2">
                {b.trainingMode ? b.shotCount : b.totalScore}
              </p>
              <p className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em]">
                {b.trainingMode ? 'DISPAROS' : 'PUNTOS'}
              </p>
            </div>
          </div>

          {/* Comparison stats */}
          <div className="tactical-card p-4">
            <h3 className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-2 text-center">
              Análisis comparativo
            </h3>
            {!a.trainingMode && !b.trainingMode && (
              <>
                <StatRow label="Puntaje" aVal={a.totalScore} bVal={b.totalScore} diff={scoreDiff} />
                <StatRow label="Promedio" aVal={a.avgScore.toFixed(1)} bVal={b.avgScore.toFixed(1)} diff={avgDiff} />
                <StatRow label="Mejor" aVal={a.bestScore} bVal={b.bestScore} diff={bestDiff} />
              </>
            )}
            <StatRow label="Disparos" aVal={a.shotCount} bVal={b.shotCount} diff={shotsDiff} />
            <StatRow label="Duración" aVal={`${a.durationSec}s`} bVal={`${b.durationSec}s`} diff={durDiff} higherBetter={false} />
          </div>

          {/* Verdict */}
          {!a.trainingMode && !b.trainingMode && (
            <div className="tactical-card p-4 text-center border-l-2 border-l-[#39ff7a]">
              <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase mb-1">
                Veredicto
              </p>
              <p className="font-display font-bold text-lg text-[#39ff7a]">
                {scoreDiff > 0 ? 'SESIÓN A GANA' : scoreDiff < 0 ? 'SESIÓN B GANA' : 'EMPATE'}
              </p>
              {scoreDiff !== 0 && (
                <p className="text-xs text-[#7a8ca8] mt-1">
                  Por {Math.abs(scoreDiff)} {Math.abs(scoreDiff) === 1 ? 'punto' : 'puntos'} de diferencia
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Timeline View Component ─── */

function TimelineView({
  sessions,
  timelineSessions,
  timelineLoading,
  onOpenSession,
  fmtDate,
}: {
  sessions: SessionListItem[]
  timelineSessions: SessionDetail[]
  timelineLoading: boolean
  onOpenSession: (id: string) => void
  fmtDate: (iso: string) => string
}) {
  // Map timeline session details by id for quick lookup
  const detailMap = new Map<string, SessionDetail>()
  for (const ts of timelineSessions) {
    detailMap.set(ts.id, ts)
  }

  if (timelineLoading && timelineSessions.length === 0) {
    return (
      <div className="text-center py-12 text-[#7a8ca8]">
        <span className="inline-block w-5 h-5 border-2 border-[#ff3a28] border-t-transparent rounded-full animate-spin mr-2 align-middle" />
        Cargando línea de tiempo…
      </div>
    )
  }

  return (
    <div className="relative pl-8">
      {/* Vertical gradient line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#ff3a28] via-[rgba(255,58,40,0.3)] to-[var(--border-subtle)]" />

      {sessions.map((s, idx) => {
        const detail = detailMap.get(s.id)
        const isFirst = idx === 0
        const weatherIcon = s.weather?.condition
          ? WEATHER_CONDITIONS.find(w => w.value === s.weather!.condition)?.icon
          : null

        return (
          <div
            key={s.id}
            className="relative mb-6 slide-in-up"
            style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
          >
            {/* Timeline node dot */}
            <div
              className={`absolute -left-5 top-4 rounded-full bg-[#ff3a28] ${
                isFirst
                  ? 'w-4 h-4 shadow-[0_0_12px_#ff3a28,0_0_24px_rgba(255,58,40,0.4)]'
                  : 'w-3 h-3 shadow-[0_0_8px_#ff3a28]'
              }`}
            />

            {/* Card */}
            <button
              onClick={() => onOpenSession(s.id)}
              className="w-full tactical-card p-4 flex flex-col gap-3 text-left transition-all hover:border-[var(--border-glow)] active:scale-[0.98] sweep-highlight"
            >
              {/* Top row: date + badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono-tactical text-[10px] text-[#3d4f68]">
                  {fmtDate(s.createdAt)}
                </span>
                {s.trainingMode && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(255,184,0,0.15)] text-[#ffb830] border border-[rgba(255,184,0,0.3)]">
                    ENTREN.
                  </span>
                )}
                {s.captureMode === 'simulator' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tactical bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border border-[rgba(0,229,255,0.3)]">
                    SIM.
                  </span>
                )}
                {weatherIcon && (
                  <span className="text-sm" title={s.weather?.condition}>{weatherIcon}</span>
                )}
              </div>

              {/* Middle row: mini target + score + stats */}
              <div className="flex items-center gap-3">
                {/* Mini TargetMap or placeholder */}
                <div className="flex-shrink-0">
                  {detail && detail.shots.length > 0 ? (
                    <TargetMap
                      shots={detail.shots}
                      width={60}
                      height={60}
                      variant="compact"
                      showRingLabels={false}
                      showShotNumbers={false}
                      showLatestBadge={false}
                      coordSpace={
                        detail.captureMode === 'simulator'
                          ? { width: 600, height: 600 }
                          : { width: 1280, height: 720 }
                      }
                      trainingMode={detail.trainingMode}
                    />
                  ) : (
                    <div
                      className="w-[60px] h-[60px] rounded-full flex items-center justify-center"
                      style={{
                        background: 'rgba(255,58,40,0.08)',
                        border: '1px dashed rgba(255,58,40,0.25)',
                      }}
                    >
                      <Target size={18} className="text-[rgba(255,58,40,0.3)]" />
                    </div>
                  )}
                </div>

                {/* Score */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-display font-bold text-xl text-[#ff3a28]"
                      style={{ textShadow: '0 0 10px rgba(255,58,40,0.4)' }}
                    >
                      {s.trainingMode ? s.shotCount : s.totalScore}
                    </span>
                    <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.15em]">
                      {s.trainingMode ? 'DISPAROS' : 'PTS'}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[11px] text-[#7a8ca8] mt-1">
                    {!s.trainingMode && (
                      <span className="flex items-center gap-1">
                        <span className="text-[#ff3a28]">★</span>
                        <span className={s.bestScore === 10 ? 'text-[#39ff7a] font-bold' : ''}>
                          {s.bestScore}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Target size={10} /> {s.shotCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {s.durationSec}s
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight size={16} className="text-[#3d4f68] flex-shrink-0" />
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function StatRow({ label, aVal, bVal, diff, higherBetter = true, suffix = '' }: {
  label: string
  aVal: string | number
  bVal: string | number
  diff: number
  higherBetter?: boolean
  suffix?: string
}) {
  const aWins = higherBetter ? diff > 0 : diff < 0
  const bWins = higherBetter ? diff < 0 : diff > 0
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-b border-white/[0.03]">
      <div className={`text-right ${aWins ? 'text-[#39ff7a]' : 'text-[#7a8ca8]'}`}>
        <span className="font-display font-bold text-lg">{aVal}{suffix}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
        <span className="font-mono-tactical text-[8px] text-[#3d4f68] tracking-[0.15em] uppercase">{label}</span>
        <span className={`font-mono-tactical text-[9px] ${diff > 0 ? 'text-[#39ff7a]' : diff < 0 ? 'text-[#ff3a28]' : 'text-[#3d4f68]'}`}>
          {diff > 0 ? '+' : ''}{diff.toFixed(Math.abs(diff) % 1 < 1e-9 ? 0 : 1)}{suffix}
        </span>
      </div>
      <div className={`text-left ${bWins ? 'text-[#39ff7a]' : 'text-[#7a8ca8]'}`}>
        <span className="font-display font-bold text-lg">{bVal}{suffix}</span>
      </div>
    </div>
  )
}
