import { expect, test, type Page } from "@playwright/test"

import { isCompact, openBarMenu, openUtilityBar } from "./utility-bar"

const cspErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  cspErrors.set(page, errors)
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy|refused to/i.test(message.text())
    ) {
      errors.push(message.text())
    }
  })
  await page.goto("/")
})

test.afterEach(async ({ page }) => {
  expect(cspErrors.get(page)).toEqual([])
})

/* Aquí vivían cuatro pruebas del plegado al bajar: la barra se compactaba con
   el scroll, dejaba los controles `inert` y un chevrón los devolvía. La barra ya
   no es pegajosa —`position: relative` en `Layout.astro`—, así que sube con el
   documento y no hay nada que plegar ni que recuperar. Lo que sigue en pie son
   los dos plegados de dentro de la barra, que son otra cosa. */

/**
 * La barra cabe en una fila en cualquier teléfono, con el CV a mano.
 *
 * Fueron nueve celdas, después seis tras un «⋯» que medía `barFit.ts`. Desde el
 * 06-10-2026 son tres —el disparador de idioma, el PDF y el tema— y no hay
 * nada que recoger: la fila cabe en el suelo de 320 px, que es lo que la
 * página deja de encoger. Se comprueba en ese suelo y en un teléfono corriente.
 *
 * El idioma se pliega desde los 700 y ahí se queda: sus tres celdas son 130 px
 * que no sobran en ningún teléfono.
 */
test("keeps the bar on one row with the CV within reach", async ({ page }) => {
  const pdf = page.locator("[data-utility-controls] .pdf-button")
  const localeTrigger = page.locator(
    '[data-bar-menu="locale"] [data-bar-menu-trigger]',
  )

  for (const width of [412, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await expect(pdf).toBeVisible()
    await expect(localeTrigger).toBeVisible()
    await expect(page.locator('[data-bar-menu="views"]')).toHaveCount(0)

    /* Y la fila sigue siendo **una**: un `wrap` silencioso costaría 102 px
       justo encima del hero. Se cuentan filas por la coordenada superior de
       cada celda visible; el panel de idioma plegado queda fuera porque está
       en `visibility: hidden`. */
    const rows = await page
      .locator("[data-utility-controls]")
      .evaluate((element) => {
        const shown = Array.from(
          element.querySelectorAll<HTMLElement>("a, button"),
        ).filter(
          (item) =>
            item.getBoundingClientRect().width > 0 &&
            getComputedStyle(item).visibility !== "hidden",
        )
        return new Set(
          shown.map((item) => Math.round(item.getBoundingClientRect().top)),
        ).size
      })
    expect(rows, `${width} px`).toBe(1)
  }
})

/**
 * El panel de idioma cabe en la pantalla, entero.
 *
 * El del idioma no cabía. Iba anclado por la derecha porque la barra vive pegada
 * a ese canto, y eso valía mientras la fila era `[ES][⋯][tema]`; desde que las
 * vistas caben en línea, el disparador de idioma es el primero por la izquierda
 * de seis controles y el panel crecía 130 px hacia fuera de la pantalla. Se
 * veían dos de las tres celdas: la del idioma actual quedaba cortada.
 *
 * Hubo un segundo panel, el «⋯» de las vistas, hasta el 06-10-2026. Se
 * comprueba en los dos anchos porque la posición del disparador cambia entre
 * uno y otro, que es exactamente lo que rompió esto.
 */
for (const width of [412, 320]) {
  test(`keeps the language panel inside the screen at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")

    for (const name of ["locale"] as const) {
      const trigger = page.locator(
        `[data-bar-menu="${name}"] [data-bar-menu-trigger]`,
      )
      await trigger.click()
      const panel = page.locator("#locale-panel")
      await expect(panel).toBeVisible()

      const box = await panel.boundingBox()
      if (!box) throw new Error(`El panel de ${name} no tiene caja`)
      expect(box.x, `${name}: se sale por la izquierda`).toBeGreaterThanOrEqual(
        0,
      )
      expect(
        box.x + box.width,
        `${name}: se sale por la derecha`,
      ).toBeLessThanOrEqual(width)

      /* Y sus celdas también: un panel dentro de la pantalla con una celda
         cortada seguiría siendo el mismo fallo. */
      const clipped = await panel.evaluate(
        (element, viewport) =>
          Array.from(element.querySelectorAll("a, button, .current-language"))
            .map((cell) => cell.getBoundingClientRect())
            .filter((cell) => cell.left < 0 || cell.right > viewport).length,
        width,
      )
      expect(clipped, `${name}: celdas cortadas`).toBe(0)

      await page.keyboard.press("Escape")
      await expect(panel).toBeHidden()
    }
  })
}

/**
 * La línea del pie llega hasta donde llega el contenido.
 *
 * El pie aplicaba su relleno **dentro** de `--page-width` mientras cada vista se
 * lo suma a la caja, así que su caja de contenido medía 824 contra los 920 de
 * todo lo demás: la raya de puntos empezaba y acababa 48 px por dentro del
 * bloque de arriba. Sólo se veía por encima de 920 px de ventana, que es donde
 * el tope entra en juego.
 *
 * Se compara la caja de **contenido**, no la del borde: el relleno es justo la
 * pieza que estaba mal.
 */
for (const width of [768, 1280]) {
  test(`lines the footer up with the content at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })

    const contentWidth = (selector: string) =>
      page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element)
        return Math.round(
          element.getBoundingClientRect().width -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
        )
      })

    await page.goto("/")
    await expect(page.locator("#web-view")).toBeVisible()
    expect(await contentWidth(".site-footer")).toBe(
      await contentWidth("#web-view"),
    )
  })
}

/* Y su contenido cabe en un renglón donde hay sitio. Por debajo de ~960 px los
   dos grupos no caben —suman unos 840— y envuelven a propósito: forzarlo sería
   sacarlos por el canto. */
