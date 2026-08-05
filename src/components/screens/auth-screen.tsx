'use client'

import { useState } from 'react'
import { useAppStore, bootstrapAuth } from '@/lib/store'
import { showToast } from '@/components/shared/toast'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      showToast('Completa todos los campos', 'error')
      return
    }
    setLoading(true)
    try {
      const body = mode === 'register' ? { email, password, name: name || undefined } : { email, password }
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Error de autenticación', 'error')
        return
      }
      showToast(mode === 'register' ? 'Cuenta creada ✓' : 'Bienvenido de vuelta', 'success')
      await bootstrapAuth()
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (which: 'admin' | 'demo') => {
    if (which === 'admin') {
      setEmail('admin@etarget.app')
      setPassword('admin123')
    } else {
      setEmail('tirador@etarget.app')
      setPassword('demo123')
    }
    setMode('login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060910] px-6 py-10 relative overflow-hidden">
      {/* Animated grid */}
      <div
        className="absolute inset-[-50%] opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,58,40,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,58,40,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          animation: 'gridDrift 30s linear infinite',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(6,9,16,0.9) 70%)' }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[#ff3a28]" style={{ animation: 'pulseRing 2s ease-in-out infinite' }} />
            <div className="absolute inset-3 rounded-full border border-[rgba(255,58,40,0.5)]" />
            <div className="w-3 h-3 rounded-full bg-[#ff3a28]" style={{ boxShadow: '0 0 12px #ff3a28' }} />
          </div>
          <h1 className="font-display font-black text-3xl text-[#ff3a28] tracking-[0.1em]" style={{ textShadow: '0 0 20px rgba(255,58,40,0.4)' }}>
            E-TARGET
          </h1>
          <p className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </p>
        </div>

        {/* Form card */}
        <div className="tactical-card p-6 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-[var(--bg-glass)] rounded-lg">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                mode === 'login' ? 'bg-[var(--red-dim)] text-[#ff3a28] border border-[var(--border-glow)]' : 'text-[#7a8ca8]'
              }`}
            >
              INGRESAR
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                mode === 'register' ? 'bg-[var(--red-dim)] text-[#ff3a28] border border-[var(--border-glow)]' : 'text-[#7a8ca8]'
              }`}
            >
              REGISTRAR
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase block mb-1.5">
                  Nombre (opcional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="tactical-input"
                />
              </div>
            )}
            <div>
              <label className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tirador@ejemplo.com"
                autoComplete="email"
                className="tactical-input"
                required
              />
            </div>
            <div>
              <label className="font-mono-tactical text-[10px] text-[#3d4f68] tracking-[0.2em] uppercase block mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="tactical-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="tactical-btn tactical-btn-primary w-full mt-2"
            >
              {loading ? 'PROCESANDO…' : mode === 'login' ? 'INGRESAR' : 'CREAR CUENTA'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-5 tactical-card p-4">
          <p className="font-mono-tactical text-[9px] text-[#3d4f68] tracking-[0.2em] uppercase mb-2.5">
            Cuentas demo
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fillDemo('demo')}
              className="tactical-btn tactical-btn-secondary text-xs py-2.5"
            >
              👤 TIRADOR
            </button>
            <button
              onClick={() => fillDemo('admin')}
              className="tactical-btn tactical-btn-secondary text-xs py-2.5"
            >
              ⚙️ ADMIN
            </button>
          </div>
          <p className="font-mono-tactical text-[9px] text-[#3d4f68] mt-2.5 text-center">
            admin@etarget.app / admin123
          </p>
        </div>
      </div>
    </div>
  )
}
