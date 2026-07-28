const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true
const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)

if (isStandalone) {
  const launchUrl = new URL(window.location.href)

  if (launchUrl.searchParams.get('source') === 'pwa') {
    launchUrl.searchParams.delete('source')
    window.history.replaceState(
      window.history.state,
      '',
      launchUrl.pathname + launchUrl.search + launchUrl.hash
    )
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    }).catch(error => {
      console.error('Service worker registration failed:', error)
    })
  })
}

const urlBase64ToUint8Array = value => {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0)))
}

const setPushState = (element, state, message = '') => {
  const enableButton = element.querySelector('[data-push-enable]')
  const disableButton = element.querySelector('[data-push-disable]')
  const status = element.querySelector('[data-push-status]')
  const isLoading = state === 'loading'
  const isSubscribed = state === 'subscribed'
  const isDenied = state === 'denied'

  element.dataset.pushState = state
  enableButton.hidden = isSubscribed || isDenied
  disableButton.hidden = !isSubscribed
  enableButton.disabled = isLoading
  disableButton.disabled = isLoading
  status.textContent = message
}

const setPushVisibility = (element, isVisible) => {
  element.hidden = !isVisible

  const card = element.closest('[data-push-card]')
  if (card) card.hidden = !isVisible

  const actions = element.closest('[data-publication-actions]')
  if (actions) {
    actions.hidden = !actions.querySelector(
      '[data-push-card]:not([hidden]), [data-telegram-discussion]:not([hidden])'
    )
  }
}

const getPushConfig = async () => {
  const response = await window.fetch('/api/push/config', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) throw new Error('Push service is unavailable')
  const config = await response.json()
  if (!config.enabled || !config.publicKey) throw new Error('Push service is not configured')
  return config
}

const saveSubscription = async subscription => {
  const response = await window.fetch('/api/push/subscriptions', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  })

  if (!response.ok) throw new Error('Could not save push subscription')
}

const removeSubscription = async endpoint => {
  await window.fetch('/api/push/subscriptions', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  })
}

const setupPushSubscription = async element => {
  const enableButton = element.querySelector('[data-push-enable]')
  const disableButton = element.querySelector('[data-push-disable]')
  const supportsPush = 'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  if (!supportsPush) {
    if (isIos && !isStandalone) {
      setPushVisibility(element, true)
      enableButton.addEventListener('click', () => {
        setPushState(element, 'default', element.dataset.messageInstall)
      })
    }
    return
  }

  let pushConfig

  try {
    pushConfig = await getPushConfig()
  } catch (error) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    setPushState(element, 'loading')

    try {
      await saveSubscription(subscription)
      setPushState(element, 'subscribed', element.dataset.messageEnabled)
    } catch (error) {
      console.error('Push subscription sync failed:', error)
      setPushState(element, 'default', element.dataset.messageError)
    }
  } else if (Notification.permission === 'denied') {
    setPushState(element, 'denied', element.dataset.messageDenied)
  }

  enableButton.addEventListener('click', async () => {
    if (isIos && !isStandalone) {
      setPushState(element, 'default', element.dataset.messageInstall)
      return
    }

    setPushState(element, 'loading')

    try {
      const permission = Notification.permission === 'granted'
        ? Notification.permission
        : await Notification.requestPermission()

      if (permission !== 'granted') {
        setPushState(element, permission === 'denied' ? 'denied' : 'default', element.dataset.messageDenied)
        return
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey)
        })
      }

      await saveSubscription(subscription)
      setPushState(element, 'subscribed', element.dataset.messageEnabled)
    } catch (error) {
      console.error('Push subscription failed:', error)
      setPushState(element, 'default', element.dataset.messageError)
    }
  })

  disableButton.addEventListener('click', async () => {
    setPushState(element, 'loading', element.dataset.messageEnabled)

    try {
      const endpoint = subscription && subscription.endpoint
      if (subscription) await subscription.unsubscribe()
      subscription = null
      if (endpoint) await removeSubscription(endpoint)
      setPushState(element, 'default')
    } catch (error) {
      console.error('Push unsubscribe failed:', error)
      setPushState(element, 'subscribed', element.dataset.messageDisableError)
    }
  })

  setPushVisibility(element, true)
}

const pushElements = [...document.querySelectorAll('[data-push-subscribe]')]

