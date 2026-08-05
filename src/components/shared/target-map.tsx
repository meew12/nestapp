'use client'

import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import type { ShotData } from '@/lib/types'
import { scoreColor, LATEST_SHOT_COLOR } from '@/lib/types'
import { RING_COLORS } from '@/lib/scoring'

/**
 * Imperive handle exposed by `<TargetMap ref={...}>`.
 * Used by the PNG export feature to grab the underlying canvas.
 */
export interface TargetMapHandle {
  /** Returns the internal HTMLCanvasElement, or null if not mounted. */
  getCanvas: () => HTMLCanvasElement | null
}

export interface TargetMapProps {
  /** Shots to render on the target. */
  shots: ShotData[]
  /** Pixel width of the canvas. Default 320. */
  width?: number
  /** Pixel height of the canvas. Default = width (square). */
  height?: number
  /** If true, the canvas accepts tap/click to register a new shot. */
  interactive?: boolean
  /** Called with (x, y) in canvas pixel coords when the user taps an interactive target. */
  onShot?: (x: number, y: number) => void
  /** Show the 10–1 ring number labels around the target. Default true. */
  showRingLabels?: boolean
  /** Show the shot index number inside each shot marker. Default true. */
  showShotNumbers?: boolean
  /** Show a "ÚLTIMO" badge next to the most recent shot. Default true. */
  showLatestBadge?: boolean
  /** Training mode hides score badges (shots still drawn). Default false. */
  trainingMode?: boolean
  /** Optional className for the wrapper. */
  className?: string
  /** Visual variant. 'default' = full target with rings. 'compact' = simpler ring set for small spaces. */
  variant?: 'default' | 'compact'
  /**
   * The coordinate space the shots' x/y are in. TargetMap scales them to fit
   * its internal canvas. Defaults to the canvas width/height (no scaling).
   * Use this when displaying shots captured at a different resolution
   * (e.g. camera shots at 1280×720 rendered on a 320×320 target).
   */
  coordSpace?: { width: number; height: number }
  /** Optional inline style override for the wrapper div. */
  style?: React.CSSProperties
}

/**
 * Reusable bullseye target visualization.
 *
 * Renders a canvas with:
 *  - 10 concentric score rings (innermost = 10 / red, outermost = 1 / blue)
 *  - A center crosshair
 *  - All shots drawn as colored circles (latest = #ff3a28, others = scoreColor)
 *  - Shot index numbers and an optional "ÚLTIMO" badge on the most recent shot
 *
 * When `interactive` is true, pointer events on the canvas fire `onShot(x, y)`
 * with pixel coordinates relative to the canvas's internal resolution.
 *
 * Shots' x/y can be in any coordinate space — pass `coordSpace` to indicate
 * the original space and TargetMap will scale them to fit the canvas.
 */
