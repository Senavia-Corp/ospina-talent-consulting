// Comprueba que ninguna referencia local del sitio apunta a un fichero que no existe, y
// que no queda nada colgando de servidores de Webflow.
//
// Esto es el gate de la migracion: el export traia jQuery y 3 SVG servidos desde Webflow
// (dos de ellos desde sites ajenos a este), y el dia que se cancele la cuenta cualquier
// resto se cae sin avisar. Un 404 en un asset no rompe la pagina de forma visible, asi
// que se comprueba aqui y no a ojo.

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const html = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))
const css = fs.readdirSync(path.join(ROOT, 'css')).map((f) => path.join('css', f))

// Los dos terceros que siguen sirviendo assets, a la espera de la fase 2: Splide
// (carrusel) y el widget de Elfsight. Cuando se retiren, esta lista pasa a [] EN EL
// MISMO COMMIT: el test compara un conjunto exacto y cualquiera de las dos mitades
// sola lo deja en rojo.
const EXTERNOS_OK = ['cdn.jsdelivr.net', 'apps.elfsight.com']

function refs(file) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const out = []
  const patterns = [/(?:src|href)="([^"]+)"/g, /url\(["']?([^"')]+)["']?\)/g]
  for (const re of patterns) {
    for (const m of s.matchAll(re)) out.push(m[1])
  }
  return out
}

// Con cleanUrls activo los enlaces internos van sin extension (/contact, /services).
// Resolverlos contra <ref>.html es lo que permite usar rutas limpias sin que el gate
// las de por rotas. En la migracion anterior el test no sabia de esto y por eso los
// deep links se quedaron con .html, pagando un 308 en cada clic.
function existe(target) {
  if (fs.existsSync(target)) return true
  if (!path.extname(target) && fs.existsSync(target + '.html')) return true
  return false
}

test('ninguna referencia local apunta a un fichero que no existe', () => {
  const rotas = []
  for (const file of [...html, ...css]) {
    const base = path.dirname(path.join(ROOT, file))
    for (const ref of refs(file)) {
      if (/^(https?:|mailto:|tel:|data:|#|\/api\/)/.test(ref)) continue
      const limpio = ref.split(/[?#]/)[0]
      if (!limpio) continue                        // href="#algo" ya filtrado arriba
      // Una ruta absoluta cuelga de la raiz del sitio, no de la carpeta del fichero.
      const target = limpio.startsWith('/')
        ? path.join(ROOT, limpio === '/' ? 'index.html' : limpio)
        : path.resolve(base, limpio)
      if (!existe(target)) rotas.push(`${file} -> ${ref}`)
    }
  }
  assert.deepStrictEqual(rotas, [], `Referencias rotas:\n${rotas.join('\n')}`)
})

test('no queda nada pidiendo assets a Webflow', () => {
  const restos = []
  for (const file of [...html, ...css]) {
    const s = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const m of s.matchAll(/https?:\/\/([^\s"'/)]+)/g)) {
      const host = m[1]
      if (/webflow\.com$|website-files\.com$|cloudfront\.net$/.test(host)) {
        // El comentario "This site was created in Webflow" enlaza a webflow.com y no
        // provoca ninguna peticion. Todo lo demas si.
        if (host === 'webflow.com') continue
        restos.push(`${file}: ${host}`)
      }
    }
  }
  assert.deepStrictEqual(restos, [], `Assets aun servidos por Webflow:\n${restos.join('\n')}`)
})

test('los unicos terceros que sirven assets son los esperados', () => {
  // Solo lo que el navegador descarga: src= de script/img y href= de <link>. Los <a> a
  // sitios de terceros son enlaces de navegacion y no cuentan.
  const hosts = new Set()
  // De los <link>, solo cuentan los rel que provocan una descarga. Un rel="canonical"
  // apunta al dominio final del sitio y no pide ningun byte.
  const REL_QUE_DESCARGA = /\brel="(stylesheet|preload|prefetch|icon|shortcut icon|apple-touch-icon|manifest)"/i
  for (const file of html) {
    const s = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const m of s.matchAll(/src="https?:\/\/([^\s"'/]+)/g)) hosts.add(m[1])
    for (const m of s.matchAll(/<link\b[^>]*>/g)) {
      if (!REL_QUE_DESCARGA.test(m[0])) continue
      const h = m[0].match(/href="https?:\/\/([^\s"'/]+)/)
      if (h) hosts.add(h[1])
    }
  }
  assert.deepStrictEqual([...hosts].sort(), EXTERNOS_OK.slice().sort())
})

// srcset no lo miraba nadie. El regex de refs() pide el literal `src="`, y en `srcset="`
// tras src viene set=, asi que las candidatas no pasaban por el gate: un nombre de
// variante mal escrito se desplegaba en silencio, sin 404 visible y sin fallar un test.
test('cada candidata de cada srcset existe en disco', () => {
  const rotas = []
  let candidatas = 0
  for (const file of html) {
    const s = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const m of s.matchAll(/srcset="([^"]+)"/g)) {
      for (const parte of m[1].split(',')) {
        const url = parte.trim().split(/\s+/)[0]
        if (!url) continue
        candidatas++
        if (!existe(path.join(ROOT, url.split(/[?#]/)[0]))) rotas.push(`${file} -> ${url}`)
      }
    }
  }
  assert.ok(candidatas > 0, 'no se ha parseado ninguna srcset: el gate no ha corrido')
  assert.deepStrictEqual(rotas, [], `Candidatas de srcset rotas:\n${rotas.join('\n')}`)
})
