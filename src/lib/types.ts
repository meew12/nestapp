/**
 * Shared TypeScript types for the E-TARGET app.
 */

export type TargetSize = 'standard' | 'large' | 'small'

/**
 * Target type presets — modeled on the discipline standards used by
 * Accushoot and other professional target scanners. Each preset bakes in
 * a default diameter (cm), ring count, and recommended distance so the
 * scoring math and group analysis stay accurate without making the user
 * tweak 5 separate fields.
 */
export type TargetType = 'issf-10m' | 'issf-50m' | 'nra-highpower' | 'f-class' | 'practical' | 'silhouette'

export interface TargetTypePreset {
  id: TargetType
  name: string
  shortName: string
  /** Target diameter in cm — drives px-to-cm conversion for group analysis. */
  diameterCm: number
  /** Recommended shooting distance in meters (used for MOA calc if user doesn't override). */
  defaultDistanceM: number
  /** Number of scoring rings (10 = ISSF-style, 6 = practical, etc.). */
  rings: number
  /** Description shown in the selector UI. */
  description: string
  /** Whether the X-ring (inner 10) is scored. */
  hasXRing: boolean
}

export const TARGET_TYPE_PRESETS: TargetTypePreset[] = [
  {
    id: 'issf-10m',
    name: 'ISSF 10m Aire',
    shortName: 'ISSF 10m',
    diameterCm: 17,
    defaultDistanceM: 10,
    rings: 10,
    description: 'Blanco oficial ISSF 10m pistola de aire. 17cm con anillos 1-10.',
    hasXRing: true,
  },
  {
    id: 'issf-50m',
    name: 'ISSF 50m Fuego',
    shortName: 'ISSF 50m',
    diameterCm: 50,
    defaultDistanceM: 50,
    rings: 10,
    description: 'Blanco ISSF 50m fuego central. 50cm con anillos 1-10 + X.',
    hasXRing: true,
  },
  {
    id: 'nra-highpower',
    name: 'NRA High Power',
    shortName: 'NRA HP',
    diameterCm: 53,
    defaultDistanceM: 100,
    rings: 10,
    description: 'Blanco NRA High Power a 100/200/300 yardas. Anillos 5-10 + X.',
    hasXRing: true,
  },
  {
    id: 'f-class',
    name: 'F-Class / LR',
    shortName: 'F-Class',
    diameterCm: 30,
    defaultDistanceM: 300,
    rings: 10,
    description: 'Blanco F-Class larga distancia. 30cm con anillos 1-10 + X.',
    hasXRing: true,
  },
  {
    id: 'practical',
    name: 'Práctico IPSC',
    shortName: 'IPSC',
    diameterCm: 30,
    defaultDistanceM: 15,
    rings: 6,
    description: 'Blanco práctico IPSC. Zonas A/C/D/M. Puntaje por zona.',
    hasXRing: false,
  },
  {
    id: 'silhouette',
    name: 'Silueta Metalica',
    shortName: 'Silueta',
    diameterCm: 25,
    defaultDistanceM: 40,
    rings: 5,
    description: 'Silueta metálica (gallina, jabalí, pavo, carnero). 25cm.',
    hasXRing: false,
  },
]

export const DEFAULT_TARGET_TYPE: TargetType = 'issf-10m'

export interface AppSettings {
  targetSize: TargetSize
  targetType: TargetType
  sensitivity: number // 1–10
  minArea: number // px²
  soundEnabled: boolean
  vibration: boolean
  flashEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  targetSize: 'standard',
  targetType: DEFAULT_TARGET_TYPE,
  sensitivity: 5,
  minArea: 80,
  soundEnabled: true,
  vibration: true,
  flashEnabled: true,
}

export interface ShotData {
  id?: string
  index: number
  x: number
  y: number
  radius: number
  score: number // 0–10 (0 = training mode)
  timestamp: number // ms since session start
  distanceM?: number // estimated distance from target center (cm)
}

export interface WeatherData {
  temp?: number       // °C
  wind?: number       // km/h
  condition?: 'sunny' | 'cloudy' | 'partly-cloudy' | 'rainy' | 'windy' | 'foggy' | 'snowy'
  humidity?: number   // %
}

export const WEATHER_CONDITIONS: Array<{ value: WeatherData['condition']; label: string; icon: string }> = [
  { value: 'sunny', label: 'Soleado', icon: '☀️' },
  { value: 'partly-cloudy', label: 'Parcial', icon: '⛅' },
  { value: 'cloudy', label: 'Nublado', icon: '☁️' },
  { value: 'rainy', label: 'Lluvioso', icon: '🌧️' },
  { value: 'windy', label: 'Ventoso', icon: '💨' },
  { value: 'foggy', label: 'Niebla', icon: '🌫️' },
  { value: 'snowy', label: 'Nevado', icon: '❄️' },
]

