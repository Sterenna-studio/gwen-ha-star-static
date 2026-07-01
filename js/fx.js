/**
 * fx.js — Gwen Ha Star shared visual effects helper
 * Provides: initCursorGlow(), glitchOnce(el), bootPanels(selector, stagger)
 */

/* ── Cursor glow dot ───────────────────────────────────────────────────── */
export function initCursorGlow() {
  const dot = document.createElement('div')
  dot.id = 'cursor-dot'
  document.body.appendChild(dot)
  document.addEventListener('mousemove', e => {
    dot.style.left = e.clientX + 'px'
    dot.style.top  = e.clientY + 'px'
  })
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0' })
  document.addEventListener('mouseenter', () => { dot.style.opacity = '1' })
}

/* ── One-shot glitch on any element ────────────────────────────────────── */
export function glitchOnce(el, duration = 400) {
  el.classList.add('glitch-hover')
  el.dispatchEvent(new MouseEvent('mouseenter'))
  setTimeout(() => el.classList.remove('glitch-hover'), duration)
}

/* ── Staggered panel boot ───────────────────────────────────────────────── */
/**
 * bootPanels(selector, stagger)
 * Adds .panel-boot to each matched element with increasing --panel-delay.
 * @param {string} selector  CSS selector for panels
 * @param {number} stagger   Delay increment in ms between panels (default 80)
 */
export function bootPanels(selector = '.panel-boot', stagger = 80) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.style.setProperty('--panel-delay', (i * stagger) + 'ms')
    el.classList.add('panel-boot')
  })
}

/* ── Random flicker trigger (call once on init) ─────────────────────────── */
/**
 * initFlickers(selector)
 * Assigns random --flicker-delay to .panel-flicker elements so they
 * don't all blink in sync.
 */
export function initFlickers(selector = '.panel-flicker') {
  document.querySelectorAll(selector).forEach(el => {
    const delay = (2 + Math.random() * 10).toFixed(1) + 's'
    el.style.setProperty('--flicker-delay', delay)
  })
}
