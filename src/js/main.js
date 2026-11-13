/* Site-wide behaviour of the redesign. Pages are rendered by Ghost; this only
   enhances them: the sticky post bar, theme toggle and themed images, Ghost
   comments colours, share, search and the subscribe dialog. */

import './navigation'

import docSelectorAll from './util/document-query-selector-all'
import { initShareLink } from './util/share-link'
import { initSearch } from './search'
import { initSubscribe } from './subscribe'
import { initGhostFrames } from './ghost-frames'

const simplySetup = () => {
  const rootEl = document.documentElement
  const documentBody = document.body

  /* Ghost's Portal and comments frames
  /* ---------------------------------------------------------- */
  // The blog's look inside Ghost's own iframes (src/js/ghost-frames.js).
  initGhostFrames()

  /* Share / copy link
  /* ---------------------------------------------------------- */
  // Bound first: it only needs a delegated document listener, so it stays
  // working even if a later block below throws on some template.
  initShareLink()

  /* Post bar
  /* ---------------------------------------------------------- */
  // On a post the bar sticks: it hides while reading down, comes back on any
  // scroll up, and once the page has moved it casts a soft shadow instead of a
  // divider. On lists it simply scrolls away with the page (CSS).
  const stickyBar = () => {
    const bar = document.querySelector('[data-bar]')
    if (!bar || !documentBody.classList.contains('is-post')) return

    let lastY = Math.max(window.scrollY, 0)
    let frame

    const update = () => {
      frame = undefined
      const y = Math.max(window.scrollY, 0)

      bar.classList.toggle('is-lifted', y > 8)
      if (Math.abs(y - lastY) < 6) return

      bar.classList.toggle('is-hidden', y > lastY && y > 120 && !bar.contains(document.activeElement))
      lastY = y
    }

    window.addEventListener('scroll', () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }, { passive: true })

    bar.addEventListener('focusin', () => bar.classList.remove('is-hidden'))
    update()
  }

  stickyBar()

  /* Dark Mode
  /* ---------------------------------------------------------- */
  // The icon shows the theme the button switches to.
  const updateThemeIcons = () => {
    docSelectorAll('.js-dark-mode').forEach(button => {
      const moonIcon = button.querySelector('.icon--moon')
      const sunnyIcon = button.querySelector('.icon--sunny')

      if (!moonIcon || !sunnyIcon) return

      const isDark = rootEl.classList.contains('dark')
      moonIcon.classList.toggle('hidden', isDark)
      sunnyIcon.classList.toggle('hidden', !isDark)
    })
  }

  // The first comments scheme is set by the inline script next to {{comments}},
  // which runs before the deferred comments-ui bundle. This only follows later
  // toggles: the bundle watches its script tag's attributes.
  const updateCommentsTheme = () => {
    const commentsTheme = rootEl.classList.contains('dark') ? 'dark' : 'light'

    docSelectorAll('script[data-ghost-comments]').forEach(script => {
      if (script.dataset.colorScheme !== commentsTheme) {
        script.dataset.colorScheme = commentsTheme
      }
    })
  }

  // comments-ui renders into a srcdoc iframe whose document is transparent, so
  // Chrome paints the frame canvas opaque white, which shows under light text
  // in the dark theme. CSS cannot reach it; writing the panel colour into the
  // frame's document (same origin) can.
  const paintCommentsFrame = () => {
    const panel = document.querySelector('.post-comments')
    if (!panel) return

    const frame = panel.querySelector('iframe[title="comments-frame"]')
    if (!frame || !frame.contentDocument) return

    frame.contentDocument.documentElement.style.backgroundColor =
      window.getComputedStyle(documentBody).backgroundColor
  }

  const watchCommentsFrame = () => {
    const panel = document.querySelector('.post-comments')
    if (!panel) return

    // The widget mounts lazily and can re-create its frame on re-render.
    const frameObserver = new window.MutationObserver(() => {
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
    updateThemeIcons()
    updateCommentsTheme()
    paintCommentsFrame()

    docSelectorAll('.js-dark-mode').forEach(item => item.addEventListener('click', event => {
      event.preventDefault()
      window.simplySetTheme(rootEl.classList.contains('dark') ? 'light' : 'dark')
    }))
  }

  // A picture drawn in two versions follows the theme: upload "name-light.jpg" as
  // the image and "name-dark.jpg" next to it (it needn't be in any post; Ghost makes
  // the sizes on request), and in the dark theme every src and srcset swaps the
  // suffix. With no dark version on the server the light one comes back.
  const themedImages = root => {
    const dark = rootEl.classList.contains('dark')
    const from = dark ? '-light.' : '-dark.'
    const to = dark ? '-dark.' : '-light.'

    root.querySelectorAll('img[src*="-light."], img[src*="-dark."]').forEach(img => {
      if (img.dataset.themedFailed || !img.src.includes(from)) return

      if (dark && !img.dataset.themedWatched) {
        img.dataset.themedWatched = 'true'
        img.addEventListener('error', () => {
          if (!img.src.includes('-dark.')) return
          img.dataset.themedFailed = 'true'
          img.srcset = img.srcset.split('-dark.').join('-light.')
          img.src = img.src.split('-dark.').join('-light.')
        })
      }

      if (img.srcset) img.srcset = img.srcset.split(from).join(to)
      img.src = img.src.split(from).join(to)
    })
  }

  darkMode()
  watchCommentsFrame()
  themedImages(document)

  // Rows that pagination and search add later
  new window.MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === 1) themedImages(node.tagName === 'IMG' ? node.parentNode || node : node)
  }))).observe(document.body, { childList: true, subtree: true })

  // Theme changes, from the toggle or the system preference
  new window.MutationObserver(() => {
    updateThemeIcons()
    updateCommentsTheme()
    paintCommentsFrame()
    themedImages(document)
  }).observe(rootEl, { attributes: true, attributeFilter: ['class'] })

  /* Search and subscribe
  /* ---------------------------------------------------------- */
  initSearch()
  initSubscribe()
}

document.addEventListener('DOMContentLoaded', simplySetup)
