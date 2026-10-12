import { expect, test, type Page } from "@playwright/test"

/**
 * El contador.
 *
 * Lo que importa comprobar no es que cuente —eso es un punto de Analytics
 * Engine— sino las
 * dos promesas que lo hacen aceptable: que sólo salga lo que se dice que sale
 * (sin nada que identifique a nadie) y que cada cosa se cuente una vez por
 * carga, o la cifra diría cuánto curioseó una persona en vez de a cuánta gente
 * le interesó.
 *
 * ## Por qué se mira la petición y no el cuerpo
 *
 * Los apuntes salen por `navigator.sendBeacon`, y WebKit **no expone el cuerpo
 * de un beacon** a Playwright: `postData()` llega vacío aunque la petición se
 * envíe —comprobado—. Así que lo que se cuenta son las peticiones, que se ven
 * en los tres motores, y el contenido se afirma sólo donde el motor lo deja
 * leer. La alternativa era saltarse la prueba entera en WebKit, y entonces el
 * motor donde más raro se comporta esto sería el único sin cubrir.
 */
interface Beacons {
  /** Una entrada por petición. `undefined` donde el motor no da el cuerpo. */
  readonly all: Array<Record<string, string> | undefined>
}

const collect = async (page: Page): Promise<Beacons> => {
  const all: Array<Record<string, string> | undefined> = []

  page.on("request", (request) => {
    if (!request.url().includes("/api/hit")) return
    const raw = request.postData()
    all.push(raw ? (JSON.parse(raw) as Record<string, string>) : undefined)
  })

  // Se responde 204 para no dejar un 405 del servidor de vista previa en la
  // consola, que el `beforeEach` de otras suites tomaría por un error real.
  await page.route("**/api/hit", (route) =>
    route.fulfill({ status: 204, body: "" }),
  )

  return { all }
}

test("counts the view on load and nothing that identifies anyone", async ({
  page,
}) => {
  const beacons = await collect(page)
  await page.goto("/")
  await expect.poll(() => beacons.all.length).toBeGreaterThan(0)

  const [first] = beacons.all
  test.skip(first === undefined, "WebKit no expone el cuerpo de un beacon")

  expect(first).toMatchObject({ event: "view", path: "/", view: "web" })
  // La lista entera de campos: si alguien añade uno, este test lo caza.
  expect(Object.keys(first ?? {}).sort()).toEqual(["event", "path", "view"])
})

test("counts each thing once per load", async ({ page }) => {
  const beacons = await collect(page)
  await page.goto("/")
  await expect.poll(() => beacons.all.length).toBe(1)

  const openers = page.locator("[data-detail-open]")
  for (let index = 0; index < 3; index += 1) {
    await openers.nth(index).click()
    await expect(page.locator("dialog[data-detail][open]")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.locator("dialog[data-detail][open]")).toHaveCount(0)
  }

  // Tres proyectos abiertos, un solo apunte: la vista de la carga más éste.
  await expect.poll(() => beacons.all.length).toBe(2)
})

/* Una de las dos conversiones de la portada. Se reconoce por el destino del
   enlace, así que vale para el botón del hero y para cualquier otro que lleve
   al PDF; dos descargas en la misma página son una persona, no dos. */
test("counts a CV download once per page", async ({ page }) => {
  const beacons = await collect(page)
  await page.goto("/")
  await expect.poll(() => beacons.all.length).toBe(1)

  const download = page.locator(".hero .cta")
  await download.click()
  await download.click()

  await expect.poll(() => beacons.all.length).toBe(2)
  const [, second] = beacons.all
  test.skip(second === undefined, "WebKit no expone el cuerpo de un beacon")
  expect(second).toEqual({ event: "cv-pdf" })
})

/* Contar es lo último que puede romper una página: si el endpoint cae, el sitio
   ni se entera. */
test("survives the endpoint failing", async ({ page }) => {
  await page.route("**/api/hit", (route) => route.abort("failed"))

  await page.goto("/")
  /* `.first()`: hay dos listas desde que las cinco últimas tarjetas viven tras
     un «Ver 5 más». Lo que se comprueba aquí es que la portada está en pie. */
  await expect(page.locator(".project-list").first()).toBeVisible()
  await expect(page.locator("[data-theme-toggle]")).toBeVisible()
})

/**
 * Y una vista por página y pestaña.
 *
 * Lo ya contado vive en `sessionStorage` y dura lo que la pestaña. Con la clave
 * de antes —`view` más el nombre de la vista, y la vista es `web` en todas las
 * páginas— la segunda página de una visita **no dejaba ni un apunte**: ir a la
 * landing de servicios desde la portada no se contaba, que era justo la
 * pregunta para la que se montó el contador. Ahora el camino entra en la
 * clave. Y volver atrás no cuenta otra vez, recargue el navegador la página o
 * la saque de la bfcache.
 */
test("counts the next page once per tab", async ({ page }) => {
  const beacons = await collect(page)
  await page.goto("/")
  await expect.poll(() => beacons.all.length).toBe(1)

  const cta = page.locator(".services-banner a[href='/servicios/']")
  await expect(cta).toBeVisible()
  await cta.click()
  await expect(page).toHaveURL(/\/servicios\/$/)

  await expect.poll(() => beacons.all.length).toBe(2)

  const [, second] = beacons.all
  test.skip(second === undefined, "WebKit no expone el cuerpo de un beacon")
  expect(second).toMatchObject({
    event: "view",
    path: "/servicios/",
    view: "web",
  })

  /* Y volver a la portada tampoco la cuenta otra vez: una por página visitada,
     no una por visita a la página. */
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await page.waitForTimeout(300)
  expect(beacons.all).toHaveLength(2)
})
