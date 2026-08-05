'use client'

import { useState, useMemo } from 'react'
import type { Tab } from './main-app'
import { ArrowLeft, Wind, ArrowDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface CalculatorScreenProps {
  onNavigate: (tab: Tab) => void
}

/* ─── Caliber data ─── */
const CALIBERS = [
  { name: '.22 LR', bc: 0.125, mv: 330 },
  { name: '9mm Luger', bc: 0.150, mv: 370 },
  { name: '.223 Rem', bc: 0.223, mv: 960 },
  { name: '5.56 NATO', bc: 0.230, mv: 940 },
  { name: '.308 Win', bc: 0.450, mv: 820 },
  { name: '7.62×51', bc: 0.415, mv: 800 },
  { name: '.300 Win Mag', bc: 0.510, mv: 960 },
]

const DISTANCE_PRESETS = [25, 50, 100, 200, 300]
const RANGE_CARD_DISTANCES = [25, 50, 100, 150, 200, 300]

/* ─── Ballistic helpers ─── */
function calcWindDrift(windSpeedKmh: number, windAngleDeg: number, distanceM: number, caliber: (typeof CALIBERS)[number]) {
  const windSpeedMs = windSpeedKmh / 3.6
  const windAngleRad = (windAngleDeg * Math.PI) / 180
  const tof = distanceM / caliber.mv
  // Simplified wind drift: drift = (Vw * sin(angle) * t²) / 2, adjusted by BC
  let driftCm = (windSpeedMs * Math.sin(windAngleRad) * tof * tof) / 2
  driftCm = driftCm / (caliber.bc * 10)
  const driftMoa = (driftCm / distanceM) * 3438
  const clicks = driftMoa / 0.25
  return { driftCm, driftMoa, clicks, tof }
}

function calcBulletDrop(distanceM: number, scopeHeightCm: number, caliber: (typeof CALIBERS)[number]) {
  const tof = distanceM / caliber.mv
  let dropCm = 0.5 * 9.81 * tof * tof * 100 // gravity in cm
  dropCm -= scopeHeightCm
  const elevMoa = (dropCm / distanceM) * 3438
  const clicks = elevMoa / 0.25
  return { dropCm, elevMoa, clicks, tof }
}

/* ─── Wind Direction Indicator SVG ─── */
function WindIndicator({ angle }: { angle: number }) {
  // angle: 0 = headwind (from top), 90 = full crosswind (from right), 180 = tailwind
  // Convert to arrow direction: arrow shows where wind is coming FROM
  const rad = ((angle - 90) * Math.PI) / 180
  const cx = 40
  const cy = 40
  const r = 24
  const ax = cx + r * Math.cos(rad)
  const ay = cy + r * Math.sin(rad)
  // Arrow head
  const headLen = 8
  const headAngle = 0.5
  const h1x = ax - headLen * Math.cos(rad - headAngle)
  const h1y = ay - headLen * Math.sin(rad - headAngle)
  const h2x = ax - headLen * Math.cos(rad + headAngle)
  const h2y = ay - headLen * Math.sin(rad + headAngle)

  return (
    <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
      {/* Outer circle */}
      <circle cx={cx} cy={cy} r={30} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      {/* Inner circle */}
      <circle cx={cx} cy={cy} r={r} stroke="rgba(0,229,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
      {/* Cross hair lines */}
      <line x1={cx} y1={cy - 30} x2={cx} y2={cy + 30} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      <line x1={cx - 30} y1={cy} x2={cx + 30} y2={cy} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      {/* Bullet path line (vertical, downward) */}
      <line x1={cx} y1={cy - 28} x2={cx} y2={cy + 28} stroke="#ff3a28" strokeWidth="1.5" strokeDasharray="4 2" />
      {/* Wind arrow */}
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#00e5ff" strokeWidth="2" />
      <polygon points={`${ax},${ay} ${h1x},${h1y} ${h2x},${h2y}`} fill="#00e5ff" />
      {/* Labels */}
      <text x={cx} y={10} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="monospace">0°</text>
      <text x={cx + 36} y={cy + 2} textAnchor="start" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="monospace">90°</text>
      <text x={cx} y={78} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="monospace">180°</text>
    </svg>
  )
}

/* ─── Result display with glow ─── */
function ResultValue({ value, unit, color = '#00e5ff' }: { value: string; unit: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="font-display font-bold text-xl tracking-[0.05em]"
        style={{ color, textShadow: `0 0 12px ${color}66` }}
      >
        {value}
      </span>
      <span className="font-mono-tactical text-[10px] text-[#3d4f68]">{unit}</span>
    </div>
  )
}

/* ─── Tactical input label ─── */
function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono-tactical text-[10px] tracking-[0.12em] text-[#7a8ca8] uppercase mb-1 block">
      {children}
    </label>
  )
}

