#!/usr/bin/env node
/**
 * Genera el CV en PDF, uno por idioma, a partir de la web ya construida.
 *
 * El PDF sale del `@media print` que ya vive en los componentes: no hay una
 * segunda maquetación que mantener, y cualquier cambio en el CV llega al PDF
 * sin tocar nada de aquí.
 *
 * Forma parte de la cadena de release entre el build fuente y el build final:
 * sirve el primer `dist/`, genera los tres PDF en `public/` y deja un manifiesto
 * para que el segundo build copie exactamente esos artefactos.
 */
import { createReadStream, existsSync, statSync } from "node:fs"
import { createHash } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import {
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from "node:path"
import { chromium } from "playwright"
import { verifyCvAtsPdfs } from "./check-cv-ats.mjs"
import { verifyCvPdfs } from "./check-cv-pdf.mjs"

const DIST = "dist"
const MANIFEST = "public/cv-pdf-manifest.json"
const PDF_SOURCES = [
  "astro.config.mjs",
  "cv.json",
  "package.json",
  "package-lock.json",
  "src/assets/me.webp",
  "src/components/ResumeDocument.astro",
  "src/pages/portrait.webp.ts",
  "src/pages/[...locale]/cv.astro",
  "src/cv.ts",
  "src/lib/cvSchema.ts",
  "src/lib/i18n.ts",
  "src/lib/resume.ts",
  "src/lib/ui.ts",
  "scripts/build-cv-pdf.mjs",
  "scripts/check-cv-pdf.mjs",
  "scripts/check-cv-ats.mjs",
]
const LOCALES = [
  { code: "es", path: "/cv/", output: "public/cv.pdf" },
  { code: "ca", path: "/ca/cv/", output: "public/ca/cv.pdf" },
  { code: "en", path: "/en/cv/", output: "public/en/cv.pdf" },
]

/**
 * Lo que `page.pdf()` no rellena solo.
 *
 * `printBackground` conserva el acento, las reglas y los indicadores de idioma
 * del documento dedicado. El único raster permitido es el retrato optimizado;
 * los iconos de contacto son vectores y todo el texto sigue en flujo normal.
 *
 * El tamaño y los márgenes llegan desde el `@page` de la ruta curricular
 * gracias a `preferCSSPageSize`, así que el diálogo de impresión del navegador
 * produce la misma caja que este archivo.
 */
const PDF_OPTIONS = {
  outline: true,
  preferCSSPageSize: true,
  printBackground: true,
  tagged: true,
}

/**
 * El dominio con el que se sellan los enlaces internos del PDF. `SITE_URL` es
 * la misma variable que usa `astro.config.mjs`, así que el PDF y el canonical
 * de la web no pueden discrepar.
 *
 * `||` y no `??`, igual que allí. En Actions, un `vars.SITE_URL` que no existe
 * no llega como ausente: llega como **cadena vacía**, y `??` sólo cae con
 * `null` o `undefined`. El resultado era `new URL("")` y un `ERR_INVALID_URL`
 * que tiró el build del repositorio público el 08-10-2026 —allí esa variable
 * no está definida—, justo después de que la web se construyera sin problema
 * porque `astro.config.mjs` sí usa `||`.
 */
const SITE_ORIGIN = new URL(process.env.SITE_URL || "https://imadelmalki.com")
  .origin

/**
 * Skia sella cada PDF con la hora de generación, así que dos ejecuciones del
 * mismo commit daban dos ficheros distintos: el hash del manifiesto cambiaba
 * sin que cambiase una línea del CV, y no servía para saber si el contenido se
 * había movido.
 *
 * Se reescribe sobre los bytes ya generados y no por opción de `page.pdf()`
 * porque no existe tal opción. La sustitución conserva **exactamente** la misma
 * longitud: la tabla de referencias cruzadas guarda desplazamientos absolutos y
 * un byte de más los invalidaría todos.
 *
 * Convención de builds reproducibles: manda `SOURCE_DATE_EPOCH` si está; si no,
 * una constante. Lo que no puede es ser «ahora».
 */
const PINNED_PDF_DATE = (() => {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH)
  const date =
    Number.isFinite(epoch) && epoch > 0
      ? new Date(epoch * 1000)
      : new Date(Date.UTC(2026, 0, 1))
  const pad = (value) => String(value).padStart(2, "0")
  return (
    `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}+00'00'`
  )
})()

function pinPdfDates(pdf) {
  // `D:YYYYMMDDHHmmSS+00'00'` — 23 bytes, los mismos que escribe Skia.
  const pattern = /\/(CreationDate|ModDate)\s*\(D:\d{14}\+\d{2}'\d{2}'\)/g
  const text = pdf.toString("latin1")
  const pinned = text.replace(
    pattern,
    (match, key) => `/${key} (${PINNED_PDF_DATE})`,
  )

  if (Buffer.byteLength(pinned, "latin1") !== pdf.length) {
    throw new Error(
      "fijar la fecha del PDF cambió su longitud; la tabla xref quedaría rota",
    )
  }
  return Buffer.from(pinned, "latin1")
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex")
}

async function writeManifest() {
  const sources = Object.fromEntries(
    await Promise.all(
      PDF_SOURCES.map(async (path) => [path, await sha256(path)]),
    ),
  )
  const sourceHash = createHash("sha256")
    .update(
      Object.entries(sources)
        .map(([path, hash]) => `${path}\0${hash}`)
        .join("\n"),
    )
    .digest("hex")
  const pdfs = Object.fromEntries(
    await Promise.all(
      LOCALES.map(async ({ code, output }) => [
        code,
        {
          path: output.replace(/^public[/\\]/, "").replaceAll("\\", "/"),
          sha256: await sha256(output),
          bytes: (await stat(output)).size,
        },
      ]),
    ),
  )

  await writeFile(
    MANIFEST,
    `${JSON.stringify({ schemaVersion: 1, profile: "visual", sourceHash, sources, pdfs }, null, 2)}\n`,
  )
  console.log(`manifiesto → ${MANIFEST}`)
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
}

