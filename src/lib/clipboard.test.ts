// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { copyToClipboard } from "./clipboard"

/**
 * `navigator.clipboard` es de sólo lectura, así que se sustituye por definición
 * de propiedad. happy-dom trae uno que funciona, de modo que el caso de «no hay
 * API» hay que provocarlo poniéndolo a `undefined` a propósito.
 *
 * Los cuatro caminos que importan: hay API y funciona, hay API y rechaza, no
 * hay API, y hay un objeto sin `writeText` —que es el que tira `TypeError` si
 * no se comprueba—.
 */
const originalClipboard = navigator.clipboard

const setClipboard = (value: unknown): void => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  })
}

afterEach(() => {
  setClipboard(originalClipboard)
})

describe("copyToClipboard", () => {
  it("copia y lo confirma", async () => {
    // Arrange
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })

    // Act
    const copied = await copyToClipboard("hola@ejemplo.com")

    // Assert
    expect(copied).toBe(true)
    expect(writeText).toHaveBeenCalledWith("hola@ejemplo.com")
  })

  /* El permiso denegado es un rechazo, no una excepción síncrona: quien llama
     tiene que poder ofrecer su reserva sin envolver la llamada en un `try`. */
  it("devuelve falso si el navegador rechaza la escritura", async () => {
    // Arrange
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) })

    // Act and assert
    await expect(copyToClipboard("texto")).resolves.toBe(false)
  })

  it("devuelve falso sin API de portapapeles", async () => {
    // Arrange — es lo que pasa fuera de un contexto seguro.
    setClipboard(undefined)

    // Act and assert
    await expect(copyToClipboard("texto")).resolves.toBe(false)
  })

  /* Hay entornos que exponen `clipboard` sin `writeText`. Llamarlo a ciegas
     tira un `TypeError` en vez de devolver un rechazo, y eso sí se escaparía. */
  it("devuelve falso si el objeto existe pero no tiene writeText", async () => {
    // Arrange
    setClipboard({})

    // Act and assert
    await expect(copyToClipboard("texto")).resolves.toBe(false)
  })
})