test("keeps the footer on a single line when there is room", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/")

  const rows = await page.evaluate(
    () =>
      new Set(
        Array.from(document.querySelectorAll(".footer-group")).map((group) =>
          Math.round(group.getBoundingClientRect().top),
        ),
      ).size,
  )
  expect(rows).toBe(1)
})

/**
 * El idioma, plegado tras su botón en estrecho.
 *
 * Se comprueba que el panel arranca cerrado, que el botón lo abre y que `Escape`
 * lo cierra devolviendo el foco —sin eso, cerrar con teclado deja el recorrido
 * al principio del documento—.
 *
 * El bucle llevaba también las vistas. Se ha quedado en uno: aquél se saltaba
 * por ancho (`isCompact`), y el pliegue de las vistas ya no depende del ancho
 * sino de si la fila cabe, así que a 375 px no hay «⋯» que abrir. Su contrato
 * lo fija la prueba de más arriba; la mecánica del panel —abrir, cerrar con
 * `Escape`, devolver el foco— es la misma para los dos y aquí se sigue midiendo.
 */
for (const { name, panelId, member } of [
  { name: "locale", panelId: "#locale-panel", member: 'a[hreflang="ca"]' },
] as const) {
  test(`folds the ${name} controls behind a button when the viewport is compact`, async ({
    page,
  }) => {
    test.skip(!isCompact(page), "En ancho están todos a la vista")

    const control = page.locator(`[data-bar-menu="${name}"]`)
    const trigger = control.locator("[data-bar-menu-trigger]")
    const panel = page.locator(panelId)

    await openUtilityBar(page)
    await expect(trigger).toBeVisible()
    await expect(panel).toBeHidden()
    await expect(trigger).toHaveAttribute("aria-expanded", "false")

    await trigger.click()
    await expect(panel).toBeVisible()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator(member)).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(panel).toBeHidden()
    await expect(control).not.toHaveAttribute("data-menu-open", "")
    expect(
      await trigger.evaluate((element) => element === document.activeElement),
    ).toBe(true)
  })
}

test("toggles the theme repeatedly and leaves no transition state", async ({
  page,
  browserName,
}) => {
  await openUtilityBar(page)

  const button = page.locator("[data-theme-toggle]")
  const initialTheme = await page.locator("html").getAttribute("data-theme")

  const transitionSample = await page.evaluate(async () => {
    const root = document.documentElement
    const toggle = document.querySelector<HTMLButtonElement>(
      "[data-theme-toggle]",
    )
    if (!toggle) throw new Error("Theme toggle was not rendered")
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    let animationName = ""
    let animationDuration = ""
    try {
      const style = getComputedStyle(root, "::view-transition-new(root)")
      animationName = style.animationName
      animationDuration = style.animationDuration
    } catch {
      // Algunos WebKit no exponen el estilo computado del pseudoelemento.
    }

    return {
      animationDuration,
      animationName,
      origin: [
        root.style.getPropertyValue("--theme-reveal-x"),
        root.style.getPropertyValue("--theme-reveal-y"),
      ],
    }
  })

  await expect(button).toBeEnabled()
  await expect(page.locator("html")).not.toHaveClass(/theme-transitioning/)
  await expect(button).toHaveAttribute("aria-pressed", "true")
  await expect(button).toHaveAttribute("aria-label", /claro|clar|light/i)

  if (browserName === "chromium") {
    expect(transitionSample.animationName).toContain("theme-reveal")
    expect(transitionSample.animationDuration).toBe("0.42s")
    // El origen del revelado va en porcentajes: en píxeles, Chrome Android
    // resuelve la `clip-path` del pseudoelemento en píxeles de dispositivo y con
    // dpr 4 el círculo salía a un cuarto de tamaño y en la esquina contraria.
    for (const value of transitionSample.origin) {
      expect(value).toMatch(/^[\d.]+%$/)
    }
  }

  await button.click()
  await expect(button).toBeEnabled()
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    initialTheme ?? "light",
  )
  await expect(button).toHaveAttribute("aria-pressed", "false")
  await expect(page.locator("html")).not.toHaveClass(/theme-transitioning/)
})

/**
 * Activa el conmutador de tema con teclado y espera a que vuelva a estar
 * disponible. Esta secuencia comprueba también que el control recupera foco y
 * teclado después de cada montaje; los clics se cubren en la prueba dedicada al
 * cambio repetido de tema.
 *
 * El botón se deshabilita mientras dura la transición de vista y sólo se suelta
 * en el `finally` de `changeTheme`. En WebKit, con los dos workers de la suite
 * compitiendo por la CPU, esa transición se pasa de largo los 5 s por defecto
 * de `expect` —el tema sí cambia; lo que llega tarde es el `finished` de la
 * transición—, así que aquí la espera va holgada. Las afirmaciones de
 * comportamiento (`aria-pressed`, el tema aplicado) no se tocan.
 */
async function activateThemeToggleWithKeyboard(page: Page): Promise<void> {
  const toggle = page.locator("[data-theme-toggle]")
  await toggle.focus()
  await expect(toggle).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(toggle).toBeEnabled({ timeout: 15_000 })
}

