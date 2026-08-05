'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { ShotData } from '@/lib/types'
import { calculateScore, calculateDistanceCm } from '@/lib/scoring'
import { scoreColor, LATEST_SHOT_COLOR } from '@/lib/types'
import { showToast } from '@/components/shared/toast'

/**
 * Custom hook that handles the live camera + OpenCV shot detection.
 *
 * Returns refs to attach to <video> and <canvas> elements, plus the live
 * session state and controls (start, stop, etc.).
 *
 * Detection algorithm:
 *  - Frame-differencing with OpenCV (or a Canvas fallback if CV fails to load)
 *  - Detects circular bright/dark blobs that appear between frames
 *  - Cooldown + de-duplication prevents double-counting
 *  - Latest shot is drawn in RED, previous shots in their score color
 *
 * Performance (Accushoot-grade):
 *  - Detection runs at a fixed ~12 FPS on a DOWNSCALED frame (480px wide)
 *    so the heavy OpenCV pipeline never starves the UI thread.
 *  - Drawing runs on its own rAF loop at full display FPS for smooth HUD.
 *  - Mats are aggressively reused between frames to cut GC pressure.
 */

// Detection throughput target. 12 FPS is the sweet spot for shot detection:
// fast enough to catch a real impact, slow enough to leave headroom for UI.
const DETECT_INTERVAL_MS = 80
// Internal detection frame size. The video stream can be 720p or 1080p,
// but detection runs on this downscaled copy. Score is computed in the
// original camera coordinate space by scaling the detected point back up.
const DETECT_W = 480
const DETECT_H = 270

