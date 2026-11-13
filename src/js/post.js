/* global prismJs */

import './main'

import mediumZoom from 'medium-zoom'

import loadScript from './util/load-script'
import docSelectorAll from './util/document-query-selector-all'
import { initGalleryCards } from './util/gallery'

const simplyPost = () => {
  /* «Обсудить»
  /* ---------------------------------------------------------- */
  // The Telegram bot writes the post's discussion link into its code injection
  // as [data-telegram-discussion-url]. When it is there, «Обсудить» opens that
  // discussion; otherwise it keeps the channel link from the theme settings.
  const telegramDiscussion = () => {
    const metadata = document.querySelector('[data-telegram-discussion-url]')
    const container = document.querySelector('[data-telegram-discussion]')
    const link = container && container.querySelector('[data-telegram-discussion-link]')

    if (!metadata || !container || !link) return

    try {
      const url = new URL(metadata.getAttribute('data-telegram-discussion-url'))
      if (url.protocol !== 'https:' || url.hostname !== 't.me') return

      link.href = url.toString()
      container.hidden = false
    } catch {
      // Invalid metadata leaves the channel link in place.
    }
  }

  telegramDiscussion()

  /* All Video Responsive
  /* ---------------------------------------------------------- */
  const videoResponsive = () => {
    const selectors = [
      'iframe[src*="player.vimeo.com"]',
      'iframe[src*="dailymotion.com"]',
      'iframe[src*="youtube.com"]',
      'iframe[src*="youtube-nocookie.com"]',
      'iframe[src*="player.twitch.tv"]',
      'iframe[src*="kickstarter.com"][src*="video.html"]'
    ]

    docSelectorAll(selectors.join(',')).forEach(el => {
      el.classList.add('aspect-video', 'w-full')
      el.removeAttribute('height')
      el.removeAttribute('width')
    })
  }

  videoResponsive()

  /* Gallery Card
  /* ---------------------------------------------------------- */
  // Before zoom, so pictures moved into a carousel are zoomable too.
  initGalleryCards(document)

  /* medium-zoom
  /* ---------------------------------------------------------- */
  // The overlay colour follows the theme through --zoom-bg (content.css).
  const mediumZoomImg = () => {
    docSelectorAll('.post-body img').forEach(el => !el.closest('a') && el.classList.add('simply-zoom'))

    mediumZoom('.simply-zoom', { margin: 20 })
  }

  mediumZoomImg()

  /* Plain videos play with the browser's own controls
  /* ---------------------------------------------------------- */
  docSelectorAll('.post-body .kg-video-card video').forEach(video => {
    video.controls = true
    video.removeAttribute('hidden')
  })

  /* highlight prismjs
  /* ---------------------------------------------------------- */
  if (docSelectorAll('code[class*=language-]').length && typeof prismJs !== 'undefined') {
    loadScript(prismJs)
  }
}

document.addEventListener('DOMContentLoaded', simplyPost)
