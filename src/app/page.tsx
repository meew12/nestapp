'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore, bootstrapAuth, refreshStats } from '@/lib/store'
import { LogoSplash } from '@/components/screens/logo-splash'
import { Splash } from '@/components/screens/splash'
import { AuthScreen } from '@/components/screens/auth-screen'
import { MainApp } from '@/components/screens/main-app'

type SplashPhase = 'logo' | 'tactical' | 'done'

export default function Home() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const [splashPhase, setSplashPhase] = useState<SplashPhase>('logo')

  useEffect(() => {
    bootstrapAuth()
  }, [])

  useEffect(() => {
    if (user) {
      refreshStats()
    }
  }, [user])

  // Phase 1: Logo splash (flat #070911 bg + logo) — ~1.2s
  useEffect(() => {
    const t = setTimeout(() => setSplashPhase('tactical'), 1200)
    return () => clearTimeout(t)
  }, [])

  // Phase 2: Tactical animated splash (loader bar, HUD, etc.) — ~2.5s
  useEffect(() => {
    if (splashPhase !== 'tactical') return
    const t = setTimeout(() => setSplashPhase('done'), 2500)
    return () => clearTimeout(t)
  }, [splashPhase])

  if (splashPhase === 'logo') {
    return <LogoSplash />
  }

  if (splashPhase === 'tactical') {
    return <Splash />
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060910]">
        <div className="font-display text-[#ff3a28] text-xl animate-pulse">E-TARGET</div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <MainApp />
}