test("remounts both controllers after ES to CA to EN navigation", async ({
  page,
}) => {
  /* Tres navegaciones, dos cambios de tema y, en móvil, dos aperturas de los
     plegados: no cabe en los 30 s por defecto cuando la máquina va cargada. */
  test.slow()

  // Los tres enlaces de idioma viven en la barra y, en móvil, detrás del botón
  // que los pliega: hay que abrir los dos para llegar a ellos.
  await openBarMenu(page, "locale")
  await page.locator('a[hreflang="ca"]').click()
  await expect(page).toHaveURL(/\/ca\/$/)
  await openUtilityBar(page)

  await activateThemeToggleWithKeyboard(page)
  await expect(page.locator("[data-theme-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  )

  await openBarMenu(page, "locale")
  await page.locator('a[hreflang="en"]').click()
  await expect(page).toHaveURL(/\/en\/$/)
  await openUtilityBar(page)
  await expect(page.locator("[data-theme-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  )

  await activateThemeToggleWithKeyboard(page)
  await expect(page.locator("[data-theme-toggle]")).toHaveAttribute(
    "aria-pressed",
    "false",
  )
})

test("uses the real-document fade when View Transitions is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const runtime = window as typeof window & {
      fallbackDurations?: Array<number | string | CSSNumericValue>
    }
    runtime.fallbackDurations = []
    const animate = Element.prototype.animate
    Element.prototype.animate = function (
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ): Animation {
      if (options && typeof options === "object" && options.duration) {
        runtime.fallbackDurations?.push(options.duration)
      }
      return Reflect.apply(animate, this, [keyframes, options]) as Animation
    }
    Object.defineProperty(Document.prototype, "startViewTransition", {
      configurable: true,
      value: undefined,
    })
  })
  await page.reload()

  const result = await page.evaluate(async () => {
    const toggle = document.querySelector<HTMLButtonElement>(
      "[data-theme-toggle]",
    )
    if (!toggle) throw new Error("Theme toggle was not rendered")
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const runtime = window as typeof window & {
      fallbackDurations?: Array<number | string | CSSNumericValue>
    }
    return {
      durations: runtime.fallbackDurations ?? [],
      theme: document.documentElement.dataset.theme,
    }
  })

  expect(result.theme).toBe("dark")
  expect(result.durations).toContain(180)
  await expect(page.locator("[data-theme-toggle]")).toBeEnabled()
})

test("disables all new motion when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.reload()

  const result = await page.evaluate(() => {
    const root = document.documentElement
    const controls = document.querySelector<HTMLElement>(
      "[data-utility-controls]",
    )
    const toggle = document.querySelector<HTMLButtonElement>(
      "[data-theme-toggle]",
    )
    if (!controls || !toggle)
      throw new Error("Navigation controls were not rendered")
    const before = root.getAnimations().length
    toggle.click()
    /* La pérdida de señal no se degrada a «lo mismo pero rápido»: con
       movimiento reducido no existe. Se comprueba desde el CSS calculado y no
       contando animaciones porque son de `:hover`, y el ratón no está encima. */
    const animationOf = (selector: string) =>
      getComputedStyle(document.querySelector(selector)!).animationName
    return {
      addedAnimations: root.getAnimations().length - before,
      controlsTransition: getComputedStyle(controls).transitionDuration,
      disabled: toggle.disabled,
      portraitImage: animationOf(".portrait-image"),
      transitioning: root.classList.contains("theme-transitioning"),
    }
  })

  expect(result).toEqual({
    addedAnimations: 0,
    controlsTransition: "0s",
    disabled: false,
    portraitImage: "none",
    transitioning: false,
  })
  await expect(page.locator("[data-theme-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  )
})

/**
 * El detalle de un proyecto es una dirección.
 *
 * Las tres mitades del trato: abrir escribe la URL, la URL abre el diálogo al
 * entrar de cero —que es lo que hace compartible un enlace— y el botón de volver
 * lo cierra en vez de sacar de la página.
 */
test("gives each project dialog its own address", async ({ page }) => {
  await page.goto("/")

  const opener = page.locator("[data-detail-open]").first()
  const id = await opener.getAttribute("data-detail-open")
  const panel = page.locator(`#${id} .detail-panel`)
  const slug = String(id).replace(/^project-/, "")

  await opener.click()
  await expect(panel).toBeVisible()
  expect(new URL(page.url()).hash).toBe(`#proyecto/${slug}`)

  // Volver cierra el diálogo, y no se lleva la página por delante.
  await page.goBack()
  await expect(panel).not.toBeVisible()
  /* `.first()`: hay dos listas desde que las cinco últimas tarjetas viven tras
     un «Ver 5 más». Lo que se comprueba aquí es que la portada está en pie. */
  await expect(page.locator(".project-list").first()).toBeVisible()
})

test("opens a project hash without reloading the document", async ({
  page,
}) => {
  await page.goto("/")

  const opener = page.locator("[data-detail-open]").first()
  const id = String(await opener.getAttribute("data-detail-open"))
  const slug = id.replace(/^project-/, "")

  // El enlace seguido sin recargar: sólo cambia el hash, así que aquí no hay
  // `popstate` y quien lo atiende es `hashchange`.
  await page.evaluate((hash) => {
    location.hash = hash
  }, `proyecto/${slug}`)
  await expect(page.locator(`#${id} .detail-panel`)).toBeVisible()
})

test("opens a shared project address on a cold page", async ({ page }) => {
  const id = "project-amazon-spending-tracker"
  await page.goto("/#proyecto/amazon-spending-tracker")
  await expect(page.locator(`#${id} .detail-panel`)).toBeVisible()
})

/**
 * Pasar al proyecto siguiente sin volver a la rejilla.
 *
 * Y sin cargar el historial: saltar de uno a otro reutiliza la misma entrada,
 * igual que abrir y cerrar.
 *
 * **El siguiente sale de `cv.json`, no de la rejilla.** Los diálogos se
 * descargan de `/project-details/`, que los emite en el orden del archivo, y por
 * ahí caminan los botones. La rejilla enseña otra cosa desde que dos proyectos
 * van marcados con `featured`: la segunda tarjeta es Riolan, que en el archivo
 * es el séptimo. Leerlo de los disparadores daba por siguiente al de al lado en
 * pantalla, y eso ya no es verdad.
 *
 * Tampoco vale contar los diálogos del DOM: al montar, los que no están abiertos
 * se desprenden y sólo queda uno.
 */
test("steps between projects from inside the dialog", async ({ page }) => {
  await page.goto("/")

  const openers = page.locator("[data-detail-open]")
  const first = String(await openers.nth(0).getAttribute("data-detail-open"))
  const second = await page.evaluate(async (from: string) => {
    const cv = await fetch("/cv.json").then((response) => response.json())
    const ids = cv.projects.map((project: { id: string }) => project.id)
    const index = ids.indexOf(from.replace(/^project-/, ""))
    return `project-${ids[(index + 1) % ids.length]}`
  }, first)

  await openers.nth(0).click()
  await expect(page.locator(`#${first}`)).toBeVisible()
  const entries = await page.evaluate(() => history.length)

  await page.locator(`#${first} .detail-step`).last().click()
  await expect(page.locator(`#${second}`)).toBeVisible()
  await expect(page.locator(`#${first}`)).not.toBeVisible()
  expect(new URL(page.url()).hash).toBe(
    `#proyecto/${second.replace(/^project-/, "")}`,
  )
  expect(await page.evaluate(() => history.length)).toBe(entries)

  // Y vuelve, que es el otro botón.
  await page.locator(`#${second} .detail-step`).first().click()
  await expect(page.locator(`#${first}`)).toBeVisible()
})

/**
 * Cerrar no puede dejar el historial cargado.
 *
 * Recorrer los proyectos abriendo y cerrando llegó a empujar una entrada por
 * cada uno: siete pulsaciones de «atrás» para salir de la página. Ahora el
 * cierre reemplaza esa entrada, así que la casilla se reutiliza.
 */
test("does not pile up history entries while browsing projects", async ({
  page,
}) => {
  await page.goto("/")
  const before = await page.evaluate(() => history.length)

  const openers = page.locator("[data-detail-open]")
  for (let index = 0; index < 3; index += 1) {
    await openers.nth(index).click()
    await expect(page.locator("dialog[data-detail][open]")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.locator("dialog[data-detail][open]")).toHaveCount(0)
  }

  const after = await page.evaluate(() => history.length)
  expect(after - before, "entradas de historial tras tres proyectos").toBe(1)
})

test("fits every project dialog on a desktop viewport without scrolling", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "One engine is enough for the layout")

  await page.setViewportSize({ width: 1280, height: 900 })
  /* En el índice y no en la portada: «every» es todos, y desde el 07-10-2026
     la portada enseña sólo los tres destacados —el «Ver 5 más» se fue porque
     repetía lo que hay aquí—. El diálogo es el mismo en los dos sitios, así
     que medirlo donde están los ocho cubre más. */
  await page.goto("/proyectos/")

  /* Uno por proyecto: la miniatura y el «ver ficha completa» repiten el
     mismo destino y van fuera del orden de tabulación. */
  const openers = page.locator("a[data-detail-open]:not([tabindex='-1'])")
  const count = await openers.count()
  expect(count).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const id = await openers.nth(index).getAttribute("data-detail-open")
    await openers.nth(index).click()
    const panel = page.locator(`#${id} .detail-panel`)
    await expect(panel).toBeVisible()
    // Las capturas de la tira son `lazy` y llegan tarde: si se mide antes, el
    // panel todavía no tiene su altura real.
    await page.waitForTimeout(400)

    const overflow = await panel.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    )
    expect(overflow, `overflow vertical en #${id}`).toBeLessThanOrEqual(1)

    // El botón de cerrar es pegajoso, así que se ve siempre, desborde o no.
    await expect(page.locator(`#${id} [data-detail-close]`)).toBeInViewport()
    await page.keyboard.press("Escape")
    await expect(panel).not.toBeVisible()
  }
})

