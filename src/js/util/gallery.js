import { initHorizontalCarousel } from './horizontal-carousel'

const isVideoCard = element => element && element.matches && element.matches('figure.kg-video-card')

// A gallery in Ghost holds only pictures. A video card placed right before or
// right after a gallery becomes one of its slides: the first or the last.
// The slide is a plain <video controls> rather than Ghost's player, because the
// notes feed copies galleries with cloneNode, which loses the player's script.
const createVideoSlide = card => {
  const source = card.querySelector('video')
  if (!source || !source.getAttribute('src')) return null

  const width = Number(source.getAttribute('width')) || 16
  const height = Number(source.getAttribute('height')) || 9
  const poster = card.getAttribute('data-kg-custom-thumbnail') || card.getAttribute('data-kg-thumbnail')
  const slide = document.createElement('div')
  const video = document.createElement('video')

  slide.className = 'kg-gallery-image kg-gallery-video'
  slide.style.flex = `${width / height} 1 0%`

  video.src = source.getAttribute('src')
  video.setAttribute('width', width)
  video.setAttribute('height', height)
  video.setAttribute('playsinline', '')
  video.setAttribute('preload', 'metadata')
  video.controls = true
  if (poster) video.poster = poster
  if (source.hasAttribute('loop')) {
    video.loop = true
    video.muted = true
    video.autoplay = true
    video.setAttribute('muted', '')
    video.setAttribute('autoplay', '')
  }

  slide.appendChild(video)
  return slide
}

const adjacentVideoCards = (gallery, direction) => {
  const cards = []
  let sibling = gallery[direction]

  while (isVideoCard(sibling)) {
    cards.push(sibling)
    sibling = sibling[direction]
  }

  return cards
}

export const mergeVideosIntoGalleries = root => {
  root.querySelectorAll('.kg-gallery-card').forEach(gallery => {
    const rows = gallery.querySelectorAll('.kg-gallery-row')
    if (!rows.length) return

    const firstRow = rows[0]
    const lastRow = rows[rows.length - 1]

    const videosBefore = adjacentVideoCards(gallery, 'previousElementSibling')

    videosBefore.forEach(card => {
      const slide = createVideoSlide(card)
      if (!slide) return
      firstRow.insertBefore(slide, firstRow.firstChild)
      card.remove()
    })

    // Scroll snapping keeps the slide it last snapped to, so a slide added in
    // front would open the carousel on the second item.
    const container = gallery.querySelector('.kg-gallery-container')
    if (videosBefore.length && container) container.scrollLeft = 0

    adjacentVideoCards(gallery, 'nextElementSibling').forEach(card => {
      const slide = createVideoSlide(card)
      if (!slide) return
      lastRow.appendChild(slide)
      card.remove()
    })
  })
}

const setGalleryImageSizes = root => {
  root.querySelectorAll('.kg-gallery-image > img, .kg-gallery-video > video').forEach(image => {
    const container = image.closest('.kg-gallery-image')
    const width = Number(image.getAttribute('width'))
    const height = Number(image.getAttribute('height'))
    const galleryHeight = image.closest('.story-note-gallery') ? 20 : 25

    if (!container || !width || !height) return

    container.style.setProperty('--gallery-image-width', `${galleryHeight * width / height}rem`)
    container.style.setProperty('--gallery-image-ratio', `${width} / ${height}`)

    if (height > width) {
      container.classList.add('is-portrait')
    }
  })

  root.querySelectorAll('.kg-gallery-row').forEach(row => {
    const images = Array.from(row.querySelectorAll('.kg-gallery-image'))

    if (images.length && images.every(image => image.classList.contains('is-portrait'))) {
      row.classList.add('is-portrait-row')
    }
  })
}

const initGalleryPagination = root => {
  root.querySelectorAll('.kg-gallery-container').forEach(gallery => {
    if (gallery.dataset.horizontalCarouselInitialized === 'true') return

    const images = Array.from(gallery.querySelectorAll('.kg-gallery-image'))
    if (images.length < 2) return

    const pagination = document.createElement('div')

    pagination.className = 'kg-gallery-pagination'
    pagination.setAttribute('aria-live', 'polite')
    pagination.setAttribute('role', 'status')
    gallery.insertAdjacentElement('afterend', pagination)

    initHorizontalCarousel({
      carousel: gallery,
      items: images,
      pagination,
      dotClassName: 'kg-gallery-pagination-dot'
    })
  })
}

// A video keeps playing with its sound after it slides out of view; pause it.
const pauseHiddenVideos = root => {
  if (!('IntersectionObserver' in window)) return

  root.querySelectorAll('.kg-gallery-video > video').forEach(video => {
    if (video.dataset.pauseWhenHidden === 'true' || video.loop) return
    video.dataset.pauseWhenHidden = 'true'

    new window.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && !video.paused) video.pause()
      })
    }, { threshold: 0.25 }).observe(video)
  })
}

export const initGalleryCards = root => {
  mergeVideosIntoGalleries(root)
  setGalleryImageSizes(root)
  pauseHiddenVideos(root)
  initGalleryPagination(root)
}
