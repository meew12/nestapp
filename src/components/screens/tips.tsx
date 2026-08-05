'use client'

import type { Tab } from './main-app'
import { ArrowLeft, Crosshair, Hand, Eye, Wind, Zap, RotateCcw, BookOpen, AlertTriangle, ArrowRightLeft } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface TipsScreenProps {
  onNavigate: (tab: Tab) => void
}

/* ─── Shooting Fundamentals Data ─── */
const FUNDAMENTALS = [
  {
    id: 'posicion',
    title: 'POSICIÓN',
    icon: Crosshair,
    description: 'Alineación corporal, tipos de postura y distribución del peso',
    bullets: [
      'Alinea hombros con el blanco — cuerpo forma ángulo 45° respecto al target',
      'Weaver: cuerpo angular, brazo de tiro extendido, apoyo flexionado — más estable',
      'Isosceles: simétrico frente al blanco, ambos brazos extendidos — más rápido',
      'Distribuye 60% del peso en la pierna adelantada, 40% en la trasera',
    ],
    proTip: 'En posiciones de rodillas o prona, busca tu punto natural de puntería con los ojos cerrados. Abre los ojos y la mira debe caer sobre el blanco sin ajuste.',
  },
  {
    id: 'empunadura',
    title: 'EMPUÑADURA',
    icon: Hand,
    description: 'Presión de agarre, empuñadura alta y colocación de la mano de apoyo',
    bullets: [
      'Regla 60/40: mano fuerte al 60% de presión, mano de apoyo al 40%',
      'Empuñadura alta: la piel entre pulgar e índice debe quedar al ras del talón de la empuñadura',
      'Mano de apoyo: envuelve los dedos de la mano fuerte, nunca sobre la corredera',
      'Presión constante — no aprietes más al disparar (anticipación)',
    ],
    proTip: 'Prueba la empuñadura sin munición: alguien debe poder arrancarte el arma de la mano con un tirón moderado si tu agarre es correcto pero no rígido.',
  },
  {
    id: 'mira',
    title: 'MIRA',
    icon: Eye,
    description: 'Alineación de miras, cuadro de mira y jerarquía de enfoque',
    bullets: [
      'Alineación: alza y punto de mira alineados horizontal y verticalmente',
      'Cuadro de mira: alineación + punto de mira sobre el blanco',
      'Jerarquía de enfoque: PUNTO DE MIRA > BLANCO > ALZA — el punto de mira SIEMPRE nítido',
      'El alza se ve borrosa pero alineada; el blanco se ve borroso pero visible',
    ],
    proTip: 'Si no puedes ver el punto de mira con nitidez, necesitas lentes correctivas de tiro con la receta ajustada para la distancia del punto de mira (~60cm).',
  },
  {
    id: 'respiracion',
    title: 'RESPIRACIÓN',
    icon: Wind,
    description: 'Pausa respiratoria, punto natural de puntería y ciclo de respiración',
    bullets: [
      'Ciclo: inhala → exhala → PAUSA RESPIRATORIA (8-10 seg) → disparo → inhala',
      'La pausa ocurre al final de la exhalación natural — menor movimiento del diafragma',
      'Si no disparas en la pausa, respira de nuevo — NUNCA forces el disparo',
      'Punto natural: en pausa respiratoria, la mira debe descansar sobre el centro del blanco',
    ],
    proTip: 'Cuenta el tiempo de tu pausa respiratoria natural. Si es menor a 6 segundos, trabaja ejercicios de respiración diafragmática antes de la sesión de tiro.',
  },
  {
    id: 'gatillo',
    title: 'GATILLO',
    icon: Zap,
    description: 'Técnica de presión, ruptura sorpresa, seguimiento y reset',
    bullets: [
      'Ruptura sorpresa: presiona el gatillo suavemente hasta que el disparo "te sorprenda"',
      'Usa la yema del dedo (no la articulación) para presión uniforme en gatillos de servicio',
      'Follow-through: mantén presión hacia atrás después del disparo, no sueltes',
      'Reset: suelta el gatillo solo hasta el punto de reset (click) para el siguiente disparo',
    ],
    proTip: 'Ejercicio de "pared seca": apunta al blanco, presiona gatillo en seco. Si la mira se mueve al "disparar", tu control de gatillo necesita trabajo.',
  },
  {
    id: 'recuperacion',
    title: 'RECUPERACIÓN',
    icon: RotateCcw,
    description: 'Recuperación entre disparos, reset mental y cadencia de tiro',
    bullets: [
      'Después del disparo: reacquiere la mira, verifica alineación, respira → siguiente',
      'Reset mental: un mal disparo no afecta el siguiente — cada disparo es independiente',
      'Cadencia controlada: mejor 10 disparos perfectos en 30s que 10 malos en 10s',
      'En tiro dinámico: la velocidad viene de la eficiencia del movimiento, no de la prisa',
    ],
    proTip: 'Desarrolla una rutina de "reset" mental de 2 segundos entre cada disparo: respira → verifica mira → presiona gatillo. Consistentencia sobre velocidad.',
  },
]

