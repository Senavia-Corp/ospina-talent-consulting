// Comprueba el mosaico del pie contra el peor pixel que puede quedar bajo el texto.
//
// El sitio no lleva fotografia debajo de texto en ningun sitio: las cabeceras de las
// interiores son plano violeta liso y las fotos de seccion van a plena fuerza, con el
// violeta al lado y no encima. Lo unico que compone alfa sobre el texto es el mosaico
// del pie, y es lo que se vigila aqui.

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const componentes = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8')
const mosaico = fs.readFileSync(path.join(__dirname, '..', 'images', 'footer-mosaic.svg'), 'utf8')

const WHITE = [255, 255, 255]
const LEDE_ALPHA = 0.78 // --on-violet-2
const INK = [29, 16, 41] // --ink #1d1029, el plano del pie
const AMBER = [242, 164, 19] // --amber #f2a413, que sobre el pie es --focus-c

function luminancia([r, g, b]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contraste(a, b) {
  const [hi, lo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const mezcla = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t))

// El mosaico del pie: se mide el peor pixel posible, el tinte mas claro del SVG.
//
// La trampa aqui es que el minimo NO lo marca el texto. Sobre el fondo compuesto, el
// texto al 78 % aguanta hasta una opacidad de 0,38, pero el anillo de foco es ambar y
// WCAG 1.4.11 le pide 3:1 contra lo que tiene al lado: el ambar rompe antes, sobre
// 0,37. Sin este segundo aserto, subir la opacidad "porque el texto sigue en AA" se
// lleva por delante la visibilidad del foco por teclado, que nadie mira dos veces.
//
// Ni la opacidad ni la paleta se copian a mano: la primera se lee del CSS y la segunda
// del propio SVG, asi que repintar el mosaico con tintes mas claros tambien salta aqui.

function opacidadMosaico() {
  const m = componentes.match(/\.site-footer::before,\s*\.site-footer::after\s*\{[^}]*?opacity:\s*(\.?\d*\.?\d+)/s)
  assert.ok(m, 'no se encuentra la opacidad del mosaico en components.css')
  return Number(m[1])
}

function tinteMasClaro() {
  const fills = [...mosaico.matchAll(/fill="#([0-9a-fA-F]{6})"/g)]
    .map((m) => [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)))
  assert.ok(fills.length, 'el mosaico no declara ningun fill')
  return fills.sort((a, b) => luminancia(b) - luminancia(a))[0]
}

test('el mosaico del pie deja texto y anillo de foco por encima del minimo', () => {
  const fondo = mezcla(tinteMasClaro(), INK, opacidadMosaico())
  const texto = mezcla(WHITE, fondo, LEDE_ALPHA)

  const cTexto = contraste(texto, fondo)
  const cAnillo = contraste(AMBER, fondo)

  assert.ok(cTexto >= 4.5, `texto del pie a ${cTexto.toFixed(2)}:1 sobre el mosaico, hace falta 4,5:1`)
  assert.ok(cAnillo >= 3, `anillo de foco a ${cAnillo.toFixed(2)}:1 sobre el mosaico, hace falta 3:1`)
})
