/* Search
/* ----------------------------------------------------------
   Replaces Ghost's sodo-search. The index is fetched lazily on first open,
   so nothing is downloaded for readers who never search. Results are drawn
   as the list rows of the home page (partials/site/row.hbs).
/* ---------------------------------------------------------- */

import { trackKeyboardInset } from './util/keyboard-inset'

const INDEX_LIMIT = 'all'
const MAX_RESULTS = 20
const MAX_RECENT = 8
const DESKTOP = '(min-width: 641px)'
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const normalize = value => (value || '')
  .toLowerCase()
  .replace(/ё/g, 'е') // ё → е, so both spellings match
  .replace(/\s+/g, ' ')
  .trim()

const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]))

// Crude Russian stemming: "виза", "визу" and "визах" all reduce to "виз" so they
// match each other, with substring matching covering the rest. This is nowhere
// near a real morphological analyser — it just removes the endings that show up
// in ordinary search queries. Tokens are never cut below MIN_STEM characters,
// which keeps short words from collapsing into noise.
const MIN_STEM = 3

// Longest first, so "ами" wins over "ми" and "ого" over "го".
const SUFFIXES = [
  'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
  'ах', 'ях', 'ов', 'ев', 'ом', 'ем', 'ам', 'ям', 'ым', 'им',
  'ый', 'ий', 'ые', 'ие', 'ых', 'их', 'ой', 'ей'
]

const stem = token => {
  let result = token

  const suffix = SUFFIXES.find(candidate =>
    result.endsWith(candidate) && result.length - candidate.length >= MIN_STEM
  )

  if (suffix) result = result.slice(0, -suffix.length)

  while (result.length > MIN_STEM && /[аяоеыиуюьй]$/.test(result)) {
    result = result.slice(0, -1)
  }

  return result
}

// The 300px size of a Ghost image, as the list rows use it.
const thumbUrl = url => /\/content\/images\/(?!size\/)/.test(url)
  ? url.replace('/content/images/', '/content/images/size/w300/')
  : url

const NOTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>'

// The same markup as partials/site/row.hbs. -light/-dark covers are swapped to
// the current theme by themedImages() in main.js as the rows are added.
const rowHtml = post => {
  const art = /-(light|dark)\./.test(post.image) ? ' art' : ''
  const thumb = post.image
    ? `<img class="thumb${art}" src="${escapeHtml(thumbUrl(post.image))}" width="84" height="56" alt="" loading="lazy" decoding="async">`
    : `<span class="thumb is-empty">${NOTE_ICON}</span>`
  const date = post.date ? new Date(post.date) : null
  const label = date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : ''

  return `<a class="row" role="option" aria-selected="false" href="${escapeHtml(post.url)}">${thumb}` +
    `<span class="t">${escapeHtml(post.title)}</span><span class="d">${label}</span></a>`
}

const scorePost = (post, tokens) => {
  let score = 0

  tokens.forEach(token => {
    if (post.searchTitle.includes(token)) score += 10
    else if (post.searchExcerpt.includes(token)) score += 4
    else if (post.searchBody.includes(token)) score += 1
  })

  // Every token has to land somewhere, otherwise a two-word query would match
  // posts containing only the more common of the two.
  const matchedAll = tokens.every(token =>
    post.searchTitle.includes(token) ||
    post.searchExcerpt.includes(token) ||
    post.searchBody.includes(token)
  )

  return matchedAll ? score : 0
}

