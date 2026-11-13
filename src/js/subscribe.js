/* Subscribe
/* ----------------------------------------------------------
   The «Подписаться» dialog (a bottom sheet on phones) and the same block under
   a post. The forms are real Ghost member forms: Portal's script sends them
   and marks the form .loading / .success / .error. This module adds the
   address check before sending and turns Ghost's classes into the block's
   states — dots while sending, «Осталось подтвердить» — without changing its height. */

import { trackKeyboardInset } from './util/keyboard-inset'

const INVALID_EMAIL = 'Похоже, в адресе ошибка'
const SEND_FAILED = 'Не получилось отправить, ещё раз?'

const resetBox = box => {
  if (!box) return
  box.classList.remove('is-done')

  box.querySelectorAll('[data-subscribe-form]').forEach(form => {
    form.reset()
    form.classList.remove('is-invalid', 'loading', 'success', 'error')
    const error = form.querySelector('[data-subscribe-error]')
    if (error) error.textContent = ''
  })
}

const showError = (form, message) => {
  form.classList.add('is-invalid')
  form.querySelector('[data-subscribe-error]').textContent = message
}

const clearError = form => {
  form.classList.remove('is-invalid')
  form.querySelector('[data-subscribe-error]').textContent = ''
}

// Follows the classes Ghost puts on the form while sending it.
const watchForm = form => {
  const box = form.closest('.sub-box')
  const input = form.querySelector('[data-members-email]')
  const button = form.querySelector('[type="submit"]')

  const sync = () => {
    const sending = form.classList.contains('loading')

    button.disabled = sending
    button.classList.toggle('is-loading', sending) // the label hides and three dots pulse over it
    button.setAttribute('aria-busy', String(sending))

    if (form.classList.contains('success')) {
      form.classList.remove('success')
      box.querySelector('[data-subscribe-email]').textContent = input.value
      box.classList.add('is-done')
      const done = box.querySelector('[data-subscribe-close].m-close')
      if (done) done.focus({ preventScroll: true })
    } else if (form.classList.contains('error')) {
      form.classList.remove('error')
      showError(form, SEND_FAILED)
    }
  }

  new window.MutationObserver(sync).observe(form, { attributes: true, attributeFilter: ['class'] })
  input.addEventListener('input', () => clearError(form))
}

export const initSubscribe = () => {
  const root = document.documentElement
  const forms = Array.from(document.querySelectorAll('[data-subscribe-form]'))

  forms.forEach(watchForm)

  // Runs in the capture phase, before Portal's own listener on the form: a
  // wrong address never leaves the page.
  document.addEventListener('submit', event => {
    const form = event.target.closest && event.target.closest('[data-subscribe-form]')
    if (!form) return

    const input = form.querySelector('[data-members-email]')
    input.value = input.value.trim()

    if (!input.value || !input.checkValidity()) {
      event.preventDefault()
      event.stopImmediatePropagation()
      showError(form, INVALID_EMAIL)
      input.focus()
      return
    }

    clearError(form)
  }, true)

  const modal = document.querySelector('[data-subscribe-modal]')
  if (!modal) return

  const card = modal.querySelector('.sub-box')
  let returnFocus
  let closeTimer
  let stopKeyboardTracking = () => {}

  const isOpen = () => !modal.hidden && modal.classList.contains('is-open')

  const open = () => {
    if (isOpen()) return

    returnFocus = document.activeElement
    resetBox(card)
    window.clearTimeout(closeTimer)
    modal.hidden = false
    root.classList.add('has-modal')
    root.style.overflow = 'hidden'
    stopKeyboardTracking = trackKeyboardInset(modal, 'subscribe')
    window.requestAnimationFrame(() => modal.classList.add('is-open'))

    // With a real keyboard the field is ready at once. On a phone the sheet
    // opens with the keyboard down, the field is one tap away.
    if (window.matchMedia('(min-width: 641px)').matches) {
      modal.querySelector('[data-members-email]').focus({ preventScroll: true })
    } else {
      card.setAttribute('tabindex', '-1')
      card.focus({ preventScroll: true })
    }
  }

  const close = () => {
    if (!isOpen()) return

    modal.classList.remove('is-open')
    root.classList.remove('has-modal')
    root.style.overflow = ''
    stopKeyboardTracking()
    closeTimer = window.setTimeout(() => { modal.hidden = true }, 180)
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true })
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-subscribe-open]')) {
      event.preventDefault()
      open()
    }
  })

  // Links that would open Portal's sign-up (a members-only notice, an old
  // newsletter link) open this dialog instead. Capture phase, so Portal's own
  // handler on the link never runs.
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-portal="signup"], a[href="#/portal/signup"], a[href="#/portal/signup/"]')
    if (!link) return

    event.preventDefault()
    event.stopPropagation()
    open()
  }, true)

  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-subscribe-close]')) close()
  })

  document.addEventListener('keydown', event => {
    if (!isOpen()) return

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key !== 'Tab') return

    // keep Tab inside the dialog
    const focusable = Array.from(modal.querySelectorAll('button, input, a[href]'))
      .filter(element => element.getClientRects().length && !element.disabled &&
        window.getComputedStyle(element).visibility !== 'hidden')
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && (document.activeElement === first || document.activeElement === card)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
}
