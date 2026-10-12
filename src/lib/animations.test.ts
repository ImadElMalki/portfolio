// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { revealSequence, toMilliseconds } from "./animations"

/**
 * La entrada escalonada sin librería: lo que antes resolvía Motion —el muelle
 * y el escalonado— ahora sale del CSS y de `element.animate()`, y esto fija
 * que lo haga igual.
 */

const SPRING_CURVE = "linear(0, 0.5, 1)"

let reducedMotion = false
let curveSupported = true

interface Animated {
  element: HTMLElement
  animate: ReturnType<typeof vi.fn<Element["animate"]>>
}

function animated(): Animated {
  const element = document.createElement("div")
  const animate = vi.fn<Element["animate"]>()
  element.animate = animate
  return { element, animate }
}

beforeEach(() => {
  reducedMotion = false
  curveSupported = true
  document.documentElement.style.setProperty("--ease-spring", SPRING_CURVE)
  document.documentElement.style.setProperty("--spring-duration", "550ms")
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reducedMotion })),
  )
  vi.stubGlobal("CSS", { supports: vi.fn(() => curveSupported) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute("style")
})

describe("revealSequence", () => {
  it("funde cada elemento con el muelle de la casa, 40 ms detrás del anterior", () => {
    // Arrange
    const items = [animated(), animated(), animated()]

    // Act
    revealSequence(items.map((item) => item.element))

    // Assert
    items.forEach((item, index) => {
      expect(item.animate).toHaveBeenCalledWith(
        { opacity: [0, 1] },
        {
          duration: 550,
          easing: SPRING_CURVE,
          delay: index * 40,
          fill: "backwards",
        },
      )
    })
  })

  it("no anima nada con movimiento reducido", () => {
    // Arrange
    reducedMotion = true
    const item = animated()

    // Act
    revealSequence([item.element])

    // Assert
    expect(item.animate).not.toHaveBeenCalled()
  })

  it("lee la duración minificada en segundos", () => {
    // Arrange: el minificador escribe `550ms` como `.55s`.
    document.documentElement.style.setProperty("--spring-duration", ".55s")
    const item = animated()

    // Act
    revealSequence([item.element])

    // Assert
    expect(item.animate).toHaveBeenCalledWith(
      { opacity: [0, 1] },
      expect.objectContaining({ duration: 550 }),
    )
  })

  it("cae a ease-out si el navegador no entiende la curva", () => {
    // Arrange
    curveSupported = false
    const item = animated()

    // Act
    revealSequence([item.element])

    // Assert
    expect(item.animate).toHaveBeenCalledWith(
      { opacity: [0, 1] },
      expect.objectContaining({ easing: "ease-out" }),
    )
  })
})

describe("toMilliseconds", () => {
  it.each([
    ["550ms", 550],
    [".55s", 550],
    ["0.2s", 200],
    [" 90ms ", 90],
  ])("%s son %i ms", (value, expected) => {
    // Act + Assert
    expect(toMilliseconds(value)).toBe(expected)
  })

  it.each(["", "auto", "550"])("rechaza %j", (value) => {
    // Act + Assert
    expect(toMilliseconds(value)).toBeUndefined()
  })
})
