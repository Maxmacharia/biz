// Service Worker for BizCore PWA
// Handles offline-first caching and background sync

const CACHE_NAME = 'bizcore-v1'
const API_CACHE = 'bizcore-api-v1'
const OFFLINE_QUEUE_KEY = 'offline_queue'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
]

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API calls – network first with offline queue for mutations
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {
      event.respondWith(handleMutation(request))
    } else {
      event.respondWith(networkFirstWithCache(request, API_CACHE))
    }
    return
  }

  // Static assets – cache first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  )
})

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleMutation(request) {
  try {
    return await fetch(request)
  } catch {
    // Queue the request for later sync
    const body = await request.text()
    const queuedRequest = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    }

    // Store in IndexedDB via postMessage to client
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'QUEUE_REQUEST', payload: queuedRequest })
      })
    })

    return new Response(JSON.stringify({
      queued: true,
      message: 'Request queued for sync when online',
      id: queuedRequest.id,
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue())
  }
})

async function syncOfflineQueue() {
  // Notify clients to flush their offline queue
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' })
  })
}

// Push notifications (future use)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'BizCore', {
      body: data.body,
      icon: '/pwa-192x192.png',
    })
  )
})
