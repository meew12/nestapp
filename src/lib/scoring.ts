/**
 * Shared scoring helpers for E-TARGET.
 *
 * These were originally inlined in `useCameraDetection` but are extracted here
 * so the simulator mode and the TargetMap component can reuse them.
 */
import type { TargetSize } from '@/lib/types'

/** Target diameter in cm per target size preset. */
export const TARGET_DIAMETER_CM: Record<TargetSize, number> = {
  standard: 25,
  large: 50,
  small: 10,
}

/**
 * Map a pixel coordinate (relative to a w×h canvas) to a 1–10 score.
 *
 * The target center is the canvas center; the max scoring radius is
 * `min(w,h) * 0.45`. Distance ratio → score follows the standard
 * ISSF-style 10-ring scale.
 */
export function calculateScore(x: number, y: number, w: number, h: number): number {
  const cx = w / 2
  const cy = h / 2
  const maxDist = Math.min(w, h) * 0.45
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
  const ratio = Math.min(dist / maxDist, 1)
  if (ratio < 0.05) return 10
  if (ratio < 0.15) return 9
  if (ratio < 0.25) return 8
  if (ratio < 0.35) return 7
  if (ratio < 0.45) return 6
  if (ratio < 0.55) return 5
  if (ratio < 0.65) return 4
  if (ratio < 0.75) return 3
  if (ratio < 0.85) return 2
  return 1
}

/**
 * Estimate the distance (in cm) of a pixel point from the target center,
 * given the canvas dimensions and target size preset.
 */
export function calculateDistanceCm(
  x: number,
  y: number,
  w: number,
  h: number,
  targetSize: TargetSize = 'standard',
): number {
  const targetCm = TARGET_DIAMETER_CM[targetSize] || 25
  const cx = w / 2
  const cy = h / 2
  const pxDist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
  const maxR = Math.min(w, h) * 0.45
  return Math.round((pxDist / maxR) * (targetCm / 2))
}

/** Concentric score ring colors for the target visualization. */
export const RING_COLORS: { score: number; color: string }[] = [
  { score: 10, color: '#ff3a28' },
  { score: 9, color: '#ff7240' },
  { score: 8, color: '#ffb830' },
  { score: 7, color: '#ffb830' },
  { score: 6, color: '#00e5ff' },
  { score: 5, color: '#00e5ff' },
  { score: 4, color: '#4da6ff' },
  { score: 3, color: '#4da6ff' },
  { score: 2, color: '#4da6ff' },
  { score: 1, color: '#4da6ff' },
]

// ── Shot grouping analysis ──
export interface GroupAnalysis {
  /** Max distance between any two shots (cm) — the "group size" */
  groupSizeCm: number
  /** Mean Point of Impact — average position of all shots { x, y in canvas px } */
  mpi: { x: number; y: number } | null
  /** Distance from MPI to target center (cm) — "zeroing error" */
  deviationCm: number
  /** Standard deviation of shot distances from MPI (cm) — "consistency" */
  stdDevCm: number
  /** Extreme spread pixels (same as groupSizeCm but in px before conversion) */
  groupSizePx: number
  /** MOA equivalent of the group size (1 MOA ≈ 0.291 cm at 10m) */
  moa: number
  /** Pair of shot indices that form the extreme spread */
  extremePair: [number, number] | null
}

/**
 * Calculate shot grouping analysis from a list of shots.
 *
 * @param shots Array of shots with x, y in canvas pixel coordinates
 * @param coordW Canvas width the shots were recorded in
 * @param coordH Canvas height the shots were recorded in
 * @param targetSize Target size preset (for cm conversion)
 * @param distanceM Shooting distance in meters (for MOA calc)
 */
export function analyzeGroup(
  shots: { x: number; y: number }[],
  coordW: number,
  coordH: number,
  targetSize: TargetSize = 'standard',
  distanceM = 10,
): GroupAnalysis {
  if (shots.length < 2) {
    return {
      groupSizeCm: 0,
      mpi: shots.length === 1 ? { x: shots[0].x, y: shots[0].y } : null,
      deviationCm: 0,
      stdDevCm: 0,
      groupSizePx: 0,
      moa: 0,
      extremePair: null,
    }
  }

  const cx = coordW / 2
  const cy = coordH / 2
  const maxR = Math.min(coordW, coordH) * 0.45
  const targetCm = TARGET_DIAMETER_CM[targetSize] || 25
  const pxToCm = (px: number) => (px / maxR) * (targetCm / 2)

  // Mean Point of Impact
  const mpiX = shots.reduce((s, sh) => s + sh.x, 0) / shots.length
  const mpiY = shots.reduce((s, sh) => s + sh.y, 0) / shots.length

  // Extreme spread — find the two shots furthest apart
  let maxDist = 0
  let pair: [number, number] | null = null
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const d = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y)
      if (d > maxDist) {
        maxDist = d
        pair = [i, j]
      }
    }
  }

  // Deviation from target center
  const devPx = Math.hypot(mpiX - cx, mpiY - cy)

  // Standard deviation of distances from MPI
  const distsFromMpi = shots.map((s) => Math.hypot(s.x - mpiX, s.y - mpiY))
  const meanDist = distsFromMpi.reduce((a, b) => a + b, 0) / distsFromMpi.length
  const variance = distsFromMpi.reduce((s, d) => s + (d - meanDist) ** 2, 0) / distsFromMpi.length
  const stdDevPx = Math.sqrt(variance)

  // MOA: 1 MOA = 1.047" at 100 yards ≈ 0.291 cm at 10m
  // MOA = (groupCm / distanceM) * (100 / 1.047) * (1.0936 / 100) ≈ groupCm / distanceM * 0.291 * 3.438
  // Simplified: moa = (groupCm / (distanceM * 100)) * 3438
  const groupCm = pxToCm(maxDist)
  const moa = distanceM > 0 ? (groupCm / (distanceM * 100)) * 3438 : 0

  return {
    groupSizeCm: Math.round(groupCm * 10) / 10,
    groupSizePx: Math.round(maxDist),
    mpi: { x: mpiX, y: mpiY },
    deviationCm: Math.round(pxToCm(devPx) * 10) / 10,
    stdDevCm: Math.round(pxToCm(stdDevPx) * 10) / 10,
    moa: Math.round(moa * 100) / 100,
    extremePair: pair,
  }
}