export const TargetMap = forwardRef<TargetMapHandle, TargetMapProps>(function TargetMap({
  shots,
  width = 320,
  height,
  interactive = false,
  onShot,
  showRingLabels = true,
  showShotNumbers = true,
  showLatestBadge = true,
  trainingMode = false,
  className,
  variant = 'default',
  coordSpace,
  style,
}: TargetMapProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const h = height ?? width
  // Coordinate space of the incoming shots; defaults to the canvas size (no scaling).
  const cs = coordSpace ?? { width, height: h }

  // Expose the canvas via ref for PNG export
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }), [])

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
    const scaleX = w / cs.width
    const scaleY = hgt / cs.height

    // Background
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
    const ringCount = variant === 'compact' ? 5 : 10
    for (let i = ringCount; i >= 1; i--) {
      const ratio = i / ringCount
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
      if (showRingLabels && variant === 'default') {
        ctx.save()
        ctx.fillStyle = 'rgba(122,140,168,0.55)'
        ctx.font = '9px "Share Tech Mono", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const labelR = maxR * (ratio - 0.05)
        ctx.fillText(String(i), cx, cy - labelR)
        ctx.restore()
      }
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
    // Center dot
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fillStyle = LATEST_SHOT_COLOR
    ctx.globalAlpha = 0.8
    ctx.fill()
    ctx.restore()

    // Draw shots (oldest first so latest paints on top), scaling from coordSpace
    // The LAST impact is ALWAYS rendered in RED (#ff3a28) with a pulsing halo,
    // regardless of its score. This guarantees the user can always identify
    // the most recent shot at a glance — a hard requirement of the spec.
    const sortedShots = [...shots]
    sortedShots.forEach((shot, idx) => {
      const isLatest = idx === sortedShots.length - 1
      const color = isLatest ? LATEST_SHOT_COLOR : scoreColor(shot.score)
      const sx = shot.x * scaleX
      const sy = shot.y * scaleY
      const radius = Math.max(4, Math.min(shot.radius || 10, 14))

      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = isLatest ? 26 : 10

      if (isLatest) {
        // Pulsing red halo rings — unmistakable "latest impact" marker
        const pulse = 1 + 0.2 * Math.sin(performance.now() / 220)
        ctx.beginPath()
        ctx.arc(sx, sy, (radius + 7) * pulse, 0, Math.PI * 2)
        ctx.strokeStyle = LATEST_SHOT_COLOR
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.55
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(sx, sy, (radius + 3) * (1 + 0.1 * Math.sin(performance.now() / 160 + 1)), 0, Math.PI * 2)
        ctx.strokeStyle = LATEST_SHOT_COLOR
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.35
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Outer ring
      ctx.beginPath()
      ctx.arc(sx, sy, radius + 3, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = isLatest ? 3 : 1.5
      ctx.globalAlpha = isLatest ? 1 : 0.75
      ctx.stroke()

      // Inner filled circle
      ctx.beginPath()
      ctx.arc(sx, sy, radius * 0.6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = isLatest ? 0.95 : 0.45
      ctx.fill()

      // Shot number
      if (showShotNumbers) {
        ctx.globalAlpha = isLatest ? 1 : 0.7
        ctx.shadowBlur = 0
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${isLatest ? 12 : 9}px "Share Tech Mono", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(idx + 1), sx, sy)
      }

      // Latest badge — always red tinted with "ÚLTIMO" micro-label
      if (isLatest && showLatestBadge && !trainingMode) {
        ctx.globalAlpha = 1
        ctx.shadowColor = LATEST_SHOT_COLOR
        ctx.shadowBlur = 10
        const badgeX = sx + radius + 20
        const badgeY = sy - radius - 8
        const badgeW = 40
        const badgeH = 22
        ctx.fillStyle = 'rgba(255,58,40,0.18)'
        ctx.beginPath()
        ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 5)
        ctx.fill()
        ctx.strokeStyle = LATEST_SHOT_COLOR
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = LATEST_SHOT_COLOR
        ctx.font = 'bold 12px Orbitron, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(shot.score), badgeX, badgeY - 1)
        // "ÚLTIMO" micro-label
        ctx.font = 'bold 7px "Share Tech Mono", monospace'
        ctx.fillStyle = 'rgba(255,58,40,0.9)'
        ctx.fillText('ÚLTIMO', badgeX, badgeY + 11)
      }

      ctx.restore()
    })
  }, [shots, showRingLabels, showShotNumbers, showLatestBadge, trainingMode, variant, cs.width, cs.height])

  // Redraw on every shot change / prop change
  useEffect(() => {
    draw()
  }, [draw])

  // Continuous rAF redraw loop — keeps the pulsing red halo on the latest
  // shot animating smoothly. Only runs when there's at least one shot,
  // so empty targets don't waste CPU cycles.
  useEffect(() => {
    if (shots.length === 0) return
    let raf = requestAnimationFrame(loop)
    function loop() {
      draw()
      raf = requestAnimationFrame(loop)
    }
    return () => cancelAnimationFrame(raf)
  }, [shots.length, draw])

  // Handle pointer events for interactive mode
  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive || !onShot) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      // Scale from displayed size to internal canvas resolution
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY
      onShot(x, y)
    },
    [interactive, onShot],
  )

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
        onPointerDown={interactive ? handlePointer : undefined}
        className="w-full h-full rounded-lg"
        style={{
          touchAction: interactive ? 'none' : 'auto',
          cursor: interactive ? 'crosshair' : 'default',
          background: '#070b16',
        }}
        aria-label="Blanco de tiro con impactos"
        role="img"
      />
    </div>
  )
})
