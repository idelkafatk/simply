const FEEDBACK_DURATION = 2000

const feedbackTimers = new WeakMap()
const idleCaptions = new WeakMap()

// Touch devices get the OS share sheet; a desktop share sheet is rarely useful.
const prefersNativeShare = () => typeof navigator.share === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

const copyWithTextarea = text => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  let copied = false

  try {
    copied = document.execCommand('copy')
  } catch (error) {
    copied = false
  }

  document.body.removeChild(textarea)
  return copied
}

// Safari only grants clipboard access within the gesture task, so this must stay
// synchronous up to the writeText() call — never await anything before it.
const copyToClipboard = text => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => {
      if (!copyWithTextarea(text)) throw new Error('Copy to clipboard failed')
    })
  }

  return copyWithTextarea(text)
    ? Promise.resolve()
    : Promise.reject(new Error('Copy to clipboard failed'))
}

const showCopied = button => {
  const text = button.querySelector('.share-link-text')

  if (!text) return

  window.clearTimeout(feedbackTimers.get(button))

  if (!idleCaptions.has(button)) idleCaptions.set(button, text.textContent)

  button.classList.add('is-copied')
  // The caption itself is the live region, so swapping it both shows and
  // announces the confirmation — no separate toast to keep in sync.
  text.textContent = button.dataset.messageCopied || idleCaptions.get(button)

  feedbackTimers.set(button, window.setTimeout(() => {
    button.classList.remove('is-copied')
    text.textContent = idleCaptions.get(button)
  }, FEEDBACK_DURATION))
}

const copyAndConfirm = (button, url) => {
  copyToClipboard(url)
    .then(() => showCopied(button))
    .catch(() => {})
}

export const initShareLink = () => {
  // Delegated so notes appended by infinite scroll are covered too.
  document.addEventListener('click', event => {
    const target = event.target

    if (!target || typeof target.closest !== 'function') return

    const button = target.closest('[data-share-link]')

    if (!button) return

    event.preventDefault()

    const url = button.dataset.shareUrl || window.location.href
    const title = button.dataset.shareTitle || document.title

    if (prefersNativeShare()) {
      navigator.share({ title, url }).catch(error => {
        // Dismissing the share sheet is a normal outcome, not a failure.
        if (error && error.name === 'AbortError') return
        copyAndConfirm(button, url)
      })
      return
    }

    copyAndConfirm(button, url)
  })
}
