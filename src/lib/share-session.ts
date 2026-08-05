/**
 * Session sharing utility.
 *
 * Uses the Web Share API (mobile) to share session PNGs natively,
 * or falls back to downloading the PNG on desktop browsers.
 */
import type { SessionData } from '@/lib/types'
import { generateSessionCanvas, type ExportOptions } from './export-session'

export interface ShareOptions extends ExportOptions {
  session: SessionData & { createdAt?: string }
}

/**
 * Share a session using the Web Share API (mobile) or fall back to download.
 * On mobile, this opens the native share sheet with the PNG image.
 * On desktop, it falls back to downloading the PNG.
 *
 * Returns:
 *  - 'shared'    — Web Share API was used (or user cancelled the share sheet)
 *  - 'downloaded' — Fell back to download
 *  - 'error'     — Something went wrong
 */
export async function shareSession({ session, userName, sourceCanvas }: ShareOptions): Promise<'shared' | 'downloaded' | 'error'> {
  try {
    // Generate the canvas using the existing export logic
    const canvas = generateSessionCanvas({ session, userName, sourceCanvas })
    if (!canvas) return 'error'

    // Add share watermark footer
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const W = canvas.width
      const H = canvas.height
      // Overwrite the footer area with the share watermark
      ctx.fillStyle = '#060910'
      ctx.fillRect(0, H - 30, W, 30)
      ctx.fillStyle = '#3d4f68'
      ctx.font = '9px "Share Tech Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('COMPARTIDO DESDE E-TARGET · DETECCIÓN DE IMPACTOS', W / 2, H - 12)
    }

    // Convert canvas to Blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to generate image'))),
        'image/png',
      )
    })

    // Try Web Share API with files support
    const file = new File([blob], 'etarget-session.png', { type: 'image/png' })
    const shareData = {
      title: 'E-TARGET — Sesión de Tiro',
      text: `Puntaje: ${session.totalScore} | ${session.shotCount} disparos | Mejor: ${session.bestScore}`,
      files: [file],
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare?.(shareData)
    ) {
      await navigator.share(shareData)
      return 'shared'
    }

    // Fallback: download the PNG
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `etarget-sesion-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return 'downloaded'
  } catch (err) {
    // User cancelled the share sheet — not an error
    if (err instanceof Error && err.name === 'AbortError') return 'shared'
    return 'error'
  }
}
