const CACHE_NAME = 'piano-exp-v2'
const STATIC_ASSETS = [
  '/',
  '/pieces',
  '/schedule',
  '/strategies',
  '/experiences',
  '/permissions',
  '/docs',
  '/logo.png',
  '/manifest.json',
]

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API routes — handled by the app's offline layer
  if (url.pathname.startsWith('/api/')) return

  // Skip auth routes
  if (url.pathname.startsWith('/auth/')) return

  // For Next.js internal data requests (RSC payloads) — cache them aggressively
  const isNextData = url.pathname.includes('/_next/') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-State-Tree') ||
    url.searchParams.has('_rsc')

  if (isNextData) {
    event.respondWith(
      fetch(request, { signal: AbortSignal.timeout(5000) })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached
            // For RSC requests with no cache, return empty response instead of 503
            // This lets Next.js fall back to client-side rendering
            return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } })
          })
        })
    )
    return
  }

  // For page navigations: network first, cache fallback
  event.respondWith(
    fetch(request, { signal: AbortSignal.timeout(5000) })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // For any navigation request without a specific cache,
          // serve the root page — Next.js client router handles the URL
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
