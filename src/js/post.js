/* global prismJs */

import './main'

import mediumZoom from 'medium-zoom'

import loadScript from './util/load-script'
import docSelectorAll from './util/document-query-selector-all'

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
  const setGalleryImageSizes = () => {
    docSelectorAll('.kg-gallery-image > img').forEach(image => {
      const container = image.closest('.kg-gallery-image')
      const width = Number(image.getAttribute('width'))
      const height = Number(image.getAttribute('height'))

      if (!container || !width || !height) return

      container.style.setProperty('--gallery-image-width', `${25 * width / height}rem`)
    })
  }

  setGalleryImageSizes()

  const initGalleryPagination = () => {
    docSelectorAll('.kg-gallery-container').forEach(gallery => {
      const images = Array.from(gallery.querySelectorAll('.kg-gallery-image'))

      if (images.length < 2) return

      const pagination = document.createElement('div')
      const dots = images.map(() => {
        const dot = document.createElement('span')

        dot.className = 'kg-gallery-pagination-dot'
        dot.setAttribute('aria-hidden', 'true')
        pagination.appendChild(dot)

        return dot
      })
      let activeIndex = -1
      let animationFrame

      pagination.className = 'kg-gallery-pagination'
      pagination.setAttribute('aria-live', 'polite')
      pagination.setAttribute('role', 'status')
      gallery.insertAdjacentElement('afterend', pagination)

      const updatePagination = () => {
        const galleryLeft = gallery.getBoundingClientRect().left
        let closestDistance = Infinity
        let closestIndex = 0

        images.forEach((image, index) => {
          const distance = Math.abs(image.getBoundingClientRect().left - galleryLeft)

          if (distance < closestDistance) {
            closestDistance = distance
            closestIndex = index
          }
        })

        if (closestIndex !== activeIndex) {
          if (activeIndex >= 0) dots[activeIndex].classList.remove('is-active')

          activeIndex = closestIndex
          dots[activeIndex].classList.add('is-active')
          pagination.setAttribute('aria-label', `${activeIndex + 1} / ${images.length}`)
        }

        animationFrame = null
      }

      gallery.addEventListener('scroll', () => {
        if (animationFrame) return

        animationFrame = window.requestAnimationFrame(updatePagination)
      }, { passive: true })

      updatePagination()
    })
  }

  initGalleryPagination()

  /* highlight prismjs
  /* ---------------------------------------------------------- */
  if (docSelectorAll('code[class*=language-]').length && typeof prismJs !== 'undefined') {
    loadScript(prismJs)
  }
}

document.addEventListener('DOMContentLoaded', simplyPost)
