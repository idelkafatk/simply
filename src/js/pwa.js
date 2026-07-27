const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

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
