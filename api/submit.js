// Recibe los dos formularios del sitio y los manda por email.
//
// Sustituye al backend de formularios de Webflow, que rechaza cualquier origen que no
// sea suyo y que desaparece al cancelar la cuenta. El formulario Partner lleva el DUNS
// y los datos fiscales de una empresa, asi que hay tres reglas que no se relajan por
// brevedad:
//
//   1. Solo POST. Un GET devuelve 405. Es lo que evita que los datos de empresa acaben
//      en la barra de direcciones, en el historial y en los logs de acceso. El export
//      venia con method="get" y sin action: si fallaba el JS, el submit nativo mandaba
//      cada valor en la query string.
//   2. Los campos se leen por lista blanca. Lo que no este en FORMS no se lee ni se envia.
//   3. El contenido del formulario NO se loguea. Los logs de Vercel se leen desde el panel.

const nodemailer = require('nodemailer')

// El campo trampa. Un navegador humano nunca lo rellena porque no se ve y no recibe
// foco; los bots que rellenan todo lo que encuentran, si.
const HONEYPOT = 'fax'

// La clave es el name= del input en el HTML; el valor, la etiqueta que sale en el email.
const FORMS = {
  contact: {
    subject: 'New enquiry from the Ospina Talent Consulting website',
    fields: {
      name: 'Full Name',
      Phone: 'Phone',
      Email: 'Email',
      Message: 'Message',
    },
    required: ['name', 'Phone', 'Email'],
    email: 'Email',
  },
  partner: {
    subject: 'New partner registration',
    // Los name= de este formulario se renombraron por su etiqueta visible. En el export
    // habia 5 nombres repetidos entre 11 campos (Full-Name-3 cuatro veces), asi que el
    // navegador mandaba un solo valor por nombre y se perdian 11 de los 21 campos.
    fields: {
      'legal-company-name': 'Legal Company Name',
      'full-name': 'Full Name',
      'dba-company-name': 'DBA Company Name',
      'duns-number': 'D&B DUNS Number',
      address: 'Address',
      country: 'Country',
      city: 'City',
      state: 'State',
      'zip-code': 'Zip Code',
      'company-phone': 'Company Phone Number',
      website: 'Company Website (URL)',
      'contact-name': 'Contact Name',
      title: 'Title',
      'contact-phone': 'Contact Phone Number',
      'contact-email': 'Contact Email',
      'it-areas': 'IT areas of specialisation',
      'number-of-employees': 'Number of Employees',
      'small-business': 'Small Business Enterprise',
      'minority-business': 'Minority Business Enterprise',
      'woman-owned': 'Woman-Owned Business Enterprise',
      certified: 'Certified by a certifying agency?',
      'certification-type': 'Certification Type',
      'certifying-agency': 'Certifying Agency',
      'certification-expiration': 'Expiration Date',
      'certification-number': 'Certification No.',
    },
    // Los mismos que el HTML marca con asterisco. En el export la obligatoriedad estaba
    // invertida: los campos con * no llevaban required y los de certificacion si, de modo
    // que un partner sin certificacion no podia enviar el formulario.
    required: [
      'legal-company-name', 'full-name', 'address', 'country', 'city', 'state',
      'zip-code', 'company-phone', 'website', 'contact-name', 'title',
      'contact-phone', 'contact-email',
    ],
    email: 'contact-email',
  },
}

const ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO', 'TURNSTILE_SECRET_KEY']

// Turnstile. El widget de los dos formularios mete su token en cf-turnstile-response, que
// no esta en FORMS y por eso no viaja al email. Sin validarlo aqui el widget es decorado.
// Devuelve los error-codes de Cloudflare (vacio = humano); no contienen nada secreto y
// distinguen un token malo ('invalid-input-response') de un secreto mal puesto
// ('invalid-input-secret').
// ponytail: falla cerrado. Si Cloudflare no contesta en 8s, el envio se rechaza y el
// visitante ve el panel de error con el telefono. Fallar abierto solo si eso molesta.
async function turnstile(token, ip) {
  if (!token) return ['missing-input-response']
  const params = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token })
  if (ip) params.set('remoteip', ip)
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(8000),
    })
    const data = await r.json()
    return data.success === true ? [] : data['error-codes'] || ['rejected']
  } catch (err) {
    console.error('Turnstile no respondio:', err && err.message)
    return ['siteverify-unreachable']
  }
}

// ponytail: contador en memoria. Fluid Compute reutiliza instancias pero no las comparte,
// asi que el limite es por instancia y un atacante repartido lo supera. Corta el abuso
// trivial sin anadir servicios; el filtro serio es Turnstile, y esto queda como segunda capa.
const VENTANA_MS = 10 * 60 * 1000
const MAX_POR_VENTANA = 5
const vistos = new Map()

function demasiadas(ip) {
  const ahora = Date.now()
  const previas = (vistos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS)
  previas.push(ahora)
  vistos.set(ip, previas)
  // Sin esto el Map crece sin limite mientras viva la instancia.
  if (vistos.size > 5000) {
    for (const [k, v] of vistos) if (!v.some((t) => ahora - t < VENTANA_MS)) vistos.delete(k)
  }
  return previas.length > MAX_POR_VENTANA
}

