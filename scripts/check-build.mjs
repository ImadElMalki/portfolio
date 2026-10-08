#!/usr/bin/env node
/**
 * Comprobaciones sobre `dist/`.
 *
 * `astro check` valida los tipos, pero nada vigilaba la salida: es ahí donde
 * aparecieron los problemas de la auditoría (una fuente que no se usaba y aun
 * así se precargaba, dos `<h1>` por página, `hreflang` distintos en la página y
 * en el sitemap). Cada regla de aquí corresponde a uno de ellos.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { join } from "node:path"
import { brotliCompressSync, constants as zlib, gzipSync } from "node:zlib"
import { Validator } from "jsonschema"
import sharp from "sharp"
import { JS_GZIP_BUDGET_BYTES, PAGE_BUDGETS } from "./budgets.mjs"
import { cspOf, governedByCsp, hashesOf, htmlFiles } from "./csp.mjs"

const require = createRequire(import.meta.url)
const jsonResumeSchema = require("@jsonresume/schema/schema.json")
/* La fuente curricular, para derivar de ella la lista de proyectos. */
const cvJson = require("../cv.json")

const DIST = "dist"
const PAGES = ["index.html", "ca/index.html", "en/index.html"]
const PROJECT_DETAIL_PAGES = [
  "project-details/index.html",
  "ca/project-details/index.html",
  "en/project-details/index.html",
]
const CV_HTML_PAGES = ["cv/index.html", "ca/cv/index.html", "en/cv/index.html"]
const CV_HTML_HREFS = ["/cv/", "/ca/cv/", "/en/cv/"]
const LOCALES = ["es", "ca", "en"]
const PAGE_LOCALE = new Map([
  ["index.html", "es"],
  ["ca/index.html", "ca"],
  ["en/index.html", "en"],
])
const LOCALE_PATH = { es: "/", ca: "/ca/", en: "/en/" }

/** Google corta el título sobre 60 caracteres y la descripción sobre 160. */
const TITLE_MAX = 60
const DESCRIPTION_MAX = 160

/** Proyectos con galería de capturas. Sube al añadir la de cada proyecto. */
const EXPECTED_GALLERIES = 8
const EXPECTED_PROJECTS = 8

/**
 * Los que enseña la portada: los marcados como destacados, y ya.
 *
 * Hasta el 07-10-2026 llevaba los ocho —tres a la vista y cinco tras un «Ver 5
 * más»—, que eran cinco tarjetas con su miniatura y su texto en el HTML de
 * cada visita para repetir lo que hay a un clic, en `/proyectos/`. Esa cifra
 * y `EXPECTED_PROJECTS` dejan de ser la misma: aquí tres, en el índice y en
 * `/project-details/` los ocho.
 */
const FEATURED_PROJECTS = 3

/**
 * Los techos de HTML, CSS, DOM y JS viven en `scripts/budgets.mjs`, que comparten
 * esta comprobación y las mediciones de navegador. El diario de cómo se movieron
 * hasta el 30-09-2026 está en `docs/historial-presupuestos.md`.
 */

/**
 * Sin `noopener`, la pestaña que se abre puede reescribir la que la abrió.
 *
 * Vivía sólo en la landing de servicios, que fue la primera página con enlaces
 * salientes. Ya no es la única ni de lejos: las tres portadas enlazan el hero,
 * las dos empresas, la tira de empleos anteriores, los proyectos, el contacto y
 * —desde el 25-08-2026— siete fichas de curso. Un `rel` que se cayera en
 * cualquiera de ésos no lo veía nadie.
 */
function checkExternalLinks(page, documentHtml) {
  const unsafe = tags(documentHtml, "a")
    .filter((attrs) => attrs.get("target") === "_blank")
    .filter((attrs) => {
      const rel = (attrs.get("rel") ?? "").toLowerCase().split(/\s+/)
      return !rel.includes("noopener") || !rel.includes("noreferrer")
    }).length

  check(
    `${page}: todo target="_blank" con rel="noopener noreferrer"`,
    unsafe === 0,
    `${unsafe} enlace(s) sin rel`,
  )
}

const failures = []

function check(description, condition, detail = "") {
  if (condition) return
  failures.push(detail ? `${description} — ${detail}` : description)
}

function read(relativePath) {
  return readFileSync(join(DIST, relativePath), "utf8")
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function countMatches(haystack, pattern) {
  return (haystack.match(pattern) ?? []).length
}

function withoutScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
}

/**
 * El marcado sin las hojas en línea.
 *
 * Con `inlineStylesheets: "always"` el CSS viaja dentro del HTML, y sus
 * selectores —`[data-lightbox]`, `[data-detail]`— no son elementos: buscar el
 * atributo en el texto del documento los confundiría con el marcado. Las
 * comprobaciones de CSS, al revés, sí quieren el documento entero.
 */
function withoutStyles(html) {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
}

/** Extrae atributos sin asumir orden, comillas dobles ni valor explícito. */
function attributes(tag) {
  const result = new Map()
  const source = tag.replace(/^<[^\s>]+|\/?\s*>$/g, "")
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

  for (const match of source.matchAll(pattern)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "")
  }

  return result
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(
    ([tag]) => attributes(tag),
  )
}

function tagBy(html, name, predicate) {
  return tags(html, name).find(predicate)
}

function metaBy(html, key, value) {
  return tagBy(
    html,
    "meta",
    (attrs) => attrs.get(key)?.toLowerCase() === value.toLowerCase(),
  )
}

function linkBy(html, rel, extra = () => true) {
  return tagBy(
    html,
    "link",
    (attrs) =>
      (attrs.get("rel") ?? "")
        .toLowerCase()
        .split(/\s+/)
        .includes(rel.toLowerCase()) && extra(attrs),
  )
}

/** Atributo suelto de una etiqueta cualquiera: `<meta name="x" content="…">`. */
function attribute(html, pattern) {
  return html.match(pattern)?.[1] ?? ""
}

function duplicateIds(html) {
  const counts = new Map()

  for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return [...counts].filter(([, times]) => times > 1).map(([id]) => id)
}

/** Hojas enlazadas por una página, leídas de `dist/` como las pide el navegador. */
function linkedStylesheets(html) {
  return tags(html, "link")
    .filter((attrs) => attrs.get("rel") === "stylesheet")
    .map((attrs) => attrs.get("href") ?? "")
    .filter((href) => href.startsWith("/"))
}

const brotliSizes = new Map()

/** Brotli al máximo, como el que sirve Cloudflare a un navegador moderno. */
function brotliSize(path) {
  if (!brotliSizes.has(path)) {
    brotliSizes.set(
      path,
      brotliCompressSync(readFileSync(path), {
        params: { [zlib.BROTLI_PARAM_QUALITY]: 11 },
      }).length,
    )
  }
  return brotliSizes.get(path)
}

/**
 * El peso de una página contra su presupuesto de `scripts/budgets.mjs`.
 *
 * El CSS se cuenta en las hojas enlazadas —cuántas, cuánto en bruto y cuánto
 * con Brotli— y aparte lo que queda en línea. Hasta el 30-09-2026 sólo se
 * sumaban los `<style>`, que desde `inlineStylesheets: "never"` son 5,7 KB de
 * los 122 KB que bloquean la portada: el techo no podía fallar (TEST-05).
 */
function checkPageWeight(page, html, budget) {
  const documentHtml = withoutScripts(html)
  const htmlBytes = Buffer.byteLength(html)
  check(
    `${page}: HTML por debajo de ${budget.htmlBytes} bytes`,
    htmlBytes <= budget.htmlBytes,
    `${htmlBytes} bytes`,
  )

  const sheets = linkedStylesheets(documentHtml)
  const missing = sheets.filter((href) => !existsSync(join(DIST, href)))
  check(
    `${page}: las hojas enlazadas existen`,
    missing.length === 0,
    missing.join(", "),
  )
  check(
    `${page}: ${budget.stylesheets} hojas bloqueantes como mucho`,
    sheets.length <= budget.stylesheets,
    `${sheets.length}: ${sheets.join(", ")}`,
  )

  const present = sheets.filter((href) => existsSync(join(DIST, href)))
  const cssBytes = present.reduce(
    (total, href) => total + statSync(join(DIST, href)).size,
    0,
  )
  const cssBrotliBytes = present.reduce(
    (total, href) => total + brotliSize(join(DIST, href)),
    0,
  )
  check(
    `${page}: CSS enlazado por debajo de ${budget.cssBytes} bytes`,
    cssBytes <= budget.cssBytes,
    `${cssBytes} bytes en ${sheets.length} hojas`,
  )
  check(
    `${page}: CSS enlazado con Brotli por debajo de ${budget.cssBrotliBytes} bytes`,
    cssBrotliBytes <= budget.cssBrotliBytes,
    `${cssBrotliBytes} bytes`,
  )

  const inlineCssBytes = [
    ...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),
  ].reduce((total, [, css]) => total + Buffer.byteLength(css), 0)
  check(
    `${page}: CSS en línea por debajo de ${budget.inlineCssBytes} bytes`,
    inlineCssBytes <= budget.inlineCssBytes,
    `${inlineCssBytes} bytes`,
  )

  const structureHtml = documentHtml.replace(
    /(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi,
    "$1$2",
  )
  const elementCount = countMatches(
    structureHtml,
    /<[a-z][^!?/\s>]*(?:\s[^<>]*?)?>/gi,
  )
  check(
    `${page}: DOM por debajo de ${budget.domElements} elementos`,
    elementCount <= budget.domElements,
    `${elementCount}`,
  )
}

// --- Páginas ---------------------------------------------------------------