test("lights the project card on hover with the shared neutral recipe", async ({
  page,
}, testInfo) => {
  // Los proyectos móviles emulan `hover: none`, donde estas reglas no aplican.
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The hover styles only exist on pointer devices",
  )

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/")

  // La tarjeta ya no tiene botón dibujado: el disparador es una capa
  // transparente estirada sobre ella, así que el encendido se mide en la propia
  // tarjeta. El color del título entra para comprobar que el texto **no** se
  // mueve.
  const card = page.locator("article:has([data-detail-open])").first()
  const read = () =>
    card.evaluate((element) => {
      const computed = getComputedStyle(element)
      const heading = element.querySelector("h3")

      return {
        background: computed.backgroundColor,
        border: computed.borderTopColor,
        color: heading ? getComputedStyle(heading).color : "",
        shadow: computed.boxShadow,
      }
    })

  /**
   * El encendido de la tarjeta es el mismo que el de los botones «volver /
   * copiar / descargar .md» y el de los controles de la barra: superficie
   * neutra, filete vivo y halo. Se comprueba contra los tokens y no contra un
   * color escrito a mano porque el acento se sortea en cada carga —y porque el
   * sentido de la regla es justamente que las tres coincidan—.
   */
  const tokens = () =>
    page.evaluate(() => {
      const computed = getComputedStyle(document.documentElement)
      const resolve = (name: string) => {
        const probe = document.createElement("span")
        probe.style.color = computed.getPropertyValue(name).trim()
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }
      return {
        surfaceHover: resolve("--surface-hover"),
        borderHover: resolve("--border-hover"),
      }
    })

  for (const theme of ["light", "dark"] as const) {
    await page.mouse.move(0, 0)
    await page.evaluate((value) => window.theme.setTheme(value), theme)
    await page.waitForTimeout(200)

    const resting = await read()
    await card.hover()
    await page.waitForTimeout(300)
    const hovered = await read()
    const { surfaceHover, borderHover } = await tokens()

    // La superficie responde, y lo hace con el token neutro compartido: nada de
    // tinte de acento, que era lo que hacía antes con `--cta-fill`.
    expect(hovered.background, `fondo en ${theme}`).not.toBe(resting.background)
    expect(hovered.background, `fondo en ${theme}`).toBe(surfaceHover)
    expect(hovered.border, `filete en ${theme}`).toBe(borderHover)
    expect(hovered.shadow, `halo en ${theme}`).not.toBe("none")

    // El título se queda exactamente donde estaba, en los dos temas.
    expect(hovered.color, `título en ${theme}`).toBe(resting.color)
  }
})

