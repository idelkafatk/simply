/* Search
/* ----------------------------------------------------------
   Replaces Ghost's sodo-search. The index is fetched lazily on first open,
   so nothing is downloaded for readers who never search.
/* ---------------------------------------------------------- */

const INDEX_LIMIT = 'all'
const MAX_RESULTS = 20
const MAX_RECENT = 8
const SNIPPET_RADIUS = 60

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

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

// Wraps every token occurrence in <mark>. Input is escaped first, so the only
// tags in the output are the ones added here.
const highlight = (text, tokens) => {
  const escaped = escapeHtml(text)
  if (!tokens.length) return escaped

  // Tokens are stems, so the match is extended over the rest of the word —
  // searching "виза" highlights the whole of "визе", not just "виз".
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})[\\p{L}\\p{N}]*`, 'giu')

  return escaped.replace(pattern, '<mark>$&</mark>')
}

// Pulls the region of the body text around the first match, so the reader sees
// why the post was returned rather than a generic opening paragraph.
const buildSnippet = (plaintext, tokens) => {
  if (!plaintext) return ''

  const haystack = normalize(plaintext)
  let index = -1

  tokens.forEach(token => {
    const found = haystack.indexOf(token)
    if (found !== -1 && (index === -1 || found < index)) index = found
  })

  if (index === -1) return plaintext.slice(0, SNIPPET_RADIUS * 2)

  const start = Math.max(0, index - SNIPPET_RADIUS)
  const end = Math.min(plaintext.length, index + SNIPPET_RADIUS * 2)

  return `${start > 0 ? '…' : ''}${plaintext.slice(start, end).trim()}${end < plaintext.length ? '…' : ''}`
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
  const sectionEl = root.querySelector('[data-search-section]')
  const closeControls = root.querySelectorAll('[data-search-close]')
  const documentBody = document.body

  let posts = null
  let indexRequest = null
  let lastFocusedElement
  let activeIndex = -1
  let currentResults = []

  const setMessage = text => {
    messageEl.textContent = text || ''
    messageEl.hidden = !text
  }

  const setSection = text => {
    sectionEl.textContent = text || ''
    sectionEl.hidden = !text
  }

  const loadIndex = () => {
    if (indexRequest) return indexRequest

    const key = root.dataset.searchKey
    const url = `${window.location.origin}/ghost/api/content/posts/` +
      `?key=${encodeURIComponent(key)}&limit=${INDEX_LIMIT}` +
      '&fields=id,title,url,excerpt,plaintext&formats=plaintext&order=published_at%20desc'

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

  const render = (results, tokens) => {
    currentResults = results
    activeIndex = -1

    if (!results.length) {
      resultsEl.innerHTML = ''
      return
    }

    resultsEl.innerHTML = results.map(post => {
      const snippet = buildSnippet(post.plaintext || post.excerpt, tokens)

      return `<a class="search-result" role="option" aria-selected="false" href="${escapeHtml(post.url)}">
        <div class="search-result-title">${highlight(post.title, tokens)}</div>
        <div class="search-result-excerpt">${highlight(snippet, tokens)}</div>
      </a>`
    }).join('')
  }

  // The index is ordered newest first, so an empty query can offer something to
  // tap straight away instead of a blank sheet. Costs nothing extra — the index
  // is already being fetched when the sheet opens.
  const showRecent = () => {
    if (!posts || !posts.length) {
      render([], [])
      setSection('')
      return
    }

    render(posts.slice(0, MAX_RECENT), [])
    setSection(root.dataset.searchRecent || 'Последние публикации')
    setMessage('')
  }

  const runSearch = () => {
    const query = normalize(input.value)

    clearButton.hidden = !input.value

    if (!query) {
      showRecent()
      return
    }

    setSection('')

    const tokens = query.split(' ').filter(Boolean).map(stem)

    const search = () => {
      const results = posts
        .map(post => ({ post, score: scorePost(post, tokens) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(entry => entry.post)

      render(results, tokens)
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

  // iOS keeps position:fixed anchored to the layout viewport, so an open
  // keyboard would otherwise sit on top of the sheet's lower half.
  const syncViewport = () => {
    const viewport = window.visualViewport
    if (!viewport) return

    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)

    root.style.setProperty('--search-keyboard-inset', `${inset}px`)
    root.style.setProperty('--search-available-height', `${viewport.height - 32}px`)
  }

  const isOpen = () => documentBody.classList.contains('is-search-open')

  const setOpen = open => {
    if (open === isOpen()) return

    if (open) {
      root.hidden = false
      lastFocusedElement = document.activeElement

      // Force a reflow so the sheet animates in from its off-screen transform
      // instead of appearing in place.
      void root.offsetWidth
    }

    documentBody.classList.toggle('is-search-open', open)

    if (open) {
      syncViewport()
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport)
        window.visualViewport.addEventListener('scroll', syncViewport)
      }

      // Focus synchronously, still inside the tap that opened the sheet. Doing
      // this in requestAnimationFrame breaks the user-gesture chain and iOS
      // Safari then refuses to raise the keyboard.
      input.focus({ preventScroll: true })

      loadIndex()
        .then(() => {
          if (isOpen() && !input.value) showRecent()
        })
        .catch(() => {})

      return
    }

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', syncViewport)
      window.visualViewport.removeEventListener('scroll', syncViewport)
    }

    input.value = ''
    clearButton.hidden = true
    render([], [])
    setSection('')
    setMessage('')

    if (lastFocusedElement) lastFocusedElement.focus()

    // Keep the node in the tree until the slide-out animation finishes.
    window.setTimeout(() => {
      if (!isOpen()) root.hidden = true
    }, 240)
  }

  // Take over every existing search trigger, including the ones that used to
  // hand off to sodo-search.
  document.querySelectorAll('[data-ghost-search], [data-search-open]').forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.preventDefault()
      setOpen(true)
    })
  })

  closeControls.forEach(control => {
    control.addEventListener('click', () => setOpen(false))
  })

  resultsEl.addEventListener('click', event => {
    if (event.target.closest('a[href]') && window.simplyStartNavigation) {
      window.simplyStartNavigation()
    }
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