/* ─── Error Correction Data ─── */
const ERRORS = [
  {
    id: 'low-left',
    title: 'Impactos bajos-izquierda',
    cause: 'Tirón del gatillo / demasiado dedo en el gatillo',
    correction: 'Usa la yema del dedo, no la articulación. Presión suave y recta hacia atrás.',
    dots: [
      { x: 30, y: 58 }, { x: 35, y: 62 }, { x: 28, y: 65 },
      { x: 40, y: 60 }, { x: 32, y: 68 },
    ],
  },
  {
    id: 'high-right',
    title: 'Impactos altos-derecha',
    cause: 'Heeling / anticipación del retroceso',
    correction: 'Relaja la mano. No empujes el arma hacia adelante anticipando el disparo. Ruptura sorpresa.',
    dots: [
      { x: 55, y: 20 }, { x: 60, y: 25 }, { x: 52, y: 18 },
      { x: 58, y: 22 }, { x: 63, y: 28 },
    ],
  },
  {
    id: 'scattered',
    title: 'Impactos dispersados',
    cause: 'Empuñadura inconsistente / respiración irregular',
    correction: 'Estandariza tu empuñadura antes de cada serie. Sigue el ciclo respiratorio.',
    dots: [
      { x: 25, y: 30 }, { x: 55, y: 55 }, { x: 60, y: 25 },
      { x: 30, y: 60 }, { x: 45, y: 40 },
    ],
  },
  {
    id: 'vertical',
    title: 'Grupo vertical',
    cause: 'Problemas de respiración / punto natural de puntería',
    correction: 'Dispara en la pausa respiratoria. Verifica que tu punto natural caiga en el centro.',
    dots: [
      { x: 40, y: 20 }, { x: 42, y: 35 }, { x: 38, y: 50 },
      { x: 41, y: 65 }, { x: 39, y: 42 },
    ],
  },
  {
    id: 'horizontal',
    title: 'Grupo horizontal',
    cause: 'Control de gatillo / tensión de empuñadura variable',
    correction: 'Presión de gatillo suave y recta. Mantén tensión constante en ambas manos.',
    dots: [
      { x: 20, y: 40 }, { x: 35, y: 42 }, { x: 50, y: 38 },
      { x: 65, y: 41 }, { x: 42, y: 39 },
    ],
  },
]

/* ─── Conversion Data ─── */
const METERS_YARDS = [
  { m: 10, yd: 10.9 },
  { m: 25, yd: 27.3 },
  { m: 50, yd: 54.7 },
  { m: 100, yd: 109.4 },
  { m: 200, yd: 218.7 },
  { m: 300, yd: 328.1 },
  { m: 500, yd: 546.8 },
]

const MOA_TABLE = [
  { dist: 25, moa1: 0.73, moa2: 1.45, moa3: 2.18 },
  { dist: 50, moa1: 1.45, moa2: 2.91, moa3: 4.36 },
  { dist: 100, moa1: 2.91, moa2: 5.82, moa3: 8.73 },
  { dist: 200, moa1: 5.82, moa2: 11.64, moa3: 17.45 },
  { dist: 300, moa1: 8.73, moa2: 17.45, moa3: 26.18 },
]

const WIND_SPEEDS = [
  { kmh: 5, ms: 1.4, mph: 3.1 },
  { kmh: 10, ms: 2.8, mph: 6.2 },
  { kmh: 15, ms: 4.2, mph: 9.3 },
  { kmh: 20, ms: 5.6, mph: 12.4 },
  { kmh: 30, ms: 8.3, mph: 18.6 },
  { kmh: 50, ms: 13.9, mph: 31.1 },
]

const TEMPS = [
  { c: -10, f: 14 },
  { c: 0, f: 32 },
  { c: 10, f: 50 },
  { c: 15, f: 59 },
  { c: 20, f: 68 },
  { c: 25, f: 77 },
  { c: 30, f: 86 },
  { c: 40, f: 104 },
]

