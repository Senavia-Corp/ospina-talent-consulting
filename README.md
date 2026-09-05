# Ospina Talent Consulting

Sitio de Ospina Talent Consulting, migrado de Webflow a Vercel.
7 páginas estáticas, sin CMS, sin build, **sin una sola dependencia de terceros
en runtime**.

Desplegado en <https://ospina-talent-consulting.vercel.app>

El repo tiene dos hitos que conviene conocer:

```bash
# el export original de Webflow, sin tocar
git diff $(git rev-list --max-parents=0 HEAD) --stat

# solo el rediseño visual (a61abf4 es el final de la fase 1)
git diff a61abf4 --stat
```

## Estructura

| | |
|---|---|
| `*.html` | Las 7 páginas. HTML escrito a mano, sin generador |
| `css/tokens.css` | Tipografía, paleta, escala y el chaflán. **Las reglas de contraste están escritas aquí** |
| `css/base.css` | Reset, elementos, primitivas de maquetación y las tres variantes del chaflán |
| `css/components.css` | Cabecera, botones, filas de servicio, franjas, valores, pasos, casos, formularios y pie |
| `css/pages.css` | La composición de cada página |
| `js/site.js` | 157 líneas: menú móvil y flechas del carrusel. Nada más |
| `js/form-submit.js` | Envía los formularios a la API y replica el done/fail de Webflow |
| `api/submit.js` | Recibe los 2 formularios y los manda por email |
| `fonts/` | Outfit variable, subconjunto latino, 31 KB (SIL OFL) |
| `test/` | `npm test`. **Es la puerta: si no pasa, no está terminado** |
| `robots.txt`, `sitemap.xml`, `vercel.json` | SEO técnico y configuración de la plataforma |

## Desarrollo

```bash
node .claude/serve.js . 4321   # estático con cleanUrls, sin dependencias
npm test                       # la puerta
npm run check-smtp cuenta@dominio.com   # verifica la credencial SMTP sin enviar nada
```

`.claude/serve.js` replica lo único de Vercel que importa en local: `cleanUrls`,
que sirve `/services` desde `services.html`.

## Despliegue

No se usa el MCP de Vercel: apunta a otro equipo y devuelve 403 al crear
proyectos. Y `vercel git connect` falla porque el repo es privado y de una
organización, cosa que el plan Hobby no soporta. Se despliega a mano:

```bash
npx --yes vercel@latest deploy --prod --scope senaviacorp --yes
```

**El autor de los commits tiene que ser `hosting@senaviacorp.com`.** Vercel compara
ese email con los miembros del equipo y bloquea con `TEAM_ACCESS_REQUIRED`. Está
fijado local al repo, no global.

## El sistema visual

Dos recursos y nada más: **planos violeta planos** y una **esquina achaflanada**,
como la de un conector con clave.

Lo que este sistema no hace, a propósito, porque es lo que hacía el export:
degradados de violeta al 70 % encima de cada fotografía. Había cinco. La
fotografía va a plena fuerza o no va.

### Contraste

El violeta de marca `#6214a8` es el caso raro que sirve de **tinta y de superficie
a la vez**: 9,67:1 en los dos sentidos. Todos los pares están medidos, no
estimados, y las reglas completas están comentadas al principio de
`css/tokens.css`, que es donde hay que leerlas antes de tocar un color.

La que más fácil se incumple: **el ámbar `#f2a413` no es texto sobre claro**
(2,08:1 sobre blanco, falla). Sobre ámbar va tinta oscura (11,1:1); sobre violeta
funciona como gráfico y como texto grande (4,65:1).

Los pares que van sobre un velo semitransparente hay que **componer el alfa a
mano**: un medidor que lea `rgba(255,255,255,.08)` como si fuera opaco devuelve
1:1 y miente. Compuesto sobre el violeta da 8,12:1.

### El chaflán

Los dos catetos miden lo mismo y en unidades absolutas (`--notch`), así que el
corte es de **45° exactos a cualquier ancho**. Con porcentajes no lo sería:
`clip-path` los resuelve por eje contra la caja del elemento y el ángulo se movería
con la relación de aspecto.

> ⚠ `clip-path` crea bloque contenedor para descendientes `position: fixed`. **Nada
> fijo puede vivir dentro de un elemento achaflanado.** La cabecera es hermana de
> todas las secciones, así que se cumple por estructura.

### Movimiento

Hay **un** momento animado en todo el sitio, el de la portada, y es CSS puro. Se
**añade** dentro de `@media (prefers-reduced-motion: no-preference)` en vez de
quitarse bajo `reduce`, de modo que el estado por defecto es el visible.