/**
 * Servidor estático mínimo sobre `dist/`.
 *
 * Hace falta un origen HTTP real y no `file://`: con `file://` el navegador
 * trata cada archivo como opaco y la CSP del `<meta>` bloquea las fuentes y los
 * scripts, así que el PDF salía sin tipografía.
 */
function serve(root) {
  const base = resolve(root)

  const server = createServer((request, response) => {
    let pathname
    try {
      pathname = decodeURIComponent(
        new URL(request.url ?? "/", "http://localhost").pathname,
      )
    } catch {
      response.writeHead(400).end()
      return
    }

    const requestedPath = normalize(pathname).replace(/^([/\\])+/, "")
    let file = resolve(base, requestedPath)

    // `startsWith(base)` permitiría un hermano llamado `dist-backup`. `relative`
    // comprueba el límite real del directorio también en Windows.
    const pathFromBase = relative(base, file)
    if (
      pathFromBase === ".." ||
      pathFromBase.startsWith(
        `..${process.platform === "win32" ? "\\" : "/"}`,
      ) ||
      isAbsolute(pathFromBase)
    ) {
      response.writeHead(403).end()
      return
    }

    // `/`, `/ca/` y `/en/` son directorios en `dist/`: el índice va dentro.
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, "index.html")
    }

    if (!existsSync(file)) {
      response.writeHead(404).end()
      return
    }

    const extension = extname(file).toLowerCase()
    response.writeHead(200, {
      "Content-Type": MIME[extension] ?? "application/octet-stream",
    })
    createReadStream(file).pipe(response)
  })

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () =>
      resolveServer({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      }),
    )
  })
}

async function main() {
  if (!existsSync(DIST)) {
    console.error(
      `No existe «${DIST}/». Ejecuta \`npm run build\` antes de \`npm run cv:pdf\`.`,
    )
    process.exit(1)
  }

  const server = await serve(DIST)
  // La paleta del documento visual es clara y fija; el contexto evita heredar
  // una preferencia de sistema distinta durante la impresión.
  const browser = await chromium.launch()
  const context = await browser.newContext({ colorScheme: "light" })

  try {
    for (const { code, path, output } of LOCALES) {
      const page = await context.newPage()

      await page.goto(`${server.origin}${path}`, { waitUntil: "load" })
      /* Los enlaces internos se resolvían contra el servidor de este script, y
         el PDF publicado acababa con una anotación a
         `http://127.0.0.1:<puerto efímero>/`: un enlace muerto justo donde
         alguien busca el portfolio, y además distinto en cada ejecución, que es
         lo único que impedía que el archivo fuese reproducible. Se reescriben
         al dominio canónico **antes** de imprimir, que es cuando Chromium fija
         las anotaciones. */
      await page.evaluate(
        ([localOrigin, siteOrigin]) => {
          for (const anchor of document.querySelectorAll("a[href]")) {
            const href = anchor.getAttribute("href") ?? ""
            if (/^(mailto:|tel:)/i.test(href)) continue
            const resolved = new URL(href, document.baseURI)
            if (resolved.origin !== localOrigin) continue
            anchor.setAttribute(
              "href",
              `${siteOrigin}${resolved.pathname}${resolved.search}${resolved.hash}`,
            )
          }
        },
        [server.origin, SITE_ORIGIN],
      )
      await page.emulateMedia({ media: "print" })
      // Después de `emulateMedia`: el medio impreso pide pesos y tamaños que la
      // pantalla no usa, y sin esperarlos el PDF sale con la fuente de reserva
      // del sistema.
      await page.evaluate(() => document.fonts.ready)
      // Una futura animación no debe dejar el PDF en un fotograma intermedio.
      await page.evaluate(async () => {
        const finished = document
          .getAnimations()
          // Una animación infinita no termina nunca: esperarla colgaría el
          // build. Ninguna debería sobrevivir al medio impreso —las del sitio
          // van dentro de `@media screen`— pero el generador no puede quedarse
          // a merced de que eso siga siendo cierto.
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished)

        await Promise.race([
          Promise.all(finished),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ])
      })

      const pdf = pinPdfDates(await page.pdf(PDF_OPTIONS))
      await mkdir(dirname(output), { recursive: true })
      await writeFile(output, pdf)
      await page.close()

      const { size } = await stat(output)
      console.log(`${code} → ${output} (${Math.round(size / 1024)} KB)`)
    }
  } finally {
    await context.close()
    await browser.close()
    await server.close()
  }

  // Generar y no comprobar es como estaba antes: los PDF se rompían en silencio
  // —texto invisible, fuentes Type 3, retratos duplicados, una hoja de más— y
  // nadie se enteraba hasta abrirlos. La verificación va aquí dentro para que
  // también corra en la CI, que ejecuta este mismo comando.
  verifyCvPdfs(LOCALES.map(({ output }) => output))
  await verifyCvAtsPdfs(
    LOCALES.map(({ code, output }) => ({ locale: code, path: output })),
  )
  await writeManifest()
}

try {
  await main()
} catch (error) {
  console.error(`
✗ ${error.message}`)
  process.exit(1)
}