for (const page of PAGES) {
  check(`${page} existe`, existsSync(join(DIST, page)))
  if (!existsSync(join(DIST, page))) continue

  const html = read(page)
  const documentHtml = withoutScripts(html)
  const locale = PAGE_LOCALE.get(page)
  const root = tagBy(documentHtml, "html", () => true)
  const canonical = linkBy(documentHtml, "canonical")
  const cspMeta = metaBy(documentHtml, "http-equiv", "content-security-policy")

  check(`${page}: idioma HTML`, root?.get("lang") === locale, root?.get("lang"))
  check(`${page}: canonical`, Boolean(canonical?.get("href")))
  check(
    `${page}: og:image`,
    Boolean(metaBy(documentHtml, "property", "og:image")),
  )
  check(
    `${page}: og:image:width 1200`,
    metaBy(documentHtml, "property", "og:image:width")?.get("content") ===
      "1200",
  )
  check(
    `${page}: og:image:height 630`,
    metaBy(documentHtml, "property", "og:image:height")?.get("content") ===
      "630",
  )
  check(
    `${page}: og:image:alt`,
    Boolean(metaBy(documentHtml, "property", "og:image:alt")?.get("content")),
  )
  check(
    `${page}: meta description`,
    Boolean(metaBy(documentHtml, "name", "description")?.get("content")),
  )
  check(`${page}: CSP`, Boolean(cspMeta))

  const cspValue = cspMeta?.get("content") ?? ""
  check(
    `${page}: CSP sin unsafe-*`,
    !/'unsafe-(?:inline|eval|hashes)'/i.test(cspValue),
    cspValue,
  )

  checkPageWeight(page, html, PAGE_BUDGETS.home)

  const h1Count = tags(documentHtml, "h1").length
  check(`${page}: un solo <h1>`, h1Count === 1, `encontrados ${h1Count}`)

  // Las anclas chocaron mientras la vista Markdown convivía con la web en el
  // mismo documento: `slugify("Proyectos")` y el slug de su encabezado daban
  // los dos `proyectos`. La vista se fue el 06-10-2026; la comprobación se
  // queda, que es barata y caza cualquier otro choque.
  const dupes = duplicateIds(documentHtml)
  check(
    `${page}: ids únicos`,
    dupes.length === 0,
    `repetidos: ${dupes.join(", ")}`,
  )

  // El título salía de `label`, que es una frase larga: 108 caracteres. La
  // descripción reutilizaba `summary`: unos 380. Los dos salían cortados.
  const title = attribute(html, /<title>([^<]*)<\/title>/)
  check(
    `${page}: <title> de ${TITLE_MAX} caracteres o menos`,
    title.length > 0 && title.length <= TITLE_MAX,
    `${title.length}`,
  )

  const description =
    metaBy(documentHtml, "name", "description")?.get("content") ?? ""
  check(
    `${page}: description de ${DESCRIPTION_MAX} caracteres o menos`,
    description.length > 0 && description.length <= DESCRIPTION_MAX,
    `${description.length}`,
  )

  check(
    `${page}: robots con max-image-preview:large`,
    (metaBy(documentHtml, "name", "robots")?.get("content") ?? "").includes(
      "max-image-preview:large",
    ),
  )

  // `style-src` va con hashes: cualquier atributo `style` queda bloqueado por
  // el navegador (un icono lo llevaba y no se veía).
  const inlineStyles = [...documentHtml.matchAll(/<[a-z][^>]*>/gi)].filter(
    ([tag]) => attributes(tag).has("style"),
  ).length
  check(
    `${page}: sin atributos style=`,
    inlineStyles === 0,
    `encontrados ${inlineStyles}, la CSP los bloquea`,
  )

  /**
   * Y cada `<style>` debe tener su hash declarado en la propia CSP.
   *
   * No es teórico: `transition:animate` hace que Astro emita el `<style>` con
   * el ámbito de la transición **después** de calcular los hash, así que el
   * navegador lo bloqueaba en silencio —la regla se perdía y, de propina,
   * `<ClientRouter />` inyectaba otro `<style>` en cada navegación que también
   * caía—. En el HTML todo parecía correcto; sólo salía en la consola.
   *
   * Se recalcula el hash igual que lo hace el navegador y se busca en la
   * directiva. Si algún día se añade una directiva `transition:*`, esto falla
   * en el build en vez de en la consola de quien visite la página.
   */
  const csp = cspValue
  const declaredHashes = new Set(
    (csp.match(/'sha256-[^']+'/g) ?? []).map((hash) => hash.slice(1, -1)),
  )
  const blockedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map(
      ([, css]) =>
        `sha256-${createHash("sha256").update(css).digest("base64")}`,
    )
    .filter((hash) => !declaredHashes.has(hash))

  check(
    `${page}: todo <style> tiene su hash en la CSP`,
    blockedStyles.length === 0,
    `${blockedStyles.length} sin declarar; el navegador los bloquea`,
  )

  /* Ninguna fuente precargada, y no por descuido: `preload` marca todas las
     caras de la familia, y desde que Inter se sirve en cinco pesos estáticos
     —lo que hace falta para que el PDF no salga con fuentes Type 3— eso eran
     cinco archivos en el camino crítico. El CSS va incrustado, así que el
     navegador descubre los `@font-face` al parsear el `<head>`.

     El límite sigue siendo un techo, no un adorno: cuando había `preload`, la
     cara `latin-ext` —que ningún texto del sitio usa— se descargaba igual y
     costaba 83 KB. */
  const fontPreloads = tags(documentHtml, "link").filter(
    (attrs) => attrs.get("rel") === "preload" && attrs.get("as") === "font",
  ).length
  check(
    `${page}: como mucho una fuente precargada`,
    fontPreloads <= 1,
    `encontradas ${fontPreloads}`,
  )

  for (const alternateLocale of LOCALES) {
    check(
      `${page}: hreflang="${alternateLocale}"`,
      Boolean(
        linkBy(
          documentHtml,
          "alternate",
          (attrs) => attrs.get("hreflang") === alternateLocale,
        )?.get("href"),
      ),
    )
  }
  check(
    `${page}: hreflang x-default`,
    Boolean(
      linkBy(
        documentHtml,
        "alternate",
        (attrs) => attrs.get("hreflang") === "x-default",
      )?.get("href"),
    ),
  )

  const canonicalUrl = canonical?.get("href")
  if (canonicalUrl && locale) {
    const origin = new URL(canonicalUrl).origin
    for (const alternateLocale of LOCALES) {
      const href = linkBy(
        documentHtml,
        "alternate",
        (attrs) => attrs.get("hreflang") === alternateLocale,
      )?.get("href")
      check(
        `${page}: hreflang ${alternateLocale} recíproco`,
        href === new URL(LOCALE_PATH[alternateLocale], origin).href,
        href,
      )
    }
    check(
      `${page}: canonical localizado`,
      canonicalUrl === new URL(LOCALE_PATH[locale], origin).href,
      canonicalUrl,
    )
  }

  const ids = new Set(
    tags(documentHtml, "section").map((attrs) => attrs.get("id")),
  )
  const internalTargets = new Set(
    tags(documentHtml, "a")
      .map((attrs) => attrs.get("href"))
      .filter((href) => href?.startsWith("#"))
      .map((href) => href.slice(1)),
  )
  const missingTargets = [...internalTargets].filter(
    (target) =>
      target && !ids.has(target) && !documentHtml.includes(`id="${target}"`),
  )
  check(
    `${page}: destinos del índice existen`,
    missingTargets.length === 0,
    missingTargets.join(", "),
  )

  // Las tarjetas siguen SSR y son enlaces funcionales sin JavaScript, pero los
  // detalles no deben volver a engordar la carga fría de la portada.
  const openers = tags(documentHtml, "a").filter((attrs) =>
    attrs.has("data-detail-open"),
  ).length
  const dialogs = tags(documentHtml, "dialog").filter((attrs) =>
    attrs.has("data-detail"),
  ).length
  check(
    `${page}: tarjetas SSR y detalles diferidos`,
    openers === FEATURED_PROJECTS && dialogs === 0,
    `${openers} enlace(s) y ${dialogs} diálogo(s)`,
  )

  // El filete de color de la tarjeta se quitó a propósito: que no vuelva.
  check(
    `${page}: sin filete de estado en las tarjetas`,
    !/border-top:\s*3px[^;]*--status/.test(documentHtml),
  )

  // Y lo mismo con el del banner de servicios, que ahora se distingue por la
  // luz: el filete lateral de acento no debe volver.
  check(
    `${page}: sin filete lateral en el banner`,
    !/border-inline-start:\s*4px/.test(documentHtml),
  )

  check(
    `${page}: sin galerías en la carga fría`,
    !withoutStyles(documentHtml).includes("data-lightbox"),
  )

  // Una captura ansiosa se descargaría en la carga inicial, y toda la galería
  // vive dentro de diálogos cerrados justamente para no costar nada hasta que
  // alguien las abra.
  check(
    `${page}: ninguna captura ansiosa`,
    !tags(documentHtml, "img").some(
      (attrs) =>
        attrs.has("data-lightbox-index") && attrs.get("loading") === "eager",
    ),
  )

  const imagesWithoutAlt = tags(documentHtml, "img").filter(
    (attrs) => !attrs.has("alt"),
  )
  check(
    `${page}: toda imagen declara alt (vacío permitido si es decorativa)`,
    imagesWithoutAlt.length === 0,
    `${imagesWithoutAlt.length} sin atributo`,
  )

  checkExternalLinks(page, documentHtml)
}

// El recurso diferido conserva el detalle completo, todas las galerías y el
// fallback navegable. Así el presupuesto no se compra perdiendo contenido.
for (const page of PROJECT_DETAIL_PAGES) {
  const documentHtml = withoutScripts(read(page))
  const dialogs = tags(documentHtml, "dialog").filter((attrs) =>
    attrs.has("data-detail"),
  )
  const openerIds = new Set(
    tags(documentHtml, "button")
      .map((attrs) => attrs.get("data-lightbox-open"))
      .filter(Boolean),
  )
  const lightboxIds = new Set(
    tags(documentHtml, "dialog")
      .filter((attrs) => attrs.has("data-lightbox"))
      .map((attrs) => attrs.get("id"))
      .filter(Boolean),
  )

  check(
    `${page}: ${EXPECTED_PROJECTS} detalles completos`,
    dialogs.length === EXPECTED_PROJECTS,
    `${dialogs.length}`,
  )

  /* La hoja del diálogo tiene que llegar enlazada: el guion del diálogo de la
     portada y del índice sólo adopta `<link rel="stylesheet">`. Si
     `assetsInlineLimit` (en `astro.config.mjs`) la incrustara, el diálogo se
     abriría sin estilos y nada más lo diría. */
  const dialogSheets = linkedStylesheets(documentHtml).filter((href) =>
    readFileSync(join(DIST, href), "utf8").includes(".detail-standalone"),
  )
  check(
    `${page}: la hoja del diálogo va enlazada, no incrustada`,
    dialogSheets.length === 1,
    `${dialogSheets.length}`,
  )
  check(
    `${page}: cada miniatura con su visor`,
    openerIds.size === lightboxIds.size &&
      [...openerIds].every((value) => lightboxIds.has(value)),
    `${openerIds.size} disparador(es), ${lightboxIds.size} visor(es)`,
  )
  check(
    `${page}: ${EXPECTED_GALLERIES} galería(s)`,
    lightboxIds.size === EXPECTED_GALLERIES,
    `${lightboxIds.size}`,
  )
  check(
    `${page}: ninguna captura ansiosa`,
    !tags(documentHtml, "img").some(
      (attrs) =>
        attrs.has("data-lightbox-index") && attrs.get("loading") === "eager",
    ),
  )
}

// --- Landing de servicios --------------------------------------------------

/**
 * La landing comercial no entra en el bucle de `PAGES`: no tiene galerías, ni
 * diálogos, ni tarjeta Open Graph, y la mitad de esas reglas le fallarían por
 * cosas que no le aplican. Se comprueba aparte.
 *
 * Desde el 20-08-2026 se publica siempre —antes vivía detrás de `SERVICES=1`—,
 * así que la comprobación de «o las tres o ninguna» pasa a exigir las tres: el
 * hero la enlaza desde las tres portadas y que falte una es un 404.
 *
 * Desde el 23-08-2026 se indexa: fuera el `noindex` del marcado y fuera el
 * filtro de `sitemap()` en `astro.config.mjs`. Las dos comprobaciones de
 * abajo cambian de sentido y siguen siendo la misma regla: marcado y sitemap
 * tienen que decir lo mismo, porque la contradicción entre ellos es lo que
 * señala Search Console.
 */
const SERVICES_PAGES = [
  "servicios/index.html",
  "ca/serveis/index.html",
  "en/services/index.html",
]
const SERVICES_HREFS = ["/servicios/", "/ca/serveis/", "/en/services/"]

const servicesBuilt = SERVICES_PAGES.filter((page) =>
  existsSync(join(DIST, page)),
)

check(
  "servicios: los tres idiomas emitidos",
  servicesBuilt.length === SERVICES_PAGES.length,
  `emitidas ${servicesBuilt.length} de ${SERVICES_PAGES.length}`,
)

/* El hero enlaza la landing desde las tres portadas: cada enlace necesita su
   destino, y en el idioma que le toca. */
for (const [index, page] of PAGES.entries()) {
  if (!existsSync(join(DIST, page))) continue

  const href = SERVICES_HREFS[index]
  check(
    `${page}: enlaza su landing (${href})`,
    read(page).includes(`href="${href}"`),
  )
}

/* Indexada: la página pide entrar en el índice, así que el sitemap tiene que
   nombrarla. Es la misma comprobación de antes con el signo cambiado. */
if (existsSync(join(DIST, "sitemap-0.xml"))) {
  const sitemap = read("sitemap-0.xml")
  const missing = SERVICES_HREFS.filter((href) => !sitemap.includes(href))

  check(
    "servicios: dentro del sitemap, como el resto",
    missing.length === 0,
    `${missing.join(", ")} — ¿ha vuelto el filtro de sitemap() en astro.config.mjs?`,
  )
}

for (const page of servicesBuilt) {
  const html = read(page)
  const documentHtml = withoutScripts(html)
  const pageIndex = SERVICES_PAGES.indexOf(page)
  const locale = LOCALES[pageIndex]
  const cspValue =
    metaBy(documentHtml, "http-equiv", "content-security-policy")?.get(
      "content",
    ) ?? ""

  /* Indexable, y por partida doble: sin `noindex` y con la directiva positiva
     que `Layout` emite cuando la página entra en el índice. Comprobar sólo la
     ausencia del `noindex` dejaría pasar una página sin `canonical` ni
     `hreflang`, que es el otro fallo posible del mismo interruptor. */
  const robots = metaBy(documentHtml, "name", "robots")?.get("content") ?? ""

  check(`${page}: sin noindex`, !robots.includes("noindex"), robots)
  check(`${page}: indexable`, robots.includes("index"), robots)
  check(
    `${page}: con canonical`,
    /<link[^>]+rel="canonical"/.test(documentHtml),
  )

  const canonicalUrl = linkBy(documentHtml, "canonical")?.get("href")
  if (canonicalUrl) {
    const origin = new URL(canonicalUrl).origin
    check(
      `${page}: canonical localizado`,
      canonicalUrl === new URL(SERVICES_HREFS[pageIndex], origin).href,
      canonicalUrl,
    )
    for (const [alternateIndex, alternateLocale] of LOCALES.entries()) {
      const href = linkBy(
        documentHtml,
        "alternate",
        (attrs) => attrs.get("hreflang") === alternateLocale,
      )?.get("href")
      check(
        `${page}: hreflang ${alternateLocale} recíproco`,
        href === new URL(SERVICES_HREFS[alternateIndex], origin).href,
        href,
      )
    }
    const xDefault = linkBy(
      documentHtml,
      "alternate",
      (attrs) => attrs.get("hreflang") === "x-default",
    )?.get("href")
    check(
      `${page}: hreflang x-default castellano`,
      xDefault === new URL(SERVICES_HREFS[0], origin).href,
      xDefault,
    )
  }

  check(
    `${page}: idioma HTML`,
    tagBy(documentHtml, "html", () => true)?.get("lang") === locale,
  )

  checkPageWeight(page, html, PAGE_BUDGETS.services)

  const h1Count = tags(documentHtml, "h1").length
  check(`${page}: un solo <h1>`, h1Count === 1, `encontrados ${h1Count}`)

  const dupes = duplicateIds(documentHtml)
  check(
    `${page}: ids únicos`,
    dupes.length === 0,
    `repetidos: ${dupes.join(", ")}`,
  )

  const title = attribute(html, /<title>([^<]*)<\/title>/)
  check(
    `${page}: <title> de ${TITLE_MAX} caracteres o menos`,
    title.length > 0 && title.length <= TITLE_MAX,
    `${title.length}`,
  )

  const description =
    metaBy(documentHtml, "name", "description")?.get("content") ?? ""
  check(
    `${page}: description de ${DESCRIPTION_MAX} caracteres o menos`,
    description.length > 0 && description.length <= DESCRIPTION_MAX,
    `${description.length}`,
  )

  const inlineStyles = [...documentHtml.matchAll(/<[a-z][^>]*>/gi)].filter(
    ([tag]) => attributes(tag).has("style"),
  ).length
  check(
    `${page}: sin atributos style=`,
    inlineStyles === 0,
    `encontrados ${inlineStyles}, la CSP los bloquea`,
  )

  const declaredHashes = new Set(
    (cspValue.match(/'sha256-[^']+'/g) ?? []).map((hash) => hash.slice(1, -1)),
  )
  const blockedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map(
      ([, css]) =>
        `sha256-${createHash("sha256").update(css).digest("base64")}`,
    )
    .filter((hash) => !declaredHashes.has(hash))
  check(
    `${page}: todo <style> tiene su hash en la CSP`,
    blockedStyles.length === 0,
    `${blockedStyles.length} sin declarar; el navegador los bloquea`,
  )

  checkExternalLinks(page, documentHtml)

  /* El conmutador enlaza los otros dos idiomas —el actual es un `<span>` con
     `aria-current`—, y desde la landing tienen que apuntar a la landing: con el
     destino por defecto, cambiar de idioma te echaba a la portada. */
  const languageLinks = SERVICES_HREFS.filter((href) =>
    html.includes(`href="${href}"`),
  ).length
  check(
    `${page}: el conmutador de idioma se queda en la landing`,
    languageLinks === 2,
    `${languageLinks} de 2 enlaces a la landing`,
  )
}

// --- Política de privacidad ------------------------------------------------

/**
 * La segunda capa del aviso, con las mismas reglas de indexación que la landing
 * y una propia: **tiene que existir en los tres idiomas**.
 *
 * El motivo es que la primera capa la enlaza desde todos los formularios, en las
 * tres portadas. Un enlace roto ahí no es un 404 cualquiera: es el punto exacto
 * donde alguien va a comprobar quién trata sus datos antes de escribir. Por eso
 * se comprueba aquí, en el build, y no sólo en la suite de navegador.
 *
 * La página se publicó indexable el 31-08-2026, así que canonical, `hreflang`
 * recíproco y sitemap se exigen igual que en `servicios`.
 */
const PRIVACY_PAGES = [
  "privacidad/index.html",
  "ca/privacitat/index.html",
  "en/privacy/index.html",
]
const PRIVACY_HREFS = ["/privacidad/", "/ca/privacitat/", "/en/privacy/"]

const privacyBuilt = PRIVACY_PAGES.filter((page) =>
  existsSync(join(DIST, page)),
)

check(
  "privacidad: los tres idiomas emitidos",
  privacyBuilt.length === PRIVACY_PAGES.length,
  `emitidas ${privacyBuilt.length} de ${PRIVACY_PAGES.length}`,
)

if (existsSync(join(DIST, "sitemap-0.xml"))) {
  const sitemap = read("sitemap-0.xml")
  const missing = PRIVACY_HREFS.filter((href) => !sitemap.includes(href))
  check(
    "privacidad: dentro del sitemap",
    missing.length === 0,
    `${missing.join(", ")} — la página se declara indexable`,
  )
}

/* La primera capa vive en el formulario de las tres portadas y enlaza la
   segunda en su propio idioma. Sin esto, el aviso puede quedarse sin salida
   —o mandar a la persona a la versión castellana desde la página inglesa. */
for (const [index, page] of PAGES.entries()) {
  if (!existsSync(join(DIST, page))) continue

  const documentHtml = withoutScripts(read(page))
  const href = PRIVACY_HREFS[index]
  check(
    `${page}: la primera capa enlaza su política (${href})`,
    documentHtml.includes(`href="${href}"`),
  )
}

for (const page of privacyBuilt) {
  const html = read(page)
  const documentHtml = withoutScripts(html)
  const pageIndex = PRIVACY_PAGES.indexOf(page)
  const locale = LOCALES[pageIndex]

  checkPageWeight(page, html, PAGE_BUDGETS.privacy)

  const robots = metaBy(documentHtml, "name", "robots")?.get("content") ?? ""
  check(`${page}: sin noindex`, !robots.includes("noindex"), robots)
  check(`${page}: indexable`, robots.includes("index"), robots)

  const canonicalUrl = linkBy(documentHtml, "canonical")?.get("href")
  check(`${page}: con canonical`, Boolean(canonicalUrl))
  if (canonicalUrl) {
    const origin = new URL(canonicalUrl).origin
    check(
      `${page}: canonical localizado`,
      canonicalUrl === new URL(PRIVACY_HREFS[pageIndex], origin).href,
      canonicalUrl,
    )
    for (const [alternateIndex, alternateLocale] of LOCALES.entries()) {
      const href = linkBy(
        documentHtml,
        "alternate",
        (attrs) => attrs.get("hreflang") === alternateLocale,
      )?.get("href")
      check(
        `${page}: hreflang ${alternateLocale} recíproco`,
        href === new URL(PRIVACY_HREFS[alternateIndex], origin).href,
        href,
      )
    }
    const xDefault = linkBy(
      documentHtml,
      "alternate",
      (attrs) => attrs.get("hreflang") === "x-default",
    )?.get("href")
    check(
      `${page}: hreflang x-default castellano`,
      xDefault === new URL(PRIVACY_HREFS[0], origin).href,
      xDefault,
    )
  }

  check(
    `${page}: idioma HTML`,
    tagBy(documentHtml, "html", () => true)?.get("lang") === locale,
  )

  const h1Count = tags(documentHtml, "h1").length
  check(`${page}: un solo <h1>`, h1Count === 1, `encontrados ${h1Count}`)

  const dupes = duplicateIds(documentHtml)
  check(
    `${page}: ids únicos`,
    dupes.length === 0,
    `repetidos: ${dupes.join(", ")}`,
  )

  /* Una política publicada no puede seguir diciendo que es un borrador sin
     revisar. La nota se retiró el 31-08-2026 al indexarla; que no vuelva. */
  check(
    `${page}: no se declara borrador pendiente de revisión`,
    !/borrador|esborrany|\bdraft\b/i.test(documentHtml),
  )

  checkExternalLinks(page, documentHtml)
}

// --- Fichas de proyecto ---------------------------------------------------

/**
 * Una URL por proyecto, y que siga siéndolo.
 *
 * El detalle de cada proyecto vivió mucho tiempo sólo dentro de un `<dialog>` de
 * la portada y en `/project-details/`, que lleva `noindex`: no había ninguna
 * dirección que enviar ni que un buscador pudiera recorrer. Desde que existe
 * `/proyectos/<id>/` hay tres cosas que se pueden romper en silencio, y las tres
 * se comprueban aquí:
 *
 * 1. Que la página exista para **cada proyecto y cada idioma**. La lista sale de
 *    `cv.json`, así que añadir un proyecto sin su página falla aquí y no en
 *    producción.
 * 2. Que la tarjeta de la portada siga apuntando a esa dirección. El `href` es
 *    lo único que la hace compartible: el guion intercepta el clic y abre el
 *    diálogo, así que un `href` equivocado **no se nota navegando** —sólo lo
 *    descubre quien copie el enlace o llegue sin JavaScript.
 * 3. Que la ficha no arrastre el diálogo ni el visor. Su guion vive en
 *    `ProjectDialogRuntime.astro` y no se monta aquí, así que un `<dialog>` en esta página
 *    sería contenido que nadie puede abrir.
 */
const projectIds = cvJson.projects.map(({ id }) => id)
const PROJECTS_INDEX_HREFS = ["/proyectos/", "/ca/projectes/", "/en/projects/"]
const projectHrefs = (id) => PROJECTS_INDEX_HREFS.map((base) => `${base}${id}/`)

const projectPagesExpected = projectIds.flatMap((id) =>
  projectHrefs(id).map((href) => `${href.replace(/^\/|\/$/g, "")}/index.html`),
)
const projectPagesBuilt = projectPagesExpected.filter((page) =>
  existsSync(join(DIST, page)),
)

check(
  "proyectos: una ficha por proyecto e idioma",
  projectPagesBuilt.length === projectPagesExpected.length,
  `emitidas ${projectPagesBuilt.length} de ${projectPagesExpected.length}`,
)

const projectsIndexPages = PROJECTS_INDEX_HREFS.map(
  (href) => `${href.replace(/^\/|\/$/g, "")}/index.html`,
)
const projectsIndexBuilt = projectsIndexPages.filter((page) =>
  existsSync(join(DIST, page)),
)

check(
  "proyectos: los tres índices emitidos",
  projectsIndexBuilt.length === projectsIndexPages.length,
  `emitidos ${projectsIndexBuilt.length} de ${projectsIndexPages.length}`,
)

if (existsSync(join(DIST, "sitemap-0.xml"))) {
  const sitemap = read("sitemap-0.xml")
  const missing = [
    ...PROJECTS_INDEX_HREFS,
    ...projectIds.flatMap((id) => projectHrefs(id)),
  ].filter((href) => !sitemap.includes(href))
  check(
    "proyectos: índice y fichas dentro del sitemap",
    missing.length === 0,
    `${missing.slice(0, 4).join(", ")} — son páginas indexables`,
  )
}

/* La tarjeta de la portada es el único sitio desde el que se llega, y su `href`
   es lo que hace compartible el proyecto. Se comprueba en los tres idiomas. */
for (const [index, page] of PAGES.entries()) {
  if (!existsSync(join(DIST, page))) continue

  const documentHtml = withoutScripts(read(page))
  const base = PROJECTS_INDEX_HREFS[index]
  const openers = tags(documentHtml, "a").filter((attrs) =>
    attrs.has("data-detail-open"),
  )
  const stray = openers.filter((attrs) => {
    const id = attrs.get("data-detail-open")?.replace(/^project-/, "")
    return attrs.get("href") !== `${base}${id}/`
  })

  check(
    `${page}: cada tarjeta de proyecto enlaza su ficha`,
    openers.length > 0 && stray.length === 0,
    `${openers.length} tarjeta(s) bajo ${base}; ${stray.length} con href ajeno`,
  )
}

/* Y que la portada nombre el índice. Una página que ningún enlace del sitio
   menciona sólo la encuentra quien lea el sitemap. */
for (const [index, page] of PAGES.entries()) {
  if (!existsSync(join(DIST, page))) continue

  const href = PROJECTS_INDEX_HREFS[index]
  check(
    `${page}: enlaza el índice de proyectos (${href})`,
    withoutScripts(read(page)).includes(`href="${href}"`),
  )
}

for (const [index, page] of projectsIndexBuilt.entries()) {
  const documentHtml = withoutScripts(read(page))
  checkPageWeight(page, read(page), PAGE_BUDGETS.projectsIndex)
  const base = PROJECTS_INDEX_HREFS[index]
  const missing = projectIds.filter(
    (id) => !documentHtml.includes(`href="${base}${id}/"`),
  )
  check(
    `${page}: el índice enlaza los ${projectIds.length} proyectos`,
    missing.length === 0,
    `faltan ${missing.join(", ")}`,
  )

  /**
   * Desde el 11-09-2026 el índice abre la ficha en diálogo, como la portada.
   *
   * Eso descansa en tres contratos que no se ven navegando, porque si fallan lo
   * que queda es justo el comportamiento de antes —navegar a la ficha suelta—,
   * que parece correcto y no lo es:
   *
   * 1. Cada proyecto tiene al menos un disparador `data-detail-open`, y su
   *    `href` sigue siendo el de la ficha. El `href` es lo que sostiene el sitio
   *    sin JavaScript y el copiar-enlace.
   * 2. La lista lleva `data-project-details-url`, que es de donde el guion saca
   *    de dónde traerse los diálogos. Sin él caería al castellano en los tres
   *    idiomas, y nadie lo notaría salvo leyendo en catalán o inglés.
   * 3. El índice, como la portada, **no** trae los diálogos en el HTML: se
   *    descargan al primer clic.
   */
  const indexOpeners = tags(documentHtml, "a").filter((attrs) =>
    attrs.has("data-detail-open"),
  )
  const covered = new Set(
    indexOpeners.map((attrs) =>
      attrs.get("data-detail-open")?.replace(/^project-/, ""),
    ),
  )
  const strayIndex = indexOpeners.filter((attrs) => {
    const id = attrs.get("data-detail-open")?.replace(/^project-/, "")
    return attrs.get("href") !== `${base}${id}/`
  })
  check(
    `${page}: cada proyecto abre su diálogo y conserva su href`,
    projectIds.every((id) => covered.has(id)) && strayIndex.length === 0,
    `${covered.size} de ${projectIds.length} con disparador; ${strayIndex.length} con href ajeno`,
  )

  const detailsUrl = tagBy(documentHtml, "ul", (attrs) =>
    attrs.has("data-project-details"),
  )?.get("data-project-details-url")
  check(
    `${page}: la lista declara de dónde traer las fichas`,
    detailsUrl === `${base.replace(/[^/]+\/$/, "")}project-details/`,
    detailsUrl,
  )

  check(
    `${page}: los diálogos siguen diferidos`,
    tags(documentHtml, "dialog").filter((attrs) => attrs.has("data-detail"))
      .length === 0,
  )

  /* La simplificación del 11-09-2026: ni píldoras de tecnología ni etiqueta de
     estado. Vive en la ficha, que es donde se lee entera. */
  check(
    `${page}: sin píldoras de tecnología ni estado`,
    !documentHtml.includes("entry-technologies") &&
      !documentHtml.includes('class="status"'),
  )
}

for (const page of [...projectsIndexBuilt, ...projectPagesBuilt]) {
  const documentHtml = withoutScripts(read(page))
  const pathname = `/${page.replace(/index\.html$/, "")}`
  const locale = pathname.startsWith("/ca/")
    ? "ca"
    : pathname.startsWith("/en/")
      ? "en"
      : "es"

  const robots = metaBy(documentHtml, "name", "robots")?.get("content") ?? ""
  check(`${page}: indexable`, robots.includes("index"), robots)
  check(`${page}: sin noindex`, !robots.includes("noindex"), robots)

  const canonicalUrl = linkBy(documentHtml, "canonical")?.get("href")
  check(`${page}: con canonical`, Boolean(canonicalUrl))
  if (canonicalUrl) {
    const origin = new URL(canonicalUrl).origin
    check(
      `${page}: canonical apunta a sí misma`,
      canonicalUrl === new URL(pathname, origin).href,
      canonicalUrl,
    )

    /* El segmento se traduce y el identificador no, así que la ficha castellana
       y la inglesa sólo coinciden en el último tramo: es exactamente el caso que
       `@astrojs/sitemap` no sabe emparejar y que obliga a declarar el grupo en
       `astro.config.mjs`. Si eso se cae, aquí se ve. */
    const suffix = pathname.replace(/^\/(ca|en)\//, "/").replace(/^\//, "")
    const expected = PROJECTS_INDEX_HREFS.map(
      (base) => new URL(base + suffix.replace(/^[^/]+\//, ""), origin).href,
    )

    for (const [alternateIndex, alternateLocale] of LOCALES.entries()) {
      const href = linkBy(
        documentHtml,
        "alternate",
        (attrs) => attrs.get("hreflang") === alternateLocale,
      )?.get("href")
      check(
        `${page}: hreflang ${alternateLocale} recíproco`,
        href === expected[alternateIndex],
        `${href} vs ${expected[alternateIndex]}`,
      )
    }

    const xDefault = linkBy(
      documentHtml,
      "alternate",
      (attrs) => attrs.get("hreflang") === "x-default",
    )?.get("href")
    check(
      `${page}: hreflang x-default castellano`,
      xDefault === expected[0],
      xDefault,
    )
  }

  check(
    `${page}: idioma HTML`,
    tagBy(documentHtml, "html", () => true)?.get("lang") === locale,
  )

  const h1Count = tags(documentHtml, "h1").length
  check(`${page}: un solo <h1>`, h1Count === 1, `encontrados ${h1Count}`)

  const dupes = duplicateIds(documentHtml)
  check(
    `${page}: ids únicos`,
    dupes.length === 0,
    `repetidos: ${dupes.join(", ")}`,
  )
}

/* Sólo las fichas: el visor y el diálogo son de la portada, y aquí no hay guion
   que los abra. */
/**
 * Y que ninguna ficha sea un callejón.
 *
 * A `/proyectos/<id>/` se llega de fuera: el índice abre el diálogo, así que
 * quien aterriza aquí viene de un buscador o de un enlace compartido. Del
 * 11-09 al 07-10-2026 la única salida era el «volver al portfolio» de la
 * barra, y eso convierte la mejor página del sitio en el final del recorrido.
 *
 * Se exigen tres caminos, que son los que `ProjectPage.astro` pinta: las
 * migas hacia la portada y hacia el índice, el siguiente proyecto —que tiene
 * que resolver a una ficha que exista, no a un `href` bonito— y el CV. El
 * contenido de los tres lo comprueba `project-pages.spec.ts` en un navegador;
 * aquí se comprueba que estén y que apunten a algo.
 */
const PROJECT_PAGE_SLUGS = new Set(
  projectPagesBuilt.map((page) => page.replace(/\/index\.html$/, "/")),
)

for (const page of projectPagesBuilt) {
  const documentHtml = withoutScripts(read(page))
  checkPageWeight(page, read(page), PAGE_BUDGETS.projectPage)

  /**
   * La tarjeta propia de la ficha, y que esté emitida.
   *
   * Hasta el 08-10-2026 las veinticuatro declaraban la de la portada. Ahora
   * cada una apunta a la suya, y lo que se puede romper en silencio es que el
   * `og:image` diga una dirección que el build no ha escrito: el enlace
   * compartido se vería sin imagen y aquí nada avisaría.
   */
  const cardUrl = metaBy(documentHtml, "property", "og:image")?.get("content")
  const cardPath = cardUrl?.replace(/^https?:\/\/[^/]+\//, "")
  check(
    `${page}: og:image es la tarjeta de la ficha`,
    Boolean(cardPath) && cardPath.endsWith("/og.jpg") && cardPath !== "og.jpg",
    String(cardUrl),
  )
  check(
    `${page}: la tarjeta está emitida`,
    Boolean(cardPath) && existsSync(join(DIST, cardPath)),
    String(cardPath),
  )

  const markup = withoutStyles(documentHtml)
  check(`${page}: sin diálogo de detalle`, !markup.includes("data-detail"))
  check(`${page}: sin visor de capturas`, !markup.includes("data-lightbox"))

  const crumbs = attribute(
    markup,
    /<nav class="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/,
  )
  const crumbHrefs = [...crumbs.matchAll(/href="([^"]+)"/g)].map(
    ([, href]) => href,
  )
  check(
    `${page}: migas de pan con portada e índice`,
    crumbHrefs.length === 2,
    `${crumbHrefs.length}: ${crumbHrefs.join(", ")}`,
  )

  const next = attribute(markup, /<a class="next-project" href="([^"]+)"/)
  check(
    `${page}: «siguiente proyecto» resuelve a una ficha`,
    PROJECT_PAGE_SLUGS.has(next.replace(/^\//, "")) ||
      PROJECT_PAGE_SLUGS.has(next.slice(1)),
    next || "sin enlace",
  )
  check(
    `${page}: el siguiente no es ella misma`,
    next.replace(/^\//, "") !== page.replace(/\/index\.html$/, "/"),
    next,
  )

  const cta = markup.match(/<div class="cta-actions"[\s\S]*?<\/div>/)?.[0] ?? ""
  check(
    `${page}: el cierre ofrece el CV y escribir`,
    /href="[^"]*cv\.pdf"/.test(cta) && /href="[^"]*#contact"/.test(cta),
    cta ? "faltan enlaces" : "sin bloque de cierre",
  )
}

// --- Página Sobre mí ------------------------------------------------------

const ABOUT_PAGES = [
  "sobre-mi/index.html",
  "ca/sobre-mi/index.html",
  "en/about/index.html",
]
const ABOUT_HREFS = ["/sobre-mi/", "/ca/sobre-mi/", "/en/about/"]
const ABOUT_ONLY_SENTINELS = [
  "Mis raíces amaziges y esa mezcla",
  "Les meves arrels amazigues i aquesta barreja",
  "My Amazigh roots and that mix",
]

const aboutBuilt = ABOUT_PAGES.filter((page) => existsSync(join(DIST, page)))

check(
  "sobre mí: los tres idiomas emitidos",
  aboutBuilt.length === ABOUT_PAGES.length,
  `emitidas ${aboutBuilt.length} de ${ABOUT_PAGES.length}`,
)

/**
 * El resumen corto de cada portada enlaza la presentación larga.
 *
 * Es el único enlace que queda: la barra tenía otro —una firma que se descifraba
 * al pasar por encima— y se ha ido con ella. Éste va oculto con `display: none`
 * hasta que alguien enfoca el retrato del hero, así que **nadie lo ve en el
 * navegador**, y precisamente por eso hay que medirlo aquí: el CSS que lo
 * esconde no lo esconde de Googlebot, que lee el `href` del HTML servido, pero
 * un descuido que se llevara el nodo entero dejaría `/sobre-mi/` sin un solo
 * enlace entrante y nadie se enteraría hasta ver caer el buscador.
 */
for (const [index, page] of PAGES.entries()) {
  if (!existsSync(join(DIST, page))) continue

  const href = ABOUT_HREFS[index]
  const links = tags(withoutScripts(read(page)), "a").filter(
    (attrs) => attrs.has("data-about-cta") && attrs.get("href") === href,
  ).length
  check(
    `${page}: enlaza Sobre mí desde el resumen`,
    links === 1,
    `${links} enlace(s) con data-about-cta a ${href}`,
  )
}

if (existsSync(join(DIST, "sitemap-0.xml"))) {
  const sitemap = read("sitemap-0.xml")
  const missing = ABOUT_HREFS.filter((href) => !sitemap.includes(href))
  check(
    "sobre mí: dentro del sitemap",
    missing.length === 0,
    missing.join(", "),
  )
}

for (const page of aboutBuilt) {
  const html = read(page)
  const documentHtml = withoutScripts(html)
  const pageIndex = ABOUT_PAGES.indexOf(page)
  const locale = LOCALES[pageIndex]
  const root = tagBy(documentHtml, "html", () => true)
  const canonicalUrl = linkBy(documentHtml, "canonical")?.get("href")
  const robots = metaBy(documentHtml, "name", "robots")?.get("content") ?? ""
  const cspValue =
    metaBy(documentHtml, "http-equiv", "content-security-policy")?.get(
      "content",
    ) ?? ""

  check(`${page}: idioma HTML`, root?.get("lang") === locale, root?.get("lang"))
  check(`${page}: canonical`, Boolean(canonicalUrl))
  check(
    `${page}: indexable`,
    robots.includes("index") && !robots.includes("noindex"),
    robots,
  )
  check(`${page}: CSP`, Boolean(cspValue))

  if (canonicalUrl) {
    const origin = new URL(canonicalUrl).origin
    check(
      `${page}: canonical localizado`,
      canonicalUrl === new URL(ABOUT_HREFS[pageIndex], origin).href,
      canonicalUrl,
    )
    for (const [alternateIndex, alternateLocale] of LOCALES.entries()) {
      const href = linkBy(
        documentHtml,
        "alternate",
        (attrs) => attrs.get("hreflang") === alternateLocale,
      )?.get("href")
      check(
        `${page}: hreflang ${alternateLocale} recíproco`,
        href === new URL(ABOUT_HREFS[alternateIndex], origin).href,
        href,
      )
    }
    const xDefault = linkBy(
      documentHtml,
      "alternate",
      (attrs) => attrs.get("hreflang") === "x-default",
    )?.get("href")
    check(
      `${page}: hreflang x-default castellano`,
      xDefault === new URL(ABOUT_HREFS[0], origin).href,
      xDefault,
    )
  }

  const title = attribute(html, /<title>([^<]*)<\/title>/)
  check(
    `${page}: <title> de ${TITLE_MAX} caracteres o menos`,
    title.length > 0 && title.length <= TITLE_MAX,
    `${title.length}`,
  )
  const description =
    metaBy(documentHtml, "name", "description")?.get("content") ?? ""
  check(
    `${page}: description de ${DESCRIPTION_MAX} caracteres o menos`,
    description.length > 0 && description.length <= DESCRIPTION_MAX,
    `${description.length}`,
  )

  const h1Count = tags(documentHtml, "h1").length
  check(`${page}: un solo <h1>`, h1Count === 1, `encontrados ${h1Count}`)
  const dupes = duplicateIds(documentHtml)
  check(
    `${page}: ids únicos`,
    dupes.length === 0,
    `repetidos: ${dupes.join(", ")}`,
  )
  checkPageWeight(page, html, PAGE_BUDGETS.about)

  const inlineStyles = [...documentHtml.matchAll(/<[a-z][^>]*>/gi)].filter(
    ([tag]) => attributes(tag).has("style"),
  ).length
  check(
    `${page}: sin atributos style=`,
    inlineStyles === 0,
    `encontrados ${inlineStyles}, la CSP los bloquea`,
  )
  const declaredHashes = new Set(
    (cspValue.match(/'sha256-[^']+'/g) ?? []).map((hash) => hash.slice(1, -1)),
  )
  const blockedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map(
      ([, css]) =>
        `sha256-${createHash("sha256").update(css).digest("base64")}`,
    )
    .filter((hash) => !declaredHashes.has(hash))
  check(
    `${page}: todo <style> tiene su hash en la CSP`,
    blockedStyles.length === 0,
    `${blockedStyles.length} sin declarar`,
  )

  const languageLinks = tags(documentHtml, "a").filter(
    (attrs) =>
      attrs.has("data-language-link") &&
      ABOUT_HREFS.includes(attrs.get("href") ?? ""),
  ).length
  check(
    `${page}: el conmutador de idioma se queda en Sobre mí`,
    languageLinks === 2,
    `${languageLinks} de 2 enlaces a Sobre mí`,
  )

  const homePath = LOCALE_PATH[locale]
  const expectedDestinations = [
    homePath,
    `${homePath}#projects`,
    `${homePath}#contact`,
  ]
  const missingDestinations = expectedDestinations.filter(
    (href) => !html.includes(`href="${href}"`),
  )
  check(
    `${page}: regreso, proyectos y contacto válidos`,
    missingDestinations.length === 0,
    missingDestinations.join(", "),
  )
}

// --- Endpoints públicos ----------------------------------------------------

const validator = new Validator()
const ENDPOINTS = LOCALES.flatMap((locale) => {
  const prefix = locale === "es" ? "" : `${locale}/`
  return [`${prefix}cv.json`, `${prefix}cv.md`, `${prefix}llms.txt`]
})

for (const endpoint of ENDPOINTS) {
  check(`${endpoint} existe`, existsSync(join(DIST, endpoint)))
  if (!existsSync(join(DIST, endpoint))) continue

  const body = read(endpoint)
  check(`${endpoint} no está vacío`, body.trim().length > 0)
  const leakedAboutCopy = ABOUT_ONLY_SENTINELS.filter((text) =>
    body.includes(text),
  )
  check(
    `${endpoint}: sin la presentación personal larga`,
    leakedAboutCopy.length === 0,
    leakedAboutCopy.join(", "),
  )

  if (endpoint.endsWith("cv.json")) {
    try {
      const resume = JSON.parse(body)
      const result = validator.validate(resume, jsonResumeSchema)
      check(
        `${endpoint}: JSON Resume válido`,
        result.valid,
        result.errors.map(({ stack }) => stack).join("; "),
      )
      check(
        `${endpoint}: $schema fijado`,
        resume.$schema ===
          "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.2.1/schema.json",
        resume.$schema,
      )
      check(
        `${endpoint}: imagen absoluta`,
        typeof resume.basics?.image === "string" &&
          URL.canParse(resume.basics.image) &&
          new URL(resume.basics.image).protocol === "https:",
      )
      check(
        `${endpoint}: countryCode ES`,
        resume.basics?.location?.countryCode === "ES",
      )
    } catch (error) {
      check(`${endpoint}: JSON parseable`, false, String(error))
    }
  }

  if (endpoint.endsWith("llms.txt")) {
    check(
      `${endpoint}: incluye educación`,
      /(^|\n)##\s+(Educación|Educació|Education)\s*$/m.test(body),
    )
    check(
      `${endpoint}: incluye certificaciones`,
      /(^|\n)##\s+(Certificaciones|Certificacions|Certifications)\s*$/m.test(
        body,
      ),
    )
    check(
      `${endpoint}: incluye idiomas`,
      /(^|\n)##\s+(Idiomas|Idiomes|Languages)\s*$/m.test(body),
    )
    check(
      `${endpoint}: incluye habilidades`,
      /(^|\n)##\s+(Habilidades|Habilitats|Skills)\s*$/m.test(body),
    )
  }
}

// --- CV HTML: fuente semántica y accesible del PDF -------------------------

const cvHtmlBuilt = CV_HTML_PAGES.filter((page) => existsSync(join(DIST, page)))
check(
  "CV HTML: los tres idiomas emitidos",
  cvHtmlBuilt.length === CV_HTML_PAGES.length,
  `emitidos ${cvHtmlBuilt.length} de ${CV_HTML_PAGES.length}`,
)

if (existsSync(join(DIST, "sitemap-0.xml"))) {
  const cvEntries = CV_HTML_HREFS.filter((href) =>
    read("sitemap-0.xml").includes(`${href}</loc>`),
  )
  check(
    "CV HTML: fuera del sitemap",
    cvEntries.length === 0,
    cvEntries.join(", "),
  )
}

const expectedResumeOrder = [
  "experience",
  "education",
  "projects",
  "summary",
  "skills",
  "training",
  "languages",
]

for (const page of cvHtmlBuilt) {
  const html = withoutScripts(read(page))
  const sectionOrder = [...html.matchAll(/data-resume-section="([^"]+)"/g)].map(
    ([, section]) => section,
  )
  const robots = metaBy(html, "name", "robots")?.get("content") ?? ""

  check(`${page}: noindex`, /\bnoindex\b/i.test(robots), robots)
  check(
    `${page}: orden curricular estable`,
    sectionOrder.join("|") === expectedResumeOrder.join("|"),
    sectionOrder.join(", "),
  )
  check(`${page}: un solo h1`, (html.match(/<h1\b/g) ?? []).length === 1)
  check(
    `${page}: un retrato decorativo y seis iconos vectoriales`,
    (html.match(/<img\b/g) ?? []).length === 1 &&
      (html.match(/<svg\b/g) ?? []).length === 6 &&
      /<img\b[^>]*\balt=""/i.test(html),
  )
  check(`${page}: sin tablas ni navegación`, !/<(?:table|nav)\b/i.test(html))
  check(
    `${page}: cabecera y columnas declaradas`,
    /data-resume-header/.test(html) &&
      /data-resume-primary/.test(html) &&
      /data-resume-sidebar/.test(html),
  )
  check(
    `${page}: contacto accionable`,
    /href="mailto:/.test(html) &&
      /href="tel:/.test(html) &&
      /linkedin\.com\/in\//.test(html) &&
      /github\.com\//.test(html),
  )
  check(
    `${page}: selección curricular exacta`,
    (html.match(/data-resume-work=/g) ?? []).length === 2 &&
      (html.match(/data-resume-project=/g) ?? []).length === 2 &&
      (html.match(/data-resume-education=/g) ?? []).length === 1 &&
      (html.match(/data-resume-certificate=/g) ?? []).length === 5 &&
      (html.match(/data-resume-language=/g) ?? []).length === 5,
  )
}

// --- PDF: fuentes y copias pertenecen a la misma ejecución ----------------

const PDF_MANIFEST = "cv-pdf-manifest.json"
const publicManifestPath = join("public", PDF_MANIFEST)
const distManifestPath = join(DIST, PDF_MANIFEST)
check("manifiesto PDF existe en public", existsSync(publicManifestPath))
check("manifiesto PDF existe en dist", existsSync(distManifestPath))

if (existsSync(publicManifestPath) && existsSync(distManifestPath)) {
  check(
    "manifiesto PDF idéntico entre public y dist",
    sha256File(publicManifestPath) === sha256File(distManifestPath),
  )

  try {
    const manifest = JSON.parse(readFileSync(distManifestPath, "utf8"))
    check(
      "manifiesto PDF declara el perfil visual",
      manifest.profile === "visual",
      manifest.profile ?? "sin perfil",
    )
    const currentSources = Object.fromEntries(
      Object.keys(manifest.sources ?? {}).map((path) => [
        path,
        sha256File(path),
      ]),
    )
    const sourceHash = createHash("sha256")
      .update(
        Object.entries(currentSources)
          .map(([path, hash]) => `${path}\0${hash}`)
          .join("\n"),
      )
      .digest("hex")

    check(
      "manifiesto PDF corresponde a las fuentes actuales",
      sourceHash === manifest.sourceHash,
      `${sourceHash} vs ${manifest.sourceHash ?? "sin huella"}`,
    )

    for (const locale of LOCALES) {
      const artifact = manifest.pdfs?.[locale]
      const relativePath = artifact?.path
      const publicPath = relativePath ? join("public", relativePath) : ""
      const distPath = relativePath ? join(DIST, relativePath) : ""
      check(`PDF ${locale} declarado en manifiesto`, Boolean(relativePath))
      if (!relativePath) continue
      check(`PDF ${locale} existe en public`, existsSync(publicPath))
      check(`PDF ${locale} existe en dist`, existsSync(distPath))
      if (!existsSync(publicPath) || !existsSync(distPath)) continue

      const publicHash = sha256File(publicPath)
      const distHash = sha256File(distPath)
      check(
        `PDF ${locale}: hash de public coincide con manifiesto`,
        publicHash === artifact.sha256,
      )
      check(
        `PDF ${locale}: hash de dist coincide con manifiesto`,
        distHash === artifact.sha256,
      )
      check(`PDF ${locale}: copias idénticas`, publicHash === distHash)
      check(
        `PDF ${locale}: tamaño coincide con manifiesto`,
        statSync(distPath).size === artifact.bytes,
      )
    }
  } catch (error) {
    check("manifiesto PDF válido", false, String(error))
  }
}

check("robots.txt existe", existsSync(join(DIST, "robots.txt")))
if (existsSync(join(DIST, "robots.txt"))) {
  const robots = read("robots.txt")
  check(
    "robots.txt permite rastreo",
    /^User-agent:\s*\*/im.test(robots) && /^Allow:\s*\/$/im.test(robots),
  )
  check("robots.txt anuncia sitemap", /^Sitemap:\s*https?:\/\//im.test(robots))
}

// --- Sitemap: las mismas etiquetas que la página --------------------------

const sitemap = read("sitemap-0.xml")
for (const locale of LOCALES) {
  check(
    `sitemap: hreflang="${locale}"`,
    new RegExp(`hreflang="${locale}"`).test(sitemap),
  )
}
check(
  "sitemap: sin etiquetas con región",
  !/hreflang="[a-z]{2}-[A-Z]{2}"/.test(sitemap),
  "la página emite es/ca/en, el sitemap debe usar las mismas",
)
check(
  "sitemap: hreflang x-default",
  /hreflang="x-default"/.test(sitemap),
  "la página lo emite; el sitemap debe declarar el mismo juego",
)

/**
 * `lastmod` sale del último commit que tocó los datos de cada página
 * (`astro.config.mjs`). Con historia completa tiene que estar en todas las URL
 * —si desaparece, algo rompió el cálculo sin avisar—; en un clon superficial
 * se omite a propósito. Y nunca puede ser una fecha inválida ni futura: un
 * `lastmod` que miente enseña a Google a no hacerle caso.
 */
const sitemapUrls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
  ([, entry]) => ({
    loc: entry.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "",
    lastmod: entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1],
  }),
)
const shallowClone = (() => {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        encoding: "utf8",
      }).trim() !== "false"
    )
  } catch {
    return true
  }
})()
const undated = sitemapUrls.filter(({ lastmod }) => !lastmod)
const badDates = sitemapUrls.filter(
  ({ lastmod }) =>
    lastmod &&
    !(
      Date.parse(lastmod) <= Date.now() + 60_000 &&
      !Number.isNaN(Date.parse(lastmod))
    ),
)
if (!shallowClone) {
  check(
    "sitemap: lastmod en todas las URL",
    undated.length === 0,
    undated.map(({ loc }) => loc).join(", "),
  )
}
check(
  "sitemap: lastmod válido y no futuro",
  badDates.length === 0,
  badDates.map(({ loc, lastmod }) => `${loc} ${lastmod}`).join(", "),
)

// --- CSP: cada documento declara lo suyo ----------------------------------

/**
 * Que cada documento de `dist/` declare, en su directiva, el hash de cada
 * guion y estilo en línea que su política gobierna.
 *
 * Hasta el 07-10-2026 el build repartía a todas las páginas la unión de los
 * hashes de todas, y aquí se comprobaba que cualquiera admitiera la hoja
 * incrustada de cualquier otra: con `<ClientRouter />`, tras un intercambio
 * seguía mandando la política de la página de origen. Sin router desde el
 * 02-10-2026, cada navegación analiza su propio `<meta>`.
 *
 * Las comprobaciones de más arriba miran sólo los `<style>` y sólo las páginas
 * de su lista. Esta mira todos los documentos, y también los guiones: por ahí
 * se coló el de `/project-details/`, un `is:inline` en el cuerpo y sin hash
 * que el navegador bloqueó del 31-08 al 06-10-2026. Cuenta sólo lo que va
 * detrás del `<meta>` —ver `governedByCsp` en `csp.mjs`— y deja fuera los
 * bloques de datos (`application/ld+json`), que no se ejecutan.
 */
{
  const hashOf = (text) =>
    `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`
  const gaps = []

  for (const page of htmlFiles(DIST)) {
    const html = readFileSync(page, "utf8")
    const csp = cspOf(html)
    const name = page
      .slice(DIST.length + 1)
      .split("\\")
      .join("/")

    if (csp === null) {
      gaps.push(`${name} sin CSP`)
      continue
    }

    const governed = governedByCsp(html)
    const inline = {
      "script-src": [
        ...governed.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
      ]
        .filter(([, attrs]) => !/\bsrc=|application\/ld\+json/i.test(attrs))
        .map(([, , code]) => hashOf(code)),
      "style-src": [
        ...governed.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
      ].map(([, css]) => hashOf(css)),
    }

    for (const [directive, own] of Object.entries(inline)) {
      const declared = new Set(hashesOf(csp, directive))
      const missing = own.filter((hash) => !declared.has(hash)).length
      if (missing > 0) gaps.push(`${name} ${directive} (${missing})`)
    }
  }

  check(
    "CSP: cada documento declara sus guiones y estilos en línea",
    gaps.length === 0,
    gaps.slice(0, 5).join("; "),
  )
}

// --- Sitemap y página: los mismos hreflang, URL por URL -------------------

/**
 * Las comprobaciones de arriba miran que cada etiqueta salga *en alguna parte*
 * del sitemap, y eso dejó pasar el desajuste real: `@astrojs/sitemap` empareja
 * los idiomas por el camino que queda tras el prefijo, así que las páginas con
 * slug propio por idioma —`/servicios/`, `/ca/serveis/`, `/en/services/`—
 * salían sin una sola alternativa, y las dos de `sobre-mi` con dos de tres. La
 * página declaraba las cuatro. Es la contradicción que Search Console llama
 * «alternativa sin etiqueta de retorno», y sólo se ve comparando URL por URL.
 */
for (const entry of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const block = entry[1]
  const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]
  if (!loc) continue

  const { pathname } = new URL(loc)
  const trimmed = pathname.replace(/^\/+|\/+$/g, "")
  const file = trimmed ? `${trimmed}/index.html` : "index.html"

  if (!existsSync(join(DIST, file))) {
    check(`sitemap: ${pathname} tiene página en dist/`, false, file)
    continue
  }

  const pairs = (source, pattern) =>
    [...source.matchAll(pattern)]
      .map(([, lang, href]) => `${lang}=${href}`)
      .sort()
      .join(", ")

  const inSitemap = pairs(block, /hreflang="([^"]+)" href="([^"]+)"/g)
  const inPage = pairs(
    read(file),
    /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g,
  )

  check(
    `sitemap: ${pathname} declara los hreflang de su página`,
    inSitemap === inPage,
    `sitemap [${inSitemap}] vs página [${inPage}]`,
  )
}