/* ─── Mini Target Diagram ─── */
function ErrorPattern({ dots }: { dots: { x: number; y: number }[] }) {
  return (
    <div className="relative w-20 h-20 bg-[#070b16] rounded border border-[var(--border-subtle)] shrink-0">
      {/* Target rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border border-[rgba(255,58,40,0.15)]" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border border-[rgba(255,58,40,0.2)]" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-[rgba(255,58,40,0.3)]" />
      </div>
      {/* Crosshairs */}
      <div className="absolute left-1/2 top-1 bottom-1 w-px bg-[rgba(255,58,40,0.08)] -translate-x-1/2" />
      <div className="absolute top-1/2 left-1 right-1 h-px bg-[rgba(255,58,40,0.08)] -translate-y-1/2" />
      {/* Impact dots */}
      {dots.map((dot, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-[#ff3a28]"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 4px rgba(255,58,40,0.6)',
          }}
        />
      ))}
    </div>
  )
}

/* ─── Main Tips Screen ─── */
export function TipsScreen({ onNavigate }: TipsScreenProps) {
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
          <h1 className="font-display font-bold text-base tracking-[0.08em]">CONSEJOS</h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68]">TIPS & REFERENCIA</p>
        </div>
        <BookOpen size={20} className="text-[#ffb830] opacity-60" />
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-6 overflow-y-auto" style={{ paddingBottom: 'calc(24px + var(--safe-bottom))' }}>
        <Accordion type="multiple" defaultValue={['fundamentals']} className="space-y-3">
          {/* ─── Section 1: Fundamentals ─── */}
          <AccordionItem value="fundamentals" className="tactical-card rounded-xl border-0 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[rgba(255,58,40,0.04)] transition-colors">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className="text-[#ff3a28]" />
                <span className="font-display font-bold text-lg tracking-[0.08em] text-[#ff3a28]">
                  FUNDAMENTOS DE TIRO
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-4">
              {FUNDAMENTALS.map((fund) => {
                const Icon = fund.icon
                return (
                  <div key={fund.id} className="tactical-card p-4 rounded-lg space-y-3">
                    {/* Title row */}
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-[#00e5ff]" />
                      <h3 className="font-display font-bold text-sm tracking-[0.06em] text-[#e8ecf5]">
                        {fund.title}
                      </h3>
                    </div>
                    {/* Description */}
                    <p className="text-sm text-[#7a8ca8]">{fund.description}</p>
                    {/* Bullet points */}
                    <ul className="space-y-1.5">
                      {fund.bullets.map((bullet, i) => (
                        <li key={i} className="text-sm text-[#7a8ca8] flex gap-2">
                          <span className="text-[#ff3a28] mt-0.5 shrink-0">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    {/* Pro Tip */}
                    <div className="bg-[rgba(255,184,0,0.1)] border-l-2 border-l-[#ffb830] p-3 rounded-r">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap size={11} className="text-[#ffb830]" />
                        <span className="font-display font-bold text-[10px] tracking-[0.1em] text-[#ffb830]">PRO TIP</span>
                      </div>
                      <p className="text-xs text-[#ffb830] opacity-90 leading-relaxed">{fund.proTip}</p>
                    </div>
                  </div>
                )
              })}
            </AccordionContent>
          </AccordionItem>

          {/* ─── Section 2: Error Correction ─── */}
          <AccordionItem value="errors" className="tactical-card rounded-xl border-0 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[rgba(255,58,40,0.04)] transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-[#ffb830]" />
                <span className="font-display font-bold text-lg tracking-[0.08em] text-[#ff3a28]">
                  CORRECCIÓN DE ERRORES
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-3">
              {ERRORS.map((err) => (
                <div key={err.id} className="tactical-card p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    {/* Pattern diagram */}
                    <ErrorPattern dots={err.dots} />
                    {/* Text content */}
                    <div className="flex-1 space-y-2">
                      <h3 className="font-display font-bold text-sm tracking-[0.04em] text-[#e8ecf5]">
                        {err.title}
                      </h3>
                      <div>
                        <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">CAUSA</span>
                        <p className="text-sm text-[#7a8ca8] mt-0.5">{err.cause}</p>
                      </div>
                      <div>
                        <span className="font-mono-tactical text-[9px] text-[#39ff7a] tracking-[0.08em]">CORRECCIÓN</span>
                        <p className="text-sm text-[#7a8ca8] mt-0.5">{err.correction}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* General tip */}
              <div className="bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.12)] rounded-lg p-3">
                <p className="text-xs text-[#00e5ff] opacity-90 leading-relaxed">
                  <span className="font-display font-bold">NOTA:</span> Los patrones de error asumen tirador diestro. Para tiradores zurdos, los patrones horizontalmente se invierten.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ─── Section 3: Conversion Table ─── */}
          <AccordionItem value="conversions" className="tactical-card rounded-xl border-0 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[rgba(255,58,40,0.04)] transition-colors">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={14} className="text-[#00e5ff]" />
                <span className="font-display font-bold text-lg tracking-[0.08em] text-[#ff3a28]">
                  TABLA DE CONVERSIÓN
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-4">
              {/* Meters ↔ Yards */}
              <div className="tactical-card p-4 rounded-lg space-y-2">
                <h3 className="font-display font-bold text-xs tracking-[0.08em] text-[#e8ecf5]">METROS ↔ YARDAS</h3>
                <div className="grid grid-cols-2 gap-1">
                  <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">METROS</span>
                  <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">YARDAS</span>
                </div>
                {METERS_YARDS.map((row) => (
                  <div key={row.m} className="grid grid-cols-2 gap-1">
                    <span className="font-mono-tactical text-sm text-[#00e5ff]">{row.m} m</span>
                    <span className="font-mono-tactical text-sm text-[#e8ecf5]">{row.yd} yd</span>
                  </div>
                ))}
              </div>

              {/* MOA ↔ cm */}
              <div className="tactical-card p-4 rounded-lg space-y-2">
                <h3 className="font-display font-bold text-xs tracking-[0.08em] text-[#e8ecf5]">MOA ↔ CM A DISTANCIA</h3>
                <div className="overflow-x-auto -mx-1">
                  <div className="min-w-[280px]">
                    <div className="grid grid-cols-4 gap-1">
                      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">DIST</span>
                      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">1 MOA</span>
                      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">2 MOA</span>
                      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">3 MOA</span>
                    </div>
                    {MOA_TABLE.map((row) => (
                      <div key={row.dist} className="grid grid-cols-4 gap-1">
                        <span className="font-mono-tactical text-sm text-[#00e5ff]">{row.dist}m</span>
                        <span className="font-mono-tactical text-sm text-[#e8ecf5]">{row.moa1} cm</span>
                        <span className="font-mono-tactical text-sm text-[#e8ecf5]">{row.moa2} cm</span>
                        <span className="font-mono-tactical text-sm text-[#e8ecf5]">{row.moa3} cm</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Wind speeds */}
              <div className="tactical-card p-4 rounded-lg space-y-2">
                <h3 className="font-display font-bold text-xs tracking-[0.08em] text-[#e8ecf5]">VELOCIDAD DEL VIENTO</h3>
                <div className="overflow-x-auto -mx-1">
                  <div className="min-w-[260px]">
                    <div className="grid grid-cols-3 gap-1">
                      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">KM/H</span>
                      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">M/S</span>
                      <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">MPH</span>
                    </div>
                    {WIND_SPEEDS.map((row) => (
                      <div key={row.kmh} className="grid grid-cols-3 gap-1">
                        <span className="font-mono-tactical text-sm text-[#00e5ff]">{row.kmh}</span>
                        <span className="font-mono-tactical text-sm text-[#e8ecf5]">{row.ms}</span>
                        <span className="font-mono-tactical text-sm text-[#e8ecf5]">{row.mph}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Temperature */}
              <div className="tactical-card p-4 rounded-lg space-y-2">
                <h3 className="font-display font-bold text-xs tracking-[0.08em] text-[#e8ecf5]">TEMPERATURA °C ↔ °F</h3>
                <div className="grid grid-cols-2 gap-1">
                  <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">°C</span>
                  <span className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.08em]">°F</span>
                </div>
                {TEMPS.map((row) => (
                  <div key={row.c} className="grid grid-cols-2 gap-1">
                    <span className="font-mono-tactical text-sm text-[#00e5ff]">{row.c}°</span>
                    <span className="font-mono-tactical text-sm text-[#e8ecf5]">{row.f}°</span>
                  </div>
                ))}
                {/* Formula */}
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                  <p className="font-mono-tactical text-[10px] text-[#7a8ca8]">
                    °F = (°C × 9/5) + 32 &nbsp;|&nbsp; °C = (°F − 32) × 5/9
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>
    </div>
  )
}