export function useCameraDetection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)

  const streamRef = useRef<MediaStream | null>(null)
  // Two independent rAF loops: one for drawing (smooth), one tick-driven for detection.
  const drawRafRef = useRef<number | null>(null)
  const detectTimerRef = useRef<number | null>(null)
  const prevGrayRef = useRef<cvMat | null>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const cooldownRef = useRef<boolean>(false)
  const fallbackPrevRef = useRef<Uint8ClampedArray | null>(null)
  const fallbackLastSampleRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const cvReadyRef = useRef<boolean>(false)
  // Live FPS counter for the HUD (detection FPS, not draw FPS).
  const fpsCounterRef = useRef<{ frames: number; lastTs: number }>({ frames: 0, lastTs: 0 })
  const [detectFps, setDetectFps] = useState(0)

  const [cvReady, setCvReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraDims, setCameraDims] = useState({ width: 0, height: 0 })

  const settings = useAppStore((s) => s.settings)
  const liveSession = useAppStore((s) => s.liveSession)
  const cameraMode = useAppStore((s) => s.cameraMode)

  // Keep latest settings in a ref so the detection loop reads fresh values
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const liveSessionRef = useRef(liveSession)
  useEffect(() => { liveSessionRef.current = liveSession }, [liveSession])

  // ── OpenCV loader ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    const markReady = () => {
      cvReadyRef.current = true
      // Defer setState to avoid synchronous state update in effect body
      queueMicrotask(() => setCvReady(true))
    }

    if ((window as any).cv && (window as any).cv.Mat) {
      markReady()
      return
    }

    // Check if script already exists
    const existing = document.getElementById('opencvScript')
    if (existing) {
      const check = setInterval(() => {
        if ((window as any).cv && (window as any).cv.Mat) {
          clearInterval(check)
          markReady()
        }
      }, 100)
      return () => clearInterval(check)
    }

    // Load OpenCV.js from CDN
    const script = document.createElement('script')
    script.id = 'opencvScript'
    script.async = true
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
    script.onload = () => {
      const check = setInterval(() => {
        if ((window as any).cv && (window as any).cv.Mat) {
          clearInterval(check)
          markReady()
        }
      }, 100)
    }
    document.head.appendChild(script)

    // Fallback timeout — proceed with Canvas detector if CV doesn't load
    const timeout = setTimeout(() => {
      if (!cvReadyRef.current) {
        console.warn('[E-TARGET] OpenCV load timeout — using Canvas fallback')
        queueMicrotask(() => setCvReady(false))
      }
    }, 12000)

    return () => clearTimeout(timeout)
  }, [])

  // ── Audio ────────────────────────────────────────────────
  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        const Ctor = (window.AudioContext || (window as any).webkitAudioContext)
        audioCtxRef.current = new Ctor()
      } catch {}
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
  }, [])

  const playShotSound = useCallback(() => {
    if (!settingsRef.current.soundEnabled) return
    ensureAudio()
    const ctx = audioCtxRef.current
    if (!ctx) return
    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.12)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.06))
      }
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800
      filter.Q.value = 0.5
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(1.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      noise.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      noise.start(ctx.currentTime)
      noise.stop(ctx.currentTime + 0.25)
    } catch {}
  }, [ensureAudio])

  const triggerVibration = useCallback(() => {
    if (!settingsRef.current.vibration) return
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 10, 20])
    }
  }, [])

  const triggerFlash = useCallback(() => {
    if (!settingsRef.current.flashEnabled) return
    const el = flashRef.current
    if (!el) return
    el.style.opacity = '0.5'
    setTimeout(() => { if (el) el.style.opacity = '0' }, 120)
  }, [])

  // ── Register a detected shot ─────────────────────────────
  // Uses the shared calculateScore / calculateDistanceCm helpers from @/lib/scoring.
  // `cooldown` prevents double-counting the same impact across consecutive frames.
  // Tuned for rapid fire: 350ms cooldown + stricter de-duplication distance
  // means the system can register shots up to ~3 per second while still
  // rejecting the same hole being re-detected on subsequent frames.
  const registerShot = useCallback((x: number, y: number, radius: number, w: number, h: number) => {
    if (cooldownRef.current) return

    const session = liveSessionRef.current
    if (!session) return

    // De-duplicate against existing shots — scaled to camera resolution.
    // 2.5% of the shorter dimension is a robust "same hole" threshold that
    // works on both 720p and 1080p streams.
    const dedupPx = Math.max(14, Math.min(w, h) * 0.025)
    const tooClose = session.shots.some((s) => {
      const dx = s.x - x
      const dy = s.y - y
      return Math.sqrt(dx * dx + dy * dy) < dedupPx
    })
    if (tooClose) return

    cooldownRef.current = true
    setTimeout(() => { cooldownRef.current = false }, 350)

    const score = session.trainingMode ? 0 : calculateScore(x, y, w, h)
    const distanceCm = calculateDistanceCm(x, y, w, h, settingsRef.current.targetSize)

    const shot: ShotData = {
      index: session.shots.length + 1,
      x,
      y,
      radius: Math.min(Math.max(radius, 6), 18),
      score,
      timestamp: session.startTime ? Date.now() - session.startTime : 0,
      distanceM: distanceCm,
    }

    useAppStore.getState().addShot(shot)
    playShotSound()
    triggerVibration()
    triggerFlash()
  }, [playShotSound, triggerVibration, triggerFlash])

  // ── Register a manual shot (simulator mode) ──────────────
  // Same as registerShot but WITHOUT the cooldown/dedup gate, so the user
  // can explicitly tap anywhere on the target to mark an impact. Used by
  // the scan screen's "MODO SIMULADOR" fallback when no camera is available.
  const registerManualShot = useCallback((x: number, y: number, w: number, h: number) => {
    const session = liveSessionRef.current
    if (!session) return

    const score = session.trainingMode ? 0 : calculateScore(x, y, w, h)
    const distanceCm = calculateDistanceCm(x, y, w, h, settingsRef.current.targetSize)

    const shot: ShotData = {
      index: session.shots.length + 1,
      x,
      y,
      radius: 10,
      score,
      timestamp: session.startTime ? Date.now() - session.startTime : 0,
      distanceM: distanceCm,
    }

    useAppStore.getState().addShot(shot)
    playShotSound()
    triggerVibration()
    triggerFlash()
  }, [playShotSound, triggerVibration, triggerFlash])

  // ── Draw all shots on canvas ─────────────────────────────
  const drawShots = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    const session = liveSessionRef.current
    if (!session) return

    session.shots.forEach((shot, idx) => {
      const isLatest = idx === session.shots.length - 1
      // The LAST impact is ALWAYS rendered in red (#ff3a28), regardless of
      // its score. Previous shots use their score-based color so the user
      // can still read the scoring distribution at a glance.
      const color = isLatest ? LATEST_SHOT_COLOR : scoreColor(shot.score)
      const radius = shot.radius

      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = isLatest ? 28 : 12

      if (isLatest) {
        // Pulsing halo ring around the latest impact — unmistakable red marker.
        const pulse = 1 + 0.18 * Math.sin(performance.now() / 220)
        ctx.beginPath()
        ctx.arc(shot.x, shot.y, (radius + 8) * pulse, 0, Math.PI * 2)
        ctx.strokeStyle = LATEST_SHOT_COLOR
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.55
        ctx.stroke()

        // Second tighter pulse ring
        ctx.beginPath()
        ctx.arc(shot.x, shot.y, (radius + 4) * (1 + 0.08 * Math.sin(performance.now() / 160 + 1)), 0, Math.PI * 2)
        ctx.strokeStyle = LATEST_SHOT_COLOR
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.35
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Outer ring
      ctx.beginPath()
      ctx.arc(shot.x, shot.y, radius + 4, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = isLatest ? 3 : 1.5
      ctx.globalAlpha = isLatest ? 1 : 0.75
      ctx.stroke()

      // Inner filled circle
      ctx.beginPath()
      ctx.arc(shot.x, shot.y, radius * 0.6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = isLatest ? 0.95 : 0.45
      ctx.fill()

      // Shot number
      ctx.globalAlpha = isLatest ? 1 : 0.7
      ctx.shadowBlur = 0
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${isLatest ? 13 : 10}px "Share Tech Mono", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(idx + 1), shot.x, shot.y)

      // Score badge for latest — always RED background tint + red border
      if (isLatest && !session.trainingMode) {
        ctx.globalAlpha = 1
        ctx.shadowColor = LATEST_SHOT_COLOR
        ctx.shadowBlur = 12
        const badgeX = shot.x + radius + 18
        const badgeY = shot.y - radius - 10
        const badgeW = 42
        const badgeH = 24
        // Red-tinted background so it's clearly the "latest" badge
        ctx.fillStyle = 'rgba(255,58,40,0.18)'
        ctx.beginPath()
        ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 5)
        ctx.fill()
        ctx.strokeStyle = LATEST_SHOT_COLOR
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = LATEST_SHOT_COLOR
        ctx.font = 'bold 14px Orbitron, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(shot.score), badgeX, badgeY)
        // "ÚLTIMO" micro-label below the badge
        ctx.font = 'bold 7px "Share Tech Mono", monospace'
        ctx.fillStyle = 'rgba(255,58,40,0.85)'
        ctx.fillText('ÚLTIMO', badgeX, badgeY + 14)
      }

      ctx.restore()
    })

    // Subtle center crosshair
    const cx = w / 2, cy = h / 2
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.strokeStyle = LATEST_SHOT_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([4, 6])
    ctx.beginPath(); ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy + 30); ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, 20, 0, Math.PI * 2)
    ctx.strokeStyle = LATEST_SHOT_COLOR
    ctx.stroke()
    ctx.restore()
  }, [])

  // ── OpenCV detection (downscaled for performance) ────────
  // Detection runs on a DETECT_W×DETECT_H copy. When a blob is found,
  // its center is scaled back to the camera's native coordinate space so
  // score/distance math stays consistent regardless of detection resolution.
  const detectWithOpenCV = useCallback(() => {
    const video = videoRef.current
    const cv = (window as any).cv
    if (!video || !cv || !cv.Mat || video.readyState < 2) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return

    // Live FPS counter — sample every second so the HUD shows real throughput.
    const fpsState = fpsCounterRef.current
    fpsState.frames++
    const nowTs = performance.now()
    if (nowTs - fpsState.lastTs >= 1000) {
      setDetectFps(Math.round((fpsState.frames * 1000) / (nowTs - fpsState.lastTs)))
      fpsState.frames = 0
      fpsState.lastTs = nowTs
    }

    const dw = DETECT_W
    const dh = DETECT_H
    const scaleX = vw / dw
    const scaleY = vh / dh

    let src: any, gray: any, blurred: any, diff: any, thresh: any, contours: any, hierarchy: any
    try {
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement('canvas')
      }
      // Reuse the same offscreen canvas — only resize if dimensions changed.
      if (offscreenRef.current.width !== dw || offscreenRef.current.height !== dh) {
        offscreenRef.current.width = dw
        offscreenRef.current.height = dh
      }
      const offCtx = offscreenRef.current.getContext('2d', { willReadFrequently: true })!
      // Downscale: drawImage handles the resampling for us.
      offCtx.drawImage(video, 0, 0, dw, dh)
      const imageData = offCtx.getImageData(0, 0, dw, dh)

      src = cv.matFromImageData(imageData)
      gray = new cv.Mat()
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

      blurred = new cv.Mat()
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.5)

      if (!prevGrayRef.current || prevGrayRef.current.rows !== blurred.rows) {
        if (prevGrayRef.current) prevGrayRef.current.delete()
        prevGrayRef.current = blurred.clone()
        src.delete(); gray.delete(); blurred.delete()
        return
      }

      diff = new cv.Mat()
      cv.absdiff(prevGrayRef.current, blurred, diff)
      prevGrayRef.current.delete()
      prevGrayRef.current = blurred.clone()

      thresh = new cv.Mat()
      const sensitivity = settingsRef.current.sensitivity
      const threshValue = Math.max(5, 30 - sensitivity * 2)
      cv.threshold(diff, thresh, threshValue, 255, cv.THRESH_BINARY)

      const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3))
      cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, kernel)
      cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, kernel)
      kernel.delete()

      contours = new cv.MatVector()
      hierarchy = new cv.Mat()
      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

      // Scale min/max area to the detection resolution (not the camera resolution).
      const minArea = Math.max(8, settingsRef.current.minArea * (dw / vw) * (dh / vh))
      const maxArea = dw * dh * 0.05

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const area = cv.contourArea(contour)
        if (area < minArea || area > maxArea) { contour.delete(); continue }
        const perimeter = cv.arcLength(contour, true)
        const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0
        if (circularity < 0.3) { contour.delete(); continue }

        const rect = cv.boundingRect(contour)
        // Scale back to native camera coordinates for scoring.
        const cx = (rect.x + rect.width / 2) * scaleX
        const cy = (rect.y + rect.height / 2) * scaleY
        const r = Math.sqrt(area / Math.PI) * Math.max(scaleX, scaleY)
        registerShot(cx, cy, r, vw, vh)
        contour.delete()
        break
      }

      src.delete(); gray.delete(); diff.delete(); thresh.delete()
      blurred.delete(); contours.delete(); hierarchy.delete()
    } catch (err) {
      try { if (src) src.delete() } catch {}
      try { if (gray) gray.delete() } catch {}
      try { if (blurred) blurred.delete() } catch {}
      try { if (diff) diff.delete() } catch {}
      try { if (thresh) thresh.delete() } catch {}
      try { if (contours) contours.delete() } catch {}
      try { if (hierarchy) hierarchy.delete() } catch {}
    }
  }, [registerShot])

  // ── Canvas fallback detection (downscaled) ───────────────
  // Same downscale strategy as the OpenCV path: detect on DETECT_W×DETECT_H
  // and scale back to native coords. The fallback only finds the single
  // brightest-delta pixel, but it works without OpenCV.
  const detectWithCanvas = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const now = performance.now()
    if (now - fallbackLastSampleRef.current < DETECT_INTERVAL_MS) return
    fallbackLastSampleRef.current = now

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return

    // Live FPS counter
    const fpsState = fpsCounterRef.current
    fpsState.frames++
    if (now - fpsState.lastTs >= 1000) {
      setDetectFps(Math.round((fpsState.frames * 1000) / (now - fpsState.lastTs)))
      fpsState.frames = 0
      fpsState.lastTs = now
    }

    const dw = DETECT_W
    const dh = DETECT_H
    const scaleX = vw / dw
    const scaleY = vh / dh

    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas')
    if (offscreenRef.current.width !== dw || offscreenRef.current.height !== dh) {
      offscreenRef.current.width = dw
      offscreenRef.current.height = dh
    }
    const ctx = offscreenRef.current.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0, dw, dh)
    const curr = ctx.getImageData(0, 0, dw, dh).data

    if (!fallbackPrevRef.current || fallbackPrevRef.current.length !== curr.length) {
      fallbackPrevRef.current = new Uint8ClampedArray(curr)
      return
    }

    let maxDiff = 0
    let maxIdx = 0
    for (let i = 0; i < curr.length; i += 4) {
      const d = Math.abs(curr[i] - fallbackPrevRef.current[i])
        + Math.abs(curr[i + 1] - fallbackPrevRef.current[i + 1])
        + Math.abs(curr[i + 2] - fallbackPrevRef.current[i + 2])
      if (d > maxDiff) { maxDiff = d; maxIdx = i }
    }
    fallbackPrevRef.current.set(curr)

    const threshold = Math.max(40, 90 - settingsRef.current.sensitivity * 5)
    if (maxDiff > threshold) {
      const pixel = maxIdx / 4
      const px = (pixel % dw) * scaleX
      const py = Math.floor(pixel / dw) * scaleY
      registerShot(px, py, 12, vw, vh)
    }
  }, [registerShot])

  // ── Detection + Draw loops (decoupled for smoothness) ────
  // Drawing runs on rAF at full display FPS (smooth HUD, glowing shots).
  // Detection runs on a fixed timer at ~12 FPS — heavy OpenCV work never
  // blocks a paint, so the video preview stays fluid even on mid-range phones.
  const detectFnRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    detectFnRef.current = () => {
      if (!running) return
      if (cvReadyRef.current) detectWithOpenCV()
      else detectWithCanvas()
    }
  }, [running, detectWithOpenCV, detectWithCanvas])

  // Drawing loop — pure rAF, no detection work here.
  useEffect(() => {
    if (!running) return
    const loop = () => {
      drawShots()
      drawRafRef.current = requestAnimationFrame(loop)
    }
    drawRafRef.current = requestAnimationFrame(loop)
    return () => {
      if (drawRafRef.current) {
        cancelAnimationFrame(drawRafRef.current)
        drawRafRef.current = null
      }
    }
  }, [running, drawShots])

  // Detection loop — fixed interval, independent of paint rate.
  useEffect(() => {
    if (!running) return
    detectTimerRef.current = window.setInterval(() => {
      detectFnRef.current?.()
    }, DETECT_INTERVAL_MS)
    return () => {
      if (detectTimerRef.current !== null) {
        clearInterval(detectTimerRef.current)
        detectTimerRef.current = null
      }
    }
  }, [running])

  // ── Start camera ─────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Cámara no soportada en este dispositivo')
      return false
    }
    const constraints: MediaStreamConstraints = {
      video: cameraMode === 'telescope'
        ? { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 120 } }
        : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
      audio: false,
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return false
      video.srcObject = stream
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => { video.play().then(resolve).catch(reject) }
        video.onerror = reject
        setTimeout(() => reject(new Error('timeout')), 8000)
      })
      const w = video.videoWidth
      const h = video.videoHeight
      setCameraDims({ width: w, height: h })
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = w
        canvas.height = h
      }
      prevGrayRef.current = null
      fallbackPrevRef.current = null
      setRunning(true)
      return true
    } catch (err: any) {
      console.error('[Camera]', err)
      setError(err?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.'
        : 'No se pudo acceder a la cámara')
      return false
    }
  }, [cameraMode])

  // ── Stop camera ──────────────────────────────────────────
  const stopCamera = useCallback(() => {
    setRunning(false)
    if (drawRafRef.current) {
      cancelAnimationFrame(drawRafRef.current)
      drawRafRef.current = null
    }
    if (detectTimerRef.current !== null) {
      clearInterval(detectTimerRef.current)
      detectTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
    if (prevGrayRef.current) {
      try { (prevGrayRef.current as any).delete() } catch {}
      prevGrayRef.current = null
    }
    fallbackPrevRef.current = null
    setDetectFps(0)
  }, [])

  // ── Undo last shot ───────────────────────────────────────
  // Removes the most recent shot from the live session. Useful for
  // false positives (camera misfire, double-count, etc.) — the same
  // "Undo" button Accushoot has on its scan screen.
  const undoLastShot = useCallback(() => {
    const store = useAppStore.getState()
    const cur = store.liveSession
    if (!cur || cur.shots.length === 0) return
    const shots = cur.shots.slice(0, -1)
    // Re-mark the new last shot as "latest"
    if (shots.length > 0) {
      shots[shots.length - 1] = { ...shots[shots.length - 1], isLatest: true }
    }
    const totalScore = cur.trainingMode ? 0 : shots.reduce((s, sh) => s + sh.score, 0)
    store.setLiveSession({
      ...cur,
      shots,
      totalScore,
      shotCount: shots.length,
      bestScore: cur.trainingMode ? 0 : shots.reduce((m, sh) => Math.max(m, sh.score), 0),
      avgScore: cur.trainingMode ? 0 : (shots.length ? totalScore / shots.length : 0),
    })
    showToast('Último disparo eliminado', 'info')
  }, [])

  // ── Clear all shots ──────────────────────────────────────
  // Wipes the current session's shot list but keeps the session alive —
  // handy when starting a fresh string on the same target.
  const clearAllShots = useCallback(() => {
    const store = useAppStore.getState()
    const cur = store.liveSession
    if (!cur) return
    store.setLiveSession({
      ...cur,
      shots: [],
      totalScore: 0,
      shotCount: 0,
      bestScore: 0,
      avgScore: 0,
      startTime: Date.now(),
    })
    cooldownRef.current = false
    showToast('Sesión reiniciada', 'info')
  }, [])

  // ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  return {
    videoRef,
    canvasRef,
    flashRef,
    cvReady,
    running,
    error,
    cameraDims,
    detectFps,
    startCamera,
    stopCamera,
    ensureAudio,
    // Exposed for the simulator mode (manual tap-to-mark shots):
    registerManualShot,
    playShotSound,
    triggerVibration,
    triggerFlash,
    // Accushoot-style session controls:
    undoLastShot,
    clearAllShots,
  }
}

// Type alias for OpenCV Mat (avoids importing cv types at compile time)
type cvMat = {
  rows: number
  cols: number
  delete: () => void
}
