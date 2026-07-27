const loadingBar = document.querySelector('.loadingBar')
const rootElement = document.documentElement
const pullToRefresh = document.querySelector('[data-pull-to-refresh]')

const setLoading = isLoading => {
  rootElement.classList.toggle('is-loading', isLoading)

  if (!loadingBar) return
  loadingBar.setAttribute('aria-hidden', String(!isLoading))
}

window.simplyStartNavigation = () => setLoading(true)

const shouldShowLoading = (event, link) => {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (link.target && link.target !== '_self') return false
  if (link.hasAttribute('download')) return false

  const url = new URL(link.href, window.location.href)
  if (!['http:', 'https:'].includes(url.protocol)) return false

  const currentUrl = new URL(window.location.href)
  const sameDocument = url.origin === currentUrl.origin &&
    url.pathname === currentUrl.pathname &&
    url.search === currentUrl.search

  return !sameDocument
}

document.addEventListener('click', event => {
  const link = event.target instanceof window.Element
    ? event.target.closest('a[href]')
    : null
  if (link && shouldShowLoading(event, link)) setLoading(true)
})

document.addEventListener('submit', () => setLoading(true))
window.addEventListener('pageshow', () => setLoading(false))

const setupSearchNavigation = () => {
  const frameSelector = 'iframe[title="portal-popup"]'
  const observedFrames = new WeakSet()
  const observedDocuments = new WeakSet()

  const bindDocument = frame => {
    let frameDocument

    try {
      frameDocument = frame.contentDocument
    } catch (error) {
      return
    }

    if (!frameDocument || observedDocuments.has(frameDocument)) return
    observedDocuments.add(frameDocument)

    frameDocument.addEventListener('click', event => {
      const target = event.target
      const result = target && typeof target.closest === 'function'
        ? target.closest('.cursor-pointer')
        : null

      if (result) setLoading(true)
    }, true)

    frameDocument.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return
      if (frameDocument.querySelector('.cursor-pointer.bg-neutral-100')) setLoading(true)
    }, true)
  }

  const bindFrame = frame => {
    if (observedFrames.has(frame)) return
    observedFrames.add(frame)
    frame.addEventListener('load', () => bindDocument(frame))
    bindDocument(frame)
  }

  const inspect = node => {
    if (!(node instanceof window.Element)) return

    if (node.matches(frameSelector)) bindFrame(node)
    node.querySelectorAll(frameSelector).forEach(bindFrame)
  }

  inspect(document.documentElement)

  const observer = new window.MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(inspect)
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

const setupPullToRefresh = () => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches

  if (!pullToRefresh || !isStandalone || !isTouchDevice) return

  const status = pullToRefresh.querySelector('[data-pull-to-refresh-status]')
  const pullThreshold = 58
  const maxDistance = 88
  let startX
  let startY
  let pullDistance = 0
  let gestureDirection
  let isPulling = false
  let isRefreshing = false
  let resetTimer

  const setStatus = message => {
    if (status.textContent !== message) status.textContent = message
  }

  const reset = () => {
    if (isRefreshing) return

    if (resetTimer) window.clearTimeout(resetTimer)
    if (isPulling) rootElement.classList.add('is-pull-resetting')

    startX = undefined
    startY = undefined
    pullDistance = 0
    gestureDirection = undefined
    isPulling = false
    rootElement.classList.remove('is-pull-active')
    rootElement.style.removeProperty('--pull-distance')
    pullToRefresh.classList.remove('is-pulling', 'is-armed')
    pullToRefresh.setAttribute('aria-hidden', 'true')

    resetTimer = window.setTimeout(() => {
      rootElement.classList.remove('is-pull-resetting')
    }, 220)
  }

  document.addEventListener('touchstart', event => {
    if (isRefreshing || event.touches.length !== 1 || window.scrollY > 0) return

    if (resetTimer) window.clearTimeout(resetTimer)
    startX = event.touches[0].clientX
    startY = event.touches[0].clientY
    gestureDirection = undefined
    rootElement.classList.remove('is-pull-resetting')
  }, { passive: true })

  document.addEventListener('touchmove', event => {
    if (startY === undefined || event.touches.length !== 1 || isRefreshing) return

    const distanceX = event.touches[0].clientX - startX
    const distanceY = event.touches[0].clientY - startY

    if (!gestureDirection && Math.max(Math.abs(distanceX), Math.abs(distanceY)) >= 8) {
      gestureDirection = Math.abs(distanceX) > Math.abs(distanceY) ? 'horizontal' : 'vertical'
    }

    if (gestureDirection === 'horizontal' || distanceY <= 0 || window.scrollY > 0) {
      reset()
      return
    }

    if (gestureDirection !== 'vertical') return
    if (event.cancelable) event.preventDefault()

    isPulling = true
    pullDistance = Math.min(maxDistance, distanceY * 0.62)
    const isArmed = pullDistance >= pullThreshold

    rootElement.classList.add('is-pull-active')
    rootElement.style.setProperty('--pull-distance', `${pullDistance}px`)
    pullToRefresh.classList.add('is-pulling')
    pullToRefresh.classList.toggle('is-armed', isArmed)
    pullToRefresh.setAttribute('aria-hidden', 'false')
    setStatus(isArmed
      ? pullToRefresh.dataset.messageRelease
      : pullToRefresh.dataset.messagePull)
  }, { passive: false })

  const finish = () => {
    if (!isPulling || pullDistance < pullThreshold) {
      reset()
      return
    }

    isRefreshing = true
    rootElement.classList.remove('is-pull-active', 'is-pull-resetting')
    rootElement.classList.add('is-pull-refreshing')
    rootElement.style.setProperty('--pull-distance', `${pullThreshold}px`)
    pullToRefresh.classList.add('is-refreshing')
    pullToRefresh.classList.remove('is-armed')
    setStatus(pullToRefresh.dataset.messageRefreshing)
    window.setTimeout(() => window.location.reload(), 180)
  }

  document.addEventListener('touchend', finish, { passive: true })
  document.addEventListener('touchcancel', reset, { passive: true })
}

setupSearchNavigation()
setupPullToRefresh()