test("lights each contact port in its own brand colour", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The hover styles only exist on pointer devices",
  )

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/")

  const read = (network: string) =>
    page
      .locator(`.contact-list a[data-network="${network}"]`)
      .evaluate((element) => {
        const icon = element.querySelector(".contact-icon")

        return {
          border: getComputedStyle(element).borderTopColor,
          icon: icon ? getComputedStyle(icon).color : "",
          pilot: getComputedStyle(element, "::before").backgroundColor,
        }
      })

  const networks = ["Email", "WhatsApp", "LinkedIn", "GitHub"] as const

  for (const theme of ["light", "dark"] as const) {
    await page.mouse.move(0, 0)
    await page.evaluate((value) => window.theme.setTheme(value), theme)
    await page.waitForTimeout(200)

    const lit: string[] = []

    for (const network of networks) {
      const resting = await read(network)
      await page.locator(`.contact-list a[data-network="${network}"]`).hover()
      await page.waitForTimeout(250)
      const hovered = await read(network)

      // Se enciende, y no es el mismo color que en reposo.
      expect(hovered.icon, `icono de ${network} en ${theme}`).not.toBe(
        resting.icon,
      )
      expect(hovered.pilot, `piloto de ${network} en ${theme}`).not.toBe(
        resting.pilot,
      )
      expect(hovered.border, `filete de ${network} en ${theme}`).not.toBe(
        resting.border,
      )
      // El icono, el filete y el piloto dicen el mismo color: es una marca, no
      // tres decisiones sueltas.
      expect(hovered.icon, `marca de ${network} en ${theme}`).toBe(
        hovered.pilot,
      )
      lit.push(hovered.icon)
    }

    // Cuatro marcas, cuatro colores distintos.
    expect(new Set(lit).size, `colores distintos en ${theme}`).toBe(
      networks.length,
    )
  }

  /**
   * Y donde se pide contraste, uno solo.
   *
   * Es la comprobación que faltaba la vez que estos colores existieron: se
   * quitaron porque el modo de alto contraste no los apagaba y nadie lo medía.
   */
  await page.emulateMedia({ contrast: "more" })
  await page.mouse.move(0, 0)
  await page.waitForTimeout(200)

  const contrasted: string[] = []
  for (const network of networks) {
    await page.locator(`.contact-list a[data-network="${network}"]`).hover()
    await page.waitForTimeout(250)
    contrasted.push((await read(network)).icon)
  }

  expect(new Set(contrasted).size, "un solo color en alto contraste").toBe(1)
})

test("does not overflow at the four acceptance widths in either theme", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "One engine is enough for width matrix")

  for (const width of [375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")

    for (const theme of ["light", "dark"] as const) {
      /**
       * El tema se fija por la API y no pulsando el conmutador.
       *
       * Lo que se mide aquí es el ancho del documento en las dos paletas; el
       * botón tiene sus propias pruebas. Pulsarlo costaba, además, dos cosas
       * que no aportan nada a esta medida: a 375 px obliga a desplegar la barra
       * —que ahí arranca plegada— y encima hay que esperar la transición de
       * vista, que deshabilita el botón mientras dura. Ocho esperas de ésas
       * dejaban la prueba al borde de su tiempo límite cuando la suite corre
       * con dos workers y tres motores.
       */
      await page.evaluate((next) => window.theme.setTheme(next), theme)

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(
        overflow,
        `overflow at ${width}px in ${theme}`,
      ).toBeLessThanOrEqual(0)
    }
  }
})

/**
 * La tira de capturas se arrastra con el ratón.
 *
 * Con el dedo el navegador ya la desplazaba y con el tabulador también; con un
 * ratón corriente no había forma, así que en un portátil sin desplazamiento
 * horizontal las capturas de más allá de la tercera no existían salvo abriendo
 * el visor.
 *
 * La prueba mide las dos mitades del trato, porque las dos se rompieron una vez
 * cada una mientras se construía esto: que el arrastre **mueva** —lo mataban el
 * arrastre nativo de la imagen y una excepción de `setPointerCapture`— y que al
 * soltar **no abra** el visor, que es el clic sintético que el navegador emite
 * sobre la miniatura donde acabó el puntero.
 */
test("drags the screenshot strip sideways with the mouse", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "El arrastre de puntero es de escritorio")

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/")

  const opener = page.locator("[data-detail-open]").first()
  const dialogId = String(await opener.getAttribute("data-detail-open"))
  await opener.click()

  const strip = page.locator(`#${dialogId} .shots`)
  await expect(strip).toBeVisible()
  /* Las capturas son `lazy`: sin ellas dentro, la tira no desborda y no hay
     nada que arrastrar. */
  await expect
    .poll(() => strip.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeGreaterThan(0)

  const box = await strip.boundingBox()
  if (!box) throw new Error("La tira de capturas no tiene caja")
  const y = box.y + box.height / 2
  const from = box.x + box.width - 40

  await page.mouse.move(from, y)
  await page.mouse.down()
  for (const dx of [10, 60, 140, 240]) await page.mouse.move(from - dx, y)
  await page.mouse.up()

  await expect
    .poll(() => strip.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0)
  // Y arrastrar no es pulsar: el visor sigue cerrado.
  await expect(page.locator("dialog[data-lightbox][open]")).toHaveCount(0)

  /* Un clic de verdad sí lo abre, pasada la ventana de 400 ms en la que el
     guion anula el clic sintético que deja un arrastre. La espera es el propio
     contrato —está escrita en `Projects.astro`—, no un margen a ojo. */
  await page.waitForTimeout(450)
  await strip.locator("[data-lightbox-open]").first().click()
  await expect(page.locator("dialog[data-lightbox][open]")).toBeVisible()
})

