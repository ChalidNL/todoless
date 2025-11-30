// Service Worker for offline caching and PWA support
// HOTFIX 0.0.57: Incremented cache version to force update (export fix)
const CACHE_NAME = 'todoless-v3'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icons/todoless-bw.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    })
  )
  // Force activation immediately
  self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  // Network-first strategy for API calls, cache-first for assets
  const url = new URL(event.request.url)
  
  if (url.pathname.startsWith('/api/')) {
    // HOTFIX 0.0.57: Don't cache export/download endpoints (causes empty response body)
    const isExportEndpoint = url.pathname.startsWith('/api/export/') ||
                             url.pathname.includes('/download')

    if (isExportEndpoint) {
      // Bypass cache entirely for exports - network only
      event.respondWith(fetch(event.request))
    } else {
      // Network-first for other API calls
      event.respondWith(
        fetch(event.request)
          .then(response => {
            // Clone and cache successful responses
            if (response.status === 200) {
              const responseClone = response.clone()
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone)
              })
            }
            return response
          })
          .catch(() => {
            // Fallback to cache if network fails
            return caches.match(event.request)
          })
      )
    }
  } else {
    // Cache-first for assets and pages
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then(fetchResponse => {
          // Cache new requests
          if (fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone()
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone)
            })
          }
          return fetchResponse
        })
      })
    )
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // Take control immediately
  return self.clients.claim()
})