export const initSearch = () => {
  const root = document.querySelector('[data-search]')
  if (!root) return

  const sheet = root.querySelector('[data-search-sheet]')
  const input = root.querySelector('[data-search-input]')
  const resultsEl = root.querySelector('[data-search-results]')
  const messageEl = root.querySelector('[data-search-message]')
  const clearButton = root.querySelector('[data-search-clear]')
  const closeControls = root.querySelectorAll('[data-search-close]')
  const rootEl = document.documentElement

  let posts = null
  let indexRequest = null
  let lastFocusedElement
  let activeIndex = -1
  let currentResults = []
  let stopKeyboardTracking = () => {}

  const setMessage = text => {
    messageEl.textContent = text || ''
    messageEl.hidden = !text
  }

  const loadIndex = () => {
    if (indexRequest) return indexRequest

    const key = root.dataset.searchKey
    const url = `${window.location.origin}/ghost/api/content/posts/` +
      `?key=${encodeURIComponent(key)}&limit=${INDEX_LIMIT}` +
      '&fields=id,title,url,excerpt,plaintext,feature_image,published_at&formats=plaintext&order=published_at%20desc'

    indexRequest = window.fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Search index responded ${response.status}`)
        return response.json()
      })
      .then(data => {
        posts = (data.posts || []).map(post => ({
          title: post.title || '',
          url: post.url,
          excerpt: post.excerpt || '',
          plaintext: post.plaintext || '',
          image: post.feature_image || '',
          date: post.published_at,
          searchTitle: normalize(post.title),
          searchExcerpt: normalize(post.excerpt),
          searchBody: normalize(post.plaintext)
        }))

        return posts
      })
      .catch(error => {
        // Allow a retry on the next keystroke rather than caching the failure.
        indexRequest = null
        throw error
      })

    return indexRequest
  }

  const setActive = index => {
    const items = Array.from(resultsEl.children)
    if (!items.length) return

    activeIndex = (index + items.length) % items.length

    items.forEach((item, position) => {
      const isActive = position === activeIndex
      item.classList.toggle('is-active', isActive)
      item.setAttribute('aria-selected', String(isActive))
      if (isActive) item.scrollIntoView({ block: 'nearest' })
    })
  }

  const render = results => {
    currentResults = results
    activeIndex = -1
    resultsEl.innerHTML = results.map(rowHtml).join('')
  }

  // The index is ordered newest first, so an empty query can offer something to
  // tap straight away instead of a blank sheet. Costs nothing extra — the index
  // is already being fetched when the sheet opens.
  const showRecent = () => {
    if (!posts || !posts.length) {
      render([])
      return
    }

    render(posts.slice(0, MAX_RECENT))
    setMessage('')
  }

  const runSearch = () => {
    const query = normalize(input.value)

    clearButton.hidden = !input.value

    if (!query) {
      showRecent()
      return
    }

    let tokens = query.split(' ').filter(Boolean).map(stem)

    // One-letter words ("в", "и") match inside nearly every post; drop them
    // when there is a real word to search by.
    if (tokens.some(token => token.length > 1)) tokens = tokens.filter(token => token.length > 1)

    const search = () => {
      const results = posts
        .map(post => ({ post, score: scorePost(post, tokens) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(entry => entry.post)

      render(results)
      setMessage(results.length ? '' : root.dataset.searchEmpty || 'Ничего не найдено')
    }

    if (posts) {
      search()
      return
    }

    setMessage(root.dataset.searchLoading || 'Загрузка…')

    loadIndex()
      .then(() => {
        // The reader may have typed on, or closed the sheet, while we waited.
        if (normalize(input.value) === query) search()
        else runSearch()
      })
      .catch(() => setMessage(root.dataset.searchError || 'Поиск временно недоступен'))
  }

  const isOpen = () => rootEl.classList.contains('is-search-open')

  const setOpen = open => {
    if (open === isOpen()) return

    if (open) {
      root.hidden = false
      lastFocusedElement = document.activeElement

      // Force a reflow so the sheet animates in from its off-screen transform
      // instead of appearing in place.
      void root.offsetWidth
    }

    rootEl.classList.toggle('is-search-open', open)

    if (open) {
      stopKeyboardTracking = trackKeyboardInset(root, 'search')

      // On a phone the sheet opens on the latest posts and leaves the keyboard
      // down until the field is tapped: raising it with the sheet made the
      // whole screen lurch. With a real keyboard the field is focused at
      // once, synchronously: from requestAnimationFrame the user-gesture chain
      // is broken and iOS Safari refuses to raise an on-screen one.
      if (window.matchMedia(DESKTOP).matches) input.focus({ preventScroll: true })
      else sheet.focus({ preventScroll: true })

      loadIndex()
        .then(() => {
          if (isOpen() && !input.value) showRecent()
        })
        .catch(() => {})

      return
    }

    stopKeyboardTracking()

    input.value = ''
    clearButton.hidden = true
    render([])
    setMessage('')

    if (lastFocusedElement && lastFocusedElement.isConnected) lastFocusedElement.focus({ preventScroll: true })

    // Keep the node in the tree until the slide-out animation finishes.
    window.setTimeout(() => {
      if (!isOpen()) root.hidden = true
    }, 240)
  }

  // Take over every search trigger, including links that used to hand off to
  // sodo-search.
  document.querySelectorAll('[data-ghost-search], [data-search-open]').forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.preventDefault()
      setOpen(!isOpen())
    })
  })

  closeControls.forEach(control => {
    control.addEventListener('click', () => setOpen(false))
  })

  // Wide screens leave the page's scrollbar in place while search is open
  // (see search.css), so the wheel is stopped here instead: it scrolls the
  // results when they overflow and nothing at all otherwise.
  root.addEventListener('wheel', event => {
    const scrollable = event.target.closest('[data-search-results]') &&
      resultsEl.scrollHeight > resultsEl.clientHeight

    if (!scrollable) event.preventDefault()
  }, { passive: false })

  resultsEl.addEventListener('click', event => {
    if (!event.target.closest('a[href]')) return
    if (window.simplyStartNavigation) window.simplyStartNavigation()
    // Back from the post, the page is shown without the sheet over it.
    window.setTimeout(() => setOpen(false), 0)
  })

  input.addEventListener('input', runSearch)

  clearButton.addEventListener('click', () => {
    input.value = ''
    runSearch()
    input.focus()
  })

  document.addEventListener('keydown', event => {
    if (event.key === '/' && !isOpen() && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (!isOpen()) return

    if (event.key === 'Escape') {
      // Esc closes a zoomed picture first, nothing else.
      if (document.querySelector('.medium-zoom-image--opened')) return
      event.preventDefault()
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(activeIndex + 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(activeIndex - 1)
      return
    }

    if (event.key === 'Enter') {
      const target = activeIndex >= 0 ? currentResults[activeIndex] : currentResults[0]
      if (!target) return

      event.preventDefault()
      if (window.simplyStartNavigation) window.simplyStartNavigation()
      window.location.assign(target.url)
      return
    }

    if (event.key !== 'Tab') return

    // Two focusable stops only (input and cancel), so a manual wrap is enough.
    const focusable = Array.from(sheet.querySelectorAll(
      'input, a[href], button:not([disabled]):not([hidden])'
    ))
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
}