export interface SessionData {
  id?: string
  trainingMode: boolean
  shots: ShotData[]
  totalScore: number
  durationSec: number
  bestScore: number
  avgScore: number
  shotCount: number
  targetSize: TargetSize
  distanceM: number
  captureMode?: 'camera' | 'simulator' // how shots were captured (affects rendering coord space)
  weather?: WeatherData | null
  notes?: string | null
  // Training drill metadata
  drillType?: DrillType | null
  drillPassed?: boolean | null
  drillGoal?: DrillGoal | null
  createdAt?: string
  startTime?: number // ms timestamp when the scan started (client-side)
}

// ── Training drills ──
export type DrillType = 'bullseye' | 'speed' | 'precision' | 'rapid' | 'marksman'

export interface DrillGoal {
  shotCount: number
  timeLimitSec?: number
  targetScore?: number      // minimum total score to pass
  targetAvg?: number        // minimum average score to pass
  targetGroupCm?: number    // maximum group size (cm) to pass
  targetBullseyes?: number  // minimum 10-ring hits to pass
}

export interface DrillDefinition {
  type: DrillType
  name: string
  description: string
  icon: string
  goal: DrillGoal
  passLabel: string
  tips: string[]
}

export const DRILL_DEFINITIONS: DrillDefinition[] = [
  {
    type: 'bullseye',
    name: 'Reto Diana',
    description: '5 disparos — todos en el anillo 9-10',
    icon: '🎯',
    goal: { shotCount: 5, targetBullseyes: 5, targetAvg: 9 },
    passLabel: '5 impactos en zona 9-10',
    tips: ['Respira profundo', 'Alinea la mira con cuidado', 'Cada disparo cuenta'],
  },
  {
    type: 'speed',
    name: 'Disparo Rápido',
    description: '5 disparos en 30 segundos — puntaje mínimo 30',
    icon: '⚡',
    goal: { shotCount: 5, timeLimitSec: 30, targetScore: 30 },
    passLabel: '≥30 pts en ≤30s',
    tips: ['Velocidad + precisión', 'No apures el tiro', 'Mantén el ritmo'],
  },
  {
    type: 'precision',
    name: 'Grupo Preciso',
    description: '5 disparos — grupo menor a 5cm',
    icon: '🎖️',
    goal: { shotCount: 5, targetGroupCm: 5 },
    passLabel: 'Grupo ≤5cm',
    tips: ['Busca agrupar los disparos', 'La consistencia es clave', 'Apunta al mismo punto'],
  },
  {
    type: 'rapid',
    name: 'Fuego Rápido',
    description: '10 disparos en 60 segundos',
    icon: '🔥',
    goal: { shotCount: 10, timeLimitSec: 60, targetScore: 60 },
    passLabel: '≥60 pts en ≤60s',
    tips: ['Cadencia sostenida', 'Recarga mental entre tiros', 'No te bloquees'],
  },
  {
    type: 'marksman',
    name: 'Tirador de Elite',
    description: '10 disparos — promedio mínimo 8',
    icon: '🏆',
    goal: { shotCount: 10, targetAvg: 8 },
    passLabel: 'Promedio ≥8 en 10 disparos',
    tips: ['Cada tiro es final', 'Concéntrate en la técnica', 'La regularidad premia'],
  },
]

export interface Plan {
  id: string
  name: string
  description: string
  priceARS: number
  durationDays: number
  features: string[]
  isActive: boolean
  isFeatured: boolean
  maxShotsPerDay: number
  sortOrder: number
}

export interface UserSubscriptionInfo {
  id: string
  status: 'active' | 'expired' | 'cancelled' | 'pending'
  startDate: string
  endDate: string
  autoRenew: boolean
  plan: Plan
}

export interface PaymentInfo {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'
  mpPaymentId?: string | null
  method?: string | null
  description?: string | null
  createdAt: string
  plan?: { id: string; name: string } | null
}

export interface UserPublic {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin'
  avatarColor: string
  createdAt: string
}

/** Score → color (matches original app.js scoreColor) */
export function scoreColor(score: number): string {
  if (score >= 9) return '#ff3a28' // Red-hot (bullseye)
  if (score >= 7) return '#ffb830' // Amber
  if (score >= 4) return '#00e5ff' // Cyan
  return '#4da6ff' // Blue
}

/** The latest shot is ALWAYS shown in red per the spec */
export const LATEST_SHOT_COLOR = '#ff3a28'