if (pushElements.length) {
  pushElements.forEach(element => {
    setupPushSubscription(element).catch(error => {
      console.error('Push controls failed:', error)
      setPushVisibility(element, false)
    })
  })
}

/* Install invitation
/* ----------------------------------------------------------
   Asking to install on the first visit gets dismissed reflexively, so the
   prompt waits until the reader has actually finished a few articles. A read
   counts once per page view, after either enough attentive time on the page or
   enough scrolling — whichever comes first. */

const INSTALL_STORAGE_KEY = 'simply:pwa-install'
const INSTALL_READ_GOAL = 3
const INSTALL_DWELL_MS = 25000
const INSTALL_SCROLL_RATIO = 0.6
const INSTALL_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const INSTALL_MAX_DISMISSALS = 2
const INSTALL_REVEAL_DELAY_MS = 1500

const readInstallState = () => {
  const empty = { reads: 0, dismissals: 0, dismissedAt: 0, installed: false }

  try {
    const stored = window.localStorage.getItem(INSTALL_STORAGE_KEY)
    return stored ? { ...empty, ...JSON.parse(stored) } : empty
  } catch (error) {
    return empty
  }
}

const writeInstallState = state => {
  try {
    window.localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    // Private mode or a full quota — the prompt just never reaches its goal.
  }
}

/* The prompt is invisible by design until several conditions line up, which makes
   "nothing happened" impossible to tell from "not yet". These URL flags make it
   inspectable: ?pwa=debug logs the gate, ?pwa=preview forces the card on screen,
   ?pwa=reset clears the stored counters. */
const installDebugFlag = (() => {
  try {
    return new URL(window.location.href).searchParams.get('pwa') || ''
  } catch (error) {
    return ''
  }
})()

