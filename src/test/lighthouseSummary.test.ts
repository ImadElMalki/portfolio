import { describe, expect, it } from "vitest"
import {
  medianByLcp,
  medianOf,
  summarizeReport,
} from "../../scripts/lighthouse-summary.mjs"

/**
 * El resumen que imprime `test:lighthouse`, contra un informe mínimo con la
 * forma de Lighthouse 13: si una versión nueva mueve el desglose del LCP o los
 * tiempos observados, esto falla aquí y no en silencio en la CI.
 */

interface RequestShape {
  url: string
  resourceType: string
  transferSize: number
  networkRequestTime: number
}

function request(overrides: Partial<RequestShape> = {}): RequestShape {
  return {
    url: "https://imadelmalki.com/_astro/a.js",
    resourceType: "Script",
    transferSize: 2048,
    networkRequestTime: 100,
    ...overrides,
  }
}

function report({
  requests = [request()],
  observedFcp = 500,
  lcpMs = 2_400,
}: {
  requests?: RequestShape[]
  observedFcp?: number
  lcpMs?: number
} = {}) {
  const category = (score: number, auditRefs: { id: string }[] = []) => ({
    score,
    auditRefs,
  })
  return {
    categories: {
      performance: category(0.94),
      accessibility: category(1),
      "best-practices": category(1, [{ id: "is-on-https" }]),
      seo: category(1),
    },
    audits: {
      "is-on-https": { id: "is-on-https", score: 1 },
      "network-requests": { details: { items: requests } },
      metrics: {
        details: {
          items: [
            {
              observedFirstContentfulPaint: observedFcp,
              observedLargestContentfulPaint: observedFcp + 40,
            },
          ],
        },
      },
      "first-contentful-paint": { numericValue: 2_200 },
      "largest-contentful-paint": { numericValue: lcpMs },
      "speed-index": { numericValue: 2_300 },
      "cumulative-layout-shift": { numericValue: 0.008 },
      "total-blocking-time": { numericValue: 0 },
      "lcp-breakdown-insight": {
        details: {
          type: "list",
          items: [
            {
              type: "table",
              items: [
                { subpart: "timeToFirstByte", duration: 210.4 },
                { subpart: "resourceLoadDelay", duration: 220.6 },
                { subpart: "resourceLoadDuration", duration: 80 },
                { subpart: "elementRenderDelay", duration: 240 },
              ],
            },
            {
              type: "node",
              selector: "div.hero > figure.portrait > picture > img",
            },
          ],
        },
      },
      "render-blocking-insight": {
        details: {
          items: [
            {
              url: "https://imadelmalki.com/_astro/Layout.css",
              totalBytes: 11_571,
              wastedMs: 750.2,
            },
          ],
        },
      },
    },
  }
}

describe("summarizeReport", () => {
  it("lee el desglose del LCP y su elemento", () => {
    // Act
    const summary = summarizeReport(report())

    // Assert
    expect(summary.lcpElement).toBe(
      "div.hero > figure.portrait > picture > img",
    )
    expect(summary.lcpPhasesMs).toEqual({
      timeToFirstByte: 210,
      resourceLoadDelay: 221,
      resourceLoadDuration: 80,
      elementRenderDelay: 240,
    })
  })

  it("agrupa por tipo lo que empezó antes del primer pintado observado", () => {
    // Arrange
    const requests = [
      request({ resourceType: "Font", transferSize: 25_600 }),
      request({ resourceType: "Font", transferSize: 25_600 }),
      request({ resourceType: "Script", transferSize: 5_120 }),
      request({ resourceType: "Image", networkRequestTime: 900 }),
    ]

    // Act
    const summary = summarizeReport(report({ requests, observedFcp: 500 }))

    // Assert
    expect(summary.beforeFcp).toEqual({
      Font: { count: 2, kib: 50 },
      Script: { count: 1, kib: 5 },
    })
  })

  it("quita el origen de las hojas que bloquean el pintado", () => {
    // Act
    const summary = summarizeReport(report())

    // Assert
    expect(summary.renderBlocking).toEqual([
      { url: "/_astro/Layout.css", kib: 11.3, ms: 750 },
    ])
  })
})

describe("medianByLcp", () => {
  it.each([
    ["tres tandas: la del medio", [2_164, 2_773, 2_251], 2_251],
    ["dos tandas: la más lenta de las centrales", [2_400, 2_600], 2_600],
    ["una tanda: ésa", [3_034], 3_034],
  ])("%s", (_name, lcps, expected) => {
    // Arrange
    const summaries = lcps.map((lcpMs) => ({ lcpMs }))

    // Act
    const median = medianByLcp(summaries)

    // Assert
    expect(median.lcpMs).toBe(expected)
  })

  it("se niega a elegir sin tandas", () => {
    // Act + Assert
    expect(() => medianByLcp([])).toThrow("sin tandas")
  })
})

describe("medianOf", () => {
  it.each([
    ["un pico de TBT en una tanda no cuenta", [244, 35, 0], 35],
    ["dos tandas: la peor de las centrales", [20, 90], 90],
    ["una tanda: ésa", [120], 120],
  ])("%s", (_name, values, expected) => {
    // Arrange
    const summaries = values.map((tbtMs) => ({ tbtMs }))

    // Act
    const median = medianOf(summaries, (summary) => summary.tbtMs)

    // Assert
    expect(median).toBe(expected)
  })

  it("se niega a calcular sin tandas", () => {
    // Act + Assert
    expect(() => medianOf([], () => 0)).toThrow("sin tandas")
  })
})