Esto no es un detalle de estilo. El export ocultaba 28 elementos con
`style="opacity:0"` y los revelaba con un disparador `SCROLL_INTO_VIEW` de Webflow
IX2, **que no dispara para lo que ya está en el viewport**. Aquí la visibilidad
del contenido no depende de JavaScript en ningún momento, y no queda ni un
`opacity:0` en el HTML.

## Formularios

Son **dos**: contacto (`?f=contact`) y partners (`?f=partner`). El del pie, que
estaba repetido en las 7 páginas y pedía un email para una newsletter que no
existe, se sustituyó por un enlace a `/contact`.

`js/form-submit.js` intercepta el `submit` **en fase de captura**. Al tocar estas
dos páginas hay que conservar:

- el `action` (`/api/submit?f=...`);
- el envoltorio `.w-form`, con `.w-form-done` y `.w-form-fail` **como hermanos del
  `<form>`**;
- el `[type="submit"]` con `data-wait`;
- **todos los `name=`**, que `api/submit.js` tiene en lista blanca uno a uno;
- el campo trampa `fax`, dentro de `.form-hp`.

> ⚠ **`.w-form-done` y `.w-form-fail` llevan `display: none` en
> `css/components.css`.** Esa regla venía de `css/webflow.css`, que este rediseño
> borró, y `form-submit.js` solo hace `display:block` al enviar: nunca los oculta
> al cargar. Sin esa regla los dos mensajes se ven permanentemente en las dos
> páginas con formulario, **y sin lanzar ningún error**.

### Reglas de `api/submit.js`

1. **Solo POST.** Un GET devuelve 405. Es lo que evita que el DUNS y los datos
   fiscales acaben en la barra de direcciones, el historial y los logs de acceso.
2. **Lista blanca de campos.** Lo que no está en `FORMS` no se lee ni se envía.
3. **El contenido del formulario no se loguea nunca.**

Anti-abuso: honeypot en los dos formularios y límite de 5 envíos por IP cada 10
minutos. El contador vive **en memoria**, así que es por instancia y no cubre un
ataque repartido entre muchas IP. Corta el abuso trivial sin añadir servicios.

