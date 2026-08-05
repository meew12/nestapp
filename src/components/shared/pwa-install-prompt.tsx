'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show prompt after 5 seconds
      setTimeout(() => setShowPrompt(true), 5000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[300]" style={{ animation: 'slideUp 0.3s ease-out' }}>
      <div className="tactical-card p-4 flex items-center gap-3 border-[var(--border-glow)] animated-border">
        <div className="w-10 h-10 rounded-lg bg-[var(--red-dim)] flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-[#ff3a28]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-[#e8ecf5]">INSTALAR E-TARGET</p>
          <p className="font-mono-tactical text-[10px] text-[#7a8ca8]">Acceso rápido · Funciona offline · Pantalla completa</p>
        </div>
        <button
          onClick={handleInstall}
          className="tactical-btn tactical-btn-primary text-xs px-3 py-2"
        >
          INSTALAR
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="text-[#7a8ca8] hover:text-[#ff3a28] transition-colors"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
