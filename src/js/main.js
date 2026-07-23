/* global followSocialMedia menuDropdown localStorage MutationObserver requestAnimationFrame */

// lib
import 'lazysizes'

// import loadScript from './util/load-script'
import urlRegexp from './util/url-regular-expression'
import docSelectorAll from './util/document-query-selector-all'

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

  const darkMode = () => {
    const $toggleDarkMode = docSelectorAll('.js-dark-mode')

    if (!$toggleDarkMode.length) return

    // Update icons on page load
    updateThemeIcons()

    $toggleDarkMode.forEach(item => item.addEventListener('click', function (event) {
      event.preventDefault()

      if (!rootEl.classList.contains('dark')) {
        rootEl.classList.add('dark')
        localStorage.theme = 'dark'
      } else {
        rootEl.classList.remove('dark')
        localStorage.theme = 'light'
      }

      // Update icons after theme change
      updateThemeIcons()
    }))
  }

  darkMode()

  // Watch for theme changes (e.g., from system preference)
  const observer = new MutationObserver(() => {
    updateThemeIcons()
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

  /* Toggle Menu
  /* ---------------------------------------------------------- */
  document.querySelector('.js-menu-toggle').addEventListener('click', function (e) {
    e.preventDefault()
    documentBody.classList.toggle('has-menu')
  })

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

  /* Notes inline ellipsis
  /* ---------------------------------------------------------- */
  const notesInlineEllipsis = () => {
    const notesFeed = document.querySelector('.notes-feed')
    if (!notesFeed) return

    const noteText = new WeakMap()

    const updateNote = note => {
      const noteBody = note.querySelector('.story-note-body')
      if (!noteBody) return

      if (!noteText.has(noteBody)) noteText.set(noteBody, noteBody.textContent.trim())

      const originalText = noteText.get(noteBody)
      const characters = Array.from(originalText)
      noteBody.classList.add('is-manual-clamp')
      noteBody.textContent = originalText

      if (noteBody.scrollHeight <= noteBody.clientHeight + 1) return

      let start = 0
      let end = characters.length

      while (start < end) {
        const middle = Math.ceil((start + end) / 2)
        noteBody.textContent = `${characters.slice(0, middle).join('').trimEnd()}...`

        if (noteBody.scrollHeight <= noteBody.clientHeight + 1) {
          start = middle
        } else {
          end = middle - 1
        }
      }

      noteBody.textContent = `${characters.slice(0, start).join('').trimEnd()}...`
    }

    const updateNotes = () => {
      notesFeed.querySelectorAll('.story-note').forEach(updateNote)
    }

    requestAnimationFrame(updateNotes)
    window.addEventListener('resize', updateNotes)
    if (document.fonts) document.fonts.ready.then(updateNotes)

    const notesObserver = new MutationObserver(updateNotes)
    notesObserver.observe(notesFeed, { childList: true })
  }

  notesInlineEllipsis()

  /* Mobile notes placement
  /* ---------------------------------------------------------- */
  const mobileNotesPlacement = () => {
    const notesWidget = document.querySelector('.js-mobile-notes-widget')
    const postFeed = document.querySelector('.js-feed-entry')
    if (!notesWidget || !postFeed) return

    const mobileViewport = window.matchMedia('(max-width: 999px)')

    const placeNotes = () => {
      if (!mobileViewport.matches) {
        notesWidget.classList.add('hidden')
        return
      }

      const visiblePosts = postFeed.querySelectorAll(':scope > .js-story')
      const targetPost = visiblePosts[2] || visiblePosts[visiblePosts.length - 1]
      if (!targetPost) return

      if (targetPost.nextElementSibling !== notesWidget) {
        targetPost.insertAdjacentElement('afterend', notesWidget)
      }

      notesWidget.classList.remove('hidden')
    }

    placeNotes()
    mobileViewport.addEventListener('change', placeNotes)

    const feedObserver = new MutationObserver(placeNotes)
    feedObserver.observe(postFeed, { childList: true })
  }

  mobileNotesPlacement()
}

document.addEventListener('DOMContentLoaded', simplySetup)
