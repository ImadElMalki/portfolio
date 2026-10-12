import { gzipSync } from "node:zlib"
import { expect, test, type Response } from "@playwright/test"
import { HOME_RUNTIME_BUDGET, PAGE_BUDGETS } from "../../scripts/budgets.mjs"

/* Los mismos techos que `check-build.mjs` y `lighthouse-docker.mjs`: antes esta
   prueba llevaba su copia (220 KiB y 1 100 nodos) y el gate otra distinta. */
const BUDGET = {
  htmlBytes: PAGE_BUDGETS.home.htmlBytes,
  nodes: HOME_RUNTIME_BUDGET.domNodes,
  requests: HOME_RUNTIME_BUDGET.requests,
  coldBytes: HOME_RUNTIME_BUDGET.transferBytes,
  lcpMs: HOME_RUNTIME_BUDGET.lcpMs,
  cls: HOME_RUNTIME_BUDGET.cls,
  tbtMs: HOME_RUNTIME_BUDGET.tbtMs,
} as const

interface AuditVitals {
  cls: number
  lcp: number
  tbt: number
}

test("keeps the cold home page inside its performance budgets", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("chromium"),
    "The release budget is measured in clean Chromium",
  )

  // Arrange: observers must exist before navigation to see the first paint and
  // every long task on the critical path.
  await page.addInitScript(() => {
    const vitals: AuditVitals = { cls: 0, lcp: 0, tbt: 0 }
    ;(window as unknown as { __auditVitals: AuditVitals }).__auditVitals =
      vitals

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (
          !(entry as PerformanceEntry & { hadRecentInput?: boolean })
            .hadRecentInput
        ) {
          vitals.cls += (entry as PerformanceEntry & { value: number }).value
        }
      }
    }).observe({ type: "layout-shift", buffered: true })

    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1)
      if (last) vitals.lcp = last.startTime
    }).observe({ type: "largest-contentful-paint", buffered: true })

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        vitals.tbt += Math.max(0, entry.duration - 50)
      }
    }).observe({ type: "longtask", buffered: true })
  })

  const coldResponses: Response[] = []
  page.on("response", (response) => {
    if (new URL(response.url()).hostname === "[::1]")
      coldResponses.push(response)
  })

  // Act
  const documentResponse = await page.goto("/", { waitUntil: "networkidle" })
  await page.waitForTimeout(250)

  const coldBytes = (
    await Promise.all(
      coldResponses.map(async (response) => {
        try {
          const body = await response.body()
          const type = response.headers()["content-type"] ?? ""
          return /(?:text|javascript|json|xml|svg)/i.test(type)
            ? gzipSync(body).byteLength
            : body.byteLength
        } catch {
          return 0
        }
      }),
    )
  ).reduce((total, bytes) => total + bytes, 0)

  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[]
    return {
      nodes: document.querySelectorAll("*").length,
      requests: resources.length + 1,
      urls: resources.map((entry) => entry.name),
      vitals: (window as unknown as { __auditVitals: AuditVitals })
        .__auditVitals,
    }
  })
  const htmlBytes = Buffer.byteLength(await documentResponse!.body())

  // Assert
  expect(htmlBytes).toBeLessThanOrEqual(BUDGET.htmlBytes)
  expect(metrics.nodes).toBeLessThanOrEqual(BUDGET.nodes)
  expect(metrics.requests).toBeLessThanOrEqual(BUDGET.requests)
  expect(coldBytes).toBeLessThanOrEqual(BUDGET.coldBytes)
  expect(metrics.vitals.lcp).toBeGreaterThan(0)
  expect(metrics.vitals.lcp).toBeLessThanOrEqual(BUDGET.lcpMs)
  expect(metrics.vitals.cls).toBeLessThanOrEqual(BUDGET.cls)
  expect(metrics.vitals.tbt).toBeLessThanOrEqual(BUDGET.tbtMs)
  expect(metrics.urls.some((url) => url.includes("project-details"))).toBe(
    false,
  )
})

/**
 * El retrato del hero se descarga **una vez**, no dos.
 *
 * Hasta el 11-09-2026 el hero emitía dos `<img>`, claro y oscuro, y escondía el
 * que no tocaba con `display:none`. Eso no evita la descarga: la portada pedía
 * las dos variantes —~50 KiB cada una en 3×— y las dos con
 * `fetchpriority="high"`, así que la imagen que define el LCP competía con otra
 * que no se pinta nunca. Es `PERF-04` en `AUDIT-2026-09-11.md`.
 *
 * Lo vigila esta prueba y no el presupuesto de arriba porque aquello mide bytes
 * totales, y ~50 KiB de más cabían de sobra en los 600 KiB: el defecto pasó por
 * debajo del gate durante toda su vida.
 */
