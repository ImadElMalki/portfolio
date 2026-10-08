import { expect, test, type Page } from "@playwright/test"

/**
 * Referencias visuales de las piezas que más se han roto en silencio y de las
 * dos páginas editoriales completas, en claro/oscuro y escritorio/móvil.
 *
 * Dos fallos de esta sesión pasaron toda la batería en verde y solo se vieron
 * mirando píxeles: el círculo del cambio de tema en Android y un `:global()` que
 * salía literal al CSS y dejaba el neón sin aplicar.
 *
 * Solo corren con `VISUAL=1`, que ponen `npm run test:visual` (contenedor) y el
 * job homónimo del CI (el mismo contenedor). El renderizado de texto depende del
 * sistema, así que fuera de esa imagen las referencias no valdrían: sin la
 * variable, la suite normal se los salta en vez de fallar por no tenerlas.
 */
test.describe("visual", () => {
  test.skip(
    !process.env.VISUAL,
    "Las referencias solo son válidas dentro de la imagen de Playwright: `npm run test:visual`",
  )

  /**
   * `window.theme` lo monta un guion en línea del `<head>`, no un módulo.
   *
   * `page.goto` resuelve con el evento `load`, que **no** garantiza que ese
   * guion ya haya definido el objeto: bajo carga —los dos workers de la suite
   * dentro del contenedor— la evaluación siguiente llegaba antes y fallaba con
   * «Cannot read properties of undefined (reading 'setTheme')». Se veía sólo de
   * vez en cuando, que es lo peor que puede hacer una referencia visual.
   */
  const waitForThemeApi = (page: Page) =>
    page.waitForFunction(() => Boolean(window.theme))

  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.project.name.startsWith("chromium")) return
    // El Chromium sin cabeza responde `reduce` a `prefers-reduced-transparency`,
    // así que sin esto las referencias retratarían la variante opaca en vez de la
    // que ve la mayoría. Playwright no lo emula, pero el CDP sí.
    const client = await page.context().newCDPSession(page)
    await client.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-transparency", value: "no-preference" },
      ],
    })
    await page.goto("/")
    // El acento se sortea en cada carga y el tema sale del sistema: se fijan los
    // dos, que es lo único que hace falta para que la captura sea reproducible.
    await waitForThemeApi(page)
    await page.evaluate(() => {
      document.documentElement.dataset.accent = "ocean"
      window.theme.setTheme("light")
    })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
  })

  /**
   * La única tolerancia de todo el fichero, y sólo para la pieza de mono denso:
   * el panel del asistente. La consola, que era la otra, se fue el 06-10-2026.
   *
   * El resto de referencias se comparan al píxel y aguantan. Éstas no: son
   * texto monoespaciado a 0,8 rem con subrayados de puntos, y el trazado de los
   * glifos —y sobre todo la fase de los puntos del subrayado— varía entre
   * pasadas con los dos workers del contenedor compitiendo.
   *
   * El número sale de medirlo, no de tantear. Con las referencias buenas, tres
   * pasadas seguidas dieron como mucho un 1 % de píxeles distintos —124, 160 y
   * 4 261— sin que nada se hubiera movido. Los fallos de verdad de esta misma
   * sesión, con el registro corrido en vertical, daban 3 y 4 %. El 2 % queda en
   * medio con margen por los dos lados: absorbe el trazado y sigue cayendo si
   * algo cambia de sitio, de tamaño o de color.
   */
  const DENSE_MONO_DRIFT = 0.02

  const desktopOnly = (projectName: string) => {
    test.skip(
      projectName !== "chromium-desktop",
      "Esta referencia detallada se mantiene solo en escritorio",
    )
  }

  /**
   * Las miniaturas de proyecto, cargadas y decodificadas.
   *
   * Son `lazy` y desde el 06-10-2026 están en la portada: una captura que llegue
   * mientras bajan retrata unas sí y otras no. Se fuerzan y se espera a que se
   * puedan pintar.
   */
  const loadThumbnails = (page: Page) =>
    page.evaluate(async () => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".thumb img"),
      )
      for (const image of images) image.loading = "eager"
      await Promise.all(
        images.map((image) => image.decode().catch(() => undefined)),
      )
    })

  const preparePage = async (
    page: Page,
    path: string,
    theme: "light" | "dark",
  ) => {
    // `setEmulatedMedia` del `beforeEach` ya escribió la lista de preferencias
    // completa. Se repiten juntas para que el recorrido por vista no vuelva a
    // dejar las secciones fuera de pantalla en `opacity: 0` y para conservar la
    // variante normal de transparencia.
    const client = await page.context().newCDPSession(page)
    await client.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-transparency", value: "no-preference" },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    })
    await page.goto(path)
    await waitForThemeApi(page)
    await page.evaluate((selectedTheme) => {
      document.documentElement.dataset.accent = "ocean"
      window.theme.setTheme(selectedTheme)
    }, theme)
    await page.evaluate(() => document.fonts.ready)
    /* Fuera los dos flotantes.
     *
     * El aviso de idioma lo pinta `localeSuggest.ts` cuando
     * `navigator.language` no es el de la página, que en el contenedor de la
     * CI es siempre, y entra con una animación: tres intentos de la misma
     * tanda dieron veinticuatro píxeles distintos en su texto.
     *
     * La píldora del asistente es `position: fixed`, y en una captura
     * `fullPage` —que Playwright compone desplazando el documento— sus letras
     * no caen dos veces en el mismo subpíxel: 44 y 60 píxeles entre intentos,
     * siempre en su rótulo. Su aspecto ya lo cubre la referencia `ask-dock`,
     * que la captura abierta y quieta.
     *
     * Se descartan en vez de enmascararse: los dos están **sobre** el
     * contenido, y una máscara taparía lo que hay debajo, que es justo lo que
     * la referencia de página completa existe para vigilar. */
    await page.evaluate(() => {
      document.querySelector("[data-locale-hint]")?.remove()
      document.querySelector(".ask-dock")?.remove()
    })
    // Una captura `fullPage` no desplaza el viewport: sin recorrer el documento,
    // IntersectionObserver deja fuera las secciones que todavía no han entrado
    // en pantalla y la referencia retrata un gran hueco vacío. Se avanza por
    // pasos para no saltarse tampoco los bloques intermedios y se vuelve arriba
    // antes de capturar.
    const documentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    )
    for (let y = 0; y <= documentHeight; y += 600) {
      await page.evaluate((scrollTop) => window.scrollTo(0, scrollTop), y)
      await page.waitForTimeout(30)
    }
    await loadThumbnails(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(250)
  }

  test("hero", async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    /* La banda de disolución del retrato no para nunca, así que una captura
       cogería un fotograma cualquiera. Con movimiento reducido el overlay no
       existe y la referencia vuelve a ser el retrato limpio.
       `setEmulatedMedia` reemplaza la lista entera, así que la transparencia
       del `beforeEach` hay que repetirla aquí. */
    const client = await page.context().newCDPSession(page)
    await client.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-transparency", value: "no-preference" },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    })
    await page.waitForTimeout(200)
    await expect(page.locator("#web-view .hero")).toHaveScreenshot("hero.png")
  })

  test("utility bar with a control lit", async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await page.locator(".pdf-button").hover()
    await page.waitForTimeout(400)
    await expect(page.locator("[data-utility-controls]")).toHaveScreenshot(
      "utility-bar-hover.png",
    )
  })

  test("utility bar readout", async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await page.evaluate(() => {
      const clock = document.querySelector<HTMLElement>("[data-bar-clock]")
      if (!clock) throw new Error("No se ha encontrado el reloj de la barra")

      const frozenClock = clock.cloneNode(true) as HTMLElement
      frozenClock.textContent = "12:34:56"
      clock.replaceWith(frozenClock)
    })
    await expect(page.locator(".bar-readout")).toHaveScreenshot(
      "utility-bar-readout.png",
    )
  })

  /* La variante de alto contraste también entra: es CSS que nadie mira nunca
     —hay que activarlo en el sistema para verlo— y su fallo natural es quedarse
     sin efecto. */
  test("utility bar with more contrast requested", async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo.project.name)
    const client = await page.context().newCDPSession(page)
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-contrast", value: "more" }],
    })
    await page.locator(".pdf-button").hover()
    await page.waitForTimeout(400)
    await expect(page.locator("[data-utility-controls]")).toHaveScreenshot(
      "utility-bar-more-contrast.png",
    )
  })

  /**
   * El panel del asistente con una respuesta escrita.
   *
   * El eco, la respuesta, el pie y las sugerencias los construye `askDock.ts`
   * **entero**, y su fallo natural —quedarse sin los
   * estilos de `AskDock.astro`, que van con `:global` colgando de un elemento
   * que sí lleva el ámbito de Astro— no lo ve ninguna otra prueba.
   */
  test("ask dock answering", async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          'data: {"text":"Vive en La Gornal, Barcelona, y trabaja en remoto."}\n\n' +
          "data: [DONE]\n\n",
      }),
    )
    await page.goto("/")
    // El `goto` recarga y se lleva el acento, el tema y las fuentes: se vuelven
    // a fijar.
    await waitForThemeApi(page)
    await page.evaluate(() => {
      document.documentElement.dataset.accent = "ocean"
      window.theme.setTheme("light")
    })
    await page.evaluate(() => document.fonts.ready)
    await page.locator("[data-ask-dock-trigger]").click()
    const panel = page.locator(".ask-dock-panel")
    await expect(panel).toBeVisible()
    const field = page.locator(".ask-dock-input")
    await expect(page.locator(".ask-dock-suggestion").first()).toBeVisible()
    await field.fill("¿dónde vive?")
    await field.press("Enter")
    await expect(page.locator(".ask-dock-answer")).toContainText("Barcelona")
    /* Se suelta el foco antes de capturar: el cursor parpadea y lo pinta el
       navegador, así que Playwright no lo apaga con el resto de animaciones.
       Aquí el reposo es además el estado que interesa —el marcador de posición
       de vuelta, y la respuesta ya escrita debajo—. */
    await field.blur()
    await page.waitForTimeout(200)
    await expect(panel).toHaveScreenshot("ask-dock.png", {
      maxDiffPixelRatio: DENSE_MONO_DRIFT,
    })
  })

  test("project dialog", async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    /* Lo que se compara es el panel, no lo que hay detrás, pero el fondo
       desenfocado se compone en la columna del canto, fuera del filete de 1 px.
       Desde el 06-10-2026 detrás quedan las miniaturas y el banner de negocios,
       con cuatro animaciones infinitas: tres intentos de la CI dieron tres
       cantos distintos y ni un píxel distinto dentro. Con movimiento reducido,
       como las capturas de página completa, el banner se queda quieto; y las
       miniaturas se ocultan para que el fondo vuelva a ser plano. */
    const client = await page.context().newCDPSession(page)
    await client.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-transparency", value: "no-preference" },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    })
    /* Desde la portada y sobre un destacado.
     *
     * Se probó en `/proyectos/`, porque Race Hub dejó de estar en la portada
     * al quitar el «Ver 5 más». Allí el panel salió con 830 píxeles distintos
     * entre intentos: detrás hay ocho tarjetas en vez de tres, y el fondo que
     * se compone tras el panel translúcido no se repite. La portada era el
     * contexto estable, así que se vuelve a ella y se abre 100 Cims, que sí es
     * destacado. El componente del diálogo es el mismo en los dos sitios. */
    await page.evaluate(() => {
      for (const thumb of document.querySelectorAll<HTMLElement>(".thumb")) {
        thumb.style.visibility = "hidden"
      }
    })
    await page.locator("[data-detail-open='project-100-cims']").click()
    const panel = page.locator("#project-100-cims .detail-panel")
    await expect(panel).toBeVisible()
    // Las capturas de la tira son `lazy`: sin esperarlas, el panel cambia de
    // altura a mitad de captura.
    await page.waitForTimeout(900)
    await expect(panel).toHaveScreenshot("project-dialog.png")
  })

  for (const theme of ["light", "dark"] as const) {
    test(`portfolio page in ${theme} theme`, async ({ page }, testInfo) => {
      test.skip(
        !testInfo.project.name.startsWith("chromium"),
        "Las referencias completas se comparan en Chromium",
      )
      await preparePage(page, "/", theme)
      await expect(page).toHaveScreenshot(`portfolio-${theme}.png`, {
        fullPage: true,
        /**
         * Las cinco lecturas que corren solas.
         *
         * El reloj y el tiempo de encendido cambian cada segundo, así que sin
         * enmascararlos la referencia caduca al segundo de escribirse. El sello
         * del build (`BUILD 2026.10`) cambia cada mes: el 01-10-2026 rompió las
         * seis capturas de página completa sin que nadie tocara nada.
         *
         * El nombre de sección y su contador dependen de dónde queda el scroll,
         * y `preparePage` recorre el documento entero antes de volver arriba: la
         * cuenta la resuelve un manejador con `requestAnimationFrame`, que unas
         * veces ha asentado y otras no. Eran los 220 píxeles que hacían fallar
         * sólo las capturas del portfolio —la única página con índice lateral—
         * en la segunda pasada. Su aspecto lo cubre la referencia dedicada del
         * rótulo, que congela la hora y no depende del scroll.
         */
        mask: [
          page.locator("[data-bar-clock]"),
          page.locator("[data-footer-uptime]"),
          page.locator("[data-build-stamp]"),
          page.locator("[data-bar-section]"),
          page.locator("[data-bar-count]"),
        ],
        timeout: 15_000,
      })
    })

    test(`about page in ${theme} theme`, async ({ page }, testInfo) => {
      test.skip(
        !testInfo.project.name.startsWith("chromium"),
        "Las referencias completas se comparan en Chromium",
      )
      await preparePage(page, "/sobre-mi/", theme)
      await expect(page).toHaveScreenshot(`about-${theme}.png`, {
        fullPage: true,
        /**
         * Las cinco lecturas que corren solas.
         *
         * El reloj y el tiempo de encendido cambian cada segundo, así que sin
         * enmascararlos la referencia caduca al segundo de escribirse. El sello
         * del build (`BUILD 2026.10`) cambia cada mes: el 01-10-2026 rompió las
         * seis capturas de página completa sin que nadie tocara nada.
         *
         * El nombre de sección y su contador dependen de dónde queda el scroll,
         * y `preparePage` recorre el documento entero antes de volver arriba: la
         * cuenta la resuelve un manejador con `requestAnimationFrame`, que unas
         * veces ha asentado y otras no. Eran los 220 píxeles que hacían fallar
         * sólo las capturas del portfolio —la única página con índice lateral—
         * en la segunda pasada. Su aspecto lo cubre la referencia dedicada del
         * rótulo, que congela la hora y no depende del scroll.
         */
        mask: [
          page.locator("[data-bar-clock]"),
          page.locator("[data-footer-uptime]"),
          page.locator("[data-build-stamp]"),
          page.locator("[data-bar-section]"),
          page.locator("[data-bar-count]"),
        ],
        timeout: 15_000,
      })
    })
  }
})
