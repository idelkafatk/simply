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

  enableButton.hidden = isSubscribed || isDenied
  disableButton.hidden = !isSubscribed
  enableButton.disabled = isLoading
  disableButton.disabled = isLoading
  status.textContent = message
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
      element.hidden = false
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

  element.hidden = false
}

const pushElements = [...document.querySelectorAll('[data-push-subscribe]')]

if (pushElements.length) {
  pushElements.forEach(element => {
    setupPushSubscription(element).catch(error => {
      console.error('Push controls failed:', error)
      element.hidden = true
    })
  })
}