// --- Recursos generados ---------------------------------------------------

for (const card of ["og.jpg", "ca/og.jpg", "en/og.jpg"]) {
  const path = join(DIST, card)
  check(`${card} existe`, existsSync(path))
  if (!existsSync(path)) continue

  // El límite que aplica WhatsApp al previsualizar está en 300 KB.
  const kb = statSync(path).size / 1024
  check(`${card} por debajo de 300 KB`, kb < 300, `${kb.toFixed(0)} KB`)
  const { width, height } = await sharp(path).metadata()
  check(
    `${card}: dimensiones 1200×630`,
    width === 1200 && height === 630,
    `${width}×${height}`,
  )
}

/**
 * El PDF por idioma, que enlaza `PdfButton.astro`.
 *
 * No lo produce el build: lo genera `npm run cv:pdf` con Chromium y se versiona
 * en `public/`, de donde Astro lo copia. Por eso la comprobación va aquí y no
 * en el script que lo escribe — lo que hay que vigilar es que el archivo llegue
 * a `dist/`, porque el botón lo promete en las tres páginas.
 *
 * Aquí sólo se comprueba que el archivo llegue y no venga vacío. Lo que hay
 * dentro —una sola hoja, las fuentes incrustadas, los enlaces pulsables— lo
 * verifica `scripts/check-cv-pdf.mjs` al final de `npm run cv:pdf`, que es
 * donde se sabe si el PDF acaba de generarse bien.
 */
