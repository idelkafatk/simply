/* Member panels
/* ----------------------------------------------------------
   The Profile and Newsletter panels of the mobile sheet. They talk to Ghost's
   members API directly, with the same requests Portal sends, so a signed-in
   reader can change their name and subscriptions without leaving the card.
/* ---------------------------------------------------------- */

import { contentApiUrl } from './util/content-api'

const membersUrl = resource => `${window.location.origin}/members/api/${resource}/`

// The session cookie identifies the member. A signed-out GET answers 204.
const memberRequest = (method, body) => window.fetch(membersUrl('member'), {
  method,
  credentials: 'same-origin',
  headers: body ? { 'Content-Type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined
}).then(response => {
  if (!response.ok || response.status === 204) throw new Error(`Members API responded ${response.status}`)
  return response.json()
})

// Ghost mails a confirmation link to the new address and switches the account
// over only when it is opened. The request has to carry the member's identity
// token, which the session endpoint hands out.
const requestEmailChange = email => window.fetch(membersUrl('session'), { credentials: 'same-origin' })
  .then(response => {
    if (!response.ok || response.status === 204) throw new Error(`Members API responded ${response.status}`)
    return response.text()
  })
  .then(identity => window.fetch(membersUrl('member/email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, identity })
  }))
  .then(response => {
    if (!response.ok) throw new Error(`Members API responded ${response.status}`)
  })

const initProfile = sheet => {
  const form = sheet.querySelector('[data-member-profile]')
  if (!form) return

  const nameInput = form.querySelector('[data-member-name-input]')
  const emailInput = form.querySelector('[data-member-email-input]')
  const error = form.querySelector('[data-member-error]')
  const notice = form.querySelector('[data-member-notice]')
  const label = form.querySelector('[data-member-save]')
  const saveLabel = label.textContent
  let labelTimeout

  // The sheet resets its forms when it opens; the notice goes with them.
  form.addEventListener('reset', () => { notice.textContent = '' })

  form.addEventListener('submit', event => {
    event.preventDefault()
    if (form.classList.contains('loading')) return

    // The value attributes hold what is saved: form.reset() falls back to them.
    const name = nameInput.value.trim()
    const email = emailInput.value.trim()
    const nameChanged = name !== nameInput.getAttribute('value')
    const emailChanged = email !== emailInput.getAttribute('value')

    error.textContent = ''
    notice.textContent = ''
    form.classList.add('loading')

    Promise.all([
      nameChanged ? memberRequest('PUT', { name }) : null,
      emailChanged ? requestEmailChange(email) : null
    ])
      .then(([member]) => {
        if (member) {
          const savedName = member.name || ''

          nameInput.value = savedName
          nameInput.setAttribute('value', savedName)

          sheet.querySelectorAll('[data-member-name]').forEach(element => {
            element.textContent = savedName || element.dataset.fallback || ''
          })
        }

        if (emailChanged) notice.textContent = notice.dataset.message

        label.textContent = label.dataset.labelSaved
        window.clearTimeout(labelTimeout)
        labelTimeout = window.setTimeout(() => { label.textContent = saveLabel }, 2000)
      })
      .catch(() => { error.textContent = error.dataset.message })
      .finally(() => form.classList.remove('loading'))
  })
}

// What the Newsletter panel shows, kept for the browser session so the panel
// opens filled in on every page instead of loading again each time.
const SETTINGS_CACHE = 'simply-member-email-settings'

const readCache = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(SETTINGS_CACHE))
  } catch (error) {
    return null
  }
}

const writeCache = data => {
  try {
    if (data) window.sessionStorage.setItem(SETTINGS_CACHE, JSON.stringify(data))
    else window.sessionStorage.removeItem(SETTINGS_CACHE)
  } catch (error) {}
}

const contentRequest = (resource, params) => {
  const url = contentApiUrl(resource, params)
  if (!url) return Promise.reject(new Error('Content API is not available'))

  return window.fetch(url)
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Content API')))
}

// { newsletters: [{ id, name, description }], subscribed: [id], comments }
// `comments` is null when the site has comments off and there is no switch.
const fetchEmailSettings = () => Promise.all([
  memberRequest('GET'),
  contentRequest('newsletters', { limit: 'all' }),
  contentRequest('settings')
]).then(([member, content, site]) => {
  const commentsEnabled = Boolean(site.settings.comments_enabled) && site.settings.comments_enabled !== 'off'

  return {
    newsletters: (content.newsletters || []).map(({ id, name, description }) => ({ id, name, description })),
    subscribed: (member.newsletters || []).map(newsletter => newsletter.id),
    comments: commentsEnabled ? Boolean(member.enable_comment_notifications) : null
  }
})

