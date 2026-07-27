/* global prismJs */

import './main'

import mediumZoom from 'medium-zoom'

import loadScript from './util/load-script'
import docSelectorAll from './util/document-query-selector-all'
import { initGalleryCards } from './util/gallery'

const simplyPost = () => {
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

      const actions = container.closest('[data-publication-actions]')
      if (actions) actions.hidden = false
    } catch {
      // Invalid metadata leaves the discussion block hidden.
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

    const $iframes = docSelectorAll(selectors.join(','))

    if (!$iframes.length) return

    $iframes.forEach(el => {
      el.classList.add('aspect-video', 'w-full')
      // const parentForVideo = document.createElement('div')
      // parentForVideo.className = 'video-responsive'
      // el.parentNode.insertBefore(parentForVideo, el)
      // parentForVideo.appendChild(el)
      el.removeAttribute('height')
      el.removeAttribute('width')
    })
  }

  videoResponsive()

  /* medium-zoom
  /* ---------------------------------------------------------- */
  const mediumZoomImg = () => {
    docSelectorAll('.post-body img').forEach(el => !el.closest('a') && el.classList.add('simply-zoom'))

    mediumZoom('.simply-zoom', {
      margin: 20,
      background: 'hsla(0,0%,100%,.85)'
    })
  }

  mediumZoomImg()

  /* Gallery Card
  /* ---------------------------------------------------------- */
  initGalleryCards(document)

  /* highlight prismjs
  /* ---------------------------------------------------------- */
  if (docSelectorAll('code[class*=language-]').length && typeof prismJs !== 'undefined') {
    loadScript(prismJs)
  }
}

document.addEventListener('DOMContentLoaded', simplyPost)
