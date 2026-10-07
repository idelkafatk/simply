/* global followSocialMedia menuDropdown MutationObserver */

import './navigation'

// lib
import mediumZoom from 'medium-zoom'

// import loadScript from './util/load-script'
import urlRegexp from './util/url-regular-expression'
import docSelectorAll from './util/document-query-selector-all'
import { initGalleryCards } from './util/gallery'
import { initHorizontalCarousel } from './util/horizontal-carousel'
import { initShareLink } from './util/share-link'
import { initSearch } from './search'
import { initMemberPanels } from './member-panels'
import { contentApiUrl } from './util/content-api'
import { trackKeyboardInset } from './util/keyboard-inset'

const simplySetup = () => {
  const rootEl = document.documentElement
  const documentBody = document.body

  /* Share / copy link
  /* ---------------------------------------------------------- */
  // Bound first: it only needs a delegated document listener, so it stays
  // working even if a later block below throws on some template.
  initShareLink()

  /* Menu DropDown
  /* ---------------------------------------------------------- */
  const dropDownMenu = () => {
    // Checking if the variable exists and if it is an object
    if (typeof menuDropdown !== 'object' || menuDropdown === null) return

    // check if the box for the menu exists
    const $dropdownMenu = document.querySelector('.js-dropdown-menu')
    if (!$dropdownMenu) return

    Object.entries(menuDropdown).forEach(([name, url]) => {
      if (name !== 'string' && !urlRegexp(url)) return

      const link = document.createElement('a')
      link.href = url
      link.classList = 'dropdown-item block py-2 leading-tight px-5 hover:text-primary'
      link.innerText = name

      $dropdownMenu.appendChild(link)
    })
  }

  dropDownMenu()

  /* Social Media
  /* ---------------------------------------------------------- */
  const socialMedia = () => {
    // Checking if the variable exists and if it is an object
    if (typeof followSocialMedia !== 'object' || followSocialMedia === null) return

    // check if the box for the menu exists
    const $socialMedia = docSelectorAll('.js-social-media')
    if (!$socialMedia.length) return

    const linkElement = element => {
      Object.entries(followSocialMedia).forEach(([name, urlTitle]) => {
        const url = urlTitle[0]

        // The url is being validated if it is false it returns
        if (!urlRegexp(url)) return

        const link = document.createElement('a')
        link.href = url
        link.title = urlTitle[1]
        link.classList = 'p-2 inline-block hover:opacity-70'
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.innerHTML = `<svg class="icon"><use xlink:href="#icon-${name}"></use></svg>`

        element.appendChild(link)
      })
    }

    $socialMedia.forEach(linkElement)
  }

  socialMedia()

  /*  Toggle modal
  /* ---------------------------------------------------------- */
  /* const simplyModal = () => {
    const $modals = docSelectorAll('.js-modal')
    const $modalButtons = docSelectorAll('.js-modal-button')
    const $modalCloses = docSelectorAll('.js-modal-close')

    // Modal Click Open
    if (!$modalButtons.length) return
    $modalButtons.forEach($el => $el.addEventListener('click', () => openModal($el.dataset.target)))

    // Modal Click Close
    if (!$modalCloses.length) return
    $modalCloses.forEach(el => el.addEventListener('click', () => closeModals()))

    const openModal = target => {
      documentBody.classList.remove('has-menu')
      const $target = document.getElementById(target)
      rootEl.classList.add('overflow-hidden')
      $target.classList.add('is-active')
    }

    const closeModals = () => {
      rootEl.classList.remove('overflow-hidden')
      $modals.forEach($el => $el.classList.remove('is-active'))
    }

    document.addEventListener('keydown', function (event) {
      const e = event || window.event
      if (e.keyCode === 27) {
        closeModals()
        // closeDropdowns()
      }
    })
  }

  simplyModal()
  */

  /* Header Transparency
  /* ---------------------------------------------------------- */
  const headerTransparency = () => {
    const hasCover = documentBody.closest('.has-cover')
    const $jsHeader = document.querySelector('.js-header')

    const updateHeader = () => {
      const lastScrollY = window.scrollY

      if (lastScrollY > 5) {
        $jsHeader.classList.add('shadow-header', 'header-bg')
      } else {
        $jsHeader.classList.remove('shadow-header', 'header-bg')
      }

      if (!hasCover) return

      lastScrollY >= 20 ? documentBody.classList.remove('is-head-transparent') : documentBody.classList.add('is-head-transparent')
    }

    // Check scroll position on page load
    updateHeader()

    window.addEventListener('scroll', updateHeader, { passive: true })
  }

  headerTransparency()

  /* Dark Mode
  /* ---------------------------------------------------------- */
  const updateThemeIcons = () => {
    const $toggleDarkMode = docSelectorAll('.js-dark-mode')

    if (!$toggleDarkMode.length) return

    $toggleDarkMode.forEach(button => {
      const moonIcon = button.querySelector('.icon--moon')
      const sunnyIcon = button.querySelector('.icon--sunny')

      if (!moonIcon || !sunnyIcon) return

      if (rootEl.classList.contains('dark')) {
        // Dark mode: show sunny icon, hide moon icon
        moonIcon.classList.add('hidden')
        sunnyIcon.classList.remove('hidden')
      } else {
        // Light mode: show moon icon, hide sunny icon
        moonIcon.classList.remove('hidden')
        sunnyIcon.classList.add('hidden')
      }
    })
  }

  // Первичную схему комментариев ставит инлайн-скрипт в article-comments.hbs —
  // он успевает до отложенного бандла comments-ui. Здесь только догоняем
  // последующие переключения: бандл следит за атрибутами своего script-тега
  // и перечитывает конфиг на каждое изменение.
  const updateCommentsTheme = () => {
    const commentsTheme = rootEl.classList.contains('dark') ? 'dark' : 'light'

    docSelectorAll('script[data-ghost-comments]').forEach(script => {
      if (script.dataset.colorScheme !== commentsTheme) {
        script.dataset.colorScheme = commentsTheme
      }
    })
  }

  // comments-ui рисует себя внутри srcdoc-iframe, документ которого полностью
  // прозрачный — поэтому Chrome заливает холст фрейма непрозрачным белым. В тёмной
  // теме это белое полотно вылезает под светлым текстом виджета. Достать до него
  // из CSS нельзя: фон самого элемента <iframe> закрашивается сверху, а
  // color-scheme в дочерний документ не пробрасывается. Единственное, что
  // работает — записать цвет панели в документ фрейма; srcdoc same-origin.
  const paintCommentsFrame = () => {
    const panel = document.querySelector('.post-comments')

    if (!panel) return

    const frame = panel.querySelector('iframe[title="comments-frame"]')

    if (!frame || !frame.contentDocument) return

    frame.contentDocument.documentElement.style.backgroundColor =
      window.getComputedStyle(panel).backgroundColor
  }

  const watchCommentsFrame = () => {
    const panel = document.querySelector('.post-comments')

    if (!panel) return

    // Виджет монтируется лениво, по IntersectionObserver, так что фрейм может
    // появиться сильно позже DOMContentLoaded — и пересоздаться при ре-рендере.
    const frameObserver = new MutationObserver(() => {
      const frame = panel.querySelector('iframe[title="comments-frame"]')

      if (frame && !frame.dataset.simplyPainted) {
        frame.dataset.simplyPainted = 'true'
        frame.addEventListener('load', paintCommentsFrame)
      }

      paintCommentsFrame()
    })

    frameObserver.observe(panel, { childList: true, subtree: true })
    paintCommentsFrame()
  }

  const darkMode = () => {
    const $toggleDarkMode = docSelectorAll('.js-dark-mode')

    if (!$toggleDarkMode.length) return

    // Update icons on page load
    updateThemeIcons()
    updateCommentsTheme()
    paintCommentsFrame()

    $toggleDarkMode.forEach(item => item.addEventListener('click', function (event) {
      event.preventDefault()

      const nextTheme = rootEl.classList.contains('dark') ? 'light' : 'dark'
      window.simplySetTheme(nextTheme)

      // Update icons after theme change
      updateThemeIcons()
      updateCommentsTheme()
      paintCommentsFrame()
    }))
  }

  darkMode()
  watchCommentsFrame()

  // Watch for theme changes (e.g., from system preference)
  const observer = new MutationObserver(() => {
    updateThemeIcons()
    updateCommentsTheme()
    paintCommentsFrame()
  })
  observer.observe(rootEl, {
    attributes: true,
    attributeFilter: ['class']
  })

  /* DropDown Toggle
  /* ---------------------------------------------------------- */
  const dropDownMenuToggle = () => {
    const dropdowns = docSelectorAll('.dropdown:not(.is-hoverable)')

    if (!dropdowns.length) return

    dropdowns.forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.stopPropagation()
        el.classList.toggle('is-active')
        documentBody.classList.remove('has-menu')
      })
    })

    const closeDropdowns = () => dropdowns.forEach(function (el) {
      el.classList.remove('is-active')
    })

    document.addEventListener('click', closeDropdowns)
  }

  dropDownMenuToggle()

  /* Mobile Navigation
  /* ---------------------------------------------------------- */
  const mobileNavigation = () => {
    const navigation = document.querySelector('[data-mobile-navigation]')
    if (!navigation) return

    const toggle = navigation.querySelector('[data-mobile-navigation-toggle]')
    const sheet = navigation.querySelector('[data-mobile-navigation-sheet]')
    const closeControls = navigation.querySelectorAll('[data-mobile-navigation-close]')
    const notesLink = navigation.querySelector('[data-mobile-navigation-notes]')
    const sheetTitle = sheet.querySelector('[data-mobile-navigation-title]')
    const sheetContent = sheet.querySelector('[data-mobile-navigation-content]')
    const panels = Array.from(sheet.querySelectorAll('[data-mobile-navigation-panel]'))
    const tagLinks = Array.from(navigation.querySelectorAll('.mobile-navigation-links a[href*="/tag/"]'))
    const onPanelShown = initMemberPanels(sheet)
    const tabBar = navigation.querySelector('.mobile-tab-bar')
    const tabs = Array.from(tabBar.querySelectorAll('.mobile-tab-item'))
    const desktopMedia = window.matchMedia('(min-width: 1000px)')
    // Scroll distance over which the bar fades back in before the end of a
    // page: about its own height plus the gap under it.
    const endFade = 120
    // Pages scrolling less than this keep the bar: 80px at the top where it
    // always shows, the fade zone at the end, and 200px of hidden travel
    // between. Any shorter and the two zones nearly meet and the bar flickers.
    const minHideScroll = 80 + endFade + 200
    let lastFocusedElement
    let lastScrollY = Math.max(window.scrollY, 0)
    let scrollFrame
    let stopKeyboardTracking = () => {}
    let tagCountsRequested = false

    navigation.querySelectorAll('.mobile-navigation-links a[href]').forEach(link => {
      const url = new URL(link.href, window.location.href)
      const isPrimaryDestination = url.origin === window.location.origin &&
        ['/', '/notes/'].includes(url.pathname)

      if (isPrimaryDestination) link.closest('li').remove()
    })

    const isOpen = () => documentBody.classList.contains('has-mobile-menu')

    const setTabBarHidden = hidden => {
      documentBody.classList.toggle('is-mobile-tab-bar-hidden', hidden && !isOpen())
    }

    // Ghost leaves .success / .error on a member form until its next submit.
    const resetForms = (forms = sheet.querySelectorAll('form')) => {
      forms.forEach(form => {
        form.reset()
        form.classList.remove('success', 'error')

        const error = form.querySelector('[data-members-error]')
        if (error) error.textContent = ''
      })
    }

    // The post count next to each tag link, fetched the first time the menu
    // opens and kept for the session: a number that small is not worth a
    // request on every page.
    const showTagCounts = counts => {
      tagLinks.forEach(link => {
        const slug = (new URL(link.href).pathname.match(/\/tag\/([^/]+)/) || [])[1]
        if (!(slug in counts) || link.querySelector('.mobile-navigation-count')) return

        const count = document.createElement('span')
        count.className = 'mobile-navigation-count'
        count.textContent = counts[slug]
        link.appendChild(count)
      })
    }

    const loadTagCounts = () => {
      if (tagCountsRequested || !tagLinks.length) return
      tagCountsRequested = true

      try {
        const cached = JSON.parse(window.sessionStorage.getItem('simply-tag-counts'))
        if (cached) return showTagCounts(cached)
      } catch (error) {}

      const url = contentApiUrl('tags', { limit: 'all', include: 'count.posts' })
      if (!url) return

      window.fetch(url)
        .then(response => response.ok ? response.json() : Promise.reject(new Error('Content API')))
        .then(data => {
          const counts = {}
          data.tags.forEach(tag => { counts[tag.slug] = tag.count.posts })

          try {
            window.sessionStorage.setItem('simply-tag-counts', JSON.stringify(counts))
          } catch (error) {}

          showTagCounts(counts)
        })
        .catch(() => {})
    }

    // The sheet shows one panel at a time: the menu, or the member forms and
    // account it leads to. Focusing a field has to happen inside the tap that
    // opened its panel, or iOS Safari refuses to raise the keyboard.
    const setPanel = (name, focus = true) => {
      const panel = panels.find(item => item.dataset.mobileNavigationPanel === name) || panels[0]

      // A form that was already sent starts over when its panel comes back.
      resetForms(panel.querySelectorAll('form.success'))
      panels.forEach(item => { item.hidden = item !== panel })
      sheet.dataset.panel = panel.dataset.mobileNavigationPanel
      sheet.dataset.parent = panel.dataset.parent || 'menu'
      sheetTitle.textContent = panel.dataset.title
      sheetContent.scrollTop = 0

      if (focus) (panel.querySelector('[data-autofocus]') || sheet).focus({ preventScroll: true })
      onPanelShown(panel.dataset.mobileNavigationPanel)
    }

    const setOpen = (open, restoreFocus = true, showKeyboardFocus = false, panel = 'menu') => {
      if (open === isOpen()) return

      if (open) {
        setTabBarHidden(false)
        resetForms()
        setPanel(panel, false)
        if (panel === 'menu') loadTagCounts()
        stopKeyboardTracking = trackKeyboardInset(navigation, 'mobile-navigation')
      } else {
        stopKeyboardTracking()
      }

      documentBody.classList.toggle('has-mobile-menu', open)
      toggle.setAttribute('aria-expanded', String(open))
      sheet.setAttribute('aria-hidden', String(!open))
      sheet.inert = !open

      closeControls.forEach(control => {
        control.setAttribute('aria-hidden', String(!open))
      })

      if (open) {
        lastFocusedElement = document.activeElement
        const closeButton = sheet.querySelector('[data-mobile-navigation-close]')
        const field = sheet.querySelector('[data-mobile-navigation-panel]:not([hidden]) [data-autofocus]')
        const focusTarget = showKeyboardFocus ? closeButton : sheet

        // A panel's field is focused right away, inside the tap, for iOS.
        if (field) field.focus({ preventScroll: true })
        else window.requestAnimationFrame(() => focusTarget.focus())
      } else if (restoreFocus && lastFocusedElement) {
        lastFocusedElement.focus()
      }
    }

    const focusableElements = () => Array.from(sheet.querySelectorAll(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
    )).filter(element => element.getClientRects().length)

    toggle.addEventListener('click', event => {
      setOpen(!isOpen(), true, event.detail === 0)
    })

    closeControls.forEach(control => {
      control.addEventListener('click', () => setOpen(false))
    })

    // Every link that would open Ghost Portal (the header buttons, the
    // subscribe box under a post, "Sign in" in a members-only notice…) opens
    // the matching panel of the sheet instead. Portal binds its own click
    // handler on these elements, so this one runs first, in the capture phase,
    // and stops the event there. Anything without a panel still goes to Portal.
    const portalPanels = {
      signup: 'signup',
      'account/signup': 'signup',
      signin: 'signin',
      account: 'account',
      'account/profile': 'profile',
      'account/newsletters': 'newsletter'
    }

    const hasPanel = name => panels.some(item => item.dataset.mobileNavigationPanel === name)

    document.addEventListener('click', event => {
      if (event.defaultPrevented) return

      const link = event.target.closest('[data-portal], a[href^="#/portal"]')
      if (!link) return

      const path = (link.dataset.portal !== undefined
        ? link.dataset.portal
        : link.getAttribute('href').replace('#/portal', '')
      ).replace(/^\/|\/$/g, '')

      // A bare "open Portal" link means sign-up to a guest and the account
      // to a member.
      const panel = path
        ? portalPanels[path]
        : ['signup', 'account'].find(hasPanel)

      if (!panel || !hasPanel(panel)) return

      event.preventDefault()
      event.stopPropagation()

      if (isOpen()) setPanel(panel)
      else setOpen(true, true, false, panel)
    }, true)

    // One card at a time: opening search closes the sheet.
    document.querySelectorAll('[data-ghost-search], [data-search-open]').forEach(trigger => {
      trigger.addEventListener('click', () => {
        if (isOpen()) setOpen(false, false)
      })
    })

    sheet.addEventListener('click', event => {
      const panelOpener = event.target.closest('[data-mobile-navigation-panel-open]')

      if (panelOpener) {
        setPanel(panelOpener.dataset.mobileNavigationPanelOpen)
      } else if (event.target.closest('[data-mobile-navigation-back]')) {
        const current = panels.find(item => !item.hidden)
        setPanel(current.dataset.parent || 'menu')
      } else if (event.target.closest('a[href]')) {
        setOpen(false, false)
      }
    })

    document.addEventListener('keydown', event => {
      if (!isOpen()) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const focusable = focusableElements()
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && (
        document.activeElement === first ||
        document.activeElement === sheet
      )) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    })

    // Hidden while the page scrolls down and back as soon as it scrolls up.
    // Near the end of a page it fades in step with the scroll, so it is fully
    // there at the end without a jump, however the iOS bounce plays out.
    const updateTabBarVisibility = () => {
      scrollFrame = undefined

      // iOS rubber-banding past the top gives a negative scrollY; past the
      // end a negative distance, which clamps to fully revealed.
      const currentScrollY = Math.max(window.scrollY, 0)
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const left = scrollable - window.scrollY
      const reveal = scrollable < minHideScroll
        ? 1
        : Math.min(Math.max(1 - left / endFade, 0), 1)

      tabBar.style.setProperty('--mobile-tab-reveal', String(reveal))
      tabBar.toggleAttribute('data-near-end', reveal > 0)

      if (currentScrollY < 80 || reveal >= 1) {
        setTabBarHidden(false)
      } else if (currentScrollY - lastScrollY > 8) {
        setTabBarHidden(true)
      } else if (lastScrollY - currentScrollY > 8) {
        setTabBarHidden(false)
      } else {
        return
      }

      lastScrollY = currentScrollY
    }

    window.addEventListener('scroll', () => {
      if (scrollFrame) return
      scrollFrame = window.requestAnimationFrame(updateTabBarVisibility)
    }, { passive: true })

    updateTabBarVisibility()

    // The tapped tab gets the pill right away instead of waiting for the next
    // page. Cleared when the page comes back from the back/forward cache.
    const setPendingTab = pendingTab => {
      tabs.forEach(tab => tab.toggleAttribute('data-pending', tab === pendingTab))
      tabBar.toggleAttribute('data-pending', Boolean(pendingTab))

      if (pendingTab) {
        tabBar.style.setProperty('--mobile-tab-index', tabs.indexOf(pendingTab))
      } else {
        tabBar.style.removeProperty('--mobile-tab-index')
      }
    }

    tabs.forEach(tab => {
      if (tab.tagName !== 'A' || tab.getAttribute('role') === 'button') return

      tab.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return
        setPendingTab(tab)
      })
    })

    window.addEventListener('pageshow', () => setPendingTab())

    navigation.addEventListener('focusin', () => setTabBarHidden(false))

    // The card sits in a different place on each side of the breakpoint.
    desktopMedia.addEventListener('change', () => {
      if (isOpen()) setOpen(false, false)
    })

    if (notesLink && (
      documentBody.classList.contains('is-notes') ||
      documentBody.classList.contains('is-note')
    )) {
      notesLink.setAttribute('aria-current', 'page')
    }
  }

  mobileNavigation()

  /* Remove focus from buttons after click
  /* ---------------------------------------------------------- */
  const removeButtonFocus = () => {
    const buttons = docSelectorAll('.button, button, a.button')

    if (!buttons.length) return

    buttons.forEach(button => {
      button.addEventListener('mousedown', function (e) {
        // Prevent default focus on mousedown
        if (e.button === 0) { // Left mouse button
          this.blur()
        }
      })

      button.addEventListener('click', function () {
        // Remove focus after click
        setTimeout(() => this.blur(), 0)
      })
    })
  }

  removeButtonFocus()

  /* Notes galleries
  /* ---------------------------------------------------------- */
  const notesGalleries = () => {
    const notesFeed = document.querySelector('.notes-feed')
    if (!notesFeed) return

    const galleryZoom = mediumZoom({
      margin: 20,
      background: 'hsla(0,0%,100%,.85)'
    })

    const updateNote = note => {
      const source = note.querySelector('[data-note-gallery-source]')
      const target = note.querySelector('[data-note-gallery]')
      if (!source || !target) return

      const galleries = source.content.querySelectorAll('.kg-gallery-card')

      if (galleries.length) {
        galleries.forEach(gallery => target.appendChild(gallery.cloneNode(true)))
        note.classList.add('has-gallery')
        initGalleryCards(target)
        galleryZoom.attach(target.querySelectorAll('img'))
      }

      source.remove()
    }

    const updateNotes = () => {
      notesFeed.querySelectorAll('.story-note').forEach(updateNote)
    }

    updateNotes()

    const notesObserver = new MutationObserver(updateNotes)
    notesObserver.observe(notesFeed, { childList: true })
  }

  notesGalleries()

  /* Notes card navigation
  /* ---------------------------------------------------------- */
  const notesCardNavigation = () => {
    const notesFeed = document.querySelector('.notes-feed')
    if (!notesFeed) return

    notesFeed.addEventListener('click', event => {
      const note = event.target.closest('[data-note-url]')
      const interactiveTarget = event.target.closest(
        'a, button, input, select, textarea, [data-note-gallery]'
      )

      if (!note || interactiveTarget || event.defaultPrevented) return
      if (window.getSelection && window.getSelection().toString()) return

      if (window.simplyStartNavigation) window.simplyStartNavigation()
      window.location.assign(note.dataset.noteUrl)
    })
  }

  notesCardNavigation()

  /* Notes months
  /* ---------------------------------------------------------- */
  // A heading opens each month of the feed in place of rules between notes.
  // Infinite scroll appends notes, so this runs on every change to the feed
  // and only adds the headings that are missing.
  const notesMonths = () => {
    const notesFeed = document.querySelector('.notes-feed')
    if (!notesFeed) return

    const currentYear = String(new Date().getFullYear())
    const monthName = new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
      month: 'long',
      timeZone: 'UTC'
    })

    const updateMonths = () => {
      let previousMonth = null

      notesFeed.querySelectorAll('.story-note').forEach(note => {
        const time = note.querySelector('time[datetime]')
        if (!time) return

        const month = time.getAttribute('datetime').slice(0, 7)
        const before = note.previousElementSibling
        const hasHeading = before && before.classList.contains('notes-month')

        if (month !== previousMonth && !hasHeading) {
          const [year, monthNumber] = month.split('-')
          const heading = document.createElement('h2')

          heading.className = 'notes-month'
          heading.textContent = monthName.format(new Date(Date.UTC(year, monthNumber - 1, 1))) +
            (year === currentYear ? '' : ` ${year}`)
          notesFeed.insertBefore(heading, note)
        }

        previousMonth = month
      })

      notesFeed.classList.add('has-months')
    }

    updateMonths()

    const monthsObserver = new MutationObserver(updateMonths)
    monthsObserver.observe(notesFeed, { childList: true })
  }

  notesMonths()

  /* Notes topic filter
  /* ---------------------------------------------------------- */
  // On a phone the topics are one row that scrolls sideways: bring the
  // current topic into view when it starts out past the edge.
  const notesTopicFilter = () => {
    const filter = document.querySelector('[data-notes-topic-filter]')
    const active = filter && filter.querySelector('.is-active')
    if (!active) return

    active.setAttribute('aria-current', 'page')

    const filterRect = filter.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()

    if (activeRect.right > filterRect.right - 40) {
      filter.scrollLeft += activeRect.left - filterRect.left - (filterRect.width - activeRect.width) / 2
    }
  }

  notesTopicFilter()

  /* Notes carousel
  /* ---------------------------------------------------------- */
  const notesCarousels = () => {
    document.querySelectorAll('[data-notes-carousel]').forEach(carouselRoot => {
      const carousel = carouselRoot.querySelector('[data-notes-carousel-track]')
      const items = Array.from(carouselRoot.querySelectorAll('[data-notes-carousel-item]'))
      const pagination = carouselRoot.querySelector('[data-notes-carousel-pagination]')
      const previousButton = carouselRoot.querySelector('.js-notes-carousel-prev')
      const nextButton = carouselRoot.querySelector('.js-notes-carousel-next')

      initHorizontalCarousel({
        carousel,
        items,
        pagination,
        dotClassName: 'notes-carousel-pagination-dot',
        previousButton,
        nextButton
      })
    })
  }

  notesCarousels()

  /* Related articles carousel
  /* ---------------------------------------------------------- */
  const relatedArticlesCarousels = () => {
    document.querySelectorAll('[data-related-articles-carousel]').forEach(carouselRoot => {
      const carousel = carouselRoot.querySelector('[data-related-articles-track]')
      const items = Array.from(carouselRoot.querySelectorAll('[data-related-articles-item]'))
      const pagination = carouselRoot.querySelector('[data-related-articles-pagination]')

      initHorizontalCarousel({
        carousel,
        items,
        pagination,
        dotClassName: 'related-carousel-pagination-dot'
      })
    })
  }

  relatedArticlesCarousels()

  /* Search
  /* ---------------------------------------------------------- */
  initSearch()
}

document.addEventListener('DOMContentLoaded', simplySetup)
