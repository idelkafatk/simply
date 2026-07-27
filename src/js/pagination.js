import InfiniteScroll from 'infinite-scroll'

(function (document) {
  // Next link Element
  const nextElement = document.querySelector('link[rel=next]')
  if (!nextElement) return

  // Post Feed element
  const $feedElement = document.querySelector('.js-feed-entry')
  if (!$feedElement) return

  const $viewMoreButton = document.querySelector('.load-more-btn')
  const $buttonLabel = $viewMoreButton.querySelector('.load-more-label')
  const $loadingStatus = document.querySelector('.feed-loading-status')
  const $errorStatus = document.querySelector('.feed-load-error')
  const $retryButton = $errorStatus.querySelector('.feed-load-retry')

  const setButtonState = state => {
    const isLoading = state === 'loading'
    $viewMoreButton.classList.toggle('is-loading', isLoading)
    $viewMoreButton.setAttribute('aria-busy', String(isLoading))
    $buttonLabel.textContent = isLoading
      ? $viewMoreButton.dataset.labelLoading
      : $viewMoreButton.dataset.labelDefault
  }

  const showButton = () => {
    setButtonState('default')
    $viewMoreButton.classList.add('flex')
    $viewMoreButton.classList.remove('hidden')
  }

  const hideButton = () => {
    $viewMoreButton.classList.add('hidden')
    $viewMoreButton.classList.remove('flex')
  }

  const finishLoading = () => {
    document.documentElement.classList.remove('is-feed-loading')
    setButtonState('default')
    $loadingStatus.hidden = true
  }

  const infScroll = new InfiniteScroll($feedElement, {
    append: '.js-story',
    button: $viewMoreButton,
    history: false,
    debug: false,
    hideNav: '.pagination',
    path: '.pagination .older-posts'
  })

  infScroll.on('request', function () {
    document.documentElement.classList.add('is-feed-loading')
    $errorStatus.hidden = true

    if ($viewMoreButton.classList.contains('hidden')) {
      $loadingStatus.hidden = false
    } else {
      setButtonState('loading')
    }
  })

  infScroll.on('append', function () {
    finishLoading()

    if (!infScroll.canLoad) {
      hideButton()
    } else if (infScroll.loadCount === 1) {
      infScroll.options.loadOnScroll = false
      showButton()
    } else if (infScroll.options.loadOnScroll) {
      hideButton()
    }
  })

  infScroll.on('last', function () {
    finishLoading()
    hideButton()
  })

  infScroll.on('error', function () {
    finishLoading()
    hideButton()
    $errorStatus.hidden = false
  })

  $viewMoreButton.addEventListener('click', function () {
    infScroll.options.loadOnScroll = true
  })

  $retryButton.addEventListener('click', function (event) {
    event.preventDefault()
    infScroll.canLoad = true
    infScroll.loadNextPage()
  })
})(document)