/**
 * El visor: rail de miniaturas y zoom.
 *
 * Con siete capturas, llegar a la quinta costaba cuatro pulsaciones a ciegas.
 * Y una captura de escritorio dentro de un móvil no se lee sin poder acercarse.
 */
/** El visor vive dentro del diálogo de detalle: hay que abrirlo antes. */
const openLightbox = async (page: Page) => {
  await page.goto("/")
  const opener = page.locator("[data-detail-open]").first()
  const dialogId = String(await opener.getAttribute("data-detail-open"))
  await opener.click()
  const detail = page.locator(`#${dialogId}`)
  await expect(detail).toBeVisible()
  const trigger = detail.locator("[data-lightbox-open]").first()
  await trigger.click()

  const lightbox = page.locator("dialog[data-lightbox][open]")
  await expect(lightbox).toBeVisible()
  return lightbox
}

test("jumps to a screenshot from the thumbnail rail", async ({ page }) => {
  const lightbox = await openLightbox(page)

  const thumbs = lightbox.locator(".lightbox-thumb")
  expect(await thumbs.count()).toBeGreaterThan(1)
  await expect(thumbs.first()).toHaveAttribute("aria-current", "true")

  await thumbs.nth(2).click()
  await expect(thumbs.nth(2)).toHaveAttribute("aria-current", "true")
  await expect(thumbs.first()).not.toHaveAttribute("aria-current", "true")
  await expect(lightbox.locator("[data-lightbox-current]")).toHaveText("3")
})

test("zooms the screenshot and resets when changing image", async ({
  page,
}) => {
  const lightbox = await openLightbox(page)
  const image = lightbox.locator("[data-lightbox-image]")

  const scale = () => image.evaluate((el) => el.style.scale || "1")
  expect(await scale()).toBe("1")

  // Doble clic: el atajo de toda la vida entre 1× y cerca.
  await image.dblclick()
  expect(Number(await scale())).toBeGreaterThan(1)
  await expect(lightbox).toHaveAttribute("data-zoomed", "")

  // Cambiar de captura devuelve el zoom a su sitio: heredarlo dejaría la nueva
  // entrando por una esquina al azar.
  await lightbox.locator(".lightbox-thumb").nth(1).click()
  expect(await scale()).toBe("1")
  await expect(lightbox).not.toHaveAttribute("data-zoomed", "")
})

/* Sin teclado, quien no usa ratón puede abrir el visor pero no acercarse. */
test("zooms with the keyboard", async ({ page }) => {
  const lightbox = await openLightbox(page)
  const image = lightbox.locator("[data-lightbox-image]")

  await page.keyboard.press("+")
  expect(
    Number(await image.evaluate((el) => el.style.scale || "1")),
  ).toBeGreaterThan(1)

  await page.keyboard.press("0")
  expect(await image.evaluate((el) => el.style.scale || "1")).toBe("1")
})

/**
 * El comando `ask`.
 *
 * El endpoint se intercepta con un flujo SSE de mentira: lo que se prueba es el
 * modo conversación —el prompt, el pintado incremental, la memoria y las
 * salidas de error—, no la cuenta del proveedor. Lo que sí se afirma de verdad
 * es el cuerpo que sale hacia el servidor.
 */
const sseBody = (chunks: string[]): string =>
  chunks.map((text) => `data: ${JSON.stringify({ text })}\n\n`).join("") +
  "data: [DONE]\n\n"

/**
 * El asistente, en su panel flotante.
 *
 * Desde el 06-10-2026 es el único camino: la consola, con su `ask`, se fue. Fue
 * un glifo sin rótulo, después una barra dentro del hero, y las
 * dos versiones compartían el mismo defecto —vivían en el flujo de la portada y
 * la movían—. Lo que se prueba aquí es justo eso: que responde **sin mover una
 * página que alguien puede estar leyendo**.
 */
const askDock = (page: Page) => ({
  trigger: page.locator("[data-ask-dock-trigger]"),
  panel: page.locator(".ask-dock-panel"),
  field: page.locator(".ask-dock-input"),
  answer: page.locator(".ask-dock-answer"),
})

async function openDock(page: Page) {
  const dock = askDock(page)
  await dock.trigger.click()
  await expect(dock.panel).toBeVisible()
  return dock
}

test("answers from the dock without moving the page", async ({ page }) => {
  const sent: Array<Record<string, unknown>> = []
  await page.route("**/api/ask", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"))
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      // En trozos, y uno partido por la mitad de una palabra: es como llegan.
      body: sseBody(["Trabaja con Ang", "ular y Spring Boot."]),
    })
  })

  /* La foto, antes de nada. Es la regresión que vino a arreglar el panel: con
     la barra dentro del hero, el retrato se recolocaba al abrir la conversación
     y otra vez con cada respuesta, porque la rejilla lo centraba contra una
     columna que crecía. */
  const portrait = page.locator(".portrait")
  const before = await portrait.boundingBox()

  const { field, answer } = await openDock(page)
  await field.fill("¿con qué trabaja?")
  await field.press("Enter")

  // El eco de lo escrito, y la respuesta debajo.
  await expect(answer).toContainText("¿con qué trabaja?")
  await expect(answer).toContainText("Trabaja con Angular y Spring Boot.")
  expect(sent.at(-1)).toMatchObject({
    locale: "es",
    question: "¿con qué trabaja?",
    history: [],
  })

  // Y la página sigue exactamente donde estaba.
  expect(await portrait.boundingBox()).toEqual(before)

  /* El segundo turno lleva el primero de vuelta: es lo que da referente a un
     «¿y en cuál?». La API no guarda estado, así que la memoria la manda el
     cliente. */
  await field.fill("¿y en cuál de ellos?")
  await field.press("Enter")
  expect(sent.at(-1)?.history).toEqual([
    { role: "user", content: "¿con qué trabaja?" },
    { role: "assistant", content: "Trabaja con Angular y Spring Boot." },
  ])
})

