'use client'

import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { showToast } from '@/components/shared/toast'

/**
 * Registers the service worker + shows an install banner when the browser
 * fires `beforeinstallprompt` (Android Chrome / Edge / Samsung Internet).
 *
 * On iOS Safari there's no programmatic install prompt — the user has to
 * use Share → "Add to Home Screen" manually, so we show a one-time hint
 * banner pointing them to that flow.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt: () => Promise<void>
}

const DISMISS_KEY = 'etarget_pwa_install_dismissed'
const IOS_HINT_KEY = 'etarget_pwa_ios_hint_shown'

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  // Register the service worker on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Only register in production builds — dev server HMR conflicts with SW.
    if (process.env.NODE_ENV !== 'production') {
      // In dev, still register but with a note that it may cache aggressively.
      // Useful for testing the install flow.
    }
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope)
        })
        .catch((err) => {
          console.warn('[PWA] SW registration failed:', err)
        })
    }
    // Defer registration until after first paint to avoid competing with
    // critical resource loading on first visit.
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  // Capture the install prompt event.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) return // already installed

    const dismissed = localStorage.getItem(DISMISS_KEY) === '1'

    const handler = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setDeferredPrompt(evt)
      if (!dismissed) {
        // Small delay so the banner doesn't fight with the app's first paint.
        setTimeout(() => setShowBanner(true), 4000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari detection — show manual hint once.
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
    if (isIos && isSafari && !localStorage.getItem(IOS_HINT_KEY)) {
      setTimeout(() => {
        setShowIosHint(true)
        localStorage.setItem(IOS_HINT_KEY, '1')
      }, 8000)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      showToast('E-TARGET instalado ✓', 'success')
    }
    setDeferredPrompt(null)
    setShowBanner(false)
  }

  const dismiss = () => {
    setShowBanner(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  const dismissIos = () => setShowIosHint(false)

  // Android/Chrome install banner
  if (showBanner && deferredPrompt) {
    return (
      <div
        className="fixed z-[150] bottom-4 left-4 right-4 mx-auto max-w-md slide-in-up"
        style={{ animation: 'slideInUp 0.4s cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div
          className="relative rounded-2xl p-4 flex items-center gap-3 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(10,14,26,0.95) 0%, rgba(13,20,36,0.95) 100%)',
            border: '1px solid var(--border-glow)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,58,40,0.2)',
          }}
        >
          <div
            className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #ff3a28 0%, #ffb830 100%)',
              boxShadow: '0 4px 16px rgba(255,58,40,0.4)',
            }}
          >
            <Download size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-sm text-[#e8ecf5] tracking-wide">
              Instalar E-TARGET
            </h3>
            <p className="text-[11px] text-[#7a8ca8] leading-snug mt-0.5">
              Acceso rápido desde tu pantalla de inicio. Funciona offline.
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 tactical-btn tactical-btn-primary text-xs py-2 px-3"
          >
            Instalar
          </button>
          <button
            onClick={dismiss}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[#7a8ca8] hover:text-[#e8ecf5] transition-colors"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  // iOS Safari manual hint
  if (showIosHint) {
    return (
      <div
        className="fixed z-[150] bottom-4 left-4 right-4 mx-auto max-w-md slide-in-up"
        style={{ animation: 'slideInUp 0.4s cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div
          className="relative rounded-2xl p-4 flex items-start gap-3 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(10,14,26,0.95) 0%, rgba(13,20,36,0.95) 100%)',
            border: '1px solid rgba(0,229,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)' }}
          >
            <Smartphone size={20} className="text-[#00e5ff]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-sm text-[#e8ecf5] tracking-wide">
              Instalar en iPhone
            </h3>
            <p className="text-[11px] text-[#7a8ca8] leading-snug mt-0.5">
              Toca <span className="text-[#00e5ff] font-bold">Compartir</span> →{' '}
              <span className="text-[#00e5ff] font-bold">Agregar a pantalla de inicio</span>
            </p>
          </div>
          <button
            onClick={dismissIos}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[#7a8ca8] hover:text-[#e8ecf5] transition-colors"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return null
}
