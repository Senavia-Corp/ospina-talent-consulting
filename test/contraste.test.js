// Comprueba los DOS recursos decorativos que componen alfa debajo de texto.
//
// El sitio no lleva fotografia debajo de texto en ningun sitio: las fotos de seccion van
// a plena fuerza, con el violeta al lado y no encima. Lo que si compone alfa es:
//   1. el mosaico del pie (images/footer-mosaic.svg) sobre --ink, que ACLARA;
//   2. las facetas de los planos violeta (images/facet-violet.svg), que HUNDEN.
//
// Los dos se vigilan aqui, y con criterios distintos porque los techos no se parecen en
// nada. Ver el comentario de cada bloque.

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const componentes = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8')
const mosaico = fs.readFileSync(path.join(__dirname, '..', 'images', 'footer-mosaic.svg'), 'utf8')
const facetas = fs.readFileSync(path.join(__dirname, '..', 'images', 'facet-violet.svg'), 'utf8')

const WHITE = [255, 255, 255]
const LEDE_ALPHA = 0.78 // --on-violet-2
const INK = [29, 16, 41] // --ink #1d1029, el plano del pie
const AMBER = [242, 164, 19] // --amber #f2a413, que sobre el pie es --focus-c
const VIOLET = [98, 20, 168] // --violet #6214a8, el plano de hero, .plane-violet y .page-head
const CARD_VEIL = 0.08 // el velo blanco de .value--on-violet, que es TRANSLUCIDA

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

// Las facetas de los planos violeta: aqui el criterio es el CONTRARIO que en el pie.
//
// Sobre --violet no hay margen para aclarar. Medido: el hero aguanta un mosaico de tinte
// claro hasta opacidad .22, pero el plano de las tarjetas solo hasta .138, porque el velo
// blanco del 8 % de .value--on-violet SUMA su aclarado al del recurso y el par de dentro
// de la tarjeta parte de 5,57:1 en vez de 6,33:1. El .26 del pie trasplantado deja esa
// entradilla en 3,66:1 y el borde ambar de la tarjeta en 2,36:1: incumple las dos.
//
// Por eso facet-violet.svg esta hecho con la rampa --violet -> --violet-deep, donde toda
// celda es MAS OSCURA que el plano y por tanto solo puede subir el contraste. Ese es el
// invariante que sujeta el diseno entero, y es lo que se asegura aqui: primero que se
// cumple, y luego que el apilado de TRES capas (faceta sobre violeta, velo del 8 % encima)
// sigue en AA. Si alguien repinta el SVG con los tintes claros del logo, salta lo primero
// mucho antes de que nadie mire una captura.

function opacidadFacetas() {
  const m = componentes.match(/\.hero::after,\s*\.plane-violet::after,\s*\.page-head::after\s*\{[^}]*?opacity:\s*(\.?\d*\.?\d+)/s)
  assert.ok(m, 'no se encuentra la opacidad de las facetas en components.css')
  return Number(m[1])
}

function fillsFacetas() {
  const fills = [...facetas.matchAll(/fill="#([0-9a-fA-F]{6})"/g)]
    .map((m) => [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)))
  assert.ok(fills.length, 'las facetas no declaran ningun fill')
  return fills
}

test('ninguna faceta es mas clara que el plano violeta que tiene debajo', () => {
  const techo = luminancia(VIOLET)
  for (const f of fillsFacetas()) {
    const l = luminancia(f)
    assert.ok(
      l <= techo + 1e-9,
      `una faceta tiene luminancia ${l.toFixed(4)} y el plano ${techo.toFixed(4)}: aclara en vez de hundir, ` +
      'y con eso el techo de opacidad deja de ser infinito. Los tintes claros del logo NO valen aqui.',
    )
  }
})

test('las facetas dejan en AA el apilado de tres capas bajo las tarjetas translucidas', () => {
  const op = opacidadFacetas()
  const peor = fillsFacetas().sort((a, b) => luminancia(b) - luminancia(a))[0]

  const plano = mezcla(peor, VIOLET, op)            // faceta sobre el plano
  const tarjeta = mezcla(WHITE, plano, CARD_VEIL)   // y el velo del 8 % de la tarjeta encima

  const cPlano = contraste(mezcla(WHITE, plano, LEDE_ALPHA), plano)
  const cTarjeta = contraste(mezcla(WHITE, tarjeta, LEDE_ALPHA), tarjeta)
  const cBorde = contraste(AMBER, tarjeta)

  assert.ok(cPlano >= 4.5, `entradilla sobre el plano a ${cPlano.toFixed(2)}:1, hace falta 4,5:1`)
  assert.ok(cTarjeta >= 4.5, `entradilla dentro de la tarjeta a ${cTarjeta.toFixed(2)}:1, hace falta 4,5:1`)
  assert.ok(cBorde >= 3, `borde ambar de la tarjeta a ${cBorde.toFixed(2)}:1, hace falta 3:1`)
})
