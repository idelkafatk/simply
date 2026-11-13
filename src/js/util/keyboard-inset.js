// iOS keeps position:fixed anchored to the layout viewport, so an open
// keyboard would otherwise sit on top of a bottom sheet. While the sheet is
// open this hands it the keyboard's height and the room left above it, as
// --<name>-keyboard-inset and --<name>-available-height on `element`, plus
// --<name>-viewport-top: how far the visible area has been panned down.
// While a keyboard is up `element` also gets [data-keyboard].
// Returns a function that stops the tracking.
export const trackKeyboardInset = (element, name) => {
  const viewport = window.visualViewport
  if (!viewport) return () => {}

  const sync = () => {
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)

    element.style.setProperty(`--${name}-keyboard-inset`, `${inset}px`)
    element.style.setProperty(`--${name}-available-height`, `${viewport.height - 32}px`)
    element.style.setProperty(`--${name}-viewport-top`, `${viewport.offsetTop}px`)
    element.toggleAttribute('data-keyboard', inset > 80)
  }

  sync()
  viewport.addEventListener('resize', sync)
  viewport.addEventListener('scroll', sync)

  return () => {
    element.removeAttribute('data-keyboard')
    viewport.removeEventListener('resize', sync)
    viewport.removeEventListener('scroll', sync)
  }
}