for (const pdf of ["cv.pdf", "ca/cv.pdf", "en/cv.pdf"]) {
  const path = join(DIST, pdf)
  check(
    `${pdf} existe`,
    existsSync(path),
    "regenéralo con `npm run cv:pdf` tras un build",
  )
  if (!existsSync(path)) continue

  const kb = statSync(path).size / 1024
  check(`${pdf} no está vacío`, kb > 20, `${kb.toFixed(0)} KB`)
}

check("portrait.webp existe", existsSync(join(DIST, "portrait.webp")))
check("_headers se publica", existsSync(join(DIST, "_headers")))

/**
 * `noindex` para las copias de `pages.dev`, y **sólo** para ellas.
 *
 * Una regla mal escrita —un `/*` en vez de la URL con `:project`— desindexaría
 * el dominio propio entero sin que nada más lo notase: el marcado seguiría
 * diciendo `index`. Se lee `_headers` regla a regla y se exige que cada
 * `X-Robots-Tag: noindex` cuelgue de una URL de `pages.dev`.
 */
if (existsSync(join(DIST, "_headers"))) {
  const rules = []
  for (const line of read("_headers").split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    if (/^\S/.test(line)) rules.push({ path: line.trim(), headers: [] })
    else rules.at(-1)?.headers.push(line.trim())
  }
  const noindexPaths = rules
    .filter(({ headers }) =>
      headers.some((header) => /^x-robots-tag:\s*noindex/i.test(header)),
    )
    .map(({ path }) => path)

  check(
    "_headers: noindex en pages.dev y en los previews",
    noindexPaths.includes("https://:project.pages.dev/*") &&
      noindexPaths.includes("https://:version.:project.pages.dev/*"),
    noindexPaths.join(", ") || "ninguna regla",
  )
  check(
    "_headers: ningún noindex fuera de pages.dev",
    noindexPaths.every((path) => /^https:\/\/[^/]*\.pages\.dev\//.test(path)),
    noindexPaths.join(", "),
  )
}
for (const notFound of ["404.html", "ca/404.html", "en/404.html"]) {
  check(`${notFound} existe`, existsSync(join(DIST, notFound)))
  if (existsSync(join(DIST, notFound))) {
    const html = withoutScripts(read(notFound))
    check(
      `${notFound}: noindex`,
      (metaBy(html, "name", "robots")?.get("content") ?? "").includes(
        "noindex",
      ),
    )
  }
}

// El original sin optimizar no debe acabar publicado. Antes se comprobaba un
// nombre con hash escrito a mano (`_astro/me.DTYTUH0f.webp`) que no existe
// nunca —los reales llevan un segundo hash por variante—, así que la regla
// pasaba sin comprobar nada. Se mide el tamaño: el original son 176 KB y la
// variante 3×, la más grande de las que emite `astro:assets`, se queda en 39 KB.
check("me.webp no se publica", !existsSync(join(DIST, "me.webp")))

/**
 * Peso máximo por archivo, en escalones según el ancho.
 *
 * Lo que busca la regla es que no se cuele un original sin optimizar. El límite
 * de 60 KB se calibró contra el retrato del hero —una foto, que comprime muy
 * bien— y se quedaba corto para una captura de interfaz: 720×1504 de UI oscura
 * con mucho texto de color son 59,7 KB a calidad 80, medidos. Reencodear no
 * ayuda: partiendo del PNG sin pérdida salen 59,68 KB, o sea que el doble paso
 * cuesta 0,1 KB y el peso es del contenido.
 *
 * 90 KB deja aire a esas capturas y sigue cazando lo que la regla busca: un
 * máster sin optimizar del mismo tamaño pasa de 200 KB.
 *
 * Una captura de escritorio tampoco cabe en el mismo presupuesto: tiene casi el
 * doble de ancho. En vez de subir el límite para todos, cada escalón cubre lo
 * que de verdad se emite a ese tamaño.
 */
const IMAGE_TIERS = [
  { maxWidth: 800, maxKb: 90 },
  { maxWidth: 1400, maxKb: 170 },
]

const assets = join(DIST, "_astro")

if (existsSync(assets)) {
  const jsGzipBytes = readdirSync(assets)
    .filter((file) => file.endsWith(".js"))
    .reduce(
      (total, file) =>
        total + gzipSync(readFileSync(join(assets, file))).length,
      0,
    )
  check(
    `JS gzip por debajo de ${JS_GZIP_BUDGET_BYTES} bytes`,
    jsGzipBytes <= JS_GZIP_BUDGET_BYTES,
    `${jsGzipBytes} bytes`,
  )
}

if (existsSync(assets)) {
  for (const file of readdirSync(assets)) {
    if (!file.endsWith(".webp")) continue

    const path = join(assets, file)
    const kb = statSync(path).size / 1024
    const { width } = await sharp(path).metadata()
    const tier = IMAGE_TIERS.find(({ maxWidth }) => width <= maxWidth)

    if (!tier) {
      check(
        `_astro/${file}: ancho dentro de lo previsto`,
        false,
        `${width} px — nada de la galería debería pasar de ${IMAGE_TIERS.at(-1).maxWidth}`,
      )
      continue
    }

    check(
      `_astro/${file} (${width} px) por debajo de ${tier.maxKb} KB`,
      kb < tier.maxKb,
      `${kb.toFixed(0)} KB — ¿se ha colado el original sin optimizar?`,
    )
  }
}

/**
 * Lo que descarga un visitante, no lo que hay en disco.
 *
 * Las miniaturas viven dentro de un <dialog> cerrado —`display: none`— con
 * `loading="lazy"`: la carga inicial no pide ni un byte de la galería. Quien
 * abre un detalle pide, como mucho, la variante mayor de cada captura de ESE
 * proyecto; quien además amplía, otra tanda en el visor. Se mide justo eso: por
 * diálogo, la entrada mayor de cada `srcset`.
 *
 * Los `src` de reserva quedan fuera a propósito: ningún navegador con `srcset`
 * los descarga, y contarlos inflaba el total por un factor de tres.
 *
 * Basta con `index.html`: los otros dos idiomas cambian el `alt`, no el
 * `srcset`.
 */
const SHOT_BUDGET_KB = 700

const assetKb = new Map(
  existsSync(assets)
    ? readdirSync(assets).map((file) => [
        file,
        statSync(join(assets, file)).size / 1024,
      ])
    : [],
)

for (const chunk of read("index.html").split("<dialog").slice(1)) {
  const block = chunk.split("</dialog>")[0]
  const id = attribute(block, /^[^>]*\sid="([^"]+)"/)
  let kb = 0
  let shots = 0
  const unresolved = []

  for (const [, srcset] of block.matchAll(/srcset="([^"]+)"/g)) {
    const largest = srcset
      .split(",")
      .map((entry) => entry.trim().split(/\s+/))
      .map(([url, width]) => ({
        file: url.split("/").pop(),
        width: Number.parseInt(width, 10),
      }))
      .sort((a, b) => b.width - a.width)[0]

    shots += 1

    // Antes esto era `?? 0`: un archivo que no estuviera en `_astro` sumaba cero
    // y el presupuesto pasaba sin haber pesado nada. Ahora falta el archivo, se
    // dice.
    const size = assetKb.get(largest.file)
    if (size === undefined) unresolved.push(largest.file)
    else kb += size
  }

  // Los diálogos de detalle sin galería no traen `srcset`: no hay nada que pesar.
  if (shots === 0) continue

  check(
    `#${id}: cada captura resuelve a un archivo de _astro`,
    unresolved.length === 0,
    unresolved.join(", "),
  )

  check(
    `#${id}: capturas por debajo de ${SHOT_BUDGET_KB} KB`,
    kb < SHOT_BUDGET_KB,
    `${kb.toFixed(0)} KB`,
  )
}

