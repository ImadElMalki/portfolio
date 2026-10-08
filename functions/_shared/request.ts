export const API_BODY_LIMITS = {
  ask: 64 * 1024,
  contact: 16 * 1024,
  hit: 2 * 1024,
} as const

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: "bad_json" | "body_too_large" }

/**
 * El origen de un navegador debe coincidir entero: protocolo, host y puerto.
 * La ausencia de `Origin` se conserva para diagnósticos con curl; `null` y la
 * señal explícita de navegación entre sitios se rechazan.
 */
export function isSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false

  const origin = request.headers.get("origin")
  if (!origin) return true
  if (origin === "null") return false

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

/** Lee y analiza un JSON pequeño sin confiar únicamente en Content-Length. */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const declared = request.headers.get("content-length")
  if (declared !== null) {
    const bytes = Number(declared)
    if (Number.isFinite(bytes) && bytes > maxBytes) {
      return { ok: false, error: "body_too_large" }
    }
  }

  const body = request.body
  if (!body) return { ok: false, error: "bad_json" }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel("body_too_large")
        return { ok: false, error: "body_too_large" }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, error: "bad_json" }
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return { ok: false, error: "bad_json" }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
