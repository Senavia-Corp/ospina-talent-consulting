// Servidor estatico minimo para la verificacion local. Sin dependencias.
// Replica lo unico de Vercel que importa aqui: cleanUrls (sirve /about-us -> about-us.html).
const http = require('node:http'), fs = require('node:fs'), path = require('node:path')
const ROOT = path.resolve(process.argv[2] || '.'), PORT = Number(process.argv[3] || 4321)
const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp',
  '.gif':'image/gif', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf',
  '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml; charset=utf-8' }

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  let file = path.join(ROOT, url)
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return }   // path traversal
  if (url.endsWith('/')) file = path.join(file, 'index.html')
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (fs.existsSync(file + '.html')) file += '.html'                          // cleanUrls
    else { res.writeHead(404, {'content-type':'text/plain'}).end('404 ' + url); return }
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
                       'cache-control': 'no-store' })
  fs.createReadStream(file).pipe(res)
}).listen(PORT, () => console.log(`sirviendo ${ROOT} en http://localhost:${PORT}`))