/* ─── Main Calculator Screen ─── */
export function CalculatorScreen({ onNavigate }: CalculatorScreenProps) {
  const [distance, setDistance] = useState(100)
  const [windSpeed, setWindSpeed] = useState(10)
  const [windAngle, setWindAngle] = useState(90)
  const [caliberIdx, setCaliberIdx] = useState(4) // .308 Win default
  const [scopeHeight, setScopeHeight] = useState(3.5)

  const caliber = CALIBERS[caliberIdx]

  // Windage calculations
  const windResult = useMemo(
    () => calcWindDrift(windSpeed, windAngle, distance, caliber),
    [windSpeed, windAngle, distance, caliber]
  )

  // Elevation calculations
  const elevResult = useMemo(
    () => calcBulletDrop(distance, scopeHeight, caliber),
    [distance, scopeHeight, caliber]
  )

  // Range card data
  const rangeCardData = useMemo(() => {
    return RANGE_CARD_DISTANCES.map((d) => {
      const wind = calcWindDrift(windSpeed, windAngle, d, caliber)
      const elev = calcBulletDrop(d, scopeHeight, caliber)
      return {
        distance: d,
        driftCm: wind.driftCm,
        driftMoa: wind.driftMoa,
        driftClicks: wind.clicks,
        dropCm: elev.dropCm,
        elevMoa: elev.elevMoa,
        elevClicks: elev.clicks,
      }
    })
  }, [windSpeed, windAngle, caliber, scopeHeight])

  const tacticalInputClass =
    'bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#e8ecf5] focus:border-[var(--border-glow)] focus:ring-1 focus:ring-[var(--border-glow)] focus:outline-none'

  return (
    <div className="min-h-screen bg-[#060910] text-[#e8ecf5] flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-[calc(16px+var(--safe-top))] pb-3">
        <button
          onClick={() => onNavigate('menu')}
          className="w-[38px] h-[38px] rounded-lg bg-[var(--bg-glass)] border border-[var(--border-subtle)] flex items-center justify-center text-[#7a8ca8] hover:text-[#ff3a28] hover:border-[var(--border-glow)] transition-all active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base tracking-[0.08em]">CALCULADORA</h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68]">BALÍSTICA / VIENTO</p>
        </div>
        <Wind size={20} className="text-[#00e5ff] opacity-60" />
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-6 space-y-4 overflow-y-auto" style={{ paddingBottom: 'calc(24px + var(--safe-bottom))' }}>
        {/* ─── Caliber & Distance Selection ─── */}
        <div className="tactical-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ChevronRight size={12} className="text-[#ff3a28]" />
            <h2 className="font-display font-bold text-xs tracking-[0.08em] text-[#e8ecf5]">CONFIGURACIÓN</h2>
          </div>

          {/* Caliber Select */}
          <div>
            <InputLabel>Calibre</InputLabel>
            <Select
              value={String(caliberIdx)}
              onValueChange={(v) => setCaliberIdx(Number(v))}
            >
              <SelectTrigger className={`w-full ${tacticalInputClass} h-9 text-sm`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0d1424] border border-[var(--border-subtle)]">
                {CALIBERS.map((c, i) => (
                  <SelectItem key={i} value={String(i)} className="text-[#e8ecf5] focus:bg-[rgba(255,58,40,0.1)] focus:text-[#ff3a28]">
                    {c.name}
                    <span className="ml-2 text-[10px] text-[#3d4f68] font-mono-tactical">
                      BC:{c.bc} | {c.mv}m/s
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Distance */}
          <div>
            <InputLabel>Distancia al blanco (m)</InputLabel>
            <Input
              type="number"
              value={distance}
              onChange={(e) => setDistance(Math.max(1, Number(e.target.value) || 1))}
              className={tacticalInputClass}
            />
            <div className="flex gap-1.5 mt-2">
              {DISTANCE_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDistance(d)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-mono-tactical tracking-[0.1em] transition-all active:scale-95 ${
                    distance === d
                      ? 'bg-[rgba(255,58,40,0.2)] border border-[#ff3a28] text-[#ff3a28]'
                      : 'bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[#7a8ca8] hover:border-[var(--border-glow)]'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* Caliber info */}
          <div className="flex gap-3 pt-1">
            <div className="flex-1 bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.12)] rounded-lg px-3 py-2">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">BC</span>
              <span className="font-display text-sm text-[#00e5ff]">{caliber.bc}</span>
            </div>
            <div className="flex-1 bg-[rgba(255,184,48,0.06)] border border-[rgba(255,184,48,0.12)] rounded-lg px-3 py-2">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">VEL. BOCA</span>
              <span className="font-display text-sm text-[#ffb830]">{caliber.mv} <span className="text-[9px]">m/s</span></span>
            </div>
          </div>
        </div>

        {/* ─── Windage Calculator ─── */}
        <div className="tactical-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wind size={12} className="text-[#00e5ff]" />
            <h2 className="font-display font-bold text-xs tracking-[0.08em] text-[#e8ecf5]">VIENTO — CORRECCIÓN LATERAL</h2>
          </div>

          {/* Wind Speed */}
          <div>
            <InputLabel>Velocidad del viento (km/h)</InputLabel>
            <Input
              type="number"
              value={windSpeed}
              onChange={(e) => setWindSpeed(Math.max(0, Number(e.target.value) || 0))}
              className={tacticalInputClass}
            />
          </div>

          {/* Wind Angle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <InputLabel>Ángulo del viento</InputLabel>
              <span className="font-mono-tactical text-[10px] text-[#00e5ff]">{windAngle}°</span>
            </div>
            <Slider
              value={[windAngle]}
              onValueChange={(v) => setWindAngle(v[0])}
              min={0}
              max={180}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="font-mono-tactical text-[8px] text-[#3d4f68]">0° FRENTE</span>
              <span className="font-mono-tactical text-[8px] text-[#3d4f68]">90° LATERAL</span>
              <span className="font-mono-tactical text-[8px] text-[#3d4f68]">180° COLA</span>
            </div>
          </div>

          {/* Wind Direction Indicator + Results */}
          <div className="flex items-start gap-4 mt-2">
            <WindIndicator angle={windAngle} />
            <div className="flex-1 space-y-2">
              <div>
                <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">DERIVA VIENTO</span>
                <ResultValue
                  value={Math.abs(windResult.driftCm).toFixed(1)}
                  unit="cm"
                />
              </div>
              <div>
                <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">AJUSTE MOA</span>
                <ResultValue
                  value={Math.abs(windResult.driftMoa).toFixed(2)}
                  unit="MOA"
                />
              </div>
              <div>
                <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">CLICKS (1/4 MOA)</span>
                <ResultValue
                  value={Math.abs(windResult.clicks).toFixed(0)}
                  unit="clicks"
                  color={Math.abs(windResult.clicks) > 20 ? '#ffb830' : '#00e5ff'}
                />
              </div>
            </div>
          </div>

          {Math.abs(windResult.clicks) > 20 && (
            <p className="font-mono-tactical text-[9px] text-[#ffb830] mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ffb830]" />
              Corrección elevada — verificar condiciones
            </p>
          )}
        </div>

        {/* ─── Elevation / Bullet Drop Calculator ─── */}
        <div className="tactical-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown size={12} className="text-[#ffb830]" />
            <h2 className="font-display font-bold text-xs tracking-[0.08em] text-[#e8ecf5]">ELEVACIÓN — CAÍDA DE BALA</h2>
          </div>

          {/* Scope Height */}
          <div>
            <InputLabel>Altura visor sobre cañón (cm)</InputLabel>
            <Input
              type="number"
              value={scopeHeight}
              onChange={(e) => setScopeHeight(Math.max(0, Number(e.target.value) || 0))}
              step={0.5}
              className={tacticalInputClass}
            />
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-[rgba(255,184,48,0.06)] border border-[rgba(255,184,48,0.12)] rounded-lg p-3 space-y-1">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">CAÍDA</span>
              <ResultValue
                value={Math.abs(elevResult.dropCm).toFixed(1)}
                unit="cm"
                color="#ffb830"
              />
            </div>
            <div className="bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.12)] rounded-lg p-3 space-y-1">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">TIEMPO VUELO</span>
              <ResultValue
                value={elevResult.tof.toFixed(3)}
                unit="s"
                color="#ffb830"
              />
            </div>
            <div className="bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.12)] rounded-lg p-3 space-y-1">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">ELEVACIÓN MOA</span>
              <ResultValue
                value={Math.abs(elevResult.elevMoa).toFixed(2)}
                unit="MOA"
              />
            </div>
            <div className="bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.12)] rounded-lg p-3 space-y-1">
              <span className="font-mono-tactical text-[9px] text-[#3d4f68] block">CLICKS (1/4 MOA)</span>
              <ResultValue
                value={Math.abs(elevResult.clicks).toFixed(0)}
                unit="clicks"
                color={Math.abs(elevResult.clicks) > 30 ? '#ffb830' : '#00e5ff'}
              />
            </div>
          </div>
        </div>

        {/* ─── Quick Reference / Range Card ─── */}
        <div className="tactical-card rounded-xl p-4 space-y-3">
          {/* Military-style header frame */}
          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-x-0 top-0 h-px bg-[rgba(255,58,40,0.3)]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-[rgba(255,58,40,0.3)]" />
            <div className="absolute left-0 top-0 w-3 h-3 border-t border-l border-[#ff3a28]" />
            <div className="absolute right-0 top-0 w-3 h-3 border-t border-r border-[#ff3a28]" />
            <div className="absolute left-0 bottom-0 w-3 h-3 border-b border-l border-[#ff3a28]" />
            <div className="absolute right-0 bottom-0 w-3 h-3 border-b border-r border-[#ff3a28]" />
            <h2 className="font-display font-bold text-xs tracking-[0.15em] text-[#ff3a28]">RANGE CARD</h2>
          </div>

          <div className="font-mono-tactical text-[9px] text-[#3d4f68] text-center">
            {caliber.name} | Viento: {windSpeed} km/h @ {windAngle}° | Visor: {scopeHeight} cm
          </div>

          <div className="overflow-x-auto -mx-1">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-subtle)] hover:bg-transparent">
                  <TableHead className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.08em] h-8">DIST</TableHead>
                  <TableHead className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.08em] h-8">DERIVA</TableHead>
                  <TableHead className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.08em] h-8">DR.MOA</TableHead>
                  <TableHead className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.08em] h-8">CAÍDA</TableHead>
                  <TableHead className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.08em] h-8">EL.MOA</TableHead>
                  <TableHead className="font-mono-tactical text-[9px] text-[#7a8ca8] tracking-[0.08em] h-8">CLK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rangeCardData.map((row) => (
                  <TableRow key={row.distance} className="border-b border-[var(--border-subtle)] hover:bg-[rgba(0,229,255,0.04)]">
                    <TableCell className="font-display text-[11px] text-[#e8ecf5]">{row.distance}m</TableCell>
                    <TableCell className="font-mono-tactical text-[10px] text-[#00e5ff]">{Math.abs(row.driftCm).toFixed(1)} cm</TableCell>
                    <TableCell className="font-mono-tactical text-[10px] text-[#00e5ff]">{Math.abs(row.driftMoa).toFixed(1)}</TableCell>
                    <TableCell className="font-mono-tactical text-[10px] text-[#ffb830]">{Math.abs(row.dropCm).toFixed(1)} cm</TableCell>
                    <TableCell className="font-mono-tactical text-[10px] text-[#ffb830]">{Math.abs(row.elevMoa).toFixed(1)}</TableCell>
                    <TableCell className="font-mono-tactical text-[10px] text-[#e8ecf5]">{Math.abs(row.elevClicks).toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center gap-4 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00e5ff]" />
              <span className="font-mono-tactical text-[8px] text-[#3d4f68]">VIENTO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ffb830]" />
              <span className="font-mono-tactical text-[8px] text-[#3d4f68]">ELEVACIÓN</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
