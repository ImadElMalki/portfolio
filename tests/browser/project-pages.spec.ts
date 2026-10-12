import { expect, test } from "@playwright/test"

/**
 * `/proyectos/<id>/`, la dirección que antes no existía.
 *
 * El detalle de cada proyecto vivía sólo en un `<dialog>` de la portada y en
 * `/project-details/`, que lleva `noindex`: no había nada que enviar por correo
 * ni que un buscador pudiera recorrer. Lo que se prueba aquí es justo lo que el
 * `check-build` no puede ver, porque necesita un navegador de verdad:
 *
 * - Que la dirección **responde** en los tres idiomas y no sólo aparece en un
 *   atributo. Un `href` correcto hacia un 404 pasa cualquier revisión de HTML.
 * - Que la tarjeta de la portada sigue abriendo el diálogo pese a apuntar ahora
 *   a una página real: el guion intercepta el clic y no debe navegar.
 * - Que quien llega sin ese guion —o abre en una pestaña nueva— aterriza en la
 *   ficha completa.
 */
const LOCALES = [
  {
    locale: "es",
    home: "/",
    index: "/proyectos/",
    page: "/proyectos/riolan-solutions/",
    back: "Volver a proyectos",
  },
  {
    locale: "ca",
    home: "/ca/",
    index: "/ca/projectes/",
    page: "/ca/projectes/riolan-solutions/",
    back: "Tornar a projectes",
  },
  {
    locale: "en",
    home: "/en/",
    index: "/en/projects/",
    page: "/en/projects/riolan-solutions/",
    back: "Back to projects",
  },
] as const

for (const { locale, index, page: projectPath, back } of LOCALES) {
  test(`serves the project page in ${locale}`, async ({ page }) => {
    // Arrange and act
    const response = await page.goto(projectPath)

    // Assert
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { level: 1, name: "Riolan Solutions" }),
    ).toBeVisible()

    /* La ficha es contenido, no un diálogo: sin el guion de la portada, un
       `<dialog>` aquí sería texto que nadie puede abrir. */
    await expect(page.locator("dialog[data-detail]")).toHaveCount(0)
    await expect(page.locator("[data-lightbox]")).toHaveCount(0)

    /**
     * Y se ve de verdad, no sólo «visible» para Playwright.
     *
     * `toBeVisible()` mira caja y `visibility`, **no** la opacidad, así que dio
     * verde mientras la página entera salía transparente: la ficha comparte la
     * clase `.detail` con el diálogo, y la regla de cierre de éste
     * —`.detail:not([open])`— la cazaba porque un `<article>` nunca lleva
     * `[open]`. Axe tampoco lo veía. Se comprueba la opacidad calculada del
     * contenedor y de todo lo que tenga por encima.
     */
    const faded = await page.locator("article.detail").evaluate((element) => {
      for (let node = element; node; node = node.parentElement!) {
        if (Number(getComputedStyle(node).opacity) < 1) return node.className
        if (node === document.body) break
      }
      return ""
    })
    expect(faded, "algún ancestro deja la ficha translúcida").toBe("")

    const box = await page.locator("article.detail").boundingBox()
    expect(box?.height ?? 0).toBeGreaterThan(200)

    /* Sin «Volver a proyectos» desde el 11-09-2026: al índice ya no se llega
       desde dentro del sitio —abre el diálogo—, así que a esta página se entra
       por enlace compartido o por un buscador. */
    await expect(page.getByRole("link", { name: back })).toHaveCount(0)
  })

  test(`lists every project at ${index}`, async ({ page }) => {
    // Arrange and act
    const response = await page.goto(index)

    // Assert
    expect(response?.status()).toBe(200)

    const entries = page.locator(".projects-index > li")
    await expect(entries).not.toHaveCount(0)

    /* Cada entrada lleva al menos un enlace bajo el segmento del idioma: es la
       comprobación de que el índice no se queda con los slugs de otro. */
    const hrefs = await page
      .locator(`.projects-index a[href^="${index}"]`)
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href") ?? ""),
      )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) expect(href.startsWith(index)).toBe(true)
  })

  /**
   * El índice abre la misma ficha que la portada, en el mismo diálogo.
   *
   * Hasta el 11-09-2026 navegaba a `/proyectos/<id>/`: la misma información, sí,
   * pero sin fondo oscurecido, sin cerrar, sin pasar al siguiente y con un
   * «Volver a proyectos» que en la portada no existe. El guion del diálogo vivía
   * dentro de `sections/Projects.astro` y Astro sólo lo empaqueta donde ese
   * componente entra, o sea únicamente en la portada.
   */
  test(`opens the dialog from the index in ${locale}`, async ({ page }) => {
    // Arrange
    await page.goto(index)
    const urlAntes = page.url()

    // Act
    await page.locator(".entry-cta").first().click()

    // Assert
    const dialog = page.locator("dialog.detail[open]").first()
    await expect(dialog).toBeVisible()
    // No ha navegado: sigue en el índice, sólo con el hash del proyecto.
    expect(page.url().split("#")[0]).toBe(urlAntes.split("#")[0])
    expect(new URL(page.url()).hash).toMatch(/^#proyecto\//)

    // Y trae lo que trae el de la portada.
    await expect(dialog.locator("[data-detail-close]")).toHaveCount(1)
    await expect(dialog.locator(".detail-step")).toHaveCount(2)

    const veil = await dialog.evaluate(
      (el) => getComputedStyle(el, "::backdrop").backgroundColor,
    )
    expect(veil, "el fondo tiene que oscurecerse").not.toBe("rgba(0, 0, 0, 0)")

    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })

  test(`the index stays simple in ${locale}`, async ({ page }) => {
    await page.goto(index)

    /* La simplificación del 11-09-2026: el estado y el stack se leen en la
       ficha, que es donde caben enteros. */
    await expect(page.locator(".entry-technologies")).toHaveCount(0)
    await expect(page.locator(".projects-index span.status")).toHaveCount(0)
    // Lo que sí se queda.
    await expect(
      page.locator(".projects-index .entry-description"),
    ).not.toHaveCount(0)
  })
}

