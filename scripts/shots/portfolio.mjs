/**
 * Capturas de este mismo portafolio para su ficha de proyecto.
 *
 * ```bash
 * npm run build                      # deja dist/ al día
 * npx vite preview --port 4321       # en otra terminal
 * node scripts/shots/portfolio.mjs
 * ```
 *
 * ## Por qué este es `.mjs` y los demás `.py`
 *
 * La regla de esta carpeta es reutilizar el arnés de Playwright **del proyecto
 * que se captura** en vez de reimplementarlo, y los otros seis son
 * aplicaciones ajenas que se conducen desde fuera. El arnés de éste es el de
 * este repositorio: `@playwright/test`, ya instalado y fijado en el lockfile.
 * Añadir Playwright para Python sólo para fotografiarse a sí mismo sería la
 * segunda instalación de lo mismo.
 *
 * ## Qué se enseña, y por qué esas cuatro
 *
 * La ficha tiene que contestar «¿y esto qué demuestra?» sin que nadie abra el
 * código: la portada, los proyectos, el asistente respondiendo —que es la
 * única parte con servidor— y una ficha de proyecto en tema oscuro, que es la
 * plantilla que más trabajo lleva y de paso enseña el conmutador.
 *
 * La respuesta del asistente **no** se pide a OpenAI: se interpone `/api/ask`
 * con una respuesta fija. Contra el modelo real la imagen saldría distinta
 * cada vez, gastaría tokens y podría publicar una frase que nadie ha revisado.
 */
import { chromium } from "@playwright/test"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { connect } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : ".shots/portfolio"
const PORT = 4321
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * Cadenas que no pueden salir en una imagen publicada.
 *
 * Salen de la lista de fuera del repositorio, la misma que usa
 * `scripts/export-public.mjs`. Iban escritas aquí —el pueblo, el DNI y los
 * términos de la etapa anterior— y este guion viaja en la copia pública: o
 * sea que estaban publicadas, que es exactamente el fallo del que protegen.
 * Mismo papel que la clase `Guard` de `_common.py`: comprobar contra el texto
 * que de verdad se renderiza, no contra la semilla.
 *
 * Su nombre no está: es público, y no tiene sentido esconderlo en un archivo
 * que existe para no publicar nada.
 */
const DENYLIST =
  process.env.PUBLIC_DENYLIST ??
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "portfolio-public-denylist.txt",
  )

if (!existsSync(DENYLIST)) {
  console.error(
    [
      `No existe la lista de términos vetados: ${DENYLIST}`,
      "Vive fuera del repositorio a propósito. Créala con una línea por",
      "término, o apunta a otra con la variable PUBLIC_DENYLIST.",
    ].join("\n"),
  )
  process.exit(1)
}

const FORBIDDEN = readFileSync(DENYLIST, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))

if (FORBIDDEN.length === 0) {
  console.error(`La lista ${DENYLIST} no tiene ni un término.`)
  process.exit(1)
}

const ANSWER =
  "Este portfolio está hecho con Astro y desplegado en Cloudflare Pages. " +
  "El CV vive en un solo cv.json, y de ahí salen la página, el PDF y los " +
  "formatos para máquinas."

/** Sale con el comando exacto si la vista previa no está levantada. */
async function requirePort() {
  const reachable = await new Promise((resolve) => {
    const probe = connect({ host: "127.0.0.1", port: PORT })
    probe.setTimeout(1000)
    probe.on("connect", () => {
      probe.destroy()
      resolve(true)
    })
    probe.on("error", () => resolve(false))
    probe.on("timeout", () => {
      probe.destroy()
      resolve(false)
    })
  })

  if (!reachable) {
    console.error(
      `No hay nada escuchando en 127.0.0.1:${PORT}.\n` +
        "Levántalo en otra terminal y vuelve a lanzar esto:\n\n" +
        `    npx vite preview --port ${PORT}\n`,
    )
    process.exit(1)
  }
}

async function save(page, name) {
  const text = await page.innerText("body")
  const hits = FORBIDDEN.filter((value) =>
    text.toLowerCase().includes(value.toLowerCase()),
  )
  if (hits.length > 0) {
    console.error(
      `${name}: la captura contiene datos que no deben publicarse: ${hits.join(", ")}`,
    )
    process.exit(1)
  }

  await page.screenshot({ path: join(OUT, name) })
  console.log(`  ✓ ${name}`)
}

/**
 * Espera a las fuentes y a las imágenes, incluidas las diferidas.
 *
 * Pedir que **todas** las de `document.images` estén completas no termina
 * nunca: las miniaturas de las tarjetas van con `loading="lazy"` y fuera de
 * pantalla el navegador no las pide. Se les quita el diferido y se espera a
 * que decodifiquen, igual que hace `loadThumbnails` en `visual.spec.ts`.
 */
async function settle(page) {
  await page.evaluate(() => document.fonts?.ready)
  await page.evaluate(async () => {
    const images = [...document.images]
    for (const image of images) image.loading = "eager"
    await Promise.all(
      images.map((image) => image.decode().catch(() => undefined)),
    )
  })
  await page.waitForTimeout(500)
}

await requirePort()
mkdirSync(OUT, { recursive: true })

/* `--disable-lcd-text` quita el antialiasing subpíxel: sin él el texto queda
   con franjas de color aunque `prepare-project-shots.mjs` reduzca después. */
const browser = await chromium.launch({ args: ["--disable-lcd-text"] })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  locale: "es-ES",
  // La entrada escalonada del hero y el revelado por scroll saldrían a medias.
  reducedMotion: "reduce",
})
await context.route("**/api/ask", (route) =>
  route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: `data: ${JSON.stringify({ text: ANSWER })}\n\ndata: [DONE]\n\n`,
  }),
)

const page = await context.newPage()

await page.goto(BASE_URL, { waitUntil: "networkidle" })
await settle(page)
await save(page, "01-portada.png")

await page.evaluate(() => {
  const section = document.querySelector("#projects")
  if (!section) throw new Error("falta la sección de proyectos")
  window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY - 24)
})
await page.waitForTimeout(600)
await save(page, "02-proyectos.png")

await page.evaluate(() => window.scrollTo(0, 0))
await page.click("[data-ask-dock-trigger]")
await page.fill(".ask-dock-input", "¿cómo está hecho este sitio?")
await page.press(".ask-dock-input", "Enter")
await page.waitForSelector(".ask-dock-answer")
await page.locator(".ask-dock-input").blur()
await page.waitForTimeout(400)
await save(page, "03-asistente.png")

await page.goto(`${BASE_URL}/proyectos/100-cims/`, { waitUntil: "networkidle" })
await page.evaluate(() => window.theme.setTheme("dark"))
await settle(page)
await save(page, "04-ficha-oscuro.png")

await context.close()
await browser.close()
console.log(`\n✓ 4 capturas en ${OUT}`)
