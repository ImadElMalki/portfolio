import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import playwrightPackage from "@playwright/test/package.json" with { type: "json" }

/**
 * La imagen de los contenedores de la CI y la que usa `npm run test:visual` en
 * local tienen que ser la misma.
 *
 * Las capturas de referencia se comparan píxel a píxel, y el renderizado de
 * texto cambia entre imágenes: si la CI se queda en una versión y el script
 * local avanza con Playwright, las referencias dejan de valer en uno de los dos
 * sitios y el aviso llega como un fallo incomprensible.
 *
 * Hasta el 30-09-2026 el workflow llevaba la versión escrita a mano, con la
 * idea de que `container:` no admitía expresiones, y esta prueba comparaba ese
 * literal con el paquete. Sí las admite —`container.image` tiene disponible el
 * contexto `needs`—, así que ahora la versión sale del lockfile en el job
 * `versions` y lo que se vigila es que ningún contenedor vuelva al literal
 * (OPS-10).
 */
const { version } = playwrightPackage
const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const workflow = read("../../.github/workflows/ci.yml")

describe("imagen de las referencias visuales", () => {
  it("los contenedores de la CI toman la versión del job `versions`", () => {
    // Arrange
    const images = [...workflow.matchAll(/^\s*image:\s*(.+)$/gm)].map(
      ([, image]) => image?.trim(),
    )

    // Assert
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) {
      expect(image).toBe(
        "mcr.microsoft.com/playwright:v${{ needs.versions.outputs.playwright }}-noble",
      )
    }
  })

  it("el lockfile fija la misma versión que el paquete que usa `test:visual`", () => {
    // Arrange
    const lockfile = JSON.parse(read("../../package-lock.json")) as {
      packages: Record<string, { version?: string }>
    }

    // Assert
    expect(workflow).toContain(
      "packages['node_modules/@playwright/test'].version",
    )
    expect(lockfile.packages["node_modules/@playwright/test"]?.version).toBe(
      version,
    )
  })
})