/** Lo que engorda el clon del repositorio, que es otra cosa. */
const MASTER_BUDGET_KB = 1200
const projectAssets = join("src", "assets", "projects")

if (existsSync(projectAssets)) {
  for (const slug of readdirSync(projectAssets)) {
    const directory = join(projectAssets, slug)
    if (!statSync(directory).isDirectory()) continue

    const kb = readdirSync(directory).reduce(
      (sum, file) => sum + statSync(join(directory, file)).size / 1024,
      0,
    )
    check(
      `másteres de ${slug} por debajo de ${MASTER_BUDGET_KB} KB`,
      kb < MASTER_BUDGET_KB,
      `${kb.toFixed(0)} KB`,
    )
  }
}

// --- El expediente no viaja al navegador -----------------------------------

/**
 * Lo que sabe el modelo se queda en el Worker.
 *
 * `/api/ask` compone sus instrucciones en el servidor con `cv.json`, `about.ts`,
 * `services.ts`, `askNotes.ts`, `askProfile.ts` y el secreto `ASK_DOSSIER`.
 * Nada de eso puede acabar en `dist/`: el CV ya es público, pero las
 * instrucciones, las notas del expediente y el dossier privado no, y basta con
 * que alguien importe
 * `buildSystemPrompt` desde un módulo de cliente para que el texto entero se
 * descargue con la página.
 *
 * Se buscan tres centinelas: la primera frase del prompt, el nombre de la
 * variable de entorno y frases de `askNotes.ts` y `askProfile.ts` que no están
 * en ninguna otra parte del sitio. No prueba que el secreto esté a salvo —eso lo garantiza que
 * viva en Pages y no en el repositorio— sino que la frontera entre el Worker y
 * el paquete del navegador sigue en pie.
 *
 * Los dos módulos de `ask` son los que más fácil se cuelan: tienen la misma
 * pinta que `about.ts`, que sí se pinta en una página. Éstos no.
 */
{
  const leaks = []
  const walk = (directory) => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(js|html|json|txt|md)$/i.test(entry)) continue
      const body = readFileSync(full, "utf8")
      if (
        body.includes("Eres el asistente del portfolio") ||
        body.includes("ASK_DOSSIER") ||
        body.includes("Este portfolio lo ha hecho él entero") ||
        body.includes("En periodos de mayor volumen ha superado los 70 km")
      ) {
        leaks.push(entry)
      }
    }
  }
  walk(DIST)

  check(
    "el expediente de `ask` no aparece en dist/",
    leaks.length === 0,
    leaks.join(", "),
  )
}

