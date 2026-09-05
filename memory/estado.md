# Estado del proyecto

Última actualización: 5 de septiembre de 2026.

## Dónde está

**Fases 0, 1, 2 y 3 hechas y desplegadas** en
<https://ospina-talent-consulting.vercel.app>.

El sitio está migrado, rediseñado, verificado y no depende de Webflow para nada.
`npm test` en verde (15 pruebas). 1,09 MB desde 9,7 MB de export.

## Lo que falta, por orden

1. Las 5 variables SMTP en el panel de Vercel. Hasta entonces los formularios
   devuelven 500, que es el comportamiento acordado.
2. **Confirmar el dominio de producción y recablear canonical, sitemap y OG.**
   Hoy apuntan a la URL de Vercel. Esto va **antes** del cambio de DNS.
3. Cambio de DNS, con el usuario delante.
4. Turnstile o BotID, decidido antes del corte de DNS.
5. Cancelar Webflow.
6. Activar Web Analytics en el panel y devolver su línea de script al HTML.

La lista completa, con las pendientes de cliente, está en el README.

## Decisiones tomadas y por qué

- **Tipografía:** Campton era comercial y se servía descargable desde `/fonts/`.
  El cliente eligió sustituirla por una OFL: **Outfit**, variable, 31 KB, frente a
  756 KB en 7 `.ttf`.
- **Testimonios retirados.** Los cuatro del export eran texto de plantilla con
  nombres inventados y etiquetados como clientes hablando como empleados. El
  carrusel está escrito y espera testimonios reales.
- **Empresas de la biografía de Yohanna** presentadas como «Companies Yohanna has
  worked with», no como clientes de la firma, que se fundó en 2022.
- **«over 50 years» eliminado** de la home: copiado del boilerplate de TCS y
  contradice la fecha de fundación.
- **Retrato de Yohanna:** se planteó que es un fotograma de vídeo doméstico y el
  cliente decidió mantenerlo.
- **Mapa de Google sustituido** por la dirección con enlace: la clave compartida de
  Webflow devuelve `BillingNotEnabledMapError`.

## Trampas de este repo, para el siguiente que lo abra

1. **`.w-form-done, .w-form-fail { display: none }` en `css/components.css` no es
   decorativa.** Si se borra, los mensajes de éxito y error se ven a la vez y de
   forma permanente, **sin lanzar ningún error**. Es la forma más fácil de publicar
   una página rota creyendo que no se ha tocado nada.
2. **`accesslint` da 0 violaciones con las 141 imágenes en `alt=""`.** El atributo
   está presente, así que el chequeo pasa. Los textos alternativos hay que mirarlos
   a mano, abriendo cada imagen. Yo mismo escribí cinco `alt` desde el nombre del
   fichero y dos describían la misma foto de formas incompatibles.
3. **El panel del navegador oculto no pinta la página.** Las capturas salen en
   blanco o devuelven el fotograma anterior, `img.decode()` no resuelve y los
   `computer` de scroll dan timeout. Con el panel oculto hay que medir por DOM y
   usar `createImageBitmap` en vez de `decode()`.
4. **`scroll-behavior: smooth` rompe `scrollTo` en las mediciones.** Hay que pasar
   `behavior: 'instant'` o el `scrollY` medido es 7 en vez de 950.
5. **Componer el alfa antes de medir contraste.** Un medidor que lea
   `rgba(255,255,255,.08)` como opaco devuelve 1:1 y da por rojo lo que en realidad
   es 8,12:1.
6. **`IFS=:` en zsh con un campo que contiene espacios** creó un fichero llamado
   `IT-solutions-1200 800.jpg`. Si un bucle genera ficheros, listar el resultado.
7. **El barrido de huérfanos por poco se lleva 12 iconos de marca** que encajaban
   uno a uno con el contenido. Antes de borrar, mirar qué hay en la lista.
