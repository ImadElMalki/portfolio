import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/**
 * Accesibilidad medida sobre el DOM real.
 *
 * `contrast.test.ts` ya vigila los colores, pero lo hace leyendo `Layout.astro`
 * como texto: mide tokens, no páginas. Aquí se auditan roles, nombres
 * accesibles y estados —incluido el `inert` de la barra compacta y el diálogo
 * abierto, que son los dos sitios donde el marcado cambia por JS.
 *
 * axe se inyecta con `page.evaluate`, que no pasa por la CSP; con
 * `addScriptTag` la política de hashes del sitio lo bloquearía.
 */
/**
 * Hasta WCAG 2.2 AA, no sólo 2.0.
 *
 * Con `wcag2a`/`wcag2aa` a secas quedaban fuera las tres reglas que más le
 * aplican a esta página: reflow (1.4.10), contraste de elementos no textuales
 * (1.4.11) y tamaño del destino (2.5.8) — que es de lo que va una barra de cinco
 * controles de 44 px y una galería de miniaturas.
 */
/**
 * Se audita con movimiento reducido, y no es por comodidad.
 *
 * Las secciones aparecen con `animation-timeline: view()`, así que su opacidad
 * es función de la posición del scroll: lo que queda por debajo del pliegue está
 * a medio revelar. axe mide el color **efectivo**, de modo que auditar desde
 * `scrollY: 0` le pregunta por texto que en ese instante está medio
 * transparente. Y lo contesta: `--text-subtle` a 12 px dentro del chip de
 * fechas salía a 1.4:1 —el color calculado era `#d2d5d2` en vez de `#3e4841`—
 * porque su sección aún no había terminado de entrar.
 *
 * Eso no es un fallo de contraste, es un fotograma. El criterio 1.4.3 habla del
 * estado en reposo, y en reposo esa sección está opaca: el rango de la
 * animación es `entry 8% cover 22%`, o sea que llega a `opacity: 1` mucho antes
 * de quedar en una posición cómoda para leerla. Con la preferencia en `reduce`
 * el revelado no existe —el `@media` que lo envuelve pide `no-preference`— y
 * axe mide los colores de verdad.
 *
 * El efecto secundario de no hacerlo era peor que un falso positivo: la
 * auditoría dependía de la altura de la página, así que cualquier cambio de
 * maquetación movía un bloque a la franja mala y rompía una prueba que no tenía
 * nada que ver con lo que se había tocado.
 *
 * Va con `emulateMedia` y no con `test.use({ reducedMotion })`: la opción de
 * contexto no llegaba a la página —`matchMedia` seguía respondiendo `false`— y
 * la auditoría pasaba a ser la de siempre sin decirlo. Es además el mismo
 * mecanismo que usa `navigation.spec.ts` para lo mismo.
 */
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
})

const audit = (page: Page) =>
  new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
  ])

/**
 * Un motor basta —axe mide el DOM, no el renderizado—, pero **dos anchos no
 * sobran**: reflow y tamaño de destino sólo se pueden medir donde el ancho
 * aprieta, y a 1280 px nunca aprieta.
 */
const AUDITED_PROJECTS = new Set(["chromium-desktop", "chromium-mobile"])

const describeViolations = (
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) =>
  violations
    .map(
      ({ id, impact, help, nodes }) =>
        `${id} (${impact}): ${help}\n    ${nodes
          .map((node) => node.target.join(" "))
          .join("\n    ")}`,
    )
    .join("\n")

/**
 * Las tres páginas del portfolio y las seis páginas públicas localizadas.
 * Enumerarlas de forma explícita evita que una ruta ausente responda con un
 * 404 accesible y la prueba quede en verde sin haber auditado la página real.
 */
const PATHS = [
  "/",
  "/ca/",
  "/en/",
  "/sobre-mi/",
  "/ca/sobre-mi/",
  "/en/about/",
  "/servicios/",
  "/ca/serveis/",
  "/en/services/",
  "/privacidad/",
  "/ca/privacitat/",
  "/en/privacy/",
  "/proyectos/",
  "/ca/projectes/",
  "/en/projects/",
  /* Una ficha por idioma, y la de Riolan a propósito: es la que trae galería,
     enlaces externos y estado, o sea la que más DOM pone en juego. */
  "/proyectos/riolan-solutions/",
  "/ca/projectes/riolan-solutions/",
  "/en/projects/riolan-solutions/",
]

for (const path of PATHS) {
  test(`has no accessibility violations at ${path}`, async ({
    page,
  }, testInfo) => {
    test.skip(
      !AUDITED_PROJECTS.has(testInfo.project.name),
      "Un motor por ancho basta: axe mide el DOM, no el renderizado",
    )

    await page.goto(path)
    const { violations } = await audit(page).analyze()

    expect(describeViolations(violations)).toBe("")
  })
}

test("has no accessibility violations with a project dialog open", async ({
  page,
}, testInfo) => {
  test.skip(
    !AUDITED_PROJECTS.has(testInfo.project.name),
    "Un motor por ancho basta: axe mide el DOM, no el renderizado",
  )

  await page.goto("/")
  await page.locator("[data-detail-open]").first().click()
  await expect(page.locator("dialog[data-detail][open]").first()).toBeVisible()

  const { violations } = await audit(page).analyze()
  expect(describeViolations(violations)).toBe("")
})

/**
 * El panel del asistente, con una respuesta ya escrita.
 *
 * Es la otra pieza que se construye entera desde JS: el diálogo, su cabecera,
 * el eco, la respuesta, el pie con el puente a la consola y las sugerencias.
 * Cerrado no existe y vacío no tiene nada que auditar, así que se abre y se
 * pregunta primero —con el endpoint interceptado, que aquí no se mide la
 * factura del modelo sino el marcado que sale—.
 */
test("has no accessibility violations in the ask dock", async ({
  page,
}, testInfo) => {
  test.skip(
    !AUDITED_PROJECTS.has(testInfo.project.name),
    "Un motor por ancho basta: axe mide el DOM, no el renderizado",
  )

  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        'data: {"text":"Vive en La Gornal, Barcelona."}\n\n' +
        "data: [DONE]\n\n",
    }),
  )

  await page.goto("/")
  /* Con el panel **abierto**: su marcado lo construye `askDock.ts` entero y
     hasta que alguien pulsa no existe, así que auditar la portada sin abrirlo
     sería auditar un botón. */
  await page.locator("[data-ask-dock-trigger]").click()
  const field = page.locator(".ask-dock-input")
  await expect(page.locator(".ask-dock-suggestion").first()).toBeVisible()
  await field.fill("¿dónde vive?")
  await field.press("Enter")
  await expect(page.locator(".ask-dock-answer")).toContainText("Barcelona")

  const { violations } = await audit(page).analyze()
  expect(describeViolations(violations)).toBe("")
})
