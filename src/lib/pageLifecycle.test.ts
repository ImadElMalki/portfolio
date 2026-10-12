// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onPageLoad } from "./pageLifecycle"
import { mountPrintableDetails } from "./printableDetails"
import { mountThemeToggle } from "./themeToggle"

function renderControls(): void {
  document.body.innerHTML = `
    <main>
      Web
      <details class="job-details"><summary>Job</summary><p>x</p></details>
    </main>
  `
}

/** Simula un documento que todavía se está analizando. */
function whileLoading(): () => void {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  })
  return () => {
    Reflect.deleteProperty(document, "readyState")
  }
}

describe("onPageLoad", () => {
  it("monta una vez y en el acto, con una señal viva", () => {
    // Arrange
    const init = vi.fn<(signal: AbortSignal) => void>()

    // Act
    const dispose = onPageLoad(init)

    // Assert
    expect(init).toHaveBeenCalledTimes(1)
    expect(init.mock.calls[0]?.[0].aborted).toBe(false)
    dispose()
  })

  it("espera a DOMContentLoaded si el documento aún se analiza", () => {
    // Arrange
    const restore = whileLoading()
    const init = vi.fn()

    try {
      // Act
      const dispose = onPageLoad(init)
      const beforeReady = init.mock.calls.length
      document.dispatchEvent(new Event("DOMContentLoaded"))

      // Assert
      expect(beforeReady).toBe(0)
      expect(init).toHaveBeenCalledTimes(1)
      dispose()
    } finally {
      restore()
    }
  })

  it("no monta nada si se desmonta antes de DOMContentLoaded", () => {
    // Arrange
    const restore = whileLoading()
    const init = vi.fn()

    try {
      // Act
      onPageLoad(init)()
      document.dispatchEvent(new Event("DOMContentLoaded"))

      // Assert
      expect(init).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})

describe("los montajes de la portada", () => {
  beforeEach(() => {
    renderControls()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /* Desde el 06-10-2026 la portada ya no monta el conmutador de vistas ni la
     vista Markdown; de los que se probaban aquí queda el de los desplegables
     al imprimir, que es además el que cuelga oyentes de `window`. */
  it("funcionan montados y se sueltan de window al desmontar", () => {
    // Arrange
    const jobDetails = () =>
      document.querySelector<HTMLDetailsElement>("details.job-details")

    // Act
    const dispose = onPageLoad((signal) => {
      mountPrintableDetails(signal)
    })

    // Assert
    window.dispatchEvent(new Event("beforeprint"))
    expect(jobDetails()?.open).toBe(true)
    window.dispatchEvent(new Event("afterprint"))
    expect(jobDetails()?.open).toBe(false)

    /* Desmontar suelta lo que colgaba de `window`: `printableDetails` registra
       allí sus oyentes, que es lo que de verdad puede quedarse colgado. */
    dispose()
    window.dispatchEvent(new Event("beforeprint"))
    expect(jobDetails()?.open).toBe(false)
  })

  it("el conmutador de tema responde montado y deja de hacerlo al desmontar", () => {
    // Arrange
    document.body.innerHTML = `
      <header class="utility-bar" data-utility-bar>
        <div class="control-groups" id="view-preferences-controls" data-utility-controls>
          <button
            data-theme-toggle
            data-label-dark="Switch to dark"
            data-label-light="Switch to light"
            aria-pressed="false"
          ><svg class="sun"></svg><svg class="moon"></svg></button>
        </div>
      </header>
    `
    const setTheme = vi.fn((theme: "auto" | "dark" | "light") => {
      document.documentElement.dataset.theme =
        theme === "auto" ? "light" : theme
      document.dispatchEvent(new CustomEvent("theme-changed"))
    })
    window.theme = {
      setTheme,
      getTheme: () => "light",
      getSystemTheme: () => "light",
    }
    /* El doble mira **qué** se le pregunta, y lleva los dos `*EventListener`:
       responder `matches: true` a cualquier consulta valía mientras el único
       interesado era `prefers-reduced-motion`. */
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    document.documentElement.dataset.theme = "light"
    const toggle = () =>
      document.querySelector<HTMLButtonElement>("[data-theme-toggle]")

    // Act
    const dispose = onPageLoad(mountThemeToggle)
    toggle()?.click()
    const whileMounted = setTheme.mock.calls.length
    dispose()
    toggle()?.click()

    // Assert
    expect(whileMounted).toBe(1)
    expect(setTheme).toHaveBeenCalledTimes(1)
  })
})
