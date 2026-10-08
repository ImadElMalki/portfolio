import { expect, test, type Page } from "@playwright/test"

import cvData from "../../cv.json" with { type: "json" }
import { openBarMenu } from "./utility-bar"

/**
 * Enfoca el visor del retrato, que es la única puerta a «Sobre mí».
 *
 * `toHaveAttribute` reintenta, así que la espera de 1200 ms de
 * `portraitFocus.ts` transcurre aquí dentro sin un `waitForTimeout` a ojo: la
 * prueba avanza en cuanto el visor queda enfocado y no un instante después.
 */
const focusViewfinder = async (page: Page): Promise<void> => {
  await page.locator("[data-portrait-focus-trigger]").hover()
  await page.mouse.down()
  await expect(page.locator("[data-portrait]")).toHaveAttribute(
    "data-portrait-focus",
    "locked",
  )
  await page.mouse.up()
}

const ABOUT_PAGES = [
  {
    locale: "es",
    path: "/sobre-mi/",
    other: ["/ca/sobre-mi/", "/en/about/"],
  },
  {
    locale: "ca",
    path: "/ca/sobre-mi/",
    other: ["/sobre-mi/", "/en/about/"],
  },
  {
    locale: "en",
    path: "/en/about/",
    other: ["/sobre-mi/", "/ca/sobre-mi/"],
  },
] as const

