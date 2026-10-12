import { describe, expect, it } from "vitest"
import { isSameOrigin, readJsonBody } from "./request"

function requestWithHeaders(headers: HeadersInit): Request {
  return new Request("https://portfolio.example/api/test", { headers })
}

describe("isSameOrigin", () => {
  it.each([
    ["mismo origen", { origin: "https://portfolio.example" }, true],
    ["sin Origin", {}, true],
    ["origen null", { origin: "null" }, false],
    ["HTTP", { origin: "http://portfolio.example" }, false],
    ["puerto distinto", { origin: "https://portfolio.example:444" }, false],
    ["host distinto", { origin: "https://evil.example" }, false],
    ["Sec-Fetch-Site cross-site", { "sec-fetch-site": "cross-site" }, false],
  ])("%s", (_name, headers, expected) => {
    // Arrange
    const request = requestWithHeaders(headers)

    // Act
    const actual = isSameOrigin(request)

    // Assert
    expect(actual).toBe(expected)
  })
})

describe("readJsonBody", () => {
  it("acepta JSON dentro del límite", async () => {
    // Arrange
    const request = new Request("https://portfolio.example/api/test", {
      method: "POST",
      body: JSON.stringify({ value: "ok" }),
    })

    // Act
    const result = await readJsonBody(request, 128)

    // Assert
    expect(result).toEqual({ ok: true, value: { value: "ok" } })
  })

  it("rechaza Content-Length excesivo antes de leer", async () => {
    // Arrange
    const request = new Request("https://portfolio.example/api/test", {
      method: "POST",
      headers: { "content-length": "129" },
      body: "{}",
    })

    // Act
    const result = await readJsonBody(request, 128)

    // Assert
    expect(result).toEqual({ ok: false, error: "body_too_large" })
  })

  it("mide los bytes reales aunque no haya Content-Length", async () => {
    // Arrange
    const request = new Request("https://portfolio.example/api/test", {
      method: "POST",
      body: JSON.stringify({ value: "á".repeat(80) }),
    })

    // Act
    const result = await readJsonBody(request, 128)

    // Assert
    expect(result).toEqual({ ok: false, error: "body_too_large" })
  })

  it("distingue JSON inválido", async () => {
    // Arrange
    const request = new Request("https://portfolio.example/api/test", {
      method: "POST",
      body: "{",
    })

    // Act
    const result = await readJsonBody(request, 128)

    // Assert
    expect(result).toEqual({ ok: false, error: "bad_json" })
  })
})
