const getVisibleItemIndex = (carousel, items) => {
  const carouselRect = carousel.getBoundingClientRect()
  let greatestVisibility = -1
  let visibleIndex = 0

  items.forEach((item, index) => {
    const itemRect = item.getBoundingClientRect()
    const visibleWidth = Math.max(
      0,
      Math.min(itemRect.right, carouselRect.right) -
        Math.max(itemRect.left, carouselRect.left)
    )
    const visibility = visibleWidth / Math.min(itemRect.width, carouselRect.width)

    if (visibility > greatestVisibility) {
      greatestVisibility = visibility
      visibleIndex = index
    }
  })

  const remainingScroll = carousel.scrollWidth - carousel.clientWidth - carousel.scrollLeft

  if (carousel.scrollLeft <= 1) return 0
  if (remainingScroll <= 1) return items.length - 1

  return visibleIndex
}

const initCarouselDrag = carousel => {
  let pointerId
  let startX = 0
  let startScrollLeft = 0
  let isDragging = false
  let suppressClick = false

  const finishDrag = () => {
    if (pointerId === undefined) return

    if (carousel.hasPointerCapture(pointerId)) {
      carousel.releasePointerCapture(pointerId)
    }

    suppressClick = isDragging
    pointerId = undefined
    isDragging = false
    carousel.classList.remove('is-dragging')

    window.setTimeout(() => {
      suppressClick = false
    }, 0)
  }

  carousel.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    if (carousel.scrollWidth <= carousel.clientWidth + 1) return

    pointerId = event.pointerId
    startX = event.clientX
    startScrollLeft = carousel.scrollLeft
  })

  carousel.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return

    const distance = event.clientX - startX

    if (!isDragging && Math.abs(distance) < 5) return

    if (!isDragging) {
      carousel.setPointerCapture(pointerId)
    }

    isDragging = true
    carousel.classList.add('is-dragging')
    carousel.scrollLeft = startScrollLeft - distance
    event.preventDefault()
  })

  carousel.addEventListener('pointerup', finishDrag)
  carousel.addEventListener('pointercancel', finishDrag)
  carousel.addEventListener('dragstart', event => {
    if (pointerId !== undefined) event.preventDefault()
  })
  carousel.addEventListener('click', event => {
    if (!suppressClick) return

    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
}

export const initHorizontalCarousel = ({
  carousel,
  items,
  pagination,
  dotClassName,
  previousButton,
  nextButton
}) => {
  if (!carousel || carousel.dataset.horizontalCarouselInitialized === 'true') return

  carousel.dataset.horizontalCarouselInitialized = 'true'

  if (items.length < 2) {
    if (pagination) pagination.hidden = true
    if (previousButton) previousButton.hidden = true
    if (nextButton) nextButton.hidden = true
    return
  }

  const dots = pagination
    ? items.map(() => {
      const dot = document.createElement('span')

      dot.className = dotClassName
      dot.setAttribute('aria-hidden', 'true')
      pagination.appendChild(dot)

      return dot
    })
    : []
  let activeIndex = -1
  let animationFrame

  const updateCarousel = () => {
    const hasOverflow = carousel.scrollWidth > carousel.clientWidth + 1
    const remainingScroll = carousel.scrollWidth - carousel.clientWidth - carousel.scrollLeft
    const visibleIndex = getVisibleItemIndex(carousel, items)

    if (visibleIndex !== activeIndex) {
      if (activeIndex >= 0 && dots.length) dots[activeIndex].classList.remove('is-active')

      activeIndex = visibleIndex

      if (dots.length) {
        dots[activeIndex].classList.add('is-active')
        pagination.setAttribute('aria-label', `${activeIndex + 1} / ${items.length}`)
      }
    }

    if (pagination) pagination.hidden = !hasOverflow

    if (previousButton) {
      previousButton.hidden = !hasOverflow
      previousButton.disabled = carousel.scrollLeft <= 1
    }

    if (nextButton) {
      nextButton.hidden = !hasOverflow
      nextButton.disabled = remainingScroll <= 1
    }

    animationFrame = null
  }

  const requestUpdate = () => {
    if (animationFrame) return

    animationFrame = window.requestAnimationFrame(updateCarousel)
  }

  const scrollByItem = direction => {
    const carouselStyles = window.getComputedStyle(carousel)
    const itemWidth = items[0].getBoundingClientRect().width
    const gap = Number.parseFloat(carouselStyles.columnGap || carouselStyles.gap) || 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    carousel.scrollBy({
      left: direction * (itemWidth + gap),
      behavior: reducedMotion ? 'auto' : 'smooth'
    })
  }

  carousel.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', requestUpdate)

  if (previousButton) {
    previousButton.addEventListener('click', () => scrollByItem(-1))
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => scrollByItem(1))
  }

  carousel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    scrollByItem(event.key === 'ArrowLeft' ? -1 : 1)
  })

  initCarouselDrag(carousel)
  updateCarousel()
}