test.describe("about page", () => {
  test("renders the complete portfolio readout", async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 1280, height: 900 })

    // Act
    await page.goto("/")

    // Assert
    const readout = page.locator(".bar-readout")
    await expect(readout.locator(".bar-callsign")).toHaveText("IEM")
    await expect(readout.locator("[data-bar-meta]")).toBeVisible()
    await expect(readout.locator("[data-bar-section]")).toHaveText("Inicio")
    await expect(readout.locator("[data-bar-clock]")).toHaveText(
      /^\d{2}:\d{2}:\d{2}$/,
    )
    // La matrícula es rótulo y nada más: ni enlace ni botón.
    await expect(readout.locator("a, button")).toHaveCount(1)
  })

  test("keeps the readout compact once the clock is running", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/")
    const readout = page.locator(".bar-readout")

    // Act and assert
    await expect(readout.locator("[data-bar-clock]")).toHaveText(
      /^\d{2}:\d{2}:\d{2}$/,
    )
    const box = await readout.boundingBox()
    expect(box?.height).toBeLessThanOrEqual(32)
  })

  /**
   * El enlace ya no se gana: se ve desde el primer pintado.
   *
   * Estuvo tras el visor y esta prueba comprobaba justo lo contrario. Ver la
   * nota de `.about-link` en `About.astro` para el motivo del cambio; lo que
   * sigue siendo suyo es que el enlace tenga nombre accesible, que no meta la
   * flecha en él y que lleve donde dice.
   */
  test("offers the way into the personal story from the start", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/")
    const link = page.locator("[data-about-cta]")

    // Assert
    await expect(link).toHaveCount(1)
    await expect(link).toBeVisible()
    await expect(link).toHaveAccessibleName("Leer sobre mí")
    await expect(link).not.toContainText("→")

    // Act
    await link.click()

    // Assert
    await expect(page).toHaveURL(/\/sobre-mi\/$/)
  })

  test("hides the pre-code jobs until the viewfinder is focused", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/")
    const fold = page.locator("details.prior-work")

    // Assert: el pliegue existe y está escondido, y —desde el 07-10-2026— sus
    // filas **no viajan en el HTML**. Antes sí: doce empleos con su nombre y su
    // enlace, en el código fuente de cada visita, tapados sólo con
    // `display: none`. Ahora llegan de `/prior-work/` al abrirlo.
    await expect(fold).toHaveCount(1)
    await expect(fold).toBeHidden()
    await expect(fold).toHaveCSS("display", "none")
    await expect(fold.locator(".prior-list li")).toHaveCount(0)

    /* Contra el HTML servido y no contra el DOM: lo que importa es lo que
       viaja, y para cuando Playwright mira el DOM ya han corrido los guiones. */
    const served = await (await page.request.get("/")).text()
    for (const { name } of cvData.otherWork) {
      expect(served, name).not.toContain(name)
    }

    // Act
    await focusViewfinder(page)

    // Assert
    await expect(fold).toBeVisible()
    await expect(fold.locator("summary")).toContainText("Antes de programar")

    // Act: abrirlo es lo que las trae.
    await fold.locator("summary").click()

    /* Contado desde `cv.json` y no a mano: la cifra escrita se quedó en ocho
       cuando el historial se cotejó con la vida laboral y pasó a doce. */
    await expect(fold.locator(".prior-list li")).toHaveCount(
      cvData.otherWork.length,
    )

    /* Y las empresas con web enlazan fuera. Cuántas hay se cuenta desde
       `cv.json`, como las filas de arriba y por el mismo motivo: `scripts/export-public.mjs`
       redacta `otherWork` sin `url`, así que en la copia pública no hay ni un
       enlace y `first()` esperaba uno que no iba a llegar nunca. Un número
       escrito a mano —aunque sea «al menos uno»— es un dato duplicado.

       La conversión no es pereza: allí la clave `url` **no existe**, porque
       `cvData` sale del JSON y no del esquema, y tanto desestructurarla como
       anotar el parámetro rompían `astro check` en la copia. */
    const linked = cvData.otherWork.filter((job) =>
      Boolean((job as { url?: string }).url),
    ).length
    const employers = fold.locator("a.employer")
    await expect(employers).toHaveCount(linked)

    if (linked > 0) {
      await expect(employers.first()).toHaveAttribute("target", "_blank")
      await expect(employers.first()).toHaveAttribute(
        "rel",
        "noopener noreferrer",
      )
    }
  })

  /* Y sin guion no se ofrece: un `<details>` que se abre y no enseña nada
     promete contenido y da un hueco. */
  test("does not offer the fold when scripts never run", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    try {
      await page.goto("/")
      await expect(page.locator("details.prior-work")).toHaveCSS(
        "display",
        "none",
      )
    } finally {
      await context.close()
    }
  })

  /**
   * Esta prueba pedía lo contrario: que el pliegue se imprimiera siempre, se
   * hubiera encontrado o no, porque un ATS no podía quedarse sin seis años.
   *
   * Se ha invertido a petición. Doce empleos de fábrica, almacén, cocina y campo
   * entre 2014 y 2020 no son lo que decide una entrevista de desarrollo, y en
   * una hoja A4 ocupaban el sitio de lo que sí. Los años no se pierden: siguen
   * en `cv.json`, en `/cv.json` y en este pliegue de la web.
   *
   * Lo que fija la prueba es que la regla es **explícita** y no un accidente:
   * sin ella, el PDF heredaría el estado escondido del huevo de pascua, y
   * entonces el contenido del currículum dependería de si alguien encontró el
   * visor antes de imprimir.
   */
  test("leaves the pre-code jobs out of the printed CV", async ({ page }) => {
    // Arrange: sesión limpia, sin hacer el gesto.
    await page.goto("/")
    const fold = page.locator("details.prior-work")
    await expect(fold).toBeHidden()

    // Act
    await page.emulateMedia({ media: "print" })

    // Assert
    await expect(fold).toHaveCSS("display", "none")
    await expect(page.locator("[data-about-cta]")).toHaveCSS("display", "none")
  })

  /* Y tampoco cuando alguien sí encontró el visor: el estado de pantalla no
     puede cambiar lo que dice el currículum en papel. */
  test("keeps them out of print even after the viewfinder was found", async ({
    page,
  }) => {
    await page.goto("/")
    await focusViewfinder(page)

    const fold = page.locator("details.prior-work")
    await expect(fold).toBeVisible()

    await page.emulateMedia({ media: "print" })
    await expect(fold).toHaveCSS("display", "none")
  })

  test("keeps the viewfinder focused across reloads and languages", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/")
    await page.evaluate(() => window.theme.setTheme("dark"))
    await focusViewfinder(page)

    // Act: recargar es una sesión nueva del documento, no de la pestaña.
    await page.reload()

    // Assert
    await expect(page.locator("details.prior-work")).toBeVisible()

    // Act: cambiar de idioma es un documento nuevo, sin los atributos de <html>.
    await openBarMenu(page, "locale")
    await page.locator(".language-switcher a[href='/en/']").click()

    // Assert: `waitForURL` y no `toHaveURL`. Sin router la URL cambia en
    // cuanto llega la respuesta y el documento se analiza después; con la
    // máquina cargada, WebKit tardaba más de cinco segundos en llegar al
    // `<main>` y la comprobación lo buscaba antes. Esperar a la carga es esperar
    // a la página que se quiere mirar.
    await page.waitForURL(/\/en\/$/)
    await expect(page.locator("details.prior-work")).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  })

  /**
   * Y el hallazgo **no** cruza a otra pestaña.
   *
   * Es lo que distingue `sessionStorage` de `localStorage`, y lo que hace que el
   * secreto se vuelva a ganar en cada visita en vez de quedarse abierto para
   * siempre. La pestaña nueva comparte contexto y origen: si el dato viviera en
   * el almacén local, lo heredaría.
   */
  test("does not carry the viewfinder into another tab", async ({
    page,
    context,
  }) => {
    // Arrange
    await page.goto("/")
    await focusViewfinder(page)
    await expect(page.locator("details.prior-work")).toBeVisible()

    // Act
    const other = await context.newPage()
    await other.goto("/")

    // Assert
    await expect(other.locator("details.prior-work")).toBeHidden()
    await expect(other.locator("html")).not.toHaveAttribute(
      "data-about-found",
      "",
    )
    await other.close()
  })

  test("opens the viewfinder from the keyboard", async ({ page }) => {
    // Arrange
    await page.goto("/")
    const trigger = page.locator("[data-portrait-focus-trigger]")
    await expect(trigger).toHaveAccessibleName("Enfocar el visor")

    // Act
    await trigger.focus()
    await page.keyboard.down("Space")
    await expect(page.locator("[data-portrait]")).toHaveAttribute(
      "data-portrait-focus",
      "locked",
    )
    await page.keyboard.up("Space")

    // Assert
    await expect(page.locator("details.prior-work")).toBeVisible()
  })

  test("gives nothing away on a press that is let go early", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/")
    const portrait = page.locator("[data-portrait]")

    // Act: un clic corriente no llega a los 1200 ms.
    await page.locator("[data-portrait-focus-trigger]").click()

    // Assert
    await expect(portrait).not.toHaveAttribute("data-portrait-focus")
    await expect(page.locator("details.prior-work")).toBeHidden()
  })

  test("arriving from a search engine unlocks the way back", async ({
    page,
  }) => {
    // Arrange: nadie ha tocado el retrato en esta sesión.
    await page.goto("/sobre-mi/")

    // Act
    await page.locator("[data-about-back]").click()

    // Assert: a la carga, no sólo a la URL (ver la prueba de los idiomas).
    await page.waitForURL(/\/$/)
    await expect(page.locator("details.prior-work")).toBeVisible()
  })

  for (const { locale, path, other } of ABOUT_PAGES) {
    test(`serves the personal story in ${locale}`, async ({ page }) => {
      await page.goto(path)

      await expect(page.locator("html")).toHaveAttribute("lang", locale)
      await expect(page.locator("[data-about-page] h1")).toHaveCount(1)
      await expect(page.locator("[data-about-section]")).toHaveCount(3)

      for (const href of other) {
        await expect(
          page.locator(`.language-switcher a[href='${href}']`),
        ).toHaveCount(1)
      }
    })
  }

  test("switches language without leaving the personal story", async ({
    page,
  }) => {
    await page.goto("/sobre-mi/")
    await openBarMenu(page, "locale")
    await page.locator(".language-switcher a[href='/en/about/']").click()

    await expect(page).toHaveURL(/\/en\/about\/$/)
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
  })

  test("links back to the portfolio, projects and contact", async ({
    page,
  }) => {
    await page.goto("/sobre-mi/")

    const back = page.locator("[data-about-back]")
    await expect(back).toHaveAttribute("href", "/")
    /* Insensible a mayúsculas: las versalitas las pone `text-transform`, y
       Chromium calcula el nombre accesible sobre el texto ya transformado. */
    await expect(back).toHaveAccessibleName(/volver al portfolio/i)
    // Y ahora lo dice también en pantalla, que era la mitad del arreglo.
    await expect(back).toContainText(/volver al portfolio/i)
    const box = await back.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)

    /* La otra mitad: es lo primero del bloque de entrada, antes del epígrafe y
       del titular. Estaba debajo del párrafo de intro, o sea donde el ojo
       espera el paso siguiente y no la salida. */
    const first = page.locator(".lead-block > *").first()
    await expect(first).toHaveAttribute("data-about-back", "")
    await expect(page.locator("[data-about-projects]")).toHaveAttribute(
      "href",
      "/#projects",
    )
    await expect(page.locator("[data-about-contact]")).toHaveAttribute(
      "href",
      "/#contact",
    )
  })

  test("focuses the viewfinder on a narrow screen too", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/")

    // El rótulo de la barra desaparece por debajo de 700 px, así que a este
    // ancho el retrato es la única puerta que queda.
    await expect(page.locator("[data-bar-meta]")).toBeHidden()
    await focusViewfinder(page)

    await expect(page.locator("[data-about-cta]")).toBeVisible()
    await page.locator("[data-about-cta]").click()
    await expect(page).toHaveURL(/\/sobre-mi\/$/)
  })

  test("focuses without a transition when reduced motion is requested", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")

    // Sin movimiento las escuadras no recorren nada, pero el gesto sigue
    // pidiendo el mismo rato: el hallazgo no puede depender de una transición
    // que no va a correr.
    await expect(page.locator("[data-portrait]")).toHaveCSS(
      "transition-duration",
      "0s",
    )
    await focusViewfinder(page)

    await expect(page.locator("[data-about-cta]")).toBeVisible()
  })

  test("does not overflow at the acceptance widths", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "One engine is enough for widths")

    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/sobre-mi/")

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0)
    }
  })
})
