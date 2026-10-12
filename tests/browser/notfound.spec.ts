import { expect, test } from "@playwright/test"

/**
 * La 404 no es un callejón.
 *
 * Hasta el 06-10-2026 lo resolvía la consola: quien llegaba por una URL rota
 * podía escribir `ls` y encontrar lo que buscaba. Sin ella, lo que lo deja de
 * ser son tres destinos —proyectos, «Sobre mí» y el CV—, la vuelta al portfolio
 * en cualquiera de los tres idiomas y la píldora del asistente.
 */
test("offers the projects, the about page and the CV", async ({ page }) => {
  await page.goto("/404.html")

  const next = page.getByRole("navigation", { name: "Por dónde seguir" })
  const hrefs = await next
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")))

  expect(hrefs).toEqual(["/proyectos/", "/sobre-mi/", "/cv.pdf"])
})

test("offers the assistant on the 404", async ({ page }) => {
  await page.goto("/404.html")

  await expect(page.locator("[data-ask-dock-trigger]")).toBeVisible()
})

test("goes back to the portfolio from the 404", async ({ page }) => {
  await page.goto("/404.html")

  await page.getByRole("link", { name: "Volver al portfolio" }).click()

  await page.waitForURL((url) => url.pathname === "/")
  /* `.first()`: hay dos listas desde que las de abajo viven tras un «Ver más».
     Lo que se comprueba aquí es que la portada está en pie. */
  await expect(page.locator(".project-list").first()).toBeVisible()
})
