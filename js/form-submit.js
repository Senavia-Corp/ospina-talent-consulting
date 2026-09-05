// Envia los formularios a /api/submit y reproduce lo que hacia Webflow al volver.
//
// Webflow deja de gestionar un formulario en cuanto tiene un action= propio: en
// js/webflow.js, la funcion que monta el form se sale sin asignar handler. Sin esto, el
// navegador navegaria a la respuesta JSON de la API y se perderia el mensaje de exito.
//
// Se replica su comportamiento: se oculta el form y se muestra .w-form-done, o
// .w-form-fail si algo fallo.

(function () {
  'use strict'

  // .w-form-done y .w-form-fail son hermanos del <form>, dentro del .w-form que envuelve.
  function panel(form, selector) {
    var wrap = form.closest('.w-form')
    return wrap ? wrap.querySelector(selector) : null
  }

  // El CSS de Webflow los deja en display:none, asi que hay que poner block explicito.
  // OJO al borrar css/webflow.css: esa regla hay que redeclararla o los dos mensajes se
  // ven permanentemente, sin lanzar ningun error.
  function show(el, visible) {
    if (el) el.style.display = visible ? 'block' : 'none'
  }

  document.addEventListener('submit', function (evt) {
    var form = evt.target
    if (!(form instanceof HTMLFormElement)) return

    var action = form.getAttribute('action')
    if (!action || action.indexOf('/api/submit') !== 0) return

    evt.preventDefault()
    evt.stopPropagation() // en fase de captura: webflow.js ni se entera

    var btn = form.querySelector('[type="submit"]')
    var label = btn ? btn.value : null
    var wait = btn ? btn.getAttribute('data-wait') : null
    if (btn) {
      btn.disabled = true
      btn.classList.add('w-form-loading')
      if (wait) btn.value = wait
    }

    var done = panel(form, '.w-form-done')
    var fail = panel(form, '.w-form-fail')

    fetch(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status)

        var redirect = form.getAttribute('data-redirect')
        if (redirect) {
          window.location = redirect
          return
        }

        show(fail, false)
        show(done, true)
        form.style.display = 'none'
        if (done) {
          done.setAttribute('tabindex', '-1')
          done.focus()
        }
      })
      .catch(function () {
        show(done, false)
        show(fail, true)
        if (fail) {
          fail.setAttribute('tabindex', '-1')
          fail.focus()
        }
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false
          btn.classList.remove('w-form-loading')
          if (label !== null) btn.value = label
        }
      })
  }, true)
})()
