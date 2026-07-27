/* global self caches fetch Request URL */

const CACHE_PREFIX = 'idel-blog'
const CACHE_VERSION = 'v18'
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`
const PAGE_CACHE = `${CACHE_PREFIX}-pages-${CACHE_VERSION}`
const ASSET_CACHE = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`
const HOME_URL = '/'
const MANIFEST_URL = '/manifest/'
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

const tryPrecache = async (cache, url) => {
  try {
    const request = new Request(url, { cache: 'reload' })
    const response = await fetch(request)
    if (isCacheableResponse(response)) await cache.put(request, response)
    return response
  } catch (error) {
    return null
  }
}

const precacheLaunchAssets = async () => {
  const cache = await caches.open(SHELL_CACHE)

  await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
  await tryPrecache(cache, HOME_URL)

  const manifestResponse = await tryPrecache(cache, MANIFEST_URL)
  if (!manifestResponse) return

  try {
    const manifest = await manifestResponse.clone().json()
    const icons = Array.isArray(manifest.icons) ? manifest.icons : []
    const icon = icons.find(item => String(item.sizes).includes('192x192')) || icons[0]

    if (icon && icon.src) {
      const iconUrl = new URL(icon.src, self.location.origin)
      if (iconUrl.origin === self.location.origin) await tryPrecache(cache, iconUrl.href)
    }
  } catch (error) {
    // The offline page remains available even if manifest parsing fails.
  }
}

const launchPage = async (event) => {
  const cached = await caches.match(HOME_URL)
  const update = (async () => {
    const response = await fetch(event.request)
    await tryStoreResponse(SHELL_CACHE, HOME_URL, response, 10)
    return response
  })().catch(async error => {
    const offline = await caches.match(OFFLINE_URL)
    if (offline) return offline
    throw error
  })

  event.waitUntil(update.then(() => undefined, () => undefined))
  return cached || update
}

const networkFirst = async (event) => {
  const request = event.request

  try {
    const response = await fetch(request)
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

const getNotificationIcon = async () => {
  let response = await caches.match(MANIFEST_URL)

  if (!response) {
    try {
      response = await fetch(MANIFEST_URL)
    } catch (error) {
      return null
    }
  }

  if (!response || !response.ok) return null

  try {
    const manifest = await response.json()
    const icons = Array.isArray(manifest.icons) ? manifest.icons : []
    const icon = icons.find(item => String(item.sizes).includes('192x192')) || icons[0]

    if (!icon || !icon.src) return null

    const iconUrl = new URL(icon.src, self.location.origin)
    return iconUrl.protocol === 'https:' || iconUrl.origin === self.location.origin
      ? iconUrl.href
      : null
  } catch (error) {
    return null
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    precacheLaunchAssets()
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
        ? self.registration.navigationPreload.disable()
        : Promise.resolve(),
      self.clients.claim()
    ])
  )
})

self.addEventListener('push', event => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch (error) {
    payload = {}
  }

  const title = payload.title || 'Новая публикация'
  const url = payload.url || HOME_URL

  event.waitUntil((async () => {
    const icon = await getNotificationIcon()
    const options = {
      body: payload.body || '',
      tag: payload.tag || 'idel-blog-publication',
      data: { url }
    }

    if (icon) options.icon = icon

    try {
      return await self.registration.showNotification(title, options)
    } catch (error) {
      if (!icon) throw error
      delete options.icon
      return self.registration.showNotification(title, options)
    }
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = new URL(
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : HOME_URL,
    self.location.origin
  )

  if (targetUrl.origin !== self.location.origin) return

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        const existingClient = windowClients.find(client => {
          return new URL(client.url).pathname === targetUrl.pathname
        })

        if (existingClient) {
          return existingClient.focus()
            .then(() => existingClient.navigate(targetUrl.href))
        }

        return self.clients.openWindow(targetUrl.href)
      })
  )
})

self.addEventListener('fetch', event => {
  const request = event.request

  if (request.method !== 'GET' || request.headers.has('range')) return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) return

  if (request.mode === 'navigate') {
    const isPwaLaunch = url.pathname === '/' && url.searchParams.get('source') === 'pwa'
    if (isPwaLaunch) {
      event.respondWith(launchPage(event))
      return
    }

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
