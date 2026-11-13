/* Ghost frames
/* ----------------------------------------------------------
   Portal (signup, signin, account, notifications) and comments-ui render
   into same-origin iframes, out of reach of the page's CSS. This puts the
   theme's styles into them: the Golos Text font, and the built ghost-portal.css or
   ghost-comments.css as a <style> at the end of the frame's head (the URLs
   come from <link data-ghost-frame-css> in the templates). It also mirrors
   the site's .dark onto the frame's <html> as .simply-dark.

   Ghost creates these frames lazily and re-creates them (Portal mounts a new
   popup frame on every open), so a MutationObserver plus each frame's load
   event find them; a document is styled once. If anything here fails the
   frames simply keep Ghost's own look.
/* ---------------------------------------------------------- */

const FRAMES = {
  'portal-popup': 'portal',
  'portal-notification': 'portal',
  'comments-frame': 'comments',
  // comments-ui opens its dialogs in a full-screen frame titled by the popup type
  addDetailsPopup: 'comments',
  reportPopup: 'comments',
  ctaPopup: 'comments',
  deletePopup: 'comments'
}

const STYLE_ID = 'simply-frame-css'
const FONT_ID = 'simply-frame-font'

const rootEl = document.documentElement
const cssText = {}

const isDark = () => rootEl.classList.contains('dark')

const frameKind = frame => FRAMES[frame.getAttribute('title')]

const frameDocument = frame => {
  try {
    const doc = frame.contentDocument
    return doc && doc.head && doc.documentElement ? doc : null
  } catch (error) {
    return null // not same-origin after all: leave it alone
  }
}

const frameList = () => Array.from(document.querySelectorAll(
  Object.keys(FRAMES).map(title => `iframe[title="${title}"]`).join(',')
))

const syncTheme = doc => doc.documentElement.classList.toggle('simply-dark', isDark())

// comments-ui dialogs live in a full-screen frame over the page: it must stay transparent
const POPUP_TITLES = ['addDetailsPopup', 'reportPopup', 'ctaPopup', 'deletePopup']
const markPopup = (frame, doc) => {
  if (!POPUP_TITLES.includes(frame.getAttribute('title'))) return
  if (doc.documentElement.classList.contains('simply-comments-popup')) return
  doc.documentElement.classList.add('simply-comments-popup')

  // «Сохранить» in the profile dialog has no busy state of its own: show the
  // dots until the dialog closes (it closes on success). With an empty name
  // Ghost answers at once with an error, so no dots then; if the save fails
  // the dialog stays open and the button comes back after a few seconds.
  doc.addEventListener('click', event => {
    const button = event.target.closest && event.target.closest('[data-testid="save-button"]')
    if (!button) return
    const name = doc.querySelector('[data-testid="name-input"]')
    if (name && !name.value.trim()) return
    button.classList.add('simply-busy')
    window.setTimeout(() => button.classList.remove('simply-busy'), 8000)
  }, true)
}

// Portal and comments-ui add their own <style> to the head while mounting;
// ours has to stay after it to win at equal specificity.
const keepLast = (doc, style) => {
  if (doc.head.lastElementChild !== style) doc.head.appendChild(style)
}

const styleDocument = frame => {
  const doc = frameDocument(frame)
  const css = cssText[frameKind(frame)]
  if (!doc) return

  syncTheme(doc)
  markPopup(frame, doc)
  if (!css) return

  let style = doc.getElementById(STYLE_ID)
  if (style) return keepLast(doc, style)

  const font = document.querySelector('link[href*="fonts.googleapis.com"][href*="Golos"]')
  if (font && !doc.getElementById(FONT_ID)) {
    const link = doc.createElement('link')
    link.id = FONT_ID
    link.rel = 'stylesheet'
    link.href = font.href
    doc.head.appendChild(link)
  }

  style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  doc.head.appendChild(style)

  new window.MutationObserver(() => keepLast(doc, style)).observe(doc.head, { childList: true })
}

const watchFrame = frame => {
  if (frame.dataset.simplyFrame) return
  frame.dataset.simplyFrame = 'true'

  // srcdoc and about:blank frames swap their document on load
  frame.addEventListener('load', () => styleDocument(frame))
  styleDocument(frame)
}

const scan = () => frameList().forEach(watchFrame)

const loadCss = () => Array.from(document.querySelectorAll('link[data-ghost-frame-css]')).map(link => {
  const kind = link.dataset.ghostFrameCss

  return window.fetch(link.href, { credentials: 'same-origin' })
    .then(response => {
      if (!response.ok) throw new Error(`${link.href} responded ${response.status}`)
      return response.text()
    })
    .then(text => {
      cssText[kind] = text
      frameList().filter(frame => frameKind(frame) === kind).forEach(styleDocument)
    })
    .catch(() => {}) // Ghost's default look stays
})

export const initGhostFrames = () => {
  if (!('MutationObserver' in window) || !window.fetch) return

  loadCss()
  scan()

  new window.MutationObserver(scan).observe(document.body, { childList: true, subtree: true })

  // the theme toggle and the system theme
  new window.MutationObserver(() => frameList().forEach(frame => {
    const doc = frameDocument(frame)
    if (doc) syncTheme(doc)
  })).observe(rootEl, { attributes: true, attributeFilter: ['class'] })
}
