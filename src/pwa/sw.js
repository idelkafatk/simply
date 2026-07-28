/* global self caches fetch Request URL */

const CACHE_PREFIX = 'idel-blog'
const CACHE_VERSION = 'v19'
const SEARCH_INDEX_PATH = '/ghost/api/content/posts/'
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

const TRIM_INTERVAL = 10
const writesSinceTrim = {}

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
  await cache.put(request, response)

  // Listing every key is a disk read, so it is amortised over several writes
  // instead of being paid on each cached response.
  const pending = (writesSinceTrim[cacheName] || 0) + 1

  if (pending < TRIM_INTERVAL) {
    writesSinceTrim[cacheName] = pending
    return
  }

  writesSinceTrim[cacheName] = 0
  await trimCache(cacheName, maxEntries)
}

const tryStoreResponse = async (cacheName, request, response, maxEntries) => {
  try {
    await storeResponse(cacheName, request, response, maxEntries)
  } catch (error) {
    // Cache failures must not replace a valid network response.
  }
}

// Caching happens in waitUntil so the page never waits on a cache write, and
// navigations reuse the preload the browser started while the worker booted.
const fetchAndCache = async (event, cacheName, cacheKey, maxEntries) => {
  const preloaded = event.request.mode === 'navigate' && event.preloadResponse
    ? await event.preloadResponse
    : null
  const response = preloaded || await fetch(event.request)

  event.waitUntil(tryStoreResponse(cacheName, cacheKey, response.clone(), maxEntries))
  return response
}

const tryPrecache = async (cache, url) => {
  try {
    const request = new Request(url, { cache: 'reload' })
    const response = await fetch(request)
    // Cloning first keeps the returned body readable, since put() consumes it.
    if (isCacheableResponse(response)) await cache.put(request, response.clone())
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
  const shell = await caches.open(SHELL_CACHE)
  const cached = await shell.match(HOME_URL)

  if (!cached) {
    try {
      return await fetchAndCache(event, SHELL_CACHE, HOME_URL, 10)
    } catch (error) {
      const offline = await shell.match(OFFLINE_URL)
      if (offline) return offline
      throw error
    }
  }

  event.waitUntil((async () => {
    try {
      const preloaded = event.preloadResponse ? await event.preloadResponse : null
      const response = preloaded || await fetch(event.request)
      await tryStoreResponse(SHELL_CACHE, HOME_URL, response, 10)
    } catch (error) {
      // The cached shell stays usable when the refresh fails.
    }
  })())

  return cached
}

const networkFirst = async (event) => {
  const request = event.request

  try {
    return await fetchAndCache(event, PAGE_CACHE, request, MAX_PAGE_ENTRIES)
  } catch (error) {
    const pages = await caches.open(PAGE_CACHE)
    const shell = await caches.open(SHELL_CACHE)

    return (await pages.match(request, { ignoreSearch: true })) ||
      (await shell.match(OFFLINE_URL))
  }
}

const staleWhileRevalidate = async (event) => {
  const request = event.request
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)

  if (!cached) return fetchAndCache(event, ASSET_CACHE, request, MAX_ASSET_ENTRIES)

  event.waitUntil((async () => {
    try {
      const response = await fetch(request)
      await tryStoreResponse(ASSET_CACHE, request, response, MAX_ASSET_ENTRIES)
    } catch (error) {
      // The cached asset stays usable when revalidation fails.
    }
  })())

  return cached
}

const cacheFirst = async (event) => {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(event.request)
  if (cached) return cached

  return fetchAndCache(event, IMAGE_CACHE, event.request, MAX_IMAGE_ENTRIES)
}

const getNotificationIcon = async () => {
  const shell = await caches.open(SHELL_CACHE)
  let response = await shell.match(MANIFEST_URL)

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
        ? self.registration.navigationPreload.enable()
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

  // The search index lives under /ghost/api/, which isPrivatePath would
  // otherwise skip. Caching it is what makes search work offline.
  if (url.origin === self.location.origin && url.pathname === SEARCH_INDEX_PATH) {
    event.respondWith(staleWhileRevalidate(event))
    return
  }

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
