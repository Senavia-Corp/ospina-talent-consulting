// Comprueba el velo violeta de las cabeceras con fotografia.
//
// tokens.css descarta a proposito los degradados de violeta encima de las fotos, y
// .page-head--photo es la excepcion pedida. El riesgo de la excepcion es evidente: el
// texto ya no va sobre un plano de color conocido, sino sobre lo que traiga la foto, y
// aclarar el velo "para que se vea mejor la imagen" es un cambio de una cifra que nadie
// mira dos veces. Cuando el velo baja de .82, la entradilla cae por debajo de 4,5:1.
//
// Se mide el peor caso posible en vez de las fotos concretas: un pixel BLANCO justo
// debajo del texto. Asi la garantia sigue valiendo el dia que alguien cambie las fotos
// por otras mas claras, sin tener que volver a medir.

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'pages.css'), 'utf8')
const componentes = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8')
const mosaico = fs.readFileSync(path.join(__dirname, '..', 'images', 'footer-mosaic.svg'), 'utf8')

const VIOLET = [98, 20, 168] // --violet #6214a8
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

// El velo tal y como esta escrito en el CSS, no una copia a mano.
function velo() {
  const m = css.match(/\.page-head--photo\s*\{[^}]*?linear-gradient\(\s*rgb\([^)]*\/\s*\.(\d+)\)/s)
  assert.ok(m, 'no se encuentra el velo de .page-head--photo en pages.css')
  return Number(`0.${m[1]}`)
}

test('el velo deja la entradilla en AA sobre el peor pixel posible', () => {
  const fondo = mezcla(VIOLET, WHITE, velo()) // foto en blanco puro bajo el velo
  const lede = mezcla(WHITE, fondo, LEDE_ALPHA)

  const cTitulo = contraste(WHITE, fondo)
  const cLede = contraste(lede, fondo)

  assert.ok(cTitulo >= 4.5, `titulo a ${cTitulo.toFixed(2)}:1, hace falta 4,5:1`)
  assert.ok(cLede >= 4.5, `entradilla a ${cLede.toFixed(2)}:1, hace falta 4,5:1`)
})

// El fallo que esto habria pillado ya ocurrio una vez: las paginas llevaban su clase de
// pagina pero no page-head--photo, asi que --head-img quedaba definida y sin usar y la
// cabecera seguia siendo un plano liso. En pantalla no se ve el error, se ve el diseño
// de antes, que es exactamente el tipo de fallo que hay que automatizar.
test('cada cabecera con foto tiene modificador, imagen declarada y fichero', () => {
  const root = path.join(__dirname, '..')
  let comprobadas = 0

  for (const f of fs.readdirSync(root).filter((n) => n.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, f), 'utf8')
    const seccion = html.match(/<section class="(page-head[^"]*)"/)
    if (!seccion) continue

    const clases = seccion[1].split(/\s+/)
    const pagina = clases.filter((c) => c.startsWith('page-head--') && c !== 'page-head--photo')
    if (pagina.length === 0) continue // cabecera de plano liso, no lleva foto

    assert.ok(
      clases.includes('page-head--photo'),
      `${f} lleva ${pagina[0]} pero le falta page-head--photo: se quedaria en plano liso`,
    )

    const regla = css.match(new RegExp(`\\.${pagina[0]}\\s*\\{[^}]*--head-img:\\s*url\\(([^)]+)\\)`))
    assert.ok(regla, `${f} usa ${pagina[0]} y pages.css no le da --head-img`)

    const fichero = path.join(root, 'css', regla[1].replace(/^["']|["']$/g, ''))
    assert.ok(fs.existsSync(fichero), `${pagina[0]} apunta a ${regla[1]}, que no existe`)
    comprobadas++
  }

  assert.ok(comprobadas > 0, 'no se comprobo ninguna cabecera con foto')
})

// El mosaico del pie: el mismo metodo que el velo, aplicado al peor pixel del pie.
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
