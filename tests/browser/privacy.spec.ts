import { expect, test } from "@playwright/test"

/**
 * Un caso por idioma y no sólo en castellano: el criterio de la auditoría pedía
 * que las tres versiones enseñaran la primera capa **y** que el enlace a la
 * segunda funcionara. Comprobar el `href` no demuestra lo segundo —una ruta
 * puede existir en el atributo y dar 404—, así que aquí se navega de verdad.
 */
const POLICIES = [
  {
    locale: "es",
    home: "/",
    path: "/privacidad/",
    canonical: "https://imadelmalki.com/privacidad/",
    title: "Política de privacidad",
    rights: "Tus derechos",
    purpose: "Solo para responderte",
    more: "Más información y derechos",
  },
  {
    locale: "ca",
    home: "/ca/",
    path: "/ca/privacitat/",
    canonical: "https://imadelmalki.com/ca/privacitat/",
    title: "Política de privacitat",
    rights: "Els teus drets",
    purpose: "Només per respondre't",
    more: "Més informació i drets",
  },
  {
    locale: "en",
    home: "/en/",
    path: "/en/privacy/",
    canonical: "https://imadelmalki.com/en/privacy/",
    title: "Privacy policy",
    rights: "Your rights",
    purpose: "Only to reply to you",
    more: "More information and your rights",
  },
] as const

for (const policy of POLICIES) {
  test(`exposes the complete layered notice at ${policy.path}`, async ({
    page,
  }) => {
    // Arrange and act
    await page.goto(policy.path)

    // Assert
    await expect(
      page.getByRole("heading", { level: 1, name: policy.title }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { level: 2, name: policy.rights }),
    ).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      policy.canonical,
    )
    await expect(
      page.getByRole("link", { name: "AEPD", exact: true }),
    ).toHaveAttribute("href", "https://www.aepd.es/")
    await expect(page.getByRole("checkbox")).toHaveCount(0)
  })

  // La página se publica, así que no puede seguir declarándose un borrador
  // pendiente de revisión: la nota que lo decía se retiró y no debe volver.
  test(`does not present ${policy.path} as an unreviewed draft`, async ({
    page,
  }) => {
    // Arrange and act
    await page.goto(policy.path)

    // Assert
    await expect(page.getByRole("note")).toHaveCount(0)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /^index, follow/,
    )
  })

  test(`reaches the full policy from the contact form in ${policy.locale}`, async ({
    page,
  }) => {
    // Arrange
    await page.goto(policy.home)
    const notice = page.locator("[data-contact-form] .contact-privacy")
    const submit = page.locator("[data-contact-send]")

    /**
     * Todo lo que es del formulario se comprueba **antes** de pulsar el enlace.
     *
     * Aquí el clic iba en medio, y detrás quedaban aserciones sobre `notice` y
     * `submit`, que son nodos de la portada. Pero ese enlace **navega** a la
     * política, y la política no lleva formulario: comprobado en `dist`, tiene
     * cero `[data-contact-form]`. En cuanto el intercambio de `<ClientRouter />`
     * entraba, el localizador no resolvía y la prueba moría con «element(s) not
     * found».
     *
     * Pasaba de milagro: sólo si las aserciones ganaban la carrera a la
     * navegación. En una máquina de desarrollo ganan; en un runner cargado, no.
     * Cayeron los tres navegadores y los tres idiomas a la vez.
     *
     * El orden nuevo dice lo que la prueba siempre quiso decir: el aviso
     * explica para qué se usa el correo, va delante del botón y no pide
     * consentimiento; y desde ahí se llega a la política entera.
     */

    // Assert: la primera capa, tal como está en el formulario.
    await expect(submit).toBeVisible()
    await expect(notice).toContainText(policy.purpose)

    // La primera capa tiene que preceder al botón, no acompañarlo.
    const noticePrecedesSubmit = await notice.evaluate((element) => {
      const button = document.querySelector("[data-contact-send]")
      return Boolean(
        button &&
        element.compareDocumentPosition(button) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
    })
    expect(noticePrecedesSubmit).toBe(true)

    // Sin casilla: la base jurídica que declara la política es precontractual e
    // interés legítimo, no un consentimiento.
    const consentCheckboxes = await page
      .locator("[data-contact-form]")
      .getByRole("checkbox")
      .count()
    expect(consentCheckboxes).toBe(0)

    // Act: y desde esa primera capa se llega a la política entera.
    await notice.getByRole("link", { name: policy.more }).click()

    // Assert: ya en la política, que es lo único que existe tras navegar.
    await expect(page).toHaveURL(new RegExp(`${policy.path}$`))
    await expect(
      page.getByRole("heading", { level: 1, name: policy.title }),
    ).toBeVisible()
  })
}

test("includes the visible clock in the Glyph control name", async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/")
  const clock = page.locator("[data-bar-clock]")
  await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/)

  // Act and assert
  await expect(page.locator("[data-glyph-easter]")).toHaveAccessibleName(
    /^\d{2}:\d{2}:\d{2} Encender la tira Glyph$/,
  )
})
