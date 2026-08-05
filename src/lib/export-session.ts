/**
 * Session PNG export utility.
 *
 * Builds a composite canvas with the target visualization + session stats
 * and triggers a browser download. Used by the Results and History screens.
 */
import type { SessionData, ShotData } from '@/lib/types'
import { scoreColor, LATEST_SHOT_COLOR } from '@/lib/types'
import { RING_COLORS, TARGET_DIAMETER_CM } from '@/lib/scoring'

export interface ExportOptions {
  session: SessionData & { createdAt?: string }
  userName?: string
  /** The source canvas to copy the target from (already rendered by TargetMap). */
  sourceCanvas: HTMLCanvasElement | null
}

/**
 * Render the session target + stats onto a new canvas.
 * The composite image is 800×1100 (portrait, share-friendly).
 * Returns the canvas element (does NOT trigger a download).
 */
export function generateSessionCanvas({ session, userName, sourceCanvas }: ExportOptions): HTMLCanvasElement | null {
  const W = 800
  const H = 1100
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // ── Background ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
  bgGrad.addColorStop(0, '#0a0e1a')
  bgGrad.addColorStop(1, '#060910')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,58,40,0.04)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // ── Header ──
  ctx.fillStyle = '#ff3a28'
  ctx.font = 'bold 32px Orbitron, sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#ff3a28'
  ctx.shadowBlur = 12
  ctx.fillText('E-TARGET', W / 2, 60)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#7a8ca8'
  ctx.font = '14px "Share Tech Mono", monospace'
  ctx.fillText('REPORTE DE SESIÓN', W / 2, 84)

  // Divider
  ctx.strokeStyle = 'rgba(255,58,40,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, 105); ctx.lineTo(W - 60, 105); ctx.stroke()

  // ── Date + user ──
  const dateStr = session.createdAt
    ? new Date(session.createdAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  ctx.fillStyle = '#3d4f68'
  ctx.font = '12px "Share Tech Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`FECHA: ${dateStr}`, 60, 135)
  if (userName) {
    ctx.textAlign = 'right'
    ctx.fillText(`TIRADOR: ${userName.toUpperCase()}`, W - 60, 135)
  }

  // Mode badge
  ctx.textAlign = 'center'
  const modeText = session.trainingMode ? 'MODO ENTRENAMIENTO' : 'MODO COMPETENCIA'
  const modeColor = session.trainingMode ? '#ffb830' : '#ff3a28'
  ctx.fillStyle = modeColor
  ctx.font = 'bold 11px "Share Tech Mono", monospace'
  ctx.fillText(modeText, W / 2, 160)

  if (session.captureMode === 'simulator') {
    ctx.fillStyle = '#00e5ff'
    ctx.font = '10px "Share Tech Mono", monospace'
    ctx.fillText('· SIMULADOR ·', W / 2, 178)
  }

  // ── Target visualization ──
  const targetSize = 360
  const targetX = (W - targetSize) / 2
  const targetY = 200

  // Target background
  ctx.fillStyle = '#070b16'
  ctx.fillRect(targetX, targetY, targetSize, targetSize)

  // Draw the target rings + shots (reuse TargetMap drawing logic)
  drawTargetOnContext(ctx, targetX, targetY, targetSize, session.shots, session.captureMode === 'simulator' ? 600 : 1280, session.captureMode === 'simulator' ? 600 : 720, session.trainingMode)

  // Target border
  ctx.strokeStyle = 'rgba(255,58,40,0.3)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(targetX, targetY, targetSize, targetSize)

  // ── Score hero ──
  const scoreY = 600
  const scoreValue = session.trainingMode ? session.shotCount : session.totalScore
  const scoreLabel = session.trainingMode ? 'IMPACTOS' : 'PUNTAJE'

  ctx.fillStyle = '#ff3a28'
  ctx.font = 'bold 64px Orbitron, sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#ff3a28'
  ctx.shadowBlur = 20
  ctx.fillText(String(scoreValue), W / 2, scoreY + 50)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#3d4f68'
  ctx.font = '12px "Share Tech Mono", monospace'
  ctx.fillText(scoreLabel, W / 2, scoreY + 72)

  // ── Stats grid (4 cards) ──
  const statsY = 720
  const cardW = 160
  const cardH = 80
  const gap = 16
  const startX = (W - (cardW * 2 + gap)) / 2

  const stats = [
    { value: String(session.shotCount), label: 'DISPAROS', color: '#00e5ff' },
    { value: String(session.bestScore || '—'), label: 'MEJOR', color: '#39ff7a' },
    { value: session.shots.length > 0 ? session.avgScore.toFixed(1) : '—', label: 'PROMEDIO', color: '#ffb830' },
    { value: `${session.durationSec}s`, label: 'DURACIÓN', color: '#ff7240' },
  ]

  stats.forEach((s, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = startX + col * (cardW + gap)
    const y = statsY + row * (cardH + gap)

    // Card bg
    ctx.fillStyle = 'rgba(13,20,36,0.8)'
    ctx.strokeStyle = 'rgba(255,58,40,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, y, cardW, cardH, 8)
    ctx.fill()
    ctx.stroke()

    // Value
    ctx.fillStyle = s.color
    ctx.font = 'bold 28px Orbitron, sans-serif'
    ctx.textAlign = 'center'
    ctx.shadowColor = s.color
    ctx.shadowBlur = 8
    ctx.fillText(s.value, x + cardW / 2, y + 42)
    ctx.shadowBlur = 0

    // Label
    ctx.fillStyle = '#3d4f68'
    ctx.font = '10px "Share Tech Mono", monospace'
    ctx.fillText(s.label, x + cardW / 2, y + 62)
  })

  // ── Shot log (compact) ──
  const logY = 920
  ctx.fillStyle = '#3d4f68'
  ctx.font = '11px "Share Tech Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('REGISTRO DE IMPACTOS', 60, logY)

  ctx.strokeStyle = 'rgba(255,58,40,0.1)'
  ctx.beginPath(); ctx.moveTo(60, logY + 6); ctx.lineTo(W - 60, logY + 6); ctx.stroke()

  if (session.shots.length === 0) {
    ctx.fillStyle = '#7a8ca8'
    ctx.font = '12px Rajdhani, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sin impactos registrados', W / 2, logY + 30)
  } else {
    session.shots.slice(0, 10).forEach((shot, i) => {
      const y = logY + 24 + i * 16
      const isLatest = i === session.shots.length - 1
      const color = isLatest ? LATEST_SHOT_COLOR : scoreColor(shot.score)
      ctx.fillStyle = '#3d4f68'
      ctx.font = '11px "Share Tech Mono", monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`#${i + 1}`, 60, y)
      ctx.fillStyle = '#7a8ca8'
      ctx.fillText(`x:${Math.round(shot.x)} y:${Math.round(shot.y)}`, 110, y)
      if (shot.distanceM) {
        ctx.fillStyle = '#4d5f78'
        ctx.fillText(`${shot.distanceM}cm`, 260, y)
      }
      if (isLatest) {
        ctx.fillStyle = '#ff3a28'
        ctx.fillText('● ÚLTIMO', 340, y)
      }
      ctx.fillStyle = color
      ctx.font = 'bold 13px Orbitron, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(session.trainingMode ? '—' : String(shot.score), W - 60, y)
    })
    if (session.shots.length > 10) {
      ctx.fillStyle = '#3d4f68'
      ctx.font = '10px "Share Tech Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`+${session.shots.length - 10} impactos más…`, W / 2, logY + 24 + 10 * 16 + 12)
    }
  }

  // ── Footer ──
  ctx.fillStyle = '#3d4f68'
  ctx.font = '9px "Share Tech Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText('E-TARGET · DETECCIÓN DE IMPACTOS', W / 2, H - 20)

  return canvas
}

