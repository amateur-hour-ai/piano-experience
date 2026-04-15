const CACHE_NAME = 'piano-exp-v1'
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
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some pages may fail to cache during install — that's okay
      })
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

// Fetch — network first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (mutations go through the sync queue, not the SW)
  if (request.method !== 'GET') return

  // Skip API routes — those are handled by the offline layer in the app
  if (url.pathname.startsWith('/api/')) return

  // Skip auth routes
  if (url.pathname.startsWith('/auth/')) return

  // For page navigations and static assets: network first, cache fallback
  event.respondWith(
    fetch(request, { signal: AbortSignal.timeout(5000) })
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // If it's a navigation request, serve the cached home page as fallback
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