async function portraitRequests(
  page: import("@playwright/test").Page,
  colorScheme: "light" | "dark",
  storedTheme?: "light" | "dark",
): Promise<string[]> {
  const requests: string[] = []
  page.on("request", (request) => {
    if (/me-bust/.test(request.url())) requests.push(request.url())
  })

  await page.emulateMedia({ colorScheme })
  if (storedTheme) {
    await page.addInitScript((theme) => {
      try {
        window.localStorage.setItem("theme", theme)
      } catch {
        /* El tema sigue funcionando sin almacenamiento; la prueba, no. */
      }
    }, storedTheme)
  }

  await page.goto("/", { waitUntil: "networkidle" })
  return requests
}

const currentPortrait = (page: import("@playwright/test").Page) =>
  page
    .locator(".portrait-image")
    .evaluate((image) => (image as HTMLImageElement).currentSrc)

for (const scheme of ["light", "dark"] as const) {
  test(`downloads exactly one hero portrait in ${scheme} mode`, async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("chromium"),
      "El `<source media>` se resuelve igual, pero sólo Chromium expone las peticiones con la fiabilidad que esto necesita",
    )

    const requests = await portraitRequests(page, scheme)

    expect(requests).toHaveLength(1)
    expect(requests[0]).toContain(
      scheme === "dark" ? "me-bust-dark." : "me-bust.",
    )
    // Chromium lee AVIF: el WebP es sólo la reserva de quien no lo lea.
    expect(requests[0]).toMatch(/\.avif$/)
    expect(await currentPortrait(page)).toContain(
      scheme === "dark" ? "me-bust-dark." : "me-bust.",
    )
  })
}

test("honours a stored theme that contradicts the system one", async ({
  page,
}) => {
  // El `<source media>` pregunta por `prefers-color-scheme`, así que este es el
  // caso que el guion en línea de `Layout.astro` existe para corregir.
  await portraitRequests(page, "light", "dark")

  expect(await currentPortrait(page)).toContain("me-bust-dark.")
})

test("the theme toggle still swaps the portrait", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  expect(await currentPortrait(page)).toContain("me-bust.")

  await page.evaluate(() =>
    (
      window as unknown as { theme: { setTheme(t: string): void } }
    ).theme.setTheme("dark"),
  )

  await expect.poll(() => currentPortrait(page)).toContain("me-bust-dark.")
})

/**
 * Las otras versiones de la página se precargan sólo cuando alguien apunta al
 * conmutador.
 *
 * Hasta el 06-10-2026 se pedían las dos después del `load` (`PERF-03` movió el
 * momento; esto vigilaba que fuera tras la carga). Eran ~84 KB con Brotli por
 * visita a la portada, el doble que la portada, para el ~7 % de visitas que
 * van a otro idioma. Ahora sólo el `hover` de Astro las pide, y lo que se vigila
 * es que la página no las traiga por su cuenta y que el conmutador sí lo haga.
 *
 * El aviso de idioma también lleva `data-language-link`, con un `href="/"` de
 * relleno: la comprobación de que no se pide nada lo cubre igual.
 */
for (const [path, alternate] of [
  ["/", "/ca/"],
  ["/servicios/", "/ca/serveis/"],
] as const) {
  test(`prefetches another language of ${path} only on hover`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Sólo Chromium precarga con `<link rel=prefetch>`, y el `hover` pide puntero",
    )

    // Hojas y fuente precargada también son `link`; los documentos acaban en `/`.
    const prefetches = () =>
      page.evaluate(() =>
        (
          performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[]
        )
          .filter(
            (entry) =>
              entry.initiatorType === "link" &&
              new URL(entry.name).pathname.endsWith("/"),
          )
          .map(({ name }) => new URL(name).pathname),
      )

    // Act: carga y reposo, más que los 3 s de espera que tenía la precarga.
    await page.goto(path)
    await page.waitForLoadState("load")
    await page.waitForTimeout(3_500)

    // Assert: nada por su cuenta…
    expect(await prefetches()).toEqual([])

    // …y el conmutador sí, en cuanto el puntero lo señala.
    await page.locator(`a[data-language-link][href="${alternate}"]`).hover()
    await expect.poll(prefetches).toEqual([alternate])
  })
}
