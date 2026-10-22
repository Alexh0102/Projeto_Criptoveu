const CACHE_VERSION = 'v6'
const APP_SHELL_CACHE = `criptoveu-app-shell-${CACHE_VERSION}`
const STATIC_CACHE = `criptoveu-static-${CACHE_VERSION}`
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  '/brand/criptoveu-logo.png',
  '/locales/pt-BR/translation.json',
  '/locales/en/translation.json',
  '/locales/es/translation.json',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const expectedCaches = new Set([APP_SHELL_CACHE, STATIC_CACHE])
      const cacheNames = await caches.keys()

      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!expectedCaches.has(cacheName)) {
            return caches.delete(cacheName)
          }

          return Promise.resolve(false)
        }),
      )

      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable().catch(() => undefined)
      }

      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(request.url)

  if (requestUrl.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event))
    return
  }

  if (shouldCacheStaticAsset(request, requestUrl)) {
    event.respondWith(cacheFirst(request))
  }
})

async function handleNavigationRequest(event) {
  try {
    const preloadResponse = await event.preloadResponse

    if (preloadResponse) {
      return preloadResponse
    }

    return await fetch(event.request)
  } catch {
    return (await caches.match('/index.html')) || caches.match('/')
  }
}

function shouldCacheStaticAsset(request, requestUrl) {
  if (requestUrl.search && requestUrl.search !== '?source=pwa') {
    return false
  }

  if (requestUrl.pathname.startsWith('/locales/') && requestUrl.pathname.endsWith('.json')) {
    return true
  }

  return ['script', 'style', 'font', 'image'].includes(request.destination)
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  const networkResponse = await fetch(request)

  if (networkResponse.ok && networkResponse.type === 'basic') {
    const cache = await caches.open(STATIC_CACHE)
    await cache.put(request, networkResponse.clone())
  }

  return networkResponse
}
