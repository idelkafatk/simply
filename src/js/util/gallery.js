import { initHorizontalCarousel } from './horizontal-carousel'

const setGalleryImageSizes = root => {
  root.querySelectorAll('.kg-gallery-image > img').forEach(image => {
    const container = image.closest('.kg-gallery-image')
    const width = Number(image.getAttribute('width'))
    const height = Number(image.getAttribute('height'))
    const galleryHeight = image.closest('.story-note-gallery') ? 20 : 25

    if (!container || !width || !height) return

    container.style.setProperty('--gallery-image-width', `${galleryHeight * width / height}rem`)
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

export const initGalleryCards = root => {
  setGalleryImageSizes(root)
  initGalleryPagination(root)
}
