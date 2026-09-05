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

const VIOLET = [98, 20, 168] // --violet #6214a8
const WHITE = [255, 255, 255]
const LEDE_ALPHA = 0.78 // --on-violet-2

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