test("sends a suggested question from the dock when it is clicked", async ({
  page,
}) => {
  const sent: Array<Record<string, unknown>> = []
  await page.route("**/api/ask", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"))
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody(["Sí."]),
    })
  })

  await openDock(page)
  const suggestions = page.locator(".ask-dock-suggestion")
  await expect(suggestions).toHaveCount(4)
  const question = (await suggestions.first().textContent())?.trim()
  await suggestions.first().click()

  await expect(askDock(page).answer).toContainText("Sí.")
  expect(sent.at(-1)).toMatchObject({ question })
  /* Las cuatro de antes se van con la pregunta, y tras la respuesta vuelven
     dos: no son las mismas —la rotación ha avanzado— y no son cuatro, que
     debajo de algo recién leído serían un menú. */
  await expect(suggestions).toHaveCount(2)
  expect(await suggestions.first().textContent()).not.toBe(question)
})

test("says from the dock when questions come too fast", async ({ page }) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({ status: 429, json: { error: "rate_limited" } }),
  )

  const { field, answer } = await openDock(page)
  await field.fill("¿y ahora?")
  await field.press("Enter")

  await expect(answer.locator(".ask-dock-line--err")).toContainText(
    "Demasiadas preguntas",
  )
})

/* Es un `<dialog>` modal, así que Escape lo cierra y el foco vuelve solo a
   quien lo abrió. Las tres cosas las da el navegador, y por eso se usa un
   diálogo de verdad en vez de una caja con `position: fixed`; lo que se prueba
   es que efectivamente se usa uno. */
test("closes the dock with Escape and gives the focus back", async ({
  page,
}) => {
  const { panel, field } = await openDock(page)

  await field.press("Escape")
  await expect(panel).toBeHidden()
  await expect(askDock(page).trigger).toBeFocused()
})

/* Sin JavaScript no se pinta: un botón que no responde es peor que no tener
   botón, y los cuatro puertos del hero son enlaces de verdad. */
test.describe("without javascript", () => {
  test.use({ javaScriptEnabled: false })

  test("does not paint the ask dock", async ({ page }) => {
    await page.goto("/")

    await expect(page.locator("[data-ask-dock]")).toBeHidden()
    await expect(
      page.locator('.contact-list a[data-network="Email"]'),
    ).toBeVisible()
  })
})

/* Un `stop_reason: "max_tokens"` trae texto válido dentro de un 200. Sin el
   aviso, la respuesta se queda a media frase y parece una avería. */
test("says when the answer was cut short by length", async ({ page }) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        sseBody(["Race Hub es una app Android que"]).replace(
          "data: [DONE]\n\n",
          "",
        ) +
        `data: ${JSON.stringify({ truncated: true })}\n\n` +
        "data: [DONE]\n\n",
    }),
  )

  const { field, answer } = await openDock(page)
  await field.fill("cuéntame todo sobre Race Hub")
  await field.press("Enter")

  await expect(answer).toContainText("Race Hub es una app Android que")
  await expect(answer).toContainText("cortada por longitud")
  // No es un error: la respuesta vale, sólo está incompleta.
  await expect(page.locator(".ask-dock-line--err")).toHaveCount(0)
})

/**
 * El chip de correo copia en vez de abrir el cliente.
 *
 * El permiso de portapapeles se concede en el contexto: sin él, Chromium
 * rechaza `writeText` y la prueba mediría la reserva en lugar del camino
 * bueno.
 */
test("copies the address from the email chip", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "El permiso de portapapeles solo se concede en Chromium",
  )
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.setViewportSize({ width: 1280, height: 900 })

  const chip = page.locator("[data-contact-copy]")
  const feedback = page.locator("[data-contact-feedback]")
  const address = await chip.getAttribute("data-contact-copy")

  await expect(feedback).toBeEmpty()
  await chip.click()

  await expect(feedback).toHaveText("Copiado")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    address,
  )
  // Y no ha navegado a ningún `mailto:`.
  await expect(page).toHaveURL(/\/$/)

  // El acuse se retira solo.
  await expect(feedback).toBeEmpty({ timeout: 4000 })
})

/**
 * El contador dice el ordinal de la sección activa, sea cual sea.
 *
 * Se comprueba contra el índice lateral y no contra un «03/07» escrito aquí: la
 * sección que está activa a una altura de scroll dada depende del alto de las
 * anteriores, y fijar un número convertiría esta prueba en una que falla cada
 * vez que alguien alarga un párrafo. Lo que promete el contador es coincidir con
 * el índice, y eso es lo que se mide.
 */
test("the section counter tracks the readout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })

  const counter = page.locator("[data-bar-count]")
  // En el hero no hay número: es la portada, no una sección numerada.
  await expect(counter).toBeEmpty()

  /* `behavior: "instant"` a propósito: el sitio pone `scroll-behavior: smooth`,
     y un desplazamiento animado deja la sección activa a medio camino mientras
     la aserción ya está mirando. */
  await page.evaluate(() => {
    const target = document.querySelector("#projects")
    if (!target) return
    window.scrollTo({
      behavior: "instant",
      top: target.getBoundingClientRect().top + window.scrollY,
    })
  })

  const total = await page
    .locator("[data-section-total]")
    .getAttribute("data-section-total")
  const active = page.locator("[data-section-link][aria-current='location']")

  /* Se espera al ordinal y no al nombre: el rótulo sale del build ya con
     «Inicio» puesto, así que mirar si tiene texto pasaría sin que el scroll
     haya llegado a ninguna parte. */
  await expect
    .poll(() => active.getAttribute("data-section-ordinal"))
    .toMatch(/^\d{2}$/)

  const ordinal = await active.getAttribute("data-section-ordinal")
  await expect(counter).toHaveText(`${ordinal}/${total}`)
  // Y el nombre que enseña la barra es el del mismo enlace.
  await expect(page.locator("[data-bar-section]")).toHaveText(
    (await active.locator(".label").textContent()) ?? "",
  )
})

