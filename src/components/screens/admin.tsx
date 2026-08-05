'use client'

import { AdminPanel } from '@/components/admin/admin-panel'
import type { Tab } from './main-app'

interface AdminScreenProps {
  onNavigate: (tab: Tab) => void
}

export function AdminScreen({ onNavigate }: AdminScreenProps) {
  return <AdminPanel onNavigate={onNavigate} />
}