/* Se vuelve a la sección de proyectos y no al encabezado de la portada: aquí se
   llega desde «Ver todos los proyectos», que vive dentro de esa sección. */
test("the index returns to the projects section", async ({ page }) => {
  await page.goto("/proyectos/")
  const back = page.locator("a.back-link").first()

  await expect(back).toHaveAttribute("href", "/#projects")

  await back.click()
  // A la carga: es otra página y la sección no está al principio del documento.
  await page.waitForURL(/#projects$/)
  await expect(page.locator("#projects")).toBeVisible()
})

/* Ctrl/Cmd+clic es del navegador, no nuestro: el disparador es un `<a>` real y
   tiene que seguir abriéndose en otra pestaña. Antes `preventDefault()` era
   incondicional y se lo comía. */
test("a modifier click does not open the dialog", async ({ page }) => {
  await page.goto("/proyectos/")

  await page
    .locator(".entry-cta")
    .first()
    .click({ modifiers: ["ControlOrMeta"] })
  await page.waitForTimeout(600)

  await expect(page.locator("dialog.detail[open]")).toHaveCount(0)
})

test("opens the dialog from the card without leaving the home page", async ({
  page,
}) => {
  // Arrange
  await page.goto("/")
  const opener = page.locator("[data-detail-open]").first()
  const id = String(await opener.getAttribute("data-detail-open"))
  const slug = id.replace(/^project-/, "")

  // El enlace apunta a la ficha real: es lo que lo hace compartible.
  await expect(opener).toHaveAttribute("href", `/proyectos/${slug}/`)

  // Act
  await opener.click()

  // Assert: el guion abre el diálogo y no navega.
  await expect(page.locator(`dialog#${id}`)).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/")
})

test("falls back to the project page when scripts never run", async ({
  browser,
}) => {
  // Arrange: sin JavaScript, la tarjeta es un enlace y nada lo intercepta.
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()

  try {
    await page.goto("/")

    // Act
    await page.locator("[data-detail-open]").first().click()

    // Assert
    await expect(page).toHaveURL(/\/proyectos\/[a-z0-9-]+\/$/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  } finally {
    await context.close()
  }
})

/**
 * Ninguna ficha es un callejón.
 *
 * `check-build.mjs` ya exige que los enlaces estén y apunten a algo. Lo que
 * sólo se puede comprobar con un navegador es que al pulsarlos se llegue: un
 * `href` correcto hacia un 404 pasa cualquier revisión del HTML, y es justo lo
 * que pasaría si alguien renombrase un proyecto en `cv.json` y no en su ruta.
 */
test("walks from a project page back to the portfolio", async ({ page }) => {
  // Arrange
  await page.goto("/proyectos/100-cims/")
  const crumbs = page.getByRole("navigation", { name: "Dónde estás" })

  // Act
  await crumbs.getByRole("link", { name: "Proyectos" }).click()

  // Assert
  await page.waitForURL((url) => url.pathname === "/proyectos/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})

test("walks from one project to the next, and round again", async ({
  page,
}) => {
  // Arrange: desde una ficha, siguiendo «siguiente proyecto» se recorren todas
  // y se vuelve al principio. Si una ruta no resuelve, el bucle cae en su 404.
  await page.goto("/proyectos/100-cims/")
  const seen: string[] = []

  // Act
  for (let step = 0; step < 8; step += 1) {
    seen.push(new URL(page.url()).pathname)
    await page.locator("a.next-project").click()
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  }

  // Assert: ocho saltos desde ocho proyectos vuelven al punto de partida, y
  // ninguno se repite por el camino.
  expect(new Set(seen).size).toBe(8)
  expect(new URL(page.url()).pathname).toBe("/proyectos/100-cims/")
})

test("offers the CV and the contact form at the end of a project page", async ({
  page,
}) => {
  // Arrange
  await page.goto("/proyectos/100-cims/")
  const cta = page.locator(".cta-actions")

  // Assert
  await expect(cta.locator("a[download]")).toHaveAttribute("href", "/cv.pdf")

  // Act
  await cta.getByRole("link", { name: /escríbeme/i }).click()

  // Assert
  await page.waitForURL(
    (url) => url.pathname === "/" && url.hash === "#contact",
  )
  await expect(page.locator("#contact")).toBeVisible()
})

/**
 * El caso de estudio sólo está donde se ha escrito.
 *
 * Es la regla que hace que esto no degenere en relleno: `caseStudies.ts` tiene
 * entrada para unos proyectos y no para otros, y la ficha se adapta. Si algún
 * día se pinta un encabezado vacío, esto lo dice.
 */
test("shows the case study only where one is written", async ({ page }) => {
  await page.goto("/proyectos/portfolio/")
  await expect(
    page.getByRole("heading", { name: "El problema", level: 2 }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Qué cambiaría", level: 2 }),
  ).toBeVisible()

  await page.goto("/proyectos/riolan-solutions/")
  await expect(
    page.getByRole("heading", { name: "El problema", level: 2 }),
  ).toHaveCount(0)
})

test("links to the full case from the dialog, and only when there is one", async ({
  page,
}) => {
  // Arrange
  await page.goto("/")
  await page.locator("[data-detail-open='project-portfolio']").click()
  const dialog = page.locator("dialog#project-portfolio")
  await expect(dialog).toBeVisible()

  // Act
  await dialog.getByRole("link", { name: /caso completo/i }).click()

  // Assert
  await page.waitForURL((url) => url.pathname === "/proyectos/portfolio/")
  await expect(
    page.getByRole("heading", { name: "Decisiones", level: 2 }),
  ).toBeVisible()
})
