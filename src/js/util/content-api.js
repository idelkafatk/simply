// Ghost prints the site's public, read-only Content API key and URL on the
// Portal script tag. Returns null when members (and so Portal) are off.
export const contentApiUrl = (resource, params = {}) => {
  const script = document.querySelector('script[data-ghost][data-key][data-api]')
  if (!script) return null

  const query = new URLSearchParams({ ...params, key: script.dataset.key })

  return `${script.dataset.api.replace(/\/$/, '')}/${resource}/?${query}`
}
