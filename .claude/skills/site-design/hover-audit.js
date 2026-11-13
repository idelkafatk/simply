// Paste into the page (javascript_tool / DevTools) on any idel.blog page.
// 1) audit(root?) lists every visible link/button/input and the :hover rule
//    that styles it; MISS = no own hover (generic `a:hover` does not count).
// 2) forceHover(true|false) copies every :hover rule to a .__h class and puts
//    it on all controls at once, so one screenshot shows every hover state.
//    Transitions are switched off so computed colours are final.
(() => {
  const hoverSelectors = () => {
    const out = []
    const walk = rules => {
      for (const r of rules) {
        if (r.cssRules && !r.selectorText) walk(r.cssRules)
        else if (r.selectorText && r.selectorText.includes(':hover')) {
          r.selectorText.split(',').filter(s => s.includes(':hover')).forEach(s => out.push(s.trim()))
        }
      }
    }
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules) } catch (e) {}
    }
    return out
  }

  const controls = root => [...(root || document).querySelectorAll('a,button,input,[role=button],summary')]
    .filter(e => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
    })

  window.audit = root => {
    const sels = hoverSelectors()
    const rows = controls(root).map(e => {
      const hit = sels.find(s => {
        const target = s.slice(0, s.indexOf(':hover')).replace(/:not\(:disabled\)$/, '')
        try { return target && !/^(a|button|\*)$/.test(target.trim()) && e.matches(target) } catch (x) { return false }
      })
      const name = (e.tagName + '.' + String(e.className || '').trim().replace(/\s+/g, '.')).slice(0, 45)
      const text = (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 22)
      return `${hit ? 'OK  ' : 'MISS'} ${name} «${text}» ${hit || ''}`
    })
    return [...new Set(rows)].sort().join('\n')
  }

  window.forceHover = on => {
    if (!document.getElementById('__hcss')) {
      let css = '*{transition:none!important}\n'
      const walk = (rules, media) => {
        for (const r of rules) {
          if (r.cssRules && !r.selectorText) walk(r.cssRules, r.conditionText ? `@media ${r.conditionText}` : media)
          else if (r.selectorText && r.selectorText.includes(':hover')) {
            const sel = r.selectorText.split(',').filter(s => s.includes(':hover')).map(s => s.replaceAll(':hover', '.__h')).join(',')
            const body = r.cssText.slice(r.cssText.indexOf('{'))
            css += media ? `${media}{${sel}${body}}\n` : `${sel}${body}\n`
          }
        }
      }
      for (const sheet of document.styleSheets) {
        try { walk(sheet.cssRules, null) } catch (e) {}
      }
      const style = document.createElement('style')
      style.id = '__hcss'
      style.textContent = css
      document.head.appendChild(style)
    }
    document.querySelectorAll('a,button,label,.tag,.act').forEach(e => e.classList.toggle('__h', on))
    return on ? 'hover on' : 'hover off'
  }

  return 'audit(root?) and forceHover(on) ready'
})()
