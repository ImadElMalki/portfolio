# Portfolio · CV en Astro

> **In English.** The source of [imadelmalki.com](https://imadelmalki.com): a
> trilingual static portfolio and CV (Spanish, Catalan, English) built with
> [Astro](https://astro.build/) and deployed to Cloudflare Pages. One
> [JSON Resume](https://jsonresume.org/) file feeds the pages, a one-page PDF
> per language, the JSON-LD for search engines and the portable endpoints
> (`/cv.json`, `/cv.md`, `/llms.txt`). No UI framework ships to the browser.
> The dynamic parts are Pages Functions: a contact form, a hit counter writing
> to Analytics Engine, and an assistant that answers questions about the CV,
> both rate-limited with atomic counters in D1.
>
> What is worth a look is the quality gate. Every build fails on a strict CSP
> whose hashes are recomputed from the HTML, on per-page budgets for HTML, DOM
> and CSS, on a total JavaScript budget, and on a PDF checked page by page.
> On top of that, CI runs unit, browser, axe accessibility and containerised
> visual-regression tests, and a Lighthouse job that blocks the deployment when
> the home page goes over 2.5 s of LCP. The rest of this README is in Spanish;
> [`docs/`](docs/) and the code comments explain the why of each decision.
>
> Licensing: the code is MIT; the CV text, the photographs and the personal
> data are not — see [Licencia](#licencia).

Portfolio estático trilingüe (castellano, catalán e inglés) generado a partir de
un CV en formato [JSON Resume](https://jsonresume.org/). El mismo `cv.json`
alimenta la página, el CV en PDF, el JSON-LD para buscadores y los endpoints
portables (`/cv.json`, `/cv.md`, `/llms.txt`), en los tres idiomas.

## Puesta en marcha

```bash
npm ci                 # Node 24.19.0 (también fijado en .node-version)
npm run dev            # http://localhost:4321
npm run build          # build fuente → PDF ES/CA/EN → build final validado
npm run preview        # sirve dist/
npm test               # Vitest sobre src/lib y Functions
npm run audit:prod     # solo dependencias que llegan a producción
npm run format:check   # Prettier sin modificar archivos
npm run check:bindings # tipos de Wrangler sincronizados con wrangler.jsonc
npm run check:links    # enlaces de dist/: --internal en la CI, --external cada lunes
npm run scan:secrets   # historial Git con Gitleaks fijado en contenedor
npm run test:lighthouse # Lighthouse en Chromium Linux limpio: mediana de tres tandas
npm run test:services  # pruebas dirigidas de la landing de servicios
npm run test:functions # humo de /api/* con wrangler pages dev (necesita dist/)
npm run test:browser   # Playwright sobre dist/: Chromium móvil y escritorio, WebKit móvil
npm run test:visual    # referencias visuales dentro del contenedor fijado de Playwright
```

Y los que se usan menos, pero existen:

```bash
npm run check:functions     # tipos de las Pages Functions, con su propio tsconfig
npm run cv:pdf              # los tres PDF desde dist/ (npm run build ya lo encadena)
npm run cv:pdf:ats          # extracción de texto de los PDF con PDF.js y Poppler
npm run favicons            # favicon.ico, icon-96 y apple-touch-icon desde favicon.svg
npm run ask:questions       # public/ask-questions/*.json desde src/data/askQuestions.ts
npm run deployment:manifest # huella de dist/ ligada al commit (la escribe la CI)
npm run deployment:verify   # comprueba esa huella antes de desplegar
```

> `npm run test:services` y `npm run test:browser` no pueden correr a la vez: el
> primero hace su propio `npm run build` y ambos comparten `dist/` y el puerto 4390. En paralelo, el servidor sirve un HTML a medio escribir y aparecen
> fallos que no son del código.

> `npm run build` es la única cadena válida para publicar: construye primero la
> fuente, genera los tres PDF con Chromium, vuelve a construir `dist/` con esos
> artefactos y valida el manifiesto `cv-pdf-manifest.json`. El manifiesto guarda
> la huella de las fuentes curriculares y el SHA-256 y tamaño de cada PDF.
>
> Lo que garantiza la frescura es **el orden del build**, no el manifiesto: los
> PDF se regeneran en cada ejecución, así que `public`, `dist` y el manifiesto
> salen siempre de la misma tanda y una copia antigua no puede colarse en el
> artefacto. **Los PDF y su manifiesto no se versionan** (`.gitignore`): la CI
> genera los suyos y son ésos los que se despliegan. Mientras se commiteaban
> sólo servían para discrepar, porque Windows y Linux producen bytes distintos a
> partir del mismo `cv.json`. En un clon recién hecho, `npm run build` los crea
> en `public/`. Dentro de una misma máquina la salida es reproducible byte a
> byte: la fecha de creación va fijada —Skia sellaba la hora— y los enlaces
> internos se reescriben al dominio canónico antes de imprimir.
>
> Cada PDF usa un documento curricular visual derivado de `cv.json`: retrato,
> cabecera compacta y dos columnas con los dos empleos, dos proyectos, DAW,
> cinco certificaciones e idiomas. Las rutas HTML equivalentes son accesibles y
> están fuera del sitemap. Cada archivo es **una hoja A4** y se verifica solo:
> [`scripts/check-cv-pdf.mjs`](scripts/check-cv-pdf.mjs) corre al final de
> `npm run cv:pdf` —también en la CI— y falla si aparece una segunda página, si
> aparece más de una imagen raster, si Inter no viaja dentro del archivo o si el
> CV se queda sin enlaces pulsables. PDF.js y Poppler comprueban además que todo
> el texto se extrae en el orden visual previsto. Es una protección de mejor
> esfuerzo, no una certificación universal de los distintos ATS.

Hay cuatro redes de seguridad, y ninguna solapa a las otras:

- **[`src/lib/*.test.ts`](src/lib)** cubre la lógica compartida por la página y
  los endpoints: el escapado del Markdown, los `slug` y las
  fechas, el aplanado a JSON Resume, el JSON-LD y el diccionario de interfaz
  (ninguna clave vacía en ninguno de los tres idiomas).
- **[`scripts/check-build.mjs`](scripts/check-build.mjs)** vigila el HTML que
  sale del build, que es donde aparecieron los problemas de las auditorías: un
  solo `<h1>` por página, `id` únicos, `<title>` de 60 caracteres o menos,
  `description` de 160 o menos, los nueve endpoints portables, JSON Resume,
  CSP, `lang`, canonical y `hreflang` recíprocos, destinos de anclas,
  presupuestos por página de HTML, DOM y CSS —el incrustado y el enlazado, con
  sus hojas, bytes y Brotli— más el JS total
  ([`scripts/budgets.mjs`](scripts/budgets.mjs)), y
  tarjetas OG 1200×630. Comprueba también que **cada documento declare el hash
  de cada guion y estilo en línea que lleva**, en su directiva —hasta el
  07-10-2026 el build repartía a todas las páginas la unión de los hashes de
  todas, que con `<ClientRouter />` hacía falta y que podía tapar uno ausente—,
  y que el sitemap declare, URL por URL, los mismos `hreflang` que la página.
- **[`scripts/functions-smoke.mjs`](scripts/functions-smoke.mjs)** levanta
  `wrangler pages dev` sobre `dist/` sin secretos y comprueba la degradación
  cerrada: `hit` calla con 204, `contact` y `ask` responden 503, un método que no
  sea POST recibe 405 y otro origen recibe 403. Las pruebas de Vitest cubren
  además HMAC, tamaños reales, timeouts y cancelación de streams, y el
  limitador contra un D1 local de verdad con el esquema de `migrations/`
  ([`rateLimit.d1.test.ts`](functions/_shared/rateLimit.d1.test.ts)).
- **[`tests/browser/`](tests/browser)** es la suite de Playwright sobre `dist/`
  servido con `vite preview`: navegación, asistente, diálogos, formulario,
  accesibilidad con axe y la portada en frío contra sus presupuestos, en
  Chromium móvil y escritorio y en WebKit móvil. `visual.spec.ts` compara las
  referencias dentro del contenedor fijado de Playwright, en local con
  `npm run test:visual` y en el job `visual` de la CI.

**TypeScript se queda en 6.x a propósito.** `astro check` necesita la API
programática del compilador, y el compilador nativo de TypeScript 7 todavía no la
expone: con 7.x instalado el paso aborta y `npm run build` falla entero. El
seguimiento está en la
[hoja de ruta de Astro](https://github.com/withastro/roadmap/discussions/1321);
hasta que se cierre, 7.x no es una actualización disponible para este proyecto.

## Editar el contenido

El contenido del currículum vive en [`cv.json`](cv.json). La colección Content Layer
`portfolio` lo carga como una única entrada `cv`, lo valida con el esquema Zod
estricto de [`src/lib/cvSchema.ts`](src/lib/cvSchema.ts) y expone la frontera
asíncrona `getCv()`. `CvData` se infiere del esquema; no hay tipos duplicados.

La presentación larga de «Sobre mí» está en
[`src/data/about.ts`](src/data/about.ts) y la oferta para pequeños negocios en
[`src/data/services.ts`](src/data/services.ts). Están separadas del JSON Resume
para que no aparezcan en el CV, el Markdown ni los PDF.

| Clave       | Se renderiza en                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `basics`    | Hero, Sobre mí, metadatos y JSON-LD (`headline` es el `<title>`, `tagline` la `description`)                             |
| `work`      | Experiencia laboral                                                                                                      |
| `education` | Educación                                                                                                                |
| `languages` | Idiomas                                                                                                                  |
| `projects`  | Proyectos (`status`: `published` \| `in-development` \| `private`; `technologies` lleva los nombres canónicos con icono) |
| `skills`    | Habilidades                                                                                                              |

Proyectos, galerías y tecnologías se relacionan mediante IDs estables. El
registro de [`src/lib/techIcons.ts`](src/lib/techIcons.ts) asocia de forma
explícita nombre fuente, ID e icono opcional; un cambio del texto visible no
rompe la relación.

El formato compartido (etiquetas de estado, fechas, slugs) está centralizado en
[`src/lib/cvFormat.ts`](src/lib/cvFormat.ts): cambiarlo ahí actualiza a la vez la
web y `/cv.md`.

## Idiomas

Los campos traducibles de `cv.json` son objetos con los tres idiomas:

```jsonc
"summary": { "es": "…", "ca": "…", "en": "…" }
```

Si falta uno, hay una fecha inválida o aparece una clave desconocida, **el build
falla** al sincronizar la colección. Los nombres de proyecto y la región sí son
localizados; tecnologías, marcas, URLs y fechas conservan su valor canónico.

Los textos de interfaz viven en el diccionario `UI` de
[`src/lib/ui.ts`](src/lib/ui.ts). Los títulos de sección salen de
[`src/lib/sections.ts`](src/lib/sections.ts), la lista única que conduce página,
navegación y endpoints. Sus `id` son estables en los tres idiomas.

## Dominio

El dominio de producción es `https://imadelmalki.com` y está fijado en
`astro.config.mjs`. Para un despliegue de prueba basta con exportar `SITE_URL`,
que tiene prioridad y alimenta canonical, `og:image` y el sitemap:

```bash
SITE_URL=https://preview.imadelmalki.com npm run build
```

## Rutas generadas

El castellano vive en la raíz; catalán e inglés llevan prefijo (`/ca/`, `/en/`).

| Ruta                                              | Contenido                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `/`, `/ca/`, `/en/`                               | Portfolio                                                        |
| `/cv.md`, `/ca/cv.md`, `/en/cv.md`                | CV en Markdown, enlazado desde el pie                            |
| `/cv.json`, `/ca/cv.json`, `/en/cv.json`          | CV en JSON Resume ya en un solo idioma                           |
| `/cv.pdf`, `/ca/cv.pdf`, `/en/cv.pdf`             | CV en PDF, generado en cada `npm run build` (no se versiona)     |
| `/cv/`, `/ca/cv/`, `/en/cv/`                      | Fuente HTML accesible del PDF, con `noindex` y fuera del sitemap |
| `/ask-questions/{es,ca,en}.json`                  | Preguntas sugeridas del asistente (`npm run ask:questions`)      |
| `/llms.txt`, `/ca/llms.txt`, `/en/llms.txt`       | Resumen para agentes/LLM ([llmstxt.org](https://llmstxt.org))    |
| `/og.jpg`, `/ca/og.jpg`, `/en/og.jpg`             | Tarjeta 1200×630 para redes, compuesta en el build               |
| `/portrait.webp`                                  | Retrato en una URL estable (`basics.image` y JSON-LD)            |
| `/robots.txt`, `/sitemap-index.xml`               | Generados desde `site`, con `hreflang` entre idiomas             |
| `/404.html`, `/ca/404.html`, `/en/404.html`       | Errores localizados; Pages usa el más cercano a cada ruta        |
| `/sobre-mi/`, `/ca/sobre-mi/`, `/en/about/`       | Presentación personal, con metadatos y alternancias propias      |
| `/servicios/`, `/ca/serveis/`, `/en/services/`    | Servicios para pequeños negocios, publicados e indexables        |
| `/privacidad/`, `/ca/privacitat/`, `/en/privacy/` | Política de privacidad localizada, canonical y `hreflang`        |
| `/proyectos/`, `/ca/projectes/`, `/en/projects/`  | Índice de proyectos, indexable y enlazado desde la portada       |
| `/proyectos/<id>/` y sus dos prefijos             | Una ficha por proyecto, indexable; el `<id>` sale de `cv.json`   |
| `/*/project-details/`                             | Fallback `noindex` de los detalles cargados al abrir un proyecto |

### Una URL por proyecto

El detalle de cada proyecto vivía sólo dentro de un `<dialog>` de la portada y en
`/project-details/`, que lleva `noindex`: no había ninguna dirección que enviar
por correo ni que un buscador pudiera recorrer. Desde `/proyectos/<id>/` la hay.

- El **segmento** se traduce (`proyectos`, `projectes`, `projects`) y sale de
  [`src/lib/publicPageSlugs.json`](src/lib/publicPageSlugs.json), la misma tabla
  que usan las otras páginas y de la que `astro.config.mjs` compone los
  `hreflang` del sitemap.
- El **identificador** no se traduce: es el `id` de `cv.json`, el mismo que ya
  nombraba el diálogo y el hash `#proyecto/<id>`. Una dirección compartida abre
  el mismo proyecto se lea el sitio en el idioma que se lea.
- La tarjeta de la portada apunta ahí con un `href` real. El guion intercepta el
  clic y abre el diálogo sin navegar, así que la interacción no cambia; quien
  llegue sin JavaScript, con el botón central o copiando el enlace aterriza en la
  ficha. `scripts/check-build.mjs` comprueba las dos mitades.
- La ficha reutiliza [`ProjectDetail.astro`](src/components/ProjectDetail.astro)
  con `standalone`: mismo contenido, pero en `<article>`, con el título en `<h1>`
  y sin visor de capturas —su guion vive en `ProjectDialogRuntime.astro` y no se
  monta ahí—.
- **Y no es un callejón.** A esta dirección se llega de fuera, así que lleva
  migas de pan hacia la portada y el índice —las mismas que el
  `BreadcrumbList` del JSON-LD ya declaraba—, el siguiente proyecto en el orden
  de `cv.json` y, al cerrar, el CV y el formulario. `check-build.mjs` exige los
  tres caminos y que el siguiente resuelva; `project-pages.spec.ts` los recorre
  en un navegador, que es lo único que distingue un enlace correcto de uno que
  lleva a un 404.
- **El caso de estudio es opcional.** [`src/data/caseStudies.ts`](src/data/caseStudies.ts)
  guarda, por proyecto, el problema, el papel, las decisiones con su porqué, el
  resultado y qué cambiaría. Va fuera de `cv.json` porque son mil palabras por
  idioma que inflarían el PDF y `/cv.json` sin que ninguno las use, y se pinta
  sólo donde hay entrada escrita: un caso a medias se nota y resta. El diálogo
  de la portada enlaza a la ficha cuando hay caso que leer.

## Cabeceras HTTP

El sitio es estático: **las cabeceras que devuelven los endpoints se descartan en
el build**, porque Astro solo escribe el cuerpo de la `Response` a disco. Todo lo
que dependa de cabeceras vive en [`public/_headers`](public/_headers), en el
formato de Cloudflare Pages: CORS y CORP abierto solo para los endpoints
portables, caché inmutable únicamente en `/_astro/*` y cabeceras de seguridad.

La CSP es la excepción: la genera Astro con el hash de cada script y estilo
(`security.csp` en `astro.config.mjs`) y viaja en un `<meta>` del `<head>`, así
que no hace falta `unsafe-inline`. `frame-ancestors` y HSTS no funcionan en un
`<meta>` y por eso siguen en `_headers`.

## Privacidad

El formulario y el asistente muestran una primera capa antes del
envío y enlazan a la política completa localizada. La política documenta
responsable, finalidad, bases jurídicas, proveedores, transferencias,
conservación máxima de 12 meses, derechos y reclamación ante la AEPD. Es un
borrador técnico conservador que debe revisarse jurídicamente antes de publicar.

El control de frecuencia no guarda IPs: deriva un HMAC-SHA-256 con
`RATE_LIMIT_SALT`; D1 conserva sólo el ámbito, la ventana, un contador y su
caducidad, como máximo 24 horas. La analítica usa Analytics Engine, no cookies ni
identificadores personales.

## Estructura

```
src/
  content.config.ts  Colección `portfolio` y loader de la entrada `cv`
  cv.ts           Frontera `getCv()` y tipos públicos inferidos
  assets/         me.webp, el original del retrato: PDF, Open Graph, portrait.webp
                  me-bust(-dark).webp, las variantes recortadas del hero
    fonts/        Inter y JetBrains Mono variables para pantalla, con su licencia
    projects/     Másteres de las capturas, un directorio por proyecto
  components/     Secciones del CV, conmutadores de idioma, vista y tema
                  ProjectDetail.astro: el diálogo de detalle y su visor
                  projects/ProjectDialogRuntime.astro: el guion que lo abre
  data/           about.ts · services.ts · privacy.ts · projects.ts · projectDemos.ts
                  askNotes.ts · askProfile.ts · askQuestions.ts · availability.ts
  icons/          Iconos .astro (sociales y tecnologías)
  layouts/        Layout con metadatos, temas y estilos globales
  lib/            cvSchema · i18n · cvFormat · sections · techIcons · dataUri
                  portfolioMarkdown · localizedCv · jsonLd
                  *.test.ts, las pruebas de cada uno
  styles/         CSS compartido que no es de ningún componente (la insignia de estado)
  test/           Utillaje de las pruebas: el doble de astro:i18n, el cálculo de contraste
  pages/
    [...locale]/  portfolio, páginas públicas y endpoints por idioma
    404.astro     Error castellano; ca/404.astro y en/404.astro localizados
    portrait.webp.ts  Retrato derivado de src/assets/me.webp
    robots.txt.ts Único para todo el sitio
functions/
  api/contact.ts  El buzón del formulario
  api/ask.ts      El asistente: expediente + OpenAI en streaming
  api/hit.ts      Analytics Engine, sin cookies ni identificadores
  _shared/        origen, lectura acotada y rate limiting atómico
                  rateLimit.d1.test.ts: el limitador contra un D1 local de verdad
migrations/       Esquema versionado de D1
public/
  _headers        Cabeceras de Cloudflare Pages
  favicon.svg
scripts/
  budgets.mjs     Presupuestos de HTML, CSS, DOM y JS: una sola fuente
  check-build.mjs Comprobaciones sobre dist/, también como `postbuild`
  check-links.mjs Enlaces internos, anclas y destinos externos
  build-cv-pdf.mjs  Los tres PDF desde dist/, con su verificación
  gitleaks.mjs    Escaneo reproducible del historial en contenedor
  shot-shapes.mjs Formas de captura: ancho del máster y proporciones válidas
  prepare-project-shots.mjs  Capturas en crudo → másteres webp
  fonts/          instance_variable_fonts.py: recorta las fuentes de pantalla
  shots/          Un script de captura por proyecto, con su README
docs/
  historial-presupuestos.md  Cómo se movieron los presupuestos hasta el 30-09-2026
```

Las fuentes se autoalojan con la API de fuentes de Astro (`fonts` en
`astro.config.mjs`), así que el sitio no hace peticiones a terceros en tiempo de
ejecución. En pantalla, Inter y JetBrains Mono son dos archivos variables
recortados a los pesos que usa el CSS, en `src/assets/fonts/`; los genera
`python scripts/fonts/instance_variable_fonts.py`, con el origen fijado por
versión y hash. El CV en PDF y la impresión usan los pesos estáticos de
Fontsource, que se descargan en el build: Chromium convierte las instancias
variables en fuentes Type 3 al imprimir.

## Despliegue

`main` es la única fuente de producción. La Action fijada por SHA ejecuta
instalación exacta, auditoría, Gitleaks, tipos, pruebas, visuales y la cadena de
build completa, y mide la portada con Lighthouse: si el LCP, el CLS, las
peticiones o los bytes pasan de los techos de `scripts/budgets.mjs`, no se
despliega (el TBT sólo avisa). Después añade a `dist/deployment-manifest.json` el SHA del commit
y la huella de la salida; `deploy-production` sólo puede publicar ese artefacto
final. No hay otra ruta automatizada de producción en el repositorio.

La configuración queda limitada a este repositorio:

- variable `SITE_URL=https://imadelmalki.com`;
- variable `CLOUDFLARE_PAGES_PROJECT` con el proyecto Pages auditado;
- secretos `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN`, con un token
  limitado a Cloudflare Pages Edit.

El proyecto Pages debe usar Direct Upload o tener desactivados sus builds de Git
para que no exista un segundo despliegue automático. El dominio personalizado se
asocia desde Pages antes de cambiar DNS; nunca se crea un CNAME huérfano.

## Functions, bindings y desarrollo local

`wrangler.jsonc` versiona la fecha y los flags de compatibilidad, `dist/`, D1 de
producción y preview, Analytics Engine y las migraciones. Los valores secretos
nunca se escriben en Git; se parte de `.dev.vars.example` para desarrollo local.

| Binding o secreto | Uso                                                         |
| ----------------- | ----------------------------------------------------------- |
| `RATE_LIMIT_DB`   | D1 con contadores atómicos para `ask` y contacto            |
| `RATE_LIMIT_SALT` | Secreto HMAC; sin él ambos endpoints fallan con 503         |
| `HITS`            | Dataset de Analytics Engine; sin él `/api/hit` responde 204 |
| `OPENAI_API_KEY`  | Secreto de OpenAI; sin él `/api/ask` responde 503           |
| `ASK_DOSSIER`     | Opcional; contexto adicional que debe considerarse público  |
| `CF_ACCOUNT_ID`   | Cuenta usada por Email Sending                              |
| `EMAIL_API_TOKEN` | Token limitado para Email Sending                           |
| `CONTACT_TO`      | Buzón receptor                                              |
| `CONTACT_FROM`    | Remitente verificado                                        |

El KV `ASK_RATE`, que contaba las preguntas antes de D1, ya no existe: D1 lleva
en producción desde el 31-08-2026, y el espacio de nombres `portfolio-ask-rate`
se borró de la cuenta el 06-10-2026, vacío y sin ningún despliegue que lo
enlazara.

**El entorno de preview no lleva ningún secreto, y es a propósito.** Tiene su
propia base D1 y su dataset, pero no `RATE_LIMIT_SALT`, ni `OPENAI_API_KEY`, ni
`EMAIL_API_TOKEN`/`CONTACT_*`. En una URL de preview, `/api/ask` y
`/api/contact` responden 503 y `/api/hit` responde 204: exactamente la
degradación que `npm run test:functions` comprueba. La revisión por PR es
visual, y el comentario del preview lo dice.

**El despliegue tiene que salir de la raíz del repositorio.** Con
`wrangler.jsonc` presente, ese archivo es la fuente de verdad de bindings,
fecha y flags de compatibilidad, y el panel de Cloudflare deja de poder
editarlos. Un `wrangler pages deploy` desde otra carpeta publica el código sin
`RATE_LIMIT_DB` ni `enable_request_signal`, y entonces `/api/ask` y
`/api/contact` responden 503 en frío. Después del primer despliegue conviene
releer la configuración del proyecto y confirmar que llegaron.

Para preparar la base local y el preview:

```bash
Copy-Item .dev.vars.example .dev.vars
npx wrangler d1 migrations apply portfolio-rate-limits-preview --local
npx wrangler d1 migrations apply portfolio-rate-limits-preview --remote --env preview
npm run build
npx wrangler pages dev dist --env preview
```

## El asistente: `/api/ask`

La píldora «Preguntar sobre Imad», en todas las páginas, abre un panel que
contesta preguntas en lenguaje normal sobre Imad. Detrás hay una Pages Function que llama a OpenAI con
[`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna) y un expediente compuesto en el servidor a partir de `cv.json`,
`src/data/availability.ts`, `src/data/about.ts`, `src/data/services.ts`,
`src/data/askNotes.ts`, `src/data/askProfile.ts` y un dossier privado opcional.

Hasta el 06-10-2026 se llegaba también por la consola (`ask`) y por la paleta de
comandos; las dos se retiraron por uso (48 vistas y 6 aperturas en cuarenta
días). La conversación dura lo que la pestaña, en `sessionStorage`.

**`ASK_DOSSIER` hay que tratarlo como público.** Va en las instrucciones del
modelo, y unas instrucciones siempre se pueden sonsacar por mucho que se le pida
que no las revele. No es sitio para nada que no dirías en una primera
entrevista.

El coste y el abuso están acotados antes de llamar al proveedor: 64 KiB de cuerpo,
600 caracteres por pregunta, 1024 tokens máximos de salida, 40 preguntas por
conexión y hora y 2000 globales por día. Una conexión es una IPv4 o la red /64
de una IPv6: dentro de su /64 una IPv6 se cambia a voluntad, y contada entera
no frenaba a nadie. Los contadores se consumen con un único
`UPSERT … RETURNING` por regla, contra una tabla que se limpia una vez por
petición; si D1 no está disponible o agota cuota, no se llama a OpenAI. No se copia una tabla de precios en este README: la ficha oficial del
modelo enlazada arriba es la fuente vigente.

La conexión con OpenAI dispone de 20 segundos para establecerse, el stream puede
estar inactivo 30 segundos y nunca supera 120 segundos. La señal del cliente se
propaga y al navegar o cerrar se cancela también el lector de origen. Los errores
estables son `body_too_large` (413), `rate_limited` (429),
`rate_limiter_unavailable` (503), `upstream_failed` (502/503) y
`upstream_timeout` (504).

`check-build.mjs` comprueba además que ni el expediente, ni las notas de
`askNotes.ts`, ni el nombre del secreto aparezcan en `dist/`.

## Contacto y contador

`/api/contact` acepta como máximo 16 KiB, aplica tres envíos por conexión cada
diez minutos y treinta al día entre todos, y da a Email Sending un deadline de
10 segundos. Agotado el techo diario, el formulario responde 429 y queda el
enlace `mailto:`. No usa una casilla de
consentimiento: informa antes del envío y aplica la base jurídica descrita en la
política.

`/api/hit` acepta como máximo 2 KiB, 120 apuntes por conexión y hora y 20 000
al día en total. Cuenta la vista al cargar y cuatro eventos: `ask`, proyecto
abierto, descarga del CV (`cv-pdf`) y formulario enviado (`contact-sent`). La lista está en
[`src/lib/hitEvents.ts`](src/lib/hitEvents.ts), que comparten el emisor y la
Function.

No se guarda ni la IP, ni el `User-Agent`, ni el `Referer`, ni ningún
identificador. Cada punto contiene únicamente el evento, la ruta limpia y la
vista; sin `HITS` responde 204 y no cuenta nada.

Se eligió esto en lugar de Cloudflare Web Analytics porque su script obliga a
abrir `script-src` y `connect-src` a un dominio ajeno, que es justo lo que la
CSP de este sitio existe para impedir.

## Capturas de los proyectos

Cada proyecto abre un diálogo con su detalle, y los que tienen capturas enseñan
además una tira que se puede ampliar a pantalla completa y recorrer con el dedo,
las flechas o los botones.

La portada conserva tarjetas y contenido principal SSR, pero no incluye los
diálogos ni las capturas. En el primer clic carga el detalle localizado, mantiene
un solo detalle conectado al DOM y conserva foco, teclado, historial y fallback
web sin JavaScript. Los techos de cada superficie están en
[`scripts/budgets.mjs`](scripts/budgets.mjs), con la medida que los calibró.

Para regenerarlas, ver [`scripts/shots/README.md`](scripts/shots/README.md).

## Licencia

El **código** es [MIT](LICENSE.txt): cópialo, úsalo y publícalo con la nota de
copyright.

Lo que **no** cubre la licencia, y no se puede reutilizar sin permiso:

- los textos del CV, la carta de «Sobre mí» y las descripciones de los
  proyectos (`cv.json`, `src/data/`);
- las fotografías y las capturas de pantalla (`src/assets/`, `public/`);
- el nombre, la firma y el dominio.

Los logotipos de las tecnologías y de las empresas pertenecen a sus dueños y
aparecen sólo para identificarlas.

Si lo que quieres es la estructura, quédate con ella: cambia `cv.json` por el
tuyo, sustituye las imágenes y el sitio se regenera entero.
