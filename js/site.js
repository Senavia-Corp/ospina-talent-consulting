/* ============================================================================
   Ospina Talent Consulting — JS propio. Sin dependencias, sin build.
   Una sola cosa: el menu movil. El carrusel de testimonios se retiro al no
   quedar testimonios publicables; esta en la historia de git si vuelve.

   Lo que NO hay aqui, a proposito: revelado al hacer scroll. El contenido es
   visible siempre y su visibilidad no depende de JavaScript en ningun
   momento. El sitio anterior ocultaba 28 elementos con style="opacity:0" y
   los revelaba con un disparador SCROLL_INTO_VIEW que nunca llega a
   dispararse para lo que ya esta en pantalla. El unico momento animado es el
   de la portada y es CSS puro, anadido solo bajo prefers-reduced-motion:
   no-preference.
   ========================================================================== */
(() => {
  'use strict'

  /* ------------------------------------------------------------- menu movil */
  const btn = document.querySelector('[data-nav-toggle]')
  const panel = document.getElementById('site-nav')

  if (btn && panel) {
    const FOCUSABLE = 'a[href], button:not([disabled])'
    // El mismo umbral que components.css, y expresado igual: el complemento
    // exacto de min-width: 64rem. Con max-width: 63.99rem en el CSS y
    // min-width: 64rem aqui quedaria una franja sin navegacion de ningun tipo.
    const desktop = matchMedia('(min-width: 64rem)')
    let open = false

    // Mientras el panel cubre la pagina, lo de detras se marca inerte: sin
    // esto el lector de pantalla se pasea por el contenido tapado.
    const detras = [document.querySelector('.site-main'), document.querySelector('.site-footer')]
    const marcarInerte = () => {
      const tapando = open && !desktop.matches
      for (const el of detras) if (el) el.inert = tapando
      // inert bloquea interaccion y lector de pantalla, pero NO el scroll. Sin
      // esta linea el gesto sobre el panel encadenaba al documento de detras y
      // al cerrar el menu aparecias 1.200px mas abajo. El complemento en CSS es
      // overscroll-behavior: contain en .site-nav.
      document.documentElement.style.overflow = tapando ? 'hidden' : ''
    }

    const setOpen = (next) => {
      open = next
      btn.setAttribute('aria-expanded', String(open))
      if (open) {
        panel.removeAttribute('hidden')
        panel.querySelector(FOCUSABLE)?.focus()
      } else {
        panel.setAttribute('hidden', '')
      }
      marcarInerte()
    }

    // En escritorio el panel no es un overlay: siempre visible y sin estado.
    const sync = () => {
      if (desktop.matches) {
        panel.removeAttribute('hidden')
        btn.setAttribute('aria-expanded', 'false')
        open = false
      } else if (!open) {
        panel.setAttribute('hidden', '')
      }
      // Cruzar a escritorio con el panel abierto pasa por aqui, no por
      // setOpen: sin esta llamada el inert se quedaria puesto y la pagina,
      // muerta.
      marcarInerte()
    }

    btn.addEventListener('click', () => setOpen(!open))
    desktop.addEventListener('change', sync)

    document.addEventListener('keydown', (e) => {
      if (!open) return
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.focus(); return }
      if (e.key !== 'Tab') return
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    })

    // Navegar a un ancla de la propia pagina cierra el panel.
    panel.addEventListener('click', (e) => {
      if (e.target.closest('a') && !desktop.matches) setOpen(false)
    })

    sync()
  }

})()
