/* global followSocialMedia menuDropdown MutationObserver */

import './navigation'

// lib
import mediumZoom from 'medium-zoom'

// import loadScript from './util/load-script'
import urlRegexp from './util/url-regular-expression'
import docSelectorAll from './util/document-query-selector-all'
import { initGalleryCards } from './util/gallery'
import { initHorizontalCarousel } from './util/horizontal-carousel'
import { initSearch } from './search'

const simplySetup = () => {
  const rootEl = document.documentElement
  const documentBody = document.body

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
    const desktopMedia = window.matchMedia('(min-width: 1000px)')
    let lastFocusedElement
    let lastScrollY = Math.max(window.scrollY, 0)
    let scrollFrame

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

    const setOpen = (open, restoreFocus = true, showKeyboardFocus = false) => {
      if (open) setTabBarHidden(false)
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
        const focusTarget = showKeyboardFocus ? closeButton : sheet
        window.requestAnimationFrame(() => focusTarget.focus())
      } else if (restoreFocus && lastFocusedElement) {
        lastFocusedElement.focus()
      }
    }

    const focusableElements = () => Array.from(sheet.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ))

    toggle.addEventListener('click', event => {
      setOpen(!isOpen(), true, event.detail === 0)
    })

    closeControls.forEach(control => {
      control.addEventListener('click', () => setOpen(false))
    })

    sheet.addEventListener('click', event => {
      if (event.target.closest('a[href]')) setOpen(false, false)
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

    const updateTabBarVisibility = () => {
      const currentScrollY = Math.max(window.scrollY, 0)
      const delta = currentScrollY - lastScrollY

      if (currentScrollY <= 64 || delta < -6) {
        setTabBarHidden(false)
      } else if (delta > 6 && currentScrollY > 96) {
        setTabBarHidden(true)
      }

      lastScrollY = currentScrollY
      scrollFrame = undefined
    }

    window.addEventListener('scroll', () => {
      if (scrollFrame) return
      scrollFrame = window.requestAnimationFrame(updateTabBarVisibility)
    }, { passive: true })

    navigation.addEventListener('focusin', () => setTabBarHidden(false))

    desktopMedia.addEventListener('change', event => {
      if (event.matches && isOpen()) setOpen(false, false)
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
