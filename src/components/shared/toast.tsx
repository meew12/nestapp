'use client'

import { useEffect, useState, useCallback } from 'react'

interface ToastState {
  message: string
  type: 'success' | 'error' | 'info'
  id: number
}

let toastId = 0
const listeners = new Set<(t: ToastState) => void>()

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  const t: ToastState = { message, type, id: ++toastId }
  listeners.forEach((l) => l(t))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const addToast = useCallback((t: ToastState) => {
    setToasts((prev) => [...prev, t])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id))
    }, 3000)
  }, [])

  useEffect(() => {
    listeners.add(addToast)
    return () => { listeners.delete(addToast) }
  }, [addToast])

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-xl text-sm font-semibold animate-fade-in-up ${
            t.type === 'success' ? 'border border-[rgba(57,255,122,0.3)] text-[#39ff7a] bg-[rgba(15,22,40,0.95)]' :
            t.type === 'error' ? 'border border-[var(--border-glow)] text-[#ff3a28] bg-[rgba(15,22,40,0.95)]' :
            'border border-[rgba(0,229,255,0.3)] text-[#00e5ff] bg-[rgba(15,22,40,0.95)]'
          }`}
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          <span className="text-base">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="text-[#e8ecf5]">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