/**
 * Render the session target + stats onto a new canvas and download it as PNG.
 * The composite image is 800×1100 (portrait, share-friendly).
 */
export function exportSessionPNG(options: ExportOptions) {
  const canvas = generateSessionCanvas(options)
  if (!canvas) return

  const { session } = options
  const link = document.createElement('a')
  const ts = session.createdAt ? new Date(session.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  link.download = `etarget-sesion-${ts}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

/**
 * Draw the bullseye target + shots onto an arbitrary 2D context at a given position.
 * This mirrors the TargetMap component's drawing logic.
 */
function drawTargetOnContext(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number,
  shots: ShotData[],
  coordW: number,
  coordH: number,
  trainingMode: boolean,
) {
  const cx = ox + size / 2
  const cy = oy + size / 2
  const maxR = (size / 2) * 0.9
  const scaleX = size / coordW
  const scaleY = size / coordH

  // Vignette
  const vignette = ctx.createRadialGradient(cx, cy, maxR * 0.2, cx, cy, maxR * 1.4)
  vignette.addColorStop(0, 'rgba(255,58,40,0.04)')
  vignette.addColorStop(1, 'rgba(6,9,16,0)')
  ctx.fillStyle = vignette
  ctx.fillRect(ox, oy, size, size)

  // Rings
  for (let i = 10; i >= 1; i--) {
    const ratio = i / 10
    const r = maxR * ratio
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.035)'
    ctx.fill()
    ctx.strokeStyle = i <= 2 ? 'rgba(255,58,40,0.55)' : 'rgba(122,140,168,0.28)'
    ctx.lineWidth = i === 1 ? 1.5 : 1
    ctx.stroke()

    // Ring label
    ctx.fillStyle = 'rgba(122,140,168,0.55)'
    ctx.font = '9px "Share Tech Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labelR = maxR * (ratio - 0.05)
    ctx.fillText(String(i), cx, cy - labelR)
  }

  // Center crosshair
  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.strokeStyle = LATEST_SHOT_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(cx - maxR * 0.12, cy); ctx.lineTo(cx + maxR * 0.12, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy - maxR * 0.12); ctx.lineTo(cx, cy + maxR * 0.12); ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fillStyle = LATEST_SHOT_COLOR
  ctx.globalAlpha = 0.8
  ctx.fill()
  ctx.restore()

  // Shots
  shots.forEach((shot, idx) => {
    const isLatest = idx === shots.length - 1
    const color = isLatest ? LATEST_SHOT_COLOR : scoreColor(shot.score)
    const sx = ox + shot.x * scaleX
    const sy = oy + shot.y * scaleY
    const radius = Math.max(4, Math.min(shot.radius || 10, 14))

    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = isLatest ? 22 : 10

    ctx.beginPath()
    ctx.arc(sx, sy, radius + 3, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = isLatest ? 2.5 : 1.5
    ctx.globalAlpha = isLatest ? 1 : 0.75
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(sx, sy, radius * 0.6, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = isLatest ? 0.9 : 0.45
    ctx.fill()

    ctx.globalAlpha = isLatest ? 1 : 0.7
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${isLatest ? 11 : 9}px "Share Tech Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(idx + 1), sx, sy)

    if (isLatest && !trainingMode) {
      ctx.globalAlpha = 1
      ctx.shadowColor = LATEST_SHOT_COLOR
      ctx.shadowBlur = 8
      const badgeX = sx + radius + 18
      const badgeY = sy - radius - 6
      ctx.fillStyle = 'rgba(10,14,26,0.9)'
      ctx.beginPath()
      ctx.roundRect(badgeX - 17, badgeY - 10, 34, 20, 4)
      ctx.fill()
      ctx.strokeStyle = LATEST_SHOT_COLOR
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = LATEST_SHOT_COLOR
      ctx.font = 'bold 11px Orbitron, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(shot.score), badgeX, badgeY)
    }

    ctx.restore()
  })
}
