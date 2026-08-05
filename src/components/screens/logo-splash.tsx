'use client'

/**
 * LogoSplash — the FIRST splash screen shown on app boot.
 *
 * Minimal: just the E-TARGET logo (`/logo1.png`) centered on a solid,
 * flat `#070911` background. No animations, no grid, no HUD — just the
 * brand mark. Shown for ~1.2s before handing off to the tactical
 * animated Splash (which has the loader bar + boot sequence).
 */
export function LogoSplash() {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: '#070911' }}
    >
      <img
        src="/logo1.png"
        alt="E-TARGET"
        className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] object-contain"
        draggable={false}
      />
    </div>
  )
}