const setupInstallPrompt = element => {
  const iosActions = element.querySelector('[data-pwa-ios]')
  const browserActions = element.querySelector('[data-pwa-actions]')
  const acceptButton = element.querySelector('[data-pwa-accept]')
  const dismissButtons = [...element.querySelectorAll('[data-pwa-dismiss]')]

  // Every iOS browser installs through Safari's own Share menu, but only Safari
  // shows the entry we describe, so keep the instructions to Safari.
  const isIosSafari = isIos && !/crios|fxios|edgios|opt\//i.test(window.navigator.userAgent)

  if (installDebugFlag === 'reset') {
    try {
      window.localStorage.removeItem(INSTALL_STORAGE_KEY)
    } catch (error) {
      // Nothing was stored to begin with.
    }
  }

  let state = readInstallState()
  // Picked up from the inline catcher in default.hbs, which runs early enough to
  // see the event; null here means it simply has not fired yet.
  let deferredEvent = window.__pwaInstallEvent || null
  let isVisible = false
  let counted = false
  let dwellTimer = null
  let dwellStartedAt = 0
  let dwellElapsed = 0

  const updateState = changes => {
    state = { ...state, ...changes }
    writeInstallState(state)
  }

  const isSnoozed = () => state.dismissals >= INSTALL_MAX_DISMISSALS ||
    (state.dismissedAt > 0 && Date.now() - state.dismissedAt < INSTALL_SNOOZE_MS)

  const hide = () => {
    if (!isVisible) return
    isVisible = false
    element.classList.remove('is-visible')
    window.setTimeout(() => { element.hidden = !isVisible }, 250)
  }

  // Null means "nothing is holding the prompt back".
  const blockingReason = () => {
    if (isStandalone) return 'the page is already running as an installed app'
    if (state.installed) return 'stored state says the app was installed'
    if (state.dismissals >= INSTALL_MAX_DISMISSALS) return `dismissed ${state.dismissals} times`
    if (isSnoozed()) return `snoozed until ${new Date(state.dismissedAt + INSTALL_SNOOZE_MS).toISOString()}`
    if (state.reads < INSTALL_READ_GOAL) return `${state.reads} of ${INSTALL_READ_GOAL} articles read`
    if (!deferredEvent && !isIosSafari) {
      return 'no beforeinstallprompt event — the browser either cannot install this ' +
        'site, or it is installed already; only iOS Safari gets manual instructions instead'
    }
    return null
  }

  const logDebug = () => {
    if (installDebugFlag !== 'debug') return
    const reason = blockingReason()
    console.info('[pwa] install prompt:', reason ? `blocked — ${reason}` : 'ready to show', {
      reads: state.reads,
      goal: INSTALL_READ_GOAL,
      countedThisPage: counted,
      isArticle: element.hasAttribute('data-pwa-article'),
      hasInstallEvent: Boolean(deferredEvent),
      isIosSafari,
      isStandalone,
      state
    })
  }

  const show = () => {
    if (isVisible) return

    const isPreview = installDebugFlag === 'preview'
    logDebug()
    if (!isPreview && blockingReason()) return

    // In preview there is no install event, so pick the variant the platform
    // would really get rather than falling back to the iOS instructions.
    const useBrowserVariant = isPreview ? !isIosSafari : Boolean(deferredEvent)
    browserActions.hidden = !useBrowserVariant
    iosActions.hidden = useBrowserVariant

    isVisible = true
    element.hidden = false
    // Let the browser paint the hidden state first so the transition runs.
    window.requestAnimationFrame(() => element.classList.add('is-visible'))
  }

  const dismiss = () => {
    updateState({ dismissals: state.dismissals + 1, dismissedAt: Date.now() })
    hide()
  }

  const stopCounting = () => {
    if (dwellTimer) window.clearTimeout(dwellTimer)
    dwellTimer = null
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('scroll', onScroll)
  }

  const countRead = () => {
    if (counted) return
    counted = true
    stopCounting()
    updateState({ reads: state.reads + 1 })
    window.setTimeout(show, INSTALL_REVEAL_DELAY_MS)
  }

  const startDwell = () => {
    if (counted || dwellTimer) return
    dwellStartedAt = Date.now()
    dwellTimer = window.setTimeout(countRead, INSTALL_DWELL_MS - dwellElapsed)
  }

  const pauseDwell = () => {
    if (!dwellTimer) return
    window.clearTimeout(dwellTimer)
    dwellTimer = null
    dwellElapsed += Date.now() - dwellStartedAt
  }

  function onVisibilityChange () {
    if (document.visibilityState === 'hidden') pauseDwell()
    else startDwell()
  }

  function onScroll () {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight
    if (scrollable <= 0) return
    if (window.scrollY / scrollable >= INSTALL_SCROLL_RATIO) countRead()
  }

  acceptButton.addEventListener('click', async () => {
    if (!deferredEvent) return

    const installEvent = deferredEvent
    deferredEvent = null
    window.__pwaInstallEvent = null
    hide()

    try {
      installEvent.prompt()
      const choice = await installEvent.userChoice

      if (choice.outcome === 'accepted') updateState({ installed: true })
      else updateState({ dismissals: state.dismissals + 1, dismissedAt: Date.now() })
    } catch (error) {
      console.error('Install prompt failed:', error)
    }
  })

  dismissButtons.forEach(button => button.addEventListener('click', dismiss))

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isVisible) dismiss()
  })

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredEvent = event

    // Browsers only fire this while the app is NOT installed, so its arrival
    // proves a stored "installed" flag is stale — the app was uninstalled.
    if (state.installed) updateState({ installed: false })

    // The reader may already be past the goal from earlier visits.
    if (counted) show()
  })

  window.addEventListener('appinstalled', () => {
    deferredEvent = null
    window.__pwaInstallEvent = null
    updateState({ installed: true })
    hide()
  })

  if (installDebugFlag === 'preview') {
    counted = true
    window.setTimeout(show, INSTALL_REVEAL_DELAY_MS)
    return
  }

  if (installDebugFlag === 'debug') {
    logDebug()
    window.addEventListener('beforeinstallprompt', logDebug)
  }

  // Deliberately not bailing out on state.installed: the app may have been
  // uninstalled since, and only a later beforeinstallprompt can tell us so. The
  // flag still suppresses the card through blockingReason() until then.
  if (isStandalone) return

  if (element.hasAttribute('data-pwa-article')) {
    if (state.reads >= INSTALL_READ_GOAL) {
      // Goal already met — treat this page view as the trigger.
      counted = true
      window.setTimeout(show, INSTALL_REVEAL_DELAY_MS)
    } else {
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('scroll', onScroll, { passive: true })
      if (document.visibilityState !== 'hidden') startDwell()
    }
  }
}

const installElement = document.querySelector('[data-pwa-install]')

if (installElement) setupInstallPrompt(installElement)
