import { expect, type Page } from "@playwright/test"

/**
 * Ayudantes de la barra de utilidades, compartidos por las suites de navegación
 * y de la landing de servicios.
 *
 * Viven fuera de un `.spec.ts` para que Playwright no los recoja como pruebas
 * —`testMatch` sólo mira `*.spec.ts`— y para que haya **una** definición: el
 * conmutador de idioma está dentro de la barra, así que cualquier suite que lo
 * pulse necesita las mismas esperas, y dos copias derivarían.
 *
 * Aquí vivía además el contrato del plegado al bajar —`expectExpanded`,
 * `expectCollapsed`, el chevrón de recuperación—. La barra ya no es pegajosa:
 * se queda arriba del documento y se va con el scroll, así que no hay estado
 * que esperar ni nada que recuperar.
 */

/** El ancho en el que el idioma y las vistas se pliegan tras sus botones. */
export const COMPACT_MAX_WIDTH = 700

export function isCompact(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) <= COMPACT_MAX_WIDTH
}

/**
 * Deja los controles de la barra utilizables.
 *
 * Sólo espera a que el runtime los haya montado y a que el fundido de entrada
 * haya terminado, que es lo que Playwright necesita antes de un clic. Se
 * conserva como función en vez de borrarla de las diez llamadas: la espera
 * sigue haciendo falta y tenerla en un sitio es lo que evita que cada suite
 * invente la suya.
 */
export async function openUtilityBar(page: Page): Promise<void> {
  await expect(page.locator("[data-utility-controls]")).toBeVisible()

  /**
   * Y se espera al **runtime**, no sólo a que los controles se vean.
   *
   * Antes el barrera era `data-scroll-state`, que escribía el guion de la barra
   * pegajosa: mirar ese atributo probaba de paso que el montaje había corrido.
   * Con la barra quieta ese atributo ya no existe, y sin barrera el primer
   * `Enter` sobre el conmutador de tema tras una navegación del router llegaba
   * antes que su oyente —el botón tenía foco y no hacía nada—.
   *
   * El reloj sirve de acuse: lo escribe `mountBarWiring`, que va **el último**
   * de la tanda de `mountAll` en `UtilityBarRuntime.astro`. Si ya no pone
   * `--:--:--`, los cinco montajes de delante —tema incluido— están puestos.
   */
  await page.waitForFunction(() => {
    const controls = document.querySelector("[data-utility-controls]")
    if (!controls || getComputedStyle(controls).opacity !== "1") return false
    const clock = document.querySelector("[data-bar-clock]")
    return clock !== null && clock.textContent !== "--:--:--"
  })
}

/**
 * Abre el plegado del idioma, si lo está.
 *
 * En estrecho los tres idiomas viven en un panel: pulsarlos sin abrirlo primero
 * es pulsar algo con `visibility: hidden`. Hubo un segundo plegado, el «⋯» de
 * las vistas, hasta el 06-10-2026.
 */
export async function openBarMenu(page: Page, name: "locale"): Promise<void> {
  if (!isCompact(page)) return

  await openUtilityBar(page)
  const menu = page.locator(`[data-bar-menu="${name}"]`)
  const trigger = menu.locator("[data-bar-menu-trigger]")
  if (!(await trigger.isVisible())) return

  await trigger.click()
  await expect(menu).toHaveAttribute("data-menu-open", "")
}
