# Accesos e identificadores

**Aquí no hay ninguna credencial y no debe haberla.** Solo dónde está cada cosa y
con qué identidad se llega.

## Repositorio

- `github.com/Senavia-Corp/ospina-talent-consulting`, público.
- `gh` autenticado como **senaviacorp**. Scopes del token: `gist`, `read:org`,
  `repo`, `workflow`. **No tiene `admin:org` ni `delete_repo`.**
- **Autor de los commits: `hosting@senaviacorp.com`**, fijado local al repo.
  El `user.email` global de la máquina es `sebastian@senaviacorp.com` y **no vale**:
  Vercel compara el email del autor con los miembros del equipo y bloquea el
  despliegue con `TEAM_ACCESS_REQUIRED`.

## Vercel

- **Cuenta del cliente desde el 2026-09-22**: equipo `ospina-talent-consulting`
  (`team_sBV9Kc5airYXSG9VzP9kmisF`, Hobby). Proyecto `ospina-talent-consulting`
  (`prj_dm2acerQnsdii1KNZmu4SVZWnCCz`), transferido desde `senaviacorp` con el
  mismo id. Senavia llega por Composio, cuenta `vercel_hound-sile`.
- **Git enlazado** al repo: push a `main` = producción; cualquier otra rama = preview.
- **No usar `--scope senaviacorp`**: el proyecto ya no está ahí y el CLI crearía
  otro. `.vercel/project.json` (ignorado por git) sigue apuntando a ese equipo.
- El CLI **no está instalado global**: se usa `npx --yes vercel@latest`.
- **No usar el MCP de Vercel.** Apunta al equipo *Manuel Ramirez's projects* y
  devuelve 403 al crear proyectos.

## Variables de entorno

Las seis viven en el panel de Vercel, nunca en el repo:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`, `TURNSTILE_SECRET_KEY`.

Turnstile: widget en la cuenta de Cloudflare del cliente (Ospinatalentconsult...).
La site key es pública y va en el HTML de /contact y /become-a-partner; la secret
key solo en Vercel.

`npm run check-smtp cuenta@dominio.com` verifica una credencial SMTP sin enviar
correo y sin desplegar.

## Datos públicos del cliente (salen del propio sitio)

- Teléfono: (786) 376-2195 · Email: cio@ospinatalentconsulting.com
- ~~8400 NW 36th Street, Suite 450, Doral, FL 33178~~ — **RETIRADA del sitio a
  petición del cliente (septiembre de 2026).** Ya no aparece en ninguna página:
  ni en el pie, ni en la ficha de Office de /contact, ni en el JSON-LD de la
  home, ni en las descripciones meta. **No volver a ponerla.** Lo que sí se
  queda es «Doral, FL» como zona de servicio (títulos, descripciones y
  `areaServed`): eso es cobertura, no domicilio. La foto de /about-us es de ese
  edificio y se mantiene, con un `alt` que ya no dice dónde está ni afirma que
  la empresa tenga ahí su sede.
- Lunes a viernes, 8:00–18:00
- LinkedIn: `/company/97204468/` — **ojo**, el export enlazaba a
  `/company/97204468/admin/feed/posts/`, que es el panel de administración y da
  404 a cualquier visitante.

## Del sitio de Webflow que se abandona

- Site ID: `6a95a7e9d506502e51ebb779`. Staging: `ospina-talent-consulting.webflow.io`.
- **El DNS sigue en Webflow.** No se ha tocado.
- Los 3 SVG que el export cargaba desde `uploads-ssl.webflow.com` colgaban de dos
  sites **ajenos a este** (`6363d1af67a37a01ecc6aa6c` y `645007aaceb6f68b309669e8`):
  eran assets copiados de plantilla.
- Widget de Elfsight `c959b8bf-bd84-4be0-81d4-7645c68e07de`: **ya estaba roto** antes
  de migrar. Devuelve `WIDGET_NOT_FOUND` y pintaba 0 hijos y 0px de alto.
