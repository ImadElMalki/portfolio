import { expect, test } from "@playwright/test"

import { openBarMenu } from "./utility-bar"

/**
 * La landing de servicios.
 *
 * Se publica desde el 20-08-2026, así que estas pruebas corren siempre. Antes
 * se saltaban sin `SERVICES=1` porque `getStaticPaths` no emitía la página y no
 * había nada contra lo que correr; `npm run test:services` sigue siendo el
 * atajo para construir y pasarle sólo estos dos specs.
 */
const LANDINGS = [
  {
    locale: "es",
    path: "/servicios/",
    other: ["/ca/serveis/", "/en/services/"],
  },
  {
    locale: "ca",
    path: "/ca/serveis/",
    other: ["/servicios/", "/en/services/"],
  },
  {
    locale: "en",
    path: "/en/services/",
    other: ["/servicios/", "/ca/serveis/"],
  },
] as const

/**
 * Relleno esperado del botón de contratación, con el acento forzado a `ocean`.
 *
 * Se comprueba el par entero y no «que no sea el fondo»: en claro rellena el
 * tono fuerte con texto blanco, y en oscuro **no** puede usar `--action-fill`
 * —queda casi del color de la tarjeta, que es como se vio en el móvil—, así que
 * rellena el acento claro con el fondo como texto.
 */
const EXPECTED_HIRE = {
  light: { background: "rgb(24, 74, 115)", color: "rgb(255, 255, 255)" },
  dark: { background: "rgb(120, 185, 230)", color: "rgb(13, 16, 14)" },
} as const

test.describe("services landing", () => {
  test("reaches the landing from the hero banner", async ({ page }) => {
    await page.goto("/")

    const cta = page.locator(".services-banner a[href='/servicios/']")
    await expect(cta).toBeVisible()
    await cta.click()

    await expect(page).toHaveURL(/\/servicios\/$/)
    await expect(page.locator("h1")).toHaveText(
      "Software y webs que hacen tu negocio más fácil",
    )
  })

  for (const { locale, path, other } of LANDINGS) {
    test(`serves the landing in ${locale}`, async ({ page }) => {
      await page.goto(path)

      await expect(page.locator("h1")).toHaveCount(1)
      await expect(page.locator("html")).toHaveAttribute("lang", locale)

      // Cambiar de idioma tiene que dejarte en la landing, no en la portada.
      for (const href of other) {
        await expect(
          page.locator(`.language-switcher a[href='${href}']`),
        ).toHaveCount(1)
      }

      const contact = page.locator(".lead-block a[href$='#booking']").first()
      await expect(contact).toHaveCount(1)
      await expect(contact).not.toHaveAttribute("target", "_blank")
    })
  }

  /**
   * El relleno tiene que estar en la acción principal, y sólo en ella.
   *
   * La acción principal baja al formulario localizado. Si pierde el relleno en
   * uno de los dos temas deja de leerse como el destino, que es el fallo que ya
   * tuvo el CTA del hero.
   */
  test("fills the primary contact action in both themes", async ({ page }) => {
    await page.goto("/servicios/")
    await page.evaluate(() => {
      document.documentElement.dataset.accent = "ocean"
    })
    const primary = page.locator(".lead-block .action-primary")

    const fillOf = (locator: typeof primary) =>
      locator.evaluate((el) => {
        const computed = getComputedStyle(el)
        return { background: computed.backgroundColor, color: computed.color }
      })

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => window.theme.setTheme(value), theme)

      /**
       * Se espera al color, no a un cronómetro.
       *
       * Aquí hay dos animaciones encadenadas —el revelado del cambio de tema,
       * 420 ms en `ThemeToggle.astro`, y los 200 ms de `background-color` del
       * botón— y durante años esto fue un `waitForTimeout` con la suma a ojo.
       * Ese número ya se subió una vez, de 400 a 700, por leer el color a
       * mitad del cambio. El 11-09-2026 volvió a quedarse corto en
       * webkit-mobile sobre un runner cargado: los tres reintentos leyeron
       * colores **distintos entre sí** —`rgb(26,76,117)`, casi el claro
       * todavía, y `rgb(40,92,134)`, a medio camino—, que es la firma de
       * medir una transición en marcha.
       *
       * Subirlo otra vez sólo aplaza el siguiente rojo. Con `expect.poll` la
       * prueba termina en cuanto el color se asienta —milisegundos en una
       * máquina de desarrollo— y sigue fallando si el color final es el que no
       * toca, que es lo único que esta prueba quiere comprobar. Ya no hay
       * ninguna duración que revisar al tocar las animaciones.
       */
      await expect
        .poll(() => fillOf(primary), {
          message: `primary action at ${theme}`,
          timeout: 5_000,
        })
        .toEqual(EXPECTED_HIRE[theme])
    }
  })

  test("switches language without leaving the landing", async ({ page }) => {
    await page.goto("/servicios/")
    // El conmutador de idioma vive en la barra y, en móvil, tras el botón que
    // pliega los tres a uno.
    await openBarMenu(page, "locale")
    await page.locator(".language-switcher a[href='/en/services/']").click()

    await expect(page).toHaveURL(/\/en\/services\/$/)
    await expect(page.locator("h1")).toHaveText(
      "Software and websites that make your business easier",
    )
  })

  /**
   * El botón del banner tiene que salir relleno, y esto no es teórico: cuando
   * vivía en el hero reutilizaba la caja de `.contact-list a` y perdía el
   * relleno por especificidad. El marcado, la caja y el enlace eran correctos,
   * así que ninguna prueba de estructura lo habría visto. Ahora tiene clase
   * propia, pero el par de colores se sigue midiendo aquí.
   */
  test("fills the banner call to action in both themes", async ({ page }) => {
    await page.goto("/")
    await page.evaluate(() => {
      document.documentElement.dataset.accent = "ocean"
    })
    const cta = page.locator(".services-banner a[href='/servicios/']")

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => window.theme.setTheme(value), theme)
      await page.waitForTimeout(400)
      const style = await cta.evaluate((el) => {
        const computed = getComputedStyle(el)
        return {
          background: computed.backgroundColor,
          color: computed.color,
        }
      })

      expect(style, `banner call to action at ${theme}`).toEqual(
        EXPECTED_HIRE[theme],
      )
    }
  })

  test("does not overflow at the acceptance widths", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "One engine is enough for widths")

    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/servicios/")

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0)
    }
  })

  /* El banner es el sitio donde antes se rompía el ancho: a 375 px la fila pasa
     a columna, y un botón cortado no se toca. */
  test("keeps the banner button tappable at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")

    const box = await page
      .locator(".services-banner a[href='/servicios/']")
      .boundingBox()

    /* `expect(box).not.toBeNull()` no estrecha el tipo, así que hacían falta tres
       `!` — y si `boundingBox()` devolvía null de verdad, el test moría con un
       «Cannot read properties of null» en la línea siguiente en vez de decir que
       el botón no se está pintando. */
    if (!box)
      throw new Error("el botón del banner no tiene caja: ¿no se pinta?")

    expect(box.height, "height").toBeGreaterThanOrEqual(44)
    expect(box.x, "left edge").toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, "right edge").toBeLessThanOrEqual(375)
  })
})
