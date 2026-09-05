# Accesos e identificadores

**Aquí no hay ninguna credencial y no debe haberla.** Solo dónde está cada cosa y
con qué identidad se llega.

## Repositorio

- `github.com/Senavia-Corp/ospina-talent-consulting`, privado.
- `gh` autenticado como **senaviacorp**. Scopes del token: `gist`, `read:org`,
  `repo`, `workflow`. **No tiene `admin:org` ni `delete_repo`.**
- **Autor de los commits: `hosting@senaviacorp.com`**, fijado local al repo.
  El `user.email` global de la máquina es `sebastian@senaviacorp.com` y **no vale**:
  Vercel compara el email del autor con los miembros del equipo y bloquea el
  despliegue con `TEAM_ACCESS_REQUIRED`.

## Vercel

- Equipo (scope): **`senaviacorp`**. Proyecto: `ospina-talent-consulting`.
- Los identificadores están en `.vercel/project.json`, que está ignorado por git.
- El CLI **no está instalado global**: se usa `npx --yes vercel@latest`.
- **No usar el MCP de Vercel.** Apunta al equipo *Manuel Ramirez's projects* y
  devuelve 403 al crear proyectos. El CLI sí ve `senaviacorp`.
- **`vercel git connect` no funciona aquí**: el repo es privado y de una
  organización, y el plan Hobby no lo soporta. El despliegue es a mano.

```bash
npx --yes vercel@latest deploy --prod --scope senaviacorp --yes
```

## Variables de entorno

Las cinco viven en el panel de Vercel, nunca en el repo:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`.

`npm run check-smtp cuenta@dominio.com` verifica una credencial SMTP sin enviar
correo y sin desplegar.

## Datos públicos del cliente (salen del propio sitio)

- Teléfono: (786) 376-2195 · Email: cio@ospinatalentconsulting.com
- 8400 NW 36th Street, Suite 450, Doral, FL 33178
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