/**
 * Cada URL indexable describe **su** página, y no la portada.
 *
 * Hasta el 11-09-2026 `buildProfileJsonLd` recomponía siempre la canónica de la
 * portada, así que las 36 URL del sitemap emitían un nodo con el mismo `@id`
 * diciendo ser `https://imadelmalki.com/` mientras su propio
 * `<link rel="canonical">` decía otra cosa. Es el `SEO-02` de
 * `AUDIT-2026-09-11.md`.
 *
 * Nada lo cazaba: la CSP, los `hreflang` y el canonical se vigilaban uno por
 * uno, pero el dato estructurado no se comparaba con ellos. Aquí se comparan.
 */
{
  const pageIds = new Map()
  let checked = 0

  for (const file of htmlFiles(DIST)) {
    const html = readFileSync(file, "utf8")
    const relative = file.slice(DIST.length + 1).replace(/\\/g, "/")

    /* Una página fuera del índice no declara canonical ni JSON-LD, y es
       correcto: no es una dirección que nadie deba guardar. */
    const canonical = linkBy(html, "canonical")?.get("href")
    const script = html.match(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    )
    if (!canonical || !script) continue

    let graph
    try {
      graph = JSON.parse(script[1].replace(/\\u003c/g, "<"))["@graph"]
    } catch {
      check(`${relative}: JSON-LD analizable`, false)
      continue
    }

    const node = graph?.[0]
    checked += 1

    check(
      `${relative}: el nodo de la página declara su propia canónica`,
      node?.url === canonical,
      `${node?.url} ≠ ${canonical}`,
    )
    check(
      `${relative}: el @id del nodo cuelga de su canónica`,
      node?.["@id"] === `${canonical}#page`,
      node?.["@id"],
    )

    if (pageIds.has(node?.["@id"])) {
      check(
        `${relative}: @id sin repetir`,
        false,
        `ya lo declara ${pageIds.get(node["@id"])}`,
      )
    }
    pageIds.set(node?.["@id"], relative)

    /* Las fichas de proyecto: lo que `cbd6824` hizo indexable tiene que decir
       de qué trata, y su sujeto tiene que existir en el mismo grafo. */
    const isProjectPage =
      /^(?:(?:ca|en)\/)?(?:proyectos|projectes|projects)\/[^/]+\/index\.html$/.test(
        relative,
      )
    if (!isProjectPage) continue

    check(`${relative}: es una ItemPage`, node?.["@type"] === "ItemPage")

    const subject = node?.mainEntity?.["@id"]
    check(
      `${relative}: su mainEntity existe en el grafo`,
      Boolean(subject) && graph.some((other) => other["@id"] === subject),
      subject,
    )

    const crumbs = graph.find((other) => other["@type"] === "BreadcrumbList")
    check(
      `${relative}: lleva migas de portada, índice y ficha`,
      crumbs?.itemListElement?.length === 3 &&
        crumbs.itemListElement.at(-1)?.item === canonical,
      crumbs?.itemListElement?.at(-1)?.item,
    )
  }

  /* Que el recorrido no se quede en cero por un cambio de nombres: sin esto,
     romper el bucle dejaría las comprobaciones de arriba en verde sin ejecutar
     ninguna. */
  check(
    "hay páginas indexables con JSON-LD que comprobar",
    checked >= 36,
    `${checked}`,
  )
}

// --- Resultado -------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} comprobación(es) fallida(s):\n`)
  for (const failure of failures) console.error(`  · ${failure}`)
  process.exit(1)
}

console.log("✓ dist/ pasa todas las comprobaciones")