### Variables de entorno

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`. Las cinco son
obligatorias; si falta una, la función responde 500 y registra solo los nombres
que faltan, nunca valores.

Para comprobar que propagaron **sin mandar correo**:

```bash
curl -X POST -d 'name=solo' https://ospina-talent-consulting.vercel.app/api/submit?f=contact
```

La respuesta debe pasar de `500 {"error":"Mail not configured"}` a
`400 {"error":"Missing required fields"}`.

## Verificado

Sobre el build servido, no a ojo:

- **7 páginas × 375, 768, 1023, 1024 y 1440**: 0 scroll horizontal, 0 elementos en
  `opacity:0` (con las animaciones terminadas), un solo `<h1>` por página, sin
  saltos de nivel de encabezado, ninguna `<img>` sin `alt`, 0 errores de consola.
- **Contraste de texto**: todos los pares de las 7 páginas pasan AA. El peor es
  4,62:1, el teléfono en ámbar sobre violeta, que va a 24px.
- **Contraste del anillo de foco** (WCAG 1.4.11, 3:1): los 23 pares de las 7
  páginas pasan. El color sale de `--focus-c` porque **ningún color solo servía**:
  el ámbar da 2,08:1 sobre blanco y el violeta 1,00:1 sobre los planos violeta.
  Violeta sobre claro, ámbar sobre oscuro.
- **accesslint** sobre las 7 páginas servidas: 0 violaciones. Ojo: eso ya salía en
  verde con las 141 imágenes en `alt=""`, así que **no sustituye a mirarlo a mano**.
- **Cero peticiones a terceros** en producción, comprobado en el panel de red.
- **Anclas de `/services`**: las 5 caen a 139px bajo la barra fija, el mismo valor
  en las cinco. El `scroll-padding` y la altura de la cabecera salen del mismo
  token, así que no pueden desincronizarse.
- **Sin zona muerta de media query**: en 1023px el botón de menú existe y el panel
  es `fixed`; en 1024px el botón desaparece y el nav es `static` y visible.
- **Menú**: abre con el foco en el primer enlace, `Tab` cicla entre los 7, `Escape`
  cierra y devuelve el foco al botón, y el contenido de detrás queda `inert`. Sin
  JS el botón no existe y los enlaces se ven apilados.
- **Formularios**, con `fetch` doblado y sin enviar correo: los dos paneles
  calculan `display:none` al cargar; con `ok:true` sale el de éxito, se oculta el
  formulario y el foco va al panel; con `ok:false` sale el de error y el botón se
  restaura. En el de partners viajan 24 pares, con `address` y `company-phone` a la
  vez, y `zip-code` y `state` a la vez: en el export cada uno de esos pares
  compartía `name` y uno pisaba al otro.
- **Peso**: 1,09 MB el sitio entero, desde 9,7 MB de export. La página más pesada
  transfiere ~290 KB.
- **`srcset`**: a 375px las 8 fotografías bajan la variante de 800w (24–67 KB); a
  1440px bajan la de 1200w o 1600w, a ~2,2× del tamaño en pantalla.
- **Todos los assets en producción**: 49 URLs referenciadas, las 49 a 200.
- **Compartir**: `og:image` es 1200×630 (la relación 1,91:1 que piden las redes) y
  responde 200. Los 7 `title` y las 7 `description` son únicos y caben sin que
  Google los corte.
- **404**: una URL inexistente devuelve HTTP 404 con la página del sitio, no la
  genérica de Vercel con su identificador interno de infraestructura.

**Lo que NO se pudo verificar renderizado:** el aspecto del anillo de foco y del
enlace de salto. El panel del navegador de la sesión nunca recibe foco
(`document.hasFocus()` es `false` siempre), así que `:focus` y `:focus-visible` no
casan con nada. Se verificó por inspección de la regla y calculando el contraste;
falta verlo con un teclado de verdad.

## Pendiente

### Del despliegue

1. **Las 5 variables SMTP.** Sin ellas los formularios devuelven 500.
2. **Confirmar el dominio de producción.** Hoy el canonical, el sitemap y las
   etiquetas OG apuntan a `ospina-talent-consulting.vercel.app`. El `mailto:` del
   propio sitio sugiere `ospinatalentconsulting.com`. **Hay que recablear las tres
   cosas antes del cambio de DNS.**
3. **Cambio de DNS**, con el usuario delante. **El DNS sigue en Webflow.**
4. **Turnstile**, que necesita el dominio dado de alta en Cloudflare. Ver el punto
   9 de la lista de cliente.
5. **Cancelar Webflow**, ya con el DNS verificado.
6. **Activar Web Analytics** en el panel del proyecto. El script se añadió y hubo
   que quitarlo porque sin activar devuelve 404 y ensucia la consola de las 7
   páginas. Volver a ponerlo es una línea antes de `</body>`:
   `<script defer src="/_vercel/insights/script.js"></script>`.

### Del cliente

7. **Retrato de Yohanna.** El que hay es un fotograma de vídeo escalado: un selfie
   en un entorno doméstico, con el triángulo de reproducción incrustado en la
   esquina. Se planteó y el cliente decidió mantenerlo. Un headshot profesional
   mejora la página que más tiene que sostener la credibilidad de la consultora.
8. **Testimonios.** Los cuatro del export se retiraron: eran texto de plantilla con
   nombres inventados («Jhon Smith»), dos de ellos casi idénticos, etiquetados como
   clientes cuando hablaban como empleados. El carrusel (`scroll-snap` + flechas)
   está escrito y esperando testimonios reales con nombre y cargo verificables.
9. **`/api/submit` es un relé de correo público.** El honeypot y el límite por IP
   cortan el abuso trivial; el límite en memoria no se comparte entre instancias.
   Con DUNS y datos de empresa en el formulario de partners, conviene decidir
   Turnstile o BotID **antes** del corte de DNS, no después.
10. **Mapa de Google.** El widget del export usaba la clave compartida de Webflow,
    que devuelve `BillingNotEnabledMapError`: renderiza en modo desarrollo, con
    marca de agua. Se sustituyó por la dirección con un enlace a Google Maps, que
    no pide nada a terceros. Si se quiere el mapa incrustado hace falta una clave
    propia del cliente con facturación activa.
11. **Logos de certificaciones y clientes.** Las dos franjas son tipográficas. Con
    los ficheros de logo quedarían mejor; ojo con las normas de uso de marca de
    ITIL e IBM.
12. **Variante oficial del logotipo para fondo claro.** `images/Logo.svg` es blanco
    en 33 de sus 42 elementos y su clase en el export era literalmente
    `logo-white`. Se derivó `Logo-ink.svg` cambiando el blanco por el color de
    tinta; lo ideal es que el cliente facilite la suya.
13. **Frases que se corrigieron y conviene que el cliente valide.** La home decía
    que la empresa lleva «over 50 years» acompañando a las mayores empresas del
    mundo, frase copiada literal del boilerplate corporativo de TCS, cuando
    `/leadership` dice que se fundó en enero de 2022. También había un titular
    sobre «ITSM software» que Ospina no vende. Y las empresas de la biografía de
    Yohanna figuran ahora como «Companies Yohanna has worked with», no como
    clientes de la firma.
14. **No hay CMS.** La navegación y el pie están duplicados en las 7 páginas. Sin
    capa de edición el cliente no puede tocar nada y el contenido va a divergir.
    Fuera de alcance salvo que se pida.
