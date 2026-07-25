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
    if (gallery.dataset.galleryInitialized === 'true') return

    gallery.dataset.galleryInitialized = 'true'

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
      const galleryRect = gallery.getBoundingClientRect()
      let greatestVisibility = -1
      let visibleIndex = 0

      images.forEach((image, index) => {
        const imageRect = image.getBoundingClientRect()
        const visibleWidth = Math.max(
          0,
          Math.min(imageRect.right, galleryRect.right) -
            Math.max(imageRect.left, galleryRect.left)
        )
        const visibility = visibleWidth / Math.min(imageRect.width, galleryRect.width)

        if (visibility > greatestVisibility) {
          greatestVisibility = visibility
          visibleIndex = index
        }
      })

      const hasOverflow = gallery.scrollWidth > gallery.clientWidth + 1
      const remainingScroll = gallery.scrollWidth - gallery.clientWidth - gallery.scrollLeft

      if (!hasOverflow || gallery.scrollLeft <= 1) {
        visibleIndex = 0
      } else if (remainingScroll <= 1) {
        visibleIndex = images.length - 1
      }

      if (visibleIndex !== activeIndex) {
        if (activeIndex >= 0) dots[activeIndex].classList.remove('is-active')

        activeIndex = visibleIndex
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

const initGalleryDrag = root => {
  root.querySelectorAll('.story-note-gallery .kg-gallery-container').forEach(gallery => {
    if (gallery.dataset.galleryDragInitialized === 'true') return

    gallery.dataset.galleryDragInitialized = 'true'

    let pointerId
    let startX = 0
    let startScrollLeft = 0
    let isDragging = false
    let suppressClick = false

    const finishDrag = () => {
      if (pointerId === undefined) return

      if (gallery.hasPointerCapture(pointerId)) {
        gallery.releasePointerCapture(pointerId)
      }

      suppressClick = isDragging
      pointerId = undefined
      isDragging = false
      gallery.classList.remove('is-dragging')

      window.setTimeout(() => {
        suppressClick = false
      }, 0)
    }

    gallery.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return

      pointerId = event.pointerId
      startX = event.clientX
      startScrollLeft = gallery.scrollLeft
    })

    gallery.addEventListener('pointermove', event => {
      if (event.pointerId !== pointerId) return

      const distance = event.clientX - startX

      if (!isDragging && Math.abs(distance) < 5) return

      if (!isDragging) {
        gallery.setPointerCapture(pointerId)
      }

      isDragging = true
      gallery.classList.add('is-dragging')
      gallery.scrollLeft = startScrollLeft - distance
      event.preventDefault()
    })

    gallery.addEventListener('pointerup', finishDrag)
    gallery.addEventListener('pointercancel', finishDrag)
    gallery.addEventListener('dragstart', event => event.preventDefault())
    gallery.addEventListener('click', event => {
      if (!suppressClick) return

      event.preventDefault()
      event.stopImmediatePropagation()
    }, true)
  })
}

export const initGalleryCards = root => {
  setGalleryImageSizes(root)
  initGalleryPagination(root)
  initGalleryDrag(root)
}
