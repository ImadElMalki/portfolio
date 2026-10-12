/**
 * Lo que importa de un informe de Lighthouse, y por qué tarda lo que tarda.
 *
 * Aparte de `lighthouse-docker.mjs` para poder probarlo sin Docker: aquél lanza
 * el contenedor nada más importarse. Lee la forma de Lighthouse 13: el desglose
 * del LCP vive en el *insight* `lcp-breakdown-insight` y lo que bloquea el
 * pintado en `render-blocking-insight`.
 */

const kib = (bytes) => Math.round((bytes / 1024) * 10) / 10

/** @param {any} report Un informe JSON de Lighthouse. */
export function summarizeReport(report) {
  const audits = report.audits
  const requests = audits["network-requests"].details.items
  const metrics = audits.metrics.details.items[0]
  const bestPracticeFailures = report.categories["best-practices"].auditRefs
    .map(({ id }) => audits[id])
    .filter(
      (audit) =>
        audit &&
        audit.scoreDisplayMode !== "notApplicable" &&
        audit.score !== null &&
        audit.score < 1,
    )
    .map(({ id }) => id)

  /* Lo que ya se estaba descargando cuando se pintó por primera vez, con los
     tiempos observados (sin estrangular). Es lo que el modelo de Lighthouse
     reparte después con la red estrangulada, y lo que compite con la imagen
     LCP por el ancho de banda. */
  const observedFcp = metrics.observedFirstContentfulPaint
  const beforeFcpBytes = {}
  for (const request of requests) {
    if (request.networkRequestTime > observedFcp) continue
    const type = request.resourceType ?? "Other"
    beforeFcpBytes[type] ??= { count: 0, bytes: 0 }
    beforeFcpBytes[type].count += 1
    beforeFcpBytes[type].bytes += request.transferSize ?? 0
  }

  const breakdown = audits["lcp-breakdown-insight"]?.details?.items ?? []
  const phases = breakdown.find((item) => item.type === "table")?.items ?? []
  const node = breakdown.find((item) => item.type === "node")

  return {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    bestPractices: Math.round(report.categories["best-practices"].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    fcpMs: Math.round(audits["first-contentful-paint"].numericValue),
    lcpMs: Math.round(audits["largest-contentful-paint"].numericValue),
    speedIndexMs: Math.round(audits["speed-index"].numericValue),
    cls: audits["cumulative-layout-shift"].numericValue,
    tbtMs: Math.round(audits["total-blocking-time"].numericValue),
    requests: requests.length,
    transferKiB: kib(
      requests.reduce(
        (total, request) => total + (request.transferSize ?? 0),
        0,
      ),
    ),
    bestPracticeFailures,
    observed: {
      fcpMs: Math.round(observedFcp),
      lcpMs: Math.round(metrics.observedLargestContentfulPaint),
    },
    lcpElement: node?.selector ?? null,
    lcpPhasesMs: Object.fromEntries(
      phases.map((phase) => [phase.subpart, Math.round(phase.duration)]),
    ),
    renderBlocking:
      audits["render-blocking-insight"]?.details?.items?.map((item) => ({
        url: String(item.url).replace(/^https?:\/\/[^/]+/, ""),
        kib: kib(item.totalBytes ?? 0),
        ms: Math.round(item.wastedMs ?? 0),
      })) ?? [],
    beforeFcp: Object.fromEntries(
      Object.entries(beforeFcpBytes).map(([type, { count, bytes }]) => [
        type,
        { count, kib: kib(bytes) },
      ]),
    ),
  }
}

/**
 * La mediana de una métrica sobre todas las tandas, cada una por su cuenta.
 *
 * Para el TBT y el CLS no vale el valor de la tanda mediana por LCP: un pico
 * de CPU en esa tanda —el 01-10-2026, 244 ms de TBT en una de tres, con 35 y 0
 * en las otras— suspendería el presupuesto sin que el sitio hubiera cambiado.
 * Con un número par de tandas, la peor de las dos centrales, como en
 * `medianByLcp`.
 *
 * @template T
 * @param {T[]} summaries
 * @param {(summary: T) => number} metric
 * @returns {number}
 */
export function medianOf(summaries, metric) {
  if (summaries.length === 0) throw new Error("sin tandas de Lighthouse")
  const values = summaries.map(metric).sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]
}

/**
 * La tanda mediana por LCP. Con un número par de tandas, la más lenta de las
 * dos centrales: el presupuesto no debe aprobar por redondear a favor.
 *
 * @template {{ lcpMs: number }} T
 * @param {T[]} summaries
 * @returns {T}
 */
export function medianByLcp(summaries) {
  if (summaries.length === 0) throw new Error("sin tandas de Lighthouse")
  const sorted = [...summaries].sort((a, b) => a.lcpMs - b.lcpMs)
  return sorted[Math.floor(sorted.length / 2)]
}
