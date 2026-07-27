/* global self caches fetch Request URL */

const CACHE_PREFIX = 'idel-blog'
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`
const PAGE_CACHE = `${CACHE_PREFIX}-pages-${CACHE_VERSION}`
const ASSET_CACHE = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`
const OFFLINE_URL = '/offline/'
const MAX_PAGE_ENTRIES = 40
const MAX_ASSET_ENTRIES = 80
const MAX_IMAGE_ENTRIES = 120

const MANAGED_CACHES = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, IMAGE_CACHE]
const PRIVATE_PATHS = [
  '/ghost',
  '/members',
  '/api',
  '/signin',
  '/signup',
  '/p',
  '/.ghost'
]

const isPrivatePath = pathname => {
  return PRIVATE_PATHS.some(path => {
    return pathname === path || pathname.startsWith(`${path}/`)
  })
}

const isCacheableResponse = response => {
  if (!response || !response.ok || response.type !== 'basic') return false

  const cacheControl = response.headers.get('Cache-Control') || ''
  return !/(private|no-store)/i.test(cacheControl)
}

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const excess = keys.length - maxEntries

  if (excess <= 0) return
  await Promise.all(keys.slice(0, excess).map(request => cache.delete(request)))
}

const storeResponse = async (cacheName, request, response, maxEntries) => {
  if (!isCacheableResponse(response)) return

  const cache = await caches.open(cacheName)
  await cache.put(request, response.clone())
  await trimCache(cacheName, maxEntries)
}

const tryStoreResponse = async (cacheName, request, response, maxEntries) => {
  try {
    await storeResponse(cacheName, request, response, maxEntries)
  } catch (error) {
    // Cache failures must not replace a valid network response.
  }
}

const networkFirst = async (event) => {
  const request = event.request

  try {
    const preloaded = await event.preloadResponse
    const response = preloaded || await fetch(request)
    await tryStoreResponse(PAGE_CACHE, request, response, MAX_PAGE_ENTRIES)
    return response
  } catch (error) {
    return (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(OFFLINE_URL))
  }
}

const staleWhileRevalidate = async (event) => {
  const request = event.request
  const cached = await caches.match(request)
  const update = fetch(request).then(async response => {
    await tryStoreResponse(ASSET_CACHE, request, response, MAX_ASSET_ENTRIES)
    return response
  }).catch(error => {
    if (cached) return cached
    throw error
  })

  event.waitUntil(update.then(() => undefined, () => undefined))
  return cached || update
}

const cacheFirst = async (event) => {
  const request = event.request
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  await tryStoreResponse(IMAGE_CACHE, request, response, MAX_IMAGE_ENTRIES)
  return response
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => {
        return Promise.all(
          keys
            .filter(key => key.startsWith(`${CACHE_PREFIX}-`) && !MANAGED_CACHES.includes(key))
            .map(key => caches.delete(key))
        )
      }),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
      self.clients.claim()
    ])
  )
})

self.addEventListener('fetch', event => {
  const request = event.request

  if (request.method !== 'GET' || request.headers.has('range')) return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event))
    return
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(event))
    return
  }

  if (['style', 'script', 'font'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(event))
  }
})
