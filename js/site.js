/* ============================================================================
   Ospina Talent Consulting — JS propio. Sin dependencias, sin build.
   Dos cosas: el menu movil y las flechas/puntos del carrusel de testimonios.

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

  const reduce = matchMedia('(prefers-reduced-motion: reduce)')

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
      for (const el of detras) if (el) el.inert = open && !desktop.matches
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

  /* --------------------------------------------------- carrusel de testimonios
     El desplazamiento es CSS (scroll-snap). Esto solo anade flechas y puntos:
     si se borra el fichero, el carrusel sigue arrastrandose con el dedo. */
  document.querySelectorAll('[data-carousel]').forEach((root) => {
    const track = root.querySelector('[data-carousel-track]')
    const dots = root.querySelector('[data-carousel-dots]')
    const prev = root.querySelector('[data-carousel-prev]')
    const next = root.querySelector('[data-carousel-next]')
    if (!track) return

    const slides = [...track.children]
    if (slides.length < 2) {
      root.querySelector('[data-carousel-nav]')?.setAttribute('hidden', '')
      return
    }

    let active = 0

    const go = (i) => {
      const target = slides[Math.max(0, Math.min(slides.length - 1, i))]
      track.scrollTo({
        left: target.offsetLeft - track.offsetLeft,
        behavior: reduce.matches ? 'auto' : 'smooth',
      })
    }

    prev?.addEventListener('click', () => go(active - 1))
    next?.addEventListener('click', () => go(active + 1))

    if (dots) {
      slides.forEach((_, i) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'quotes__dot'
        b.setAttribute('aria-label', `Testimonial ${i + 1} of ${slides.length}`)
        b.addEventListener('click', () => go(i))
        dots.append(b)
      })
    }

    // Las flechas se deciden por posicion de scroll, no por indice: a >=64rem
    // se ven tres tarjetas a la vez, asi que active === slides.length - 1 no
    // se cumpliria nunca y next no se deshabilitaria jamas.
    const atStart = () => track.scrollLeft <= 2
    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 2

    const paint = () => {
      dots?.querySelectorAll('button').forEach((d, i) =>
        d.setAttribute('aria-current', String(i === active)))
      prev?.toggleAttribute('disabled', atStart())
      next?.toggleAttribute('disabled', atEnd())
    }

    // Se queda con la PRIMERA visible. Quedandose con la ultima entrada del
    // bucle, y viendose tres tarjetas a la vez en escritorio, en la posicion 0
    // se encenderia el punto 3 y prev quedaria habilitado apuntando a una
    // tarjeta ya visible.
    if ('IntersectionObserver' in window) {
      const visible = new Set()
      const spy = new IntersectionObserver((entries) => {
        for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)
        if (visible.size) active = Math.min(...[...visible].map((s) => slides.indexOf(s)))
        paint()
      }, { root: track, threshold: 0.6 })
      slides.forEach((s) => spy.observe(s))
    }
    track.addEventListener('scroll', paint, { passive: true })

    paint()
  })
})()
