// Prueba la credencial SMTP sin desplegar ni enviar ningun correo.
//
// Existe porque el ciclo "pegar la variable en Vercel -> redesplegar -> probar el
// formulario" son varios minutos por intento, y un 535 de Gmail no dice cual de las
// cuatro causas posibles es. Esto tarda dos segundos.
//
//   node scripts/check-smtp.js cuenta@dominio.com    # pide la clave, oculta al teclear
//   SMTP_USER=... node scripts/check-smtp.js         # o por variable de entorno
//   echo "clave" | node scripts/check-smtp.js c@d.com  # por tuberia, para scripts

const nodemailer = require('nodemailer')
const readline = require('node:readline')

const user = process.argv[2] || process.env.SMTP_USER
const host = process.env.SMTP_HOST || 'smtp.gmail.com'
const port = Number(process.env.SMTP_PORT || 465)

if (!user) {
  console.error('Falta la cuenta. Uso: node scripts/check-smtp.js cuenta@dominio.com')
  process.exit(2)
}

function preguntarOculta(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const tapar = () => rl.output.write('\x1B[2K\x1B[200D' + q)
    process.stdin.on('data', tapar)
    rl.question(q, (a) => {
      process.stdin.removeListener('data', tapar)
      rl.close()
      process.stdout.write('\n')
      res(a)
    })
  })
}

function leerTuberia() {
  return new Promise((res) => {
    let d = ''
    process.stdin.on('data', (c) => (d += c))
    process.stdin.on('end', () => res(d))
  })
}

;(async () => {
  const bruto = process.stdin.isTTY
    ? await preguntarOculta(`Clave de ${user}: `)
    : await leerTuberia()

  const pass = bruto.replace(/\s/g, '') // Google la enseña en 4 bloques; van sin espacios
  if (!pass) {
    console.error('No se recibio ninguna clave.')
    process.exit(2)
  }

  console.log(`\ncuenta   ${user}`)
  console.log(`servidor ${host}:${port}`)
  console.log(`clave    ${pass.length} caracteres${/\s/.test(bruto) ? ' (le quite los espacios)' : ''}`)
  if (host.includes('gmail') && pass.length !== 16) {
    console.log(`\n  Aviso: una app password de Google son 16 caracteres, y esta tiene ${pass.length}.`)
  }

  try {
    await nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
    }).verify()
    console.log('\nOK. El servidor acepta la credencial. Ya se puede poner en Vercel como SMTP_PASS.')
  } catch (err) {
    const m = String(err && err.message)
    console.log(`\nRECHAZADA: ${m.split('\n')[0]}`)
    if (/535|BadCredentials|Invalid login/i.test(m)) {
      console.log(`
Gmail devuelve 535 por una de estas cuatro razones, en orden de probabilidad:

  1. La clave no es la app password sino la contrasena normal de la cuenta.
     Las app passwords se generan en myaccount.google.com/apppasswords
  2. La app password se genero en OTRA cuenta de Google, no en ${user}.
     Tienen que ser la misma cuenta.
  3. La cuenta no tiene la verificacion en dos pasos activada. Sin ella
     Google ni siquiera ofrece app passwords, y las antiguas dejan de valer.
  4. La app password fue revocada. Se genera otra y listo.`)
    }
    process.exit(1)
  }
})()
