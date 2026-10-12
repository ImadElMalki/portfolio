// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mountThemeToggle } from "./themeToggle"

let reducedMotion = false

type StartViewTransition = NonNullable<Document["startViewTransition"]>
type ViewTransition = ReturnType<StartViewTransition>

interface ThemeFixture {
  button: HTMLButtonElement
  setTheme: ReturnType<typeof vi.fn>
}

function renderThemeToggle(): ThemeFixture {
  document.body.innerHTML = `
    <button
      type="button"
      data-theme-toggle
      data-label-dark="Switch to dark"
      data-label-light="Switch to light"
      aria-label="Switch to dark"
      aria-pressed="false"
      title="Switch to dark"
    >
      <svg class="sun"></svg>
      <svg class="moon"></svg>
    </button>
  `
  document.documentElement.dataset.theme = "light"

  const button = document.querySelector<HTMLButtonElement>(
    "[data-theme-toggle]",
  )
  if (!button) throw new Error("Theme toggle fixture was not rendered")

  const setTheme = vi.fn((theme: "auto" | "dark" | "light") => {
    const resolved = theme === "auto" ? "light" : theme
    document.documentElement.dataset.theme = resolved
    document.dispatchEvent(new CustomEvent("theme-changed"))
  })

  window.theme = {
    setTheme,
    getTheme: () => "light",
    getSystemTheme: () => "light",
  }

  return { button, setTheme }
}

function installDocumentAnimation(): {
  animateDocument: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
} {
  const cancel = vi.fn()
  const animateDocument = vi.fn(() => ({
    cancel,
    finished: Promise.resolve(),
  }))
  Object.defineProperty(document.documentElement, "animate", {
    configurable: true,
    value: animateDocument,
  })
  return { animateDocument, cancel }
}

function installViewTransition({
  ready = Promise.resolve(),
  finished = Promise.resolve(),
}: Partial<Pick<ViewTransition, "ready" | "finished">> = {}): {
  startViewTransition: ReturnType<typeof vi.fn<StartViewTransition>>
  skipTransition: ReturnType<typeof vi.fn>
} {
  const skipTransition = vi.fn()
  const implementation: StartViewTransition = (callbackOptions) => {
    const callback =
      typeof callbackOptions === "function"
        ? callbackOptions
        : callbackOptions?.update
    const updateCallbackDone = Promise.resolve(callback?.()).then(
      () => undefined,
    )
    return {
      finished,
      ready,
      skipTransition,
      types: new Set<string>(),
      updateCallbackDone,
    }
  }
  const startViewTransition = vi.fn<StartViewTransition>(implementation)
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: startViewTransition,
  })
  return { startViewTransition, skipTransition }
}

describe("theme toggle", () => {
  beforeEach(() => {
    reducedMotion = false
    delete document.documentElement.dataset.theme
    document.documentElement.className = ""
    document.documentElement.style.cssText = ""
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({ matches: reducedMotion })),
    })
    // happy-dom no maqueta: sin esto el viewport mide 0 y el origen del revelado,
    // que va en porcentajes, sale NaN.
    for (const [property, size] of [
      ["clientWidth", 1280],
      ["clientHeight", 900],
    ] as const) {
      Object.defineProperty(document.documentElement, property, {
        configurable: true,
        get: () => size,
      })
    }
    installDocumentAnimation()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("uses a view transition and restores the interactive state", async () => {
    const { button, setTheme } = renderThemeToggle()
    const { startViewTransition } = installViewTransition()
    const controller = new AbortController()
    mountThemeToggle(controller.signal)

    button.click()

    await vi.waitFor(() => expect(button.disabled).toBe(false))
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(setTheme).toHaveBeenCalledWith("dark")
    expect(button.getAttribute("aria-pressed")).toBe("true")
    expect(button.getAttribute("aria-label")).toBe("Switch to light")
    expect(document.documentElement.classList).not.toContain(
      "theme-transitioning",
    )
    // En porcentajes, no en píxeles: Chrome Android resuelve los px absolutos de
    // la `clip-path` del pseudoelemento en píxeles de dispositivo.
    const style = document.documentElement.style
    expect(style.getPropertyValue("--theme-reveal-x")).toMatch(/^[\d.]+%$/)
    expect(style.getPropertyValue("--theme-reveal-y")).toMatch(/^[\d.]+%$/)
  })

  it("falls back to a document fade without View Transitions", async () => {
    const { button, setTheme } = renderThemeToggle()
    const { animateDocument } = installDocumentAnimation()
    const controller = new AbortController()
    mountThemeToggle(controller.signal)

    button.click()

    await vi.waitFor(() => expect(button.disabled).toBe(false))
    expect(setTheme).toHaveBeenCalledWith("dark")
    expect(animateDocument).toHaveBeenCalledTimes(1)
    expect(button.getAttribute("title")).toBe("Switch to light")
  })

  it("uses the fade when the browser discards the view transition", async () => {
    const { button } = renderThemeToggle()
    const { animateDocument } = installDocumentAnimation()
    installViewTransition({ ready: Promise.reject(new Error("discarded")) })
    const controller = new AbortController()
    mountThemeToggle(controller.signal)

    button.click()

    await vi.waitFor(() => expect(button.disabled).toBe(false))
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(animateDocument).toHaveBeenCalledTimes(1)
    expect(document.documentElement.classList).not.toContain(
      "theme-transitioning",
    )
  })

  it("changes immediately without animation when motion is reduced", () => {
    reducedMotion = true
    const { button, setTheme } = renderThemeToggle()
    const { animateDocument } = installDocumentAnimation()
    const { startViewTransition } = installViewTransition()
    const controller = new AbortController()
    mountThemeToggle(controller.signal)

    button.click()

    expect(setTheme).toHaveBeenCalledWith("dark")
    expect(startViewTransition).not.toHaveBeenCalled()
    expect(animateDocument).not.toHaveBeenCalled()
    expect(button.disabled).toBe(false)
  })

  it("supports repeated light and dark changes", async () => {
    const { button, setTheme } = renderThemeToggle()
    installViewTransition()
    const controller = new AbortController()
    mountThemeToggle(controller.signal)

    button.click()
    await vi.waitFor(() => expect(button.disabled).toBe(false))
    button.click()
    await vi.waitFor(() => expect(setTheme).toHaveBeenCalledTimes(2))

    expect(document.documentElement.dataset.theme).toBe("light")
    expect(button.getAttribute("aria-pressed")).toBe("false")
    expect(button.getAttribute("aria-label")).toBe("Switch to dark")
  })

  it("cleans up an active transition when the page is aborted", async () => {
    const { button } = renderThemeToggle()
    const never = new Promise<void>(() => undefined)
    const { skipTransition } = installViewTransition({
      ready: never,
      finished: never,
    })
    const controller = new AbortController()
    mountThemeToggle(controller.signal)
    button.click()

    controller.abort()

    expect(skipTransition).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(false)
    expect(document.documentElement.classList).not.toContain(
      "theme-transitioning",
    )
  })
})
