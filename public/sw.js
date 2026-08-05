/**
 * E-TARGET Service Worker
 *
 * Strategy:
 *  - Pre-caches the app shell (HTML, CSS, JS, fonts, icons) on install.
 *  - Network-first for navigation requests (always fresh when online,
 *    falls back to cache when offline).
 *  - Stale-while-revalidate for static assets (JS/CSS/fonts/images).
 *  - Cache-first for OpenCV.js CDN (large, versioned, immutable).
 *
 * This makes the PWA installable on Android via Chrome's "Add to Home
 * Screen" and lets the user open the app + view cached history offline.
 */

const CACHE_VERSION = 'etarget-v3'
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/logo.svg',
]

// OpenCV.js is a large CDN asset (~10MB) — cache it once and serve from cache.
const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Use addAll with individual error handling so a single failed
      // asset doesn't abort the whole install.
      Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Pre-cache failed for', url, err)
          })
        )
      )
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => {
            console.log('[SW] Purging old cache:', key)
            return caches.delete(key)
          })
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle GET — never intercept POST/PUT/etc.
  if (req.method !== 'GET') return

  // Skip cross-origin non-CDN requests (e.g. analytics, MP API).
  // Allow OpenCV CDN explicitly.
  if (url.origin !== self.location.origin && url.href !== OPENCV_URL) {
    return
  }

  // Skip Next.js dev HMR + RSC prefetch — they break in SW.
  if (url.pathname.startsWith('/_next/webpack-hmr') ||
      url.pathname.includes('__nextjs_original-stack-frame') ||
      req.headers.get('purpose') === 'prefetch') {
    return
  }

  // 1) OpenCV.js — cache-first (immutable, versioned URL)
  if (url.href === OPENCV_URL) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req)
        if (cached) return cached
        try {
          const fresh = await fetch(req)
          if (fresh.ok) cache.put(req, fresh.clone())
          return fresh
        } catch {
          return cached || Response.error()
        }
      })
    )
    return
  }

  // 2) Navigation requests (HTML pages) — network-first, fall back to cache
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        try {
          const fresh = await fetch(req)
          // Cache successful navigations for offline use.
          if (fresh.ok) cache.put(req, fresh.clone())
          return fresh
        } catch (err) {
          const cached = await cache.match(req)
          if (cached) return cached
          // Final fallback: serve the cached root shell.
          const root = await cache.match('/')
          if (root) return root
          throw err
        }
      })
    )
    return
  }

  // 3) Static assets (JS, CSS, fonts, images) — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req)
      const networkPromise = fetch(req)
        .then((fresh) => {
          if (fresh.ok) cache.put(req, fresh.clone())
          return fresh
        })
        .catch(() => null)
      // Return cached immediately if available; otherwise wait for network.
      return cached || (await networkPromise) || Response.error()
    })
  )
})
