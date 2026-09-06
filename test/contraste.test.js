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

// Las facetas de los planos violeta. El criterio es el CONTRARIO que en el pie.
//
// Sobre --violet no hay margen para aclarar: el hero aguanta un recurso de tinte claro
// hasta opacidad .22 y el plano de las tarjetas solo hasta .138, porque el velo blanco
// del 8 % de .value--on-violet SUMA su aclarado al del recurso. Por eso facet-violet.svg
// va con la rampa --violet -> --violet-deep, donde toda celda es mas oscura que el plano
// y solo puede SUBIR el contraste.
//
// LA PRIMERA VERSION DE ESTA PRUEBA NO SUJETABA NADA, y conviene saber por que para no
// repetirlo. Tomaba "el fill mas claro del SVG" como peor caso, pero el fill mas claro ES
// --violet (la celda que se funde con el plano), asi que componerlo sobre --violet
// devolvia --violet para cualquier opacidad: los tres asertos median el estado sin tocar
// y daban lo mismo con opacidad 0 que con 1. Pasaba en verde con el mosaico del PIE
// puesto en su lugar (entradilla real 2,20:1) y con una celda repintada en rgb(), porque
// el regex solo miraba #rrggbb. Un gate que falla ABIERTO es peor que no tenerlo.
//
// Lo que hace la version de ahora, y de donde saca cada numero:
//   - localiza la regla REAL de components.css que da opacidad a las facetas, exige que
//     sea UNA y que cubra los cuatro selectores, y lee de ahi el nombre del SVG. Asi,
//     cambiar el asset o darle a una faceta su propia opacidad no puede dejar esta
//     prueba midiendo algo que la pagina ya no pinta;
//   - exige que los colores del SVG esten en #rrggbb, porque en otra notacion el aserto
//     de luminancia no los veria;
//   - lee --violet, --amber y el alfa de --on-violet-2 de tokens.css, y el velo de la
//     tarjeta de components.css. Ninguna cifra se copia a mano;
//   - y mide el apilado de tres capas para TODAS las celdas, no para una.

const tokens = fs.readFileSync(path.join(__dirname, '..', 'css', 'tokens.css'), 'utf8')
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))

function token(nombre) {
  const m = tokens.match(new RegExp(`--${nombre}:\\s*#([0-9a-fA-F]{6})`))
  assert.ok(m, `no se encuentra el token --${nombre} en tokens.css`)
  return hex(m[1])
}

function alfa(css, re, quien) {
  const m = css.match(re)
  assert.ok(m, `no se encuentra el alfa de ${quien}`)
  return Number(m[1])
}

const FACETAS = ['.hero__copy::after', '.hero::after', '.plane-violet::after', '.page-head::after']

function bloqueFacetas() {
  const sinComentarios = componentes.replace(/\/\*[\s\S]*?\*\//g, '')
  const reglas = [...sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel, cuerpo]) => /opacity:/.test(cuerpo) && FACETAS.some((f) => sel.includes(f)))
  assert.equal(
    reglas.length, 1,
    `${reglas.length} reglas dan opacidad a las facetas y tiene que haber exactamente una; ` +
    'si no, esta prueba mide una opacidad que la pagina no pinta',
  )
  const [, sel, cuerpo] = reglas[0]
  for (const f of FACETAS) assert.ok(sel.includes(f), `${f} ya no comparte el bloque de las facetas`)
  return cuerpo
}

function opacidadFacetas() {
  const m = bloqueFacetas().match(/opacity:\s*(\.?\d*\.?\d+)/)
  assert.ok(m, 'no se encuentra la opacidad de las facetas')
  return Number(m[1])
}

