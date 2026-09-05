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

const ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO']

// ponytail: contador en memoria. Fluid Compute reutiliza instancias pero no las comparte,
// asi que el limite es por instancia y un atacante repartido lo supera. Corta el abuso
// trivial sin anadir servicios; para algo serio, Turnstile o BotID (ver README).
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

  const text = Object.entries(spec.fields)
    .map(([name, label]) => `${label}: ${value(name) || '-'}`)
    .join('\n')

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
    })
    return res.status(200).json({ ok: true })
  } catch (err) {
    // El mensaje de error de SMTP no contiene datos del formulario.
    console.error('Fallo al enviar el email:', err && err.message)
    return res.status(502).json({ error: 'Delivery failed' })
  }
}
