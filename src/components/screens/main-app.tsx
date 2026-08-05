'use client'

import { useState, useEffect } from 'react'
import { useAppStore, refreshStats } from '@/lib/store'
import { MenuScreen } from './menu'
import { ScanScreen } from './scan'
import { ResultsScreen } from './results'
import { HistoryScreen } from './history'
import { SubscriptionScreen } from './subscription'
import { ProfileScreen } from './profile'
import { AdminScreen } from './admin'
import { StatsScreen } from './stats'
import { DrillsScreen } from './drills'
import { LeaderboardScreen } from './leaderboard'
import { HeatmapScreen } from './heatmap'
import { CalculatorScreen } from './calculator'
import { TipsScreen } from './tips'
import { MetronomeScreen } from './metronome'
import { PwaInstallPrompt } from '@/components/shared/pwa-install-prompt'
import { ToastContainer } from '@/components/shared/toast'

export type Tab = 'menu' | 'scan' | 'results' | 'history' | 'subscription' | 'profile' | 'admin' | 'stats' | 'drills' | 'leaderboard' | 'heatmap' | 'calculator' | 'tips' | 'metronome'

export function MainApp() {
  const [tab, setTab] = useState<Tab>('menu')
  const user = useAppStore((s) => s.user)
  const liveSession = useAppStore((s) => s.liveSession)

  // Refresh stats whenever we return to the menu
  useEffect(() => {
    if (tab === 'menu') refreshStats()
  }, [tab])

  // If live session ends, switch to results
  useEffect(() => {
    if (!liveSession && tab === 'scan') {
      // do nothing — ScanScreen handles its own transitions
    }
  }, [liveSession, tab])

  return (
    <div className="min-h-screen bg-[#060910] text-[#e8ecf5] flex flex-col">
      <ToastContainer />
      <PwaInstallPrompt />
      <div className="flex-1">
        {tab === 'menu' && <MenuScreen onNavigate={setTab} />}
        {tab === 'scan' && <ScanScreen onNavigate={setTab} />}
        {tab === 'results' && <ResultsScreen onNavigate={setTab} />}
        {tab === 'history' && <HistoryScreen onNavigate={setTab} />}
        {tab === 'subscription' && <SubscriptionScreen onNavigate={setTab} />}
        {tab === 'profile' && <ProfileScreen onNavigate={setTab} />}
        {tab === 'admin' && user?.role === 'admin' && <AdminScreen onNavigate={setTab} />}
        {tab === 'stats' && <StatsScreen onNavigate={setTab} />}
        {tab === 'drills' && <DrillsScreen onNavigate={setTab} />}
        {tab === 'leaderboard' && <LeaderboardScreen onNavigate={setTab} />}
        {tab === 'heatmap' && <HeatmapScreen onNavigate={setTab} />}
        {tab === 'calculator' && <CalculatorScreen onNavigate={setTab} />}
        {tab === 'tips' && <TipsScreen onNavigate={setTab} />}
        {tab === 'metronome' && <MetronomeScreen onNavigate={setTab} />}
      </div>
    </div>
  )
}