function coloresFacetas() {
  const urls = [...bloqueFacetas().matchAll(/url\('\.\.\/images\/([^']+)'\)/g)].map((m) => m[1])
  assert.equal(urls.length, 1, `el bloque de las facetas declara ${urls.length} imagenes y tiene que declarar una`)
  const svg = fs.readFileSync(path.join(__dirname, '..', 'images', urls[0]), 'utf8')

  const declarados = [...svg.matchAll(/(?:fill|stroke)\s*=\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => v !== 'none')
  assert.ok(declarados.length, `${urls[0]} no declara ningun color`)
  for (const c of declarados) {
    assert.match(
      c, /^#[0-9a-fA-F]{6}$/,
      `${urls[0]} declara el color ${c}, que no esta en #rrggbb: escrito asi el aserto de ` +
      'luminancia no lo ve y el invariante deja de estar vigilado',
    )
  }
  return declarados.map((c) => hex(c.slice(1)))
}

const VIOLET = token('violet')
const AMBER_TOKEN = token('amber')
const LEDE = alfa(tokens, /--on-violet-2:\s*rgb\(255 255 255 \/ (\.\d+)\)/, '--on-violet-2')
const VELO = alfa(componentes, /\.value--on-violet\s*\{[^}]*?rgb\(255 255 255 \/ (\.\d+)\)/s, '.value--on-violet')

test('ninguna faceta es mas clara que el plano violeta que tiene debajo', () => {
  const techo = luminancia(VIOLET)
  for (const c of coloresFacetas()) {
    assert.ok(
      luminancia(c) <= techo + 1e-9,
      `una faceta tiene luminancia ${luminancia(c).toFixed(4)} y el plano ${techo.toFixed(4)}: aclara en vez ` +
      'de hundir, y con eso el techo de opacidad deja de ser infinito',
    )
  }
})

test('el apilado de tres capas cumple AA celda a celda, no solo en el caso comodo', () => {
  const op = opacidadFacetas()
  let comprobadas = 0

  for (const celda of coloresFacetas()) {
    const plano = mezcla(celda, VIOLET, op)          // la faceta sobre el plano
    const tarjeta = mezcla(WHITE, plano, VELO)       // y el velo de .value--on-violet encima

    const cPlano = contraste(mezcla(WHITE, plano, LEDE), plano)
    const cTarjeta = contraste(mezcla(WHITE, tarjeta, LEDE), tarjeta)
    const cBorde = contraste(AMBER_TOKEN, tarjeta)

    assert.ok(cPlano >= 4.5, `entradilla sobre el plano a ${cPlano.toFixed(2)}:1, hace falta 4,5:1`)
    assert.ok(cTarjeta >= 4.5, `entradilla dentro de la tarjeta a ${cTarjeta.toFixed(2)}:1, hace falta 4,5:1`)
    assert.ok(cBorde >= 3, `borde ambar de la tarjeta a ${cBorde.toFixed(2)}:1, hace falta 3:1`)
    comprobadas++
  }

  assert.ok(comprobadas > 1, 'se comprobo una sola celda: el apilado tiene que medirse en todas')
})

// Y el reverso del suelo: que la celda mas profunda MEJORE los tres pares. Es lo que el
// diseno promete —"hundir sube el contraste"— y hasta ahora no lo afirmaba nadie. Sin
// este aserto, un SVG con las 36 celdas pintadas del color del plano pasaria en verde
// siendo un fichero que no hace nada.
test('la celda mas profunda mejora los tres pares, que es lo que promete el diseno', () => {
  const op = opacidadFacetas()
  const colores = coloresFacetas().slice().sort((a, b) => luminancia(a) - luminancia(b))
  const honda = colores[0]

  const pares = (celda) => {
    const plano = mezcla(celda, VIOLET, op)
    const tarjeta = mezcla(WHITE, plano, VELO)
    return [
      contraste(mezcla(WHITE, plano, LEDE), plano),
      contraste(mezcla(WHITE, tarjeta, LEDE), tarjeta),
      contraste(AMBER_TOKEN, tarjeta),
    ]
  }

  const conFaceta = pares(honda)
  const desnudo = pares(VIOLET)
  const nombres = ['entradilla sobre el plano', 'entradilla en la tarjeta', 'borde ambar']

  for (let i = 0; i < 3; i++) {
    assert.ok(
      conFaceta[i] > desnudo[i],
      `${nombres[i]}: la celda mas profunda deja ${conFaceta[i].toFixed(2)}:1 y el plano desnudo ` +
      `${desnudo[i].toFixed(2)}:1. El recurso no esta hundiendo nada.`,
    )
  }
})
