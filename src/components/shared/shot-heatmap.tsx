'use client'

import { useCallback, useEffect, useRef } from 'react'
import { RING_COLORS } from '@/lib/scoring'

export interface ShotHeatMapProps {
  /** Shot positions in their original coordinate space. */
  shots: Array<{ x: number; y: number }>
  /** The coordinate space the shots' x/y are in. */
  coordSpace: { width: number; height: number }
  /** Canvas pixel width. Default 640. */
  width?: number
  /** Canvas pixel height. Default = width (square). */
  height?: number
  /** Optional className for the wrapper div. */
  className?: string
  /** Optional inline style override. */
  style?: React.CSSProperties
}

/**
 * Gaussian kernel density heat map rendered over a bullseye target.
 *
 * Algorithm:
 * 1. Draw the bullseye target rings (same style as TargetMap).
 * 2. For each cell in a coarse grid (CELL_SIZE px), compute density as
 *    the sum of gaussian contributions from all shots.
 * 3. Normalize densities to [0, 1].
 * 4. Map density to a color gradient: transparent → blue → cyan → yellow → red.
 * 5. Draw the heat overlay semi-transparent on top of the target.
 */
export function ShotHeatMap({
  shots,
  coordSpace,
  width = 640,
  height,
  className,
  style,
}: ShotHeatMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const h = height ?? width

  // Grid cell size for performance (lower = more detail but slower)
  const CELL_SIZE = 4
  // Gaussian bandwidth (in canvas pixels). Controls how "spread out" the heat is.
  const BANDWIDTH = Math.min(width, h) * 0.06

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const hgt = canvas.height
    const cx = w / 2
    const cy = hgt / 2
    const maxR = Math.min(w, hgt) * 0.45

    // Scale factors from shot coord space → canvas space
    const scaleX = w / coordSpace.width
    const scaleY = hgt / coordSpace.height

    // ── Step 1: Draw the target background ──
    ctx.clearRect(0, 0, w, hgt)
    ctx.fillStyle = '#070b16'
    ctx.fillRect(0, 0, w, hgt)

    // Subtle radial vignette
    const vignette = ctx.createRadialGradient(cx, cy, maxR * 0.2, cx, cy, maxR * 1.4)
    vignette.addColorStop(0, 'rgba(255,58,40,0.04)')
    vignette.addColorStop(1, 'rgba(6,9,16,0)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, hgt)

    // Concentric score rings (outer → inner)
    for (let i = 10; i >= 1; i--) {
      const ratio = i / 10
      const r = maxR * ratio
      const ringColor = RING_COLORS.find((rc) => rc.score === i)?.color || '#4da6ff'

      // Alternating subtle fill
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.035)'
      ctx.fill()

      // Ring border
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = i <= 2 ? 'rgba(255,58,40,0.55)' : 'rgba(122,140,168,0.28)'
      ctx.lineWidth = i === 1 ? 1.5 : 1
      ctx.stroke()

      // Ring number label
      ctx.save()
      ctx.fillStyle = 'rgba(122,140,168,0.55)'
      ctx.font = '10px "Share Tech Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const labelR = maxR * (ratio - 0.05)
      ctx.fillText(String(i), cx, cy - labelR)
      ctx.restore()
    }

    // Center crosshair
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = '#ff3a28'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath(); ctx.moveTo(cx - maxR * 0.12, cy); ctx.lineTo(cx + maxR * 0.12, cy); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx, cy - maxR * 0.12); ctx.lineTo(cx, cy + maxR * 0.12); ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#ff3a28'
    ctx.globalAlpha = 0.8
    ctx.fill()
    ctx.restore()

    // ── Step 2: Compute density grid ──
    if (shots.length === 0) return

    const cols = Math.ceil(w / CELL_SIZE)
    const rows = Math.ceil(hgt / CELL_SIZE)
    const densityGrid = new Float64Array(cols * rows)

    // Scale shots to canvas space
    const scaledShots = shots.map((s) => ({
      x: s.x * scaleX,
      y: s.y * scaleY,
    }))

    const sigma2 = BANDWIDTH * BANDWIDTH
    const twoSigma2 = 2 * sigma2
    // Cutoff: contributions beyond 3σ are negligible
    const cutoff = BANDWIDTH * 3
    const cutoff2 = cutoff * cutoff

    let maxDensity = 0

    for (let row = 0; row < rows; row++) {
      const py = row * CELL_SIZE + CELL_SIZE / 2
      for (let col = 0; col < cols; col++) {
        const px = col * CELL_SIZE + CELL_SIZE / 2
        let density = 0

        for (let si = 0; si < scaledShots.length; si++) {
          const dx = px - scaledShots[si].x
          const dy = py - scaledShots[si].y
          const dist2 = dx * dx + dy * dy
          if (dist2 > cutoff2) continue
          density += Math.exp(-dist2 / twoSigma2)
        }

        densityGrid[row * cols + col] = density
        if (density > maxDensity) maxDensity = density
      }
    }

    // ── Step 3: Draw heat overlay ──
    if (maxDensity === 0) return

    // Create a temporary canvas for the heat overlay
    const heatCanvas = document.createElement('canvas')
    heatCanvas.width = cols
    heatCanvas.height = rows
    const heatCtx = heatCanvas.getContext('2d')
    if (!heatCtx) return

    const imageData = heatCtx.createImageData(cols, rows)
    const data = imageData.data

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const density = densityGrid[row * cols + col] / maxDensity // normalized 0–1
        if (density < 0.01) continue // skip very low density pixels

        const [r, g, b, a] = densityToColor(density)
        const idx = (row * cols + col) * 4
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = a
      }
    }

    heatCtx.putImageData(imageData, 0, 0)

    // Draw the low-res heat map scaled up onto the main canvas
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(heatCanvas, 0, 0, w, hgt)
    ctx.restore()

    // ── Draw individual shot dots on top for reference ──
    ctx.save()
    ctx.globalAlpha = 0.35
    for (const shot of scaledShots) {
      ctx.beginPath()
      ctx.arc(shot.x, shot.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }
    ctx.restore()

  }, [shots, coordSpace.width, coordSpace.height, width, h, BANDWIDTH])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        width: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        height: 'auto',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={h}
        className="w-full h-full rounded-lg"
        style={{
          background: '#070b16',
        }}
        aria-label="Mapa de calor de impactos"
        role="img"
      />
    </div>
  )
}

/**
 * Map a normalized density value (0–1) to an RGBA color.
 * Gradient: transparent → blue → cyan → yellow → red
 */
function densityToColor(density: number): [number, number, number, number] {
  // Clamp
  const d = Math.max(0, Math.min(1, density))

  // Alpha ramps up with density
  const alpha = Math.min(255, Math.floor(d * 280))

  let r: number, g: number, b: number

  if (d < 0.25) {
    // transparent → blue
    const t = d / 0.25
    r = 0
    g = 0
    b = Math.floor(180 * t)
  } else if (d < 0.5) {
    // blue → cyan
    const t = (d - 0.25) / 0.25
    r = 0
    g = Math.floor(229 * t)
    b = Math.floor(180 + (255 - 180) * t)
  } else if (d < 0.75) {
    // cyan → yellow
    const t = (d - 0.5) / 0.25
    r = Math.floor(255 * t)
    g = Math.floor(229 + (184 - 229) * t)
    b = Math.floor(255 * (1 - t))
  } else {
    // yellow → red
    const t = (d - 0.75) / 0.25
    r = 255
    g = Math.floor(184 * (1 - t))
    b = 0
  }

  return [r, g, b, alpha]
}
