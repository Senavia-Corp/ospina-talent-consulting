// Comprobacion de api/submit.js sin tocar SMTP: se sustituye createTransport por un doble
// que guarda lo que se habria enviado. Cubre lo que de verdad puede romperse en silencio:
// que un GET no pase, que solo salgan los campos de la lista blanca, y que un Reply-To
// manipulado no cuele cabeceras.

const test = require('node:test')
const assert = require('node:assert')

Object.assign(process.env, {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  SMTP_USER: 'remitente@example.com',
  SMTP_PASS: 'x',
  MAIL_TO: 'destino@example.com',
})

const sent = []
require('nodemailer').createTransport = () => ({
  sendMail: async (msg) => { sent.push(msg); return { messageId: 'test' } },
})

const handler = require('../api/submit.js')

function res() {
  const r = { statusCode: null, body: null, headers: {} }
  r.setHeader = (k, v) => { r.headers[k] = v; return r }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.body = b; return r }
  return r
}

// Cada prueba estrena IP para no chocar con el limite por ventana.
let n = 0
function req(extra) {
  return { headers: { 'x-forwarded-for': `10.0.0.${++n}` }, ...extra }
}

const CONTACT = { name: 'Ana Perez', Phone: '786-357-9121', Email: 'ana@example.com', Message: 'Hola' }

const PARTNER = {
  'legal-company-name': 'Acme LLC', 'full-name': 'Ana Perez',
  address: '1 Main St', country: 'US', city: 'Doral', state: 'FL', 'zip-code': '33166',
  'company-phone': '305-000-0000', website: 'https://acme.example',
  'contact-name': 'Ana Perez', title: 'CTO',
  'contact-phone': '305-000-0001', 'contact-email': 'ana@acme.example',
}

test('un GET no pasa: es lo que evita los datos de empresa en la URL', async () => {
  const r = res()
  await handler(req({ method: 'GET', query: { f: 'partner' }, body: {} }), r)
  assert.strictEqual(r.statusCode, 405)
  assert.strictEqual(r.headers.Allow, 'POST')
})

test('un formulario que no existe se rechaza', async () => {
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'footer' }, body: CONTACT }), r)
  assert.strictEqual(r.statusCode, 400)
})

test('faltando un campo obligatorio devuelve 400 y dice cual, sin el valor', async () => {
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'contact' }, body: { ...CONTACT, Phone: '  ' } }), r)
  assert.strictEqual(r.statusCode, 400)
  assert.deepStrictEqual(r.body.fields, ['Phone'])
})

test('un envio valido sale con el Reply-To de quien rellena', async () => {
  sent.length = 0
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'contact' }, body: CONTACT }), r)
  assert.strictEqual(r.statusCode, 200)
  assert.strictEqual(sent.length, 1)
  assert.strictEqual(sent[0].to, 'destino@example.com')
  assert.strictEqual(sent[0].replyTo, 'ana@example.com')
  assert.match(sent[0].text, /Full Name: Ana Perez/)
  assert.match(sent[0].text, /Message: Hola/)
})

test('lo que no esta en la lista blanca no viaja al email', async () => {
  sent.length = 0
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'contact' },
    body: { ...CONTACT, admin: 'true', __proto__polluted: 'x' } }), r)
  assert.strictEqual(r.statusCode, 200)
  assert.doesNotMatch(sent[0].text, /admin|polluted/)
})

test('un Email con salto de linea no llega a Reply-To (inyeccion de cabeceras)', async () => {
  sent.length = 0
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'contact' },
    body: { ...CONTACT, Email: 'a@b.com\nBcc: fuga@evil.com' } }), r)
  assert.strictEqual(r.statusCode, 200)
  assert.strictEqual(sent[0].replyTo, undefined)
})

test('el honeypot relleno devuelve 200 pero no manda nada', async () => {
  sent.length = 0
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'contact' }, body: { ...CONTACT, fax: 'bot' } }), r)
  assert.strictEqual(r.statusCode, 200)
  assert.strictEqual(sent.length, 0)
})

test('el formulario Partner exige sus 13 campos marcados con asterisco', async () => {
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'partner' }, body: { 'full-name': 'Ana' } }), r)
  assert.strictEqual(r.statusCode, 400)
  assert.strictEqual(r.body.fields.length, 12)
  // La certificacion NO es obligatoria: en el export lo era, y un partner sin
  // certificar no podia enviar el formulario.
  assert.ok(!r.body.fields.includes('certification-number'))
})

test('el Partner completo pasa y lleva los 22 campos, sin pisarse ninguno', async () => {
  sent.length = 0
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'partner' },
    body: { ...PARTNER, 'certification-number': 'ABC-123', certified: 'yes' } }), r)
  assert.strictEqual(r.statusCode, 200)
  // Address y Company Phone compartian name en el export: uno pisaba al otro.
  assert.match(sent[0].text, /^Address: 1 Main St$/m)
  assert.match(sent[0].text, /^Company Phone Number: 305-000-0000$/m)
  assert.match(sent[0].text, /^Zip Code: 33166$/m)
  assert.match(sent[0].text, /^State: FL$/m)
  assert.match(sent[0].text, /^Certification No\.: ABC-123$/m)
  assert.match(sent[0].text, /^Certified by a certifying agency\?: yes$/m)
})

// Las tres casillas de clasificacion se anadieron al HTML y por poco se quedan
// fuera de la lista blanca: habrian viajado en el POST y desaparecido en
// silencio, que es exactamente el fallo que este formulario ya tenia.
test('las casillas de clasificacion llegan al email', async () => {
  sent.length = 0
  const r = res()
  await handler(req({ method: 'POST', query: { f: 'partner' },
    body: { ...PARTNER, 'small-business': 'yes', 'woman-owned': 'yes' } }), r)
  assert.strictEqual(r.statusCode, 200)
  assert.match(sent[0].text, /^Small Business Enterprise: yes$/m)
  assert.match(sent[0].text, /^Woman-Owned Business Enterprise: yes$/m)
  assert.match(sent[0].text, /^Minority Business Enterprise: -$/m)
})

test('la misma IP no puede mandar sin limite', async () => {
  const ip = { headers: { 'x-forwarded-for': '203.0.113.9' } }
  let ultimo
  for (let i = 0; i < 7; i++) {
    ultimo = res()
    await handler({ ...ip, method: 'POST', query: { f: 'contact' }, body: CONTACT }, ultimo)
  }
  assert.strictEqual(ultimo.statusCode, 429)
})