const initNewsletters = sheet => {
  const list = sheet.querySelector('[data-member-newsletters]')

  // Signed out: nothing to show, and nothing of the last member's to keep.
  if (!list) {
    writeCache(null)
    return { prefetch: () => {}, show: () => {} }
  }

  const error = list.parentElement.querySelector('[data-member-error]')
  let data = readCache()
  let request
  let rendered = false
  let touched = false

  sheet.querySelectorAll('[data-members-signout]').forEach(link => {
    link.addEventListener('click', () => writeCache(null))
  })

  const setMessage = text => {
    const message = document.createElement('p')
    message.className = 'mobile-navigation-switches-message'
    message.textContent = text
    list.replaceChildren(message)
  }

  const inputs = () => Array.from(list.querySelectorAll('input'))

  // Every switch saves on change and flips back if the request fails.
  const save = (changed, body) => {
    touched = true
    error.textContent = ''
    inputs().forEach(input => { input.disabled = true })

    memberRequest('PUT', body)
      .then(() => {
        data.subscribed = inputs()
          .filter(input => input.dataset.newsletterId && input.checked)
          .map(input => input.dataset.newsletterId)

        if (data.comments !== null) data.comments = list.querySelector('[data-comments]').checked

        writeCache(data)
      })
      .catch(() => {
        changed.checked = !changed.checked
        error.textContent = list.dataset.messageSaveError
      })
      .finally(() => inputs().forEach(input => { input.disabled = false }))
  }

  const createSwitch = ({ name, hint, checked, onChange }) => {
    const row = document.createElement('label')
    const text = document.createElement('span')
    const title = document.createElement('strong')
    const description = document.createElement('span')
    const input = document.createElement('input')
    const track = document.createElement('span')

    title.textContent = name
    description.textContent = hint || ''

    row.className = 'mobile-navigation-switch'
    text.className = 'mobile-navigation-switch-text'
    text.append(title, description)

    input.type = 'checkbox'
    input.setAttribute('role', 'switch')
    input.checked = checked
    input.addEventListener('change', () => onChange(input))

    track.className = 'mobile-navigation-switch-track'
    track.setAttribute('aria-hidden', 'true')

    row.append(text, input, track)
    return row
  }

  const render = () => {
    const single = data.newsletters.length === 1

    const rows = data.newsletters.map(newsletter => {
      // A blog with one newsletter usually leaves it with a default name, so
      // the row says what the switch does instead.
      const row = createSwitch({
        name: single ? list.dataset.labelSingle : newsletter.name,
        hint: single ? list.dataset.hintSingle : newsletter.description,
        checked: data.subscribed.includes(newsletter.id),
        onChange: input => save(input, {
          newsletters: inputs()
            .filter(item => item.dataset.newsletterId && item.checked)
            .map(item => ({ id: item.dataset.newsletterId }))
        })
      })

      row.querySelector('input').dataset.newsletterId = newsletter.id
      return row
    })

    if (data.comments !== null) {
      const row = createSwitch({
        name: list.dataset.labelComments,
        hint: list.dataset.hintComments,
        checked: data.comments,
        onChange: input => save(input, { enable_comment_notifications: input.checked })
      })

      row.querySelector('input').dataset.comments = ''
      rows.push(row)
    }

    list.replaceChildren(...rows)
    rendered = true
  }

  // One request per page at most. It starts as soon as the account panel
  // opens, a step before this one (or by itself on a session's first page),
  // and what it brings is kept for the session.
  // When the panel is already showing remembered settings, fresh ones replace
  // them quietly, unless the reader has flipped a switch in the meantime.
  const refresh = () => {
    if (request) return request

    request = fetchEmailSettings()
      .then(fresh => {
        if (touched) return

        const changed = JSON.stringify(fresh) !== JSON.stringify(data)

        data = fresh
        writeCache(data)
        if (rendered && changed) render()
      })
      .catch(reason => {
        // A failed load is tried again the next time a panel asks.
        request = null
        throw reason
      })

    return request
  }

  // Nothing remembered yet (the first page of a session): fetch once the page
  // has settled, so even a first visit to the panel finds it filled in.
  if (!data) {
    const whenIdle = window.requestIdleCallback || (callback => window.setTimeout(callback, 1500))
    whenIdle(() => { refresh().catch(() => {}) })
  }

  return {
    prefetch: () => { refresh().catch(() => {}) },
    show: () => {
      error.textContent = ''

      if (data) render()
      else setMessage(list.dataset.messageLoading)

      refresh()
        .then(() => { if (!rendered) render() })
        .catch(() => { if (!rendered) setMessage(list.dataset.messageError) })
    }
  }
}

// Returns a callback for the sheet to call whenever it shows a panel.
export const initMemberPanels = sheet => {
  initProfile(sheet)

  const newsletters = initNewsletters(sheet)

  return panel => {
    if (panel === 'account') newsletters.prefetch()
    if (panel === 'newsletter') newsletters.show()
  }
}