/**
 * La secuencia de arranque, una vez y sólo una.
 *
 * Dura 400 ms y se borra sola, así que mirarla con `toContainText` es una
 * carrera perdida: para cuando la aserción consulta, puede haber terminado. Se
 * graba con un observador instalado **antes** que el guion de la página —un
 * `addInitScript` corre antes que cualquier módulo— y luego se lee lo grabado.
 *
 * La segunda visita se comprueba en una pestaña nueva del mismo contexto, que
 * comparte `localStorage` pero no arrastra el `addInitScript` de ésta: los
 * guiones de inicio se acumulan y no hay manera de retirarlos.
 */
test("plays the boot sequence only on the first visit", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("portfolio-booted")
    } catch {
      // Sin almacenamiento arranca siempre, que es el respaldo aceptado.
    }

    const store = window as unknown as { __boot?: string }
    store.__boot = ""

    document.addEventListener("DOMContentLoaded", () => {
      const slot = document.querySelector("[data-bar-boot]")
      if (!slot) return

      new MutationObserver(() => {
        if (slot.textContent) store.__boot = slot.textContent
      }).observe(slot, { characterData: true, childList: true, subtree: true })
    })
  })

  await page.goto("/")

  // Se escribió y llegó entera.
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __boot?: string }).__boot),
    )
    .toContain("SYS.OK")

  // Y al terminar cede el sitio al rótulo de siempre.
  await expect
    .poll(() => page.locator("html").getAttribute("data-booting"))
    .toBeNull()
  await expect(page.locator("[data-bar-meta]")).toBeVisible()

  // La segunda visita entra directa.
  const second = await context.newPage()
  await second.setViewportSize({ width: 1280, height: 900 })
  await second.goto("/")
  expect(await second.locator("html").getAttribute("data-booting")).toBeNull()
  await expect(second.locator("[data-bar-boot]")).toBeEmpty()
  await second.close()
})

/**
 * El aviso de idioma.
 *
 * El sitio publica tres idiomas y no detectaba ninguno: quien entra por la raíz
 * con el navegador en inglés recibe castellano sin enterarse de que existe su
 * versión. Ahora se le dice, en su idioma y sin redirigirlo — el porqué de no
 * redirigir está en `Layout.astro`.
 *
 * `test.use({ locale })` es lo que mueve `navigator.languages`, que es de donde
 * lee `localeSuggest.ts`.
 */
test.describe("language hint", () => {
  test.use({ locale: "en-US" })

  test("offers the visitor's language, written in it", async ({ page }) => {
    const hint = page.locator("[data-locale-hint]")
    await expect(hint).toBeVisible()

    /* En inglés y no en el idioma de la página: es lo que distingue este aviso
       del resto de los textos del sitio. */
    await expect(hint).toContainText("This page is also available in English")

    const action = hint.locator("[data-locale-hint-action]")
    await expect(action).toHaveAttribute("href", "/en/")
    await expect(action).toHaveAttribute("hreflang", "en")
  })

  /* Lleva a la **misma** página traducida, no a la portada: es lo que aporta
     reutilizar el `localeHref` que ya alimenta el `hreflang`. */
  test("keeps the visitor on the page they are reading", async ({ page }) => {
    await page.goto("/servicios/")

    await expect(
      page.locator("[data-locale-hint] [data-locale-hint-action]"),
    ).toHaveAttribute("href", "/en/services/")
  })

  test("stays dismissed across reloads", async ({ page }) => {
    const hint = page.locator("[data-locale-hint]")
    await expect(hint).toBeVisible()

    await hint.locator("[data-locale-hint-dismiss]").click()
    await expect(hint).toBeHidden()

    await page.reload()
    await expect(hint).toBeHidden()
  })

  /* Elegir idioma a mano cuenta como respuesta. Sin esto, quien ya ha pulsado el
     conmutador seguiría viendo la sugerencia en cada página. */
  test("takes an explicit language choice as an answer", async ({ page }) => {
    await openBarMenu(page, "locale")
    /* Acotado al panel del conmutador: el enlace del propio aviso también lleva
       `hreflang="en"`, y sin acotar el selector casa con los dos. */
    await page.locator('#locale-panel a[hreflang="en"]').click()
    await expect(page).toHaveURL(/\/en\/$/)

    await expect(page.locator("[data-locale-hint]")).toBeHidden()
  })

  /**
   * Y no mueve la página.
   *
   * Es la razón de que el aviso flote en una esquina en vez de ser una franja
   * arriba: se descubre **después** de que corra el guion, así que en el flujo
   * habría desplazado todo el documento hacia abajo.
   */
  test("reveals itself without shifting the layout", async ({ page }) => {
    const box = page.locator("#web-view")
    const before = await box.boundingBox()

    await expect(page.locator("[data-locale-hint]")).toBeVisible()

    expect((await box.boundingBox())?.y).toBe(before?.y)
  })
})

/* Y con el idioma de la página no aparece: no hay nada que sugerir. */
test.describe("language hint, already in the right language", () => {
  test.use({ locale: "es-ES" })

  test("stays out of the way", async ({ page }) => {
    await expect(page.locator("[data-locale-hint]")).toBeHidden()
  })
})
