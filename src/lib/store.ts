'use client'

import { create } from 'zustand'
import type { AppSettings, SessionData, ShotData, UserPublic, UserSubscriptionInfo, DrillType, DrillGoal } from '@/lib/types'
import { DEFAULT_TARGET_TYPE } from '@/lib/types'

export interface AppUser {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin'
  avatarColor: string
  createdAt: string
}

interface AppState {
  // Auth
  user: AppUser | null
  subscription: UserSubscriptionInfo | null
  authLoading: boolean
  setUser: (u: AppUser | null) => void
  setSubscription: (s: UserSubscriptionInfo | null) => void
  setAuthLoading: (b: boolean) => void

  // Settings
  settings: AppSettings
  setSettings: (s: Partial<AppSettings>) => void

  // Live session (during scan)
  liveSession: SessionData | null
  setLiveSession: (s: SessionData | null) => void
  addShot: (shot: ShotData) => void

  // Active training drill (null = free session)
  activeDrill: { type: DrillType; goal: DrillGoal } | null
  setActiveDrill: (d: { type: DrillType; goal: DrillGoal } | null) => void

  // Stats cache
  stats: { totalShots: number; bestScore: number | null; sessionCount: number; totalDurationSec: number; avgScore: number } | null
  setStats: (s: AppState['stats']) => void

  // Camera mode
  cameraMode: 'mobile' | 'telescope'
  setCameraMode: (m: 'mobile' | 'telescope') => void
}

const STORAGE_KEY = 'etarget_settings'

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return {
      targetSize: 'standard',
      targetType: DEFAULT_TARGET_TYPE,
      sensitivity: 5,
      minArea: 80,
      soundEnabled: true,
      vibration: true,
      flashEnabled: true,
    }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(s: AppSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

const DEFAULT_SETTINGS: AppSettings = {
  targetSize: 'standard',
  targetType: DEFAULT_TARGET_TYPE,
  sensitivity: 5,
  minArea: 80,
  soundEnabled: true,
  vibration: true,
  flashEnabled: true,
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  subscription: null,
  authLoading: true,
  setUser: (u) => set({ user: u }),
  setSubscription: (s) => set({ subscription: s }),
  setAuthLoading: (b) => set({ authLoading: b }),

  settings: typeof window !== 'undefined' ? loadSettings() : DEFAULT_SETTINGS,
  setSettings: (partial) => {
    const next = { ...get().settings, ...partial }
    saveSettings(next)
    set({ settings: next })
  },

  liveSession: null,
  setLiveSession: (s) => set({ liveSession: s }),
  addShot: (shot) => {
    const cur = get().liveSession
    if (!cur) return
    // Mark previous shots as not latest
    const shots = cur.shots.map((s) => ({ ...s, isLatest: false }))
    shots.push({ ...shot, isLatest: true })
    const totalScore = cur.trainingMode ? 0 : cur.totalScore + shot.score
    set({
      liveSession: {
        ...cur,
        shots,
        totalScore,
        shotCount: shots.length,
        bestScore: cur.trainingMode ? 0 : Math.max(cur.bestScore, shot.score),
        avgScore: cur.trainingMode ? 0 : totalScore / shots.length,
      },
    })
  },

  activeDrill: null,
  setActiveDrill: (d) => set({ activeDrill: d }),

  stats: null,
  setStats: (s) => set({ stats: s }),

  cameraMode: 'mobile',
  setCameraMode: (m) => set({ cameraMode: m }),
}))

/**
 * Fetch current user + subscription on app boot.
 */
export async function bootstrapAuth() {
  const store = useAppStore
  store.getState().setAuthLoading(true)
  try {
    const [meRes, subRes] = await Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }),
      fetch('/api/subscriptions/current', { credentials: 'include' }),
    ])
    if (meRes.ok) {
      const meData = await meRes.json()
      if (meData.user) {
        store.getState().setUser(meData.user)
      } else {
        store.getState().setUser(null)
      }
    }
    if (subRes.ok) {
      const subData = await subRes.json()
      store.getState().setSubscription(subData.subscription || null)
    }
  } catch {
    // ignore
  } finally {
    store.getState().setAuthLoading(false)
  }
}

/**
 * Refresh stats from server.
 */
export async function refreshStats() {
  try {
    const res = await fetch('/api/sessions/stats', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      useAppStore.getState().setStats(data)
    }
  } catch {}
}