// El correo en HTML, con la marca del sitio. Va junto al texto plano (multipart): cada
// cliente de correo elige, y el texto sigue siendo la version sin estilos. Estilos en
// linea y tablas porque Gmail y Outlook ignoran casi todo lo demas; sin imagenes, para
// que se vea igual con la carga de imagenes bloqueada.
// Todo lo que escribio el visitante pasa por esc(): sin eso, un nombre con etiquetas se
// pintaria como HTML en el buzon del cliente.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Los colores salen de css/tokens.css, con sus reglas de contraste: blanco sobre violeta
// (9,67:1), tinta sobre ambar (8,71:1) y el ambar nunca como letra sobre claro.
const C = { violeta: '#6214a8', ambar: '#f2a413', tinta: '#1d1029', mute: '#5b5170', linea: '#ded6e8', fondo: '#f7f5fa' }
const FUENTE = 'Arial, Helvetica, sans-serif'

function correoHtml(spec, filas, replyTo) {
  // En los titulos, <wbr> antes de cada punto: un asunto con un dominio entero
  // (supportstaffsolutionsusa.com, 315px en negrita de 22px) no cabia en un movil y
  // ensanchaba todo el correo.
  const campos = filas.map(([label, v]) => `
          <tr><td style="padding:14px 0;border-bottom:1px solid ${C.linea}">
            <div style="font:12px/16px ${FUENTE};color:${C.mute};text-transform:uppercase;letter-spacing:.05em">${esc(label)}</div>
            <div style="font:16px/24px ${FUENTE};color:${C.tinta};margin-top:4px;word-break:break-word;overflow-wrap:anywhere">${esc(v).replace(/\r?\n/g, '<br>')}</div>
          </td></tr>`).join('')
  const boton = replyTo ? `
      <tr><td style="padding:8px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.ambar}" style="border-radius:4px">
          <a href="mailto:${esc(replyTo)}" style="display:inline-block;padding:12px 22px;font:bold 15px/20px ${FUENTE};color:${C.tinta};text-decoration:none">Reply by email</a>
        </td></tr></table>
      </td></tr>` : ''
  const pie = replyTo
    ? 'Replying to this email goes straight to the person who filled in the form.'
    : 'The email address they entered is not valid, so replying to this message will not reach anyone.'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(spec.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.fondo}">
<div style="display:none;max-height:0;overflow:hidden">${esc(filas.slice(0, 2).map(([, v]) => v).join(' · '))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.fondo}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff">
    <tr><td style="background:${C.violeta};border-top:6px solid ${C.ambar};padding:24px 32px">
      <div style="font:13px/18px ${FUENTE};color:#dccbec">Ospina Talent Consulting</div>
      <div style="font:bold 22px/28px ${FUENTE};color:#ffffff;margin-top:4px;overflow-wrap:anywhere">${esc(spec.subject).replace(/\./g, '<wbr>.')}</div>
    </td></tr>
    <tr><td style="padding:24px 32px 8px;font:15px/22px ${FUENTE};color:${C.tinta}">Someone just submitted a form on the website. Here are the details:</td></tr>
    <tr><td style="padding:8px 32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${campos}
      </table>
    </td></tr>${boton}
    <tr><td style="padding:24px 32px 28px;font:13px/19px ${FUENTE};color:${C.mute}">${pie}<br>Sent automatically by the form on the Ospina Talent Consulting website.</td></tr>
  </table>
</td></tr></table>
</body></html>`
}

let transport
function mailer() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return transport
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const spec = FORMS[req.query && req.query.f]
  if (!spec) return res.status(400).json({ error: 'Unknown form' })

  const body = req.body || {}
  const value = (k) => String(body[k] == null ? '' : body[k]).trim()

  // El bot se lleva un 200: si le devolvieramos un error sabria que hay trampa.
  if (value(HONEYPOT)) return res.status(200).json({ ok: true })

  const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida'
  if (demasiadas(ip)) {
    res.setHeader('Retry-After', String(VENTANA_MS / 1000))
    return res.status(429).json({ error: 'Too many requests' })
  }

  const missingEnv = ENV.filter((k) => !process.env[k])
  if (missingEnv.length) {
    // Los nombres de las variables no son secretos; sus valores no se tocan.
    console.error('Faltan variables de entorno:', missingEnv.join(', '))
    return res.status(500).json({ error: 'Mail not configured' })
  }

  const missing = spec.required.filter((k) => !value(k))
  if (missing.length) {
    // Solo los nombres de campo, nunca lo que el usuario escribio.
    return res.status(400).json({ error: 'Missing required fields', fields: missing })
  }

  // Despues de los campos a proposito: la sonda sin correo del README (name=solo -> 400)
  // sigue funcionando sin token.
  const codes = await turnstile(value('cf-turnstile-response'), ip === 'desconocida' ? '' : ip)
  if (codes.length) return res.status(403).json({ error: 'Verification failed', codes })

  const filas = Object.entries(spec.fields).map(([name, label]) => [label, value(name) || '-'])
  const text = filas.map(([label, v]) => `${label}: ${v}`).join('\n')

  // Poner el email de quien rellena en Reply-To hace que Responder le conteste a el.
  // Solo si parece un email de verdad: un salto de linea aqui seria inyeccion de cabeceras.
  const from = value(spec.email)
  const replyTo = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(from) ? from : undefined

  try {
    await mailer().sendMail({
      from: `"Ospina Talent Consulting" <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO,
      replyTo,
      subject: spec.subject,
      text,
      html: correoHtml(spec, filas, replyTo),
    })
    return res.status(200).json({ ok: true })
  } catch (err) {
    // El mensaje de error de SMTP no contiene datos del formulario.
    console.error('Fallo al enviar el email:', err && err.message)
    return res.status(502).json({ error: 'Delivery failed' })
  }
}
