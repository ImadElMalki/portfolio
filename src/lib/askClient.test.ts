// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ASK_LIMITS } from "./ask"
import { anySignal, askStream, type AskFailure } from "./askClient"

/**
 * El cliente del flujo de `/api/ask`.
 *
 * Vivía dentro del cierre de `mountPortfolioConsole` y sólo se comprobaba de
 * refilón, desde el navegador, con la consola abierta. Ahora lo comparten el
 * terminal y el panel flotante: un fallo aquí rompe las dos entradas a la vez,
 * y ninguna de las dos lo diría con claridad.
 *
 * Lo que se mide es el análisis del flujo, que es lo delicado: los trozos de
 * red no respetan los límites de los eventos SSE.
 */

/** Un cuerpo SSE partido exactamente por donde se le diga. */
function bodyOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

function sse(...payloads: readonly object[]): string {
  return payloads.map((p) => `data: ${JSON.stringify(p)}\n`).join("")
}

interface Recorded {
  text: string[]
  done: { full: string; truncated: boolean }[]
  errors: AskFailure[]
  limits: number[]
}

function handlers(): {
  recorded: Recorded
  on: Parameters<typeof askStream>[1]
} {
  const recorded: Recorded = { text: [], done: [], errors: [], limits: [] }
  return {
    recorded,
    on: {
      onText: (delta) => recorded.text.push(delta),
      onDone: (full, { truncated }) => recorded.done.push({ full, truncated }),
      onError: (kind) => recorded.errors.push(kind),
      onLimit: (remaining) => recorded.limits.push(remaining),
    },
  }
}

const options = (signal: AbortSignal) => ({
  url: "/api/ask",
  locale: "es" as const,
  question: "¿qué usa?",
  history: [],
  signal,
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * Un doble de `Response` con cabeceras de verdad.
 *
 * Las llevaba sin ellas y bastó para tumbar seis pruebas en cuanto el cliente
 * empezó a leer `x-ratelimit-remaining`: `response.headers` era `undefined`,
 * el `.get` lanzaba y la excepción salía por el mismo camino que un fallo de
 * red. Un doble al que le falta lo que la pieza real siempre tiene no prueba
 * la pieza real.
 */
const ok = (
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): Response =>
  ({
    ok: true,
    status: 200,
    body,
    headers: new Headers(headers),
  }) as unknown as Response

describe("askStream", () => {
  it("entrega el texto por trozos y lo entero al terminar", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue(
      ok(bodyOf([sse({ text: "Usa " }, { text: "Astro." }), "data: [DONE]\n"])),
    )

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.text).toEqual(["Usa ", "Astro."])
    expect(recorded.done).toEqual([{ full: "Usa Astro.", truncated: false }])
    expect(recorded.errors).toEqual([])
  })

  /* Lo que de verdad rompe un analizador ingenuo: la red corta por donde
     quiere, y puede llegar medio `data:`. */
  it("aguanta un evento partido por la mitad", async () => {
    // Arrange
    const { recorded, on } = handlers()
    const whole = sse({ text: "media" }, { text: " palabra" })
    const cut = Math.floor(whole.length / 2)
    fetchMock.mockResolvedValue(
      ok(bodyOf([whole.slice(0, cut), whole.slice(cut)])),
    )

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.done[0]?.full).toBe("media palabra")
  })

  it("ignora una línea ilegible y sigue con el resto", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue(
      ok(bodyOf(["data: {no es json\n", sse({ text: "vale" })])),
    )

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.done[0]?.full).toBe("vale")
  })

  /* Cortada por longitud no es un fallo: la respuesta vale entera hasta donde
     cabía, y decirlo como error la haría parecer una avería. */
  it("marca la respuesta cortada por longitud sin tratarla como error", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue(
      ok(bodyOf([sse({ text: "hasta aquí" }, { truncated: true })])),
    )

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.done).toEqual([{ full: "hasta aquí", truncated: true }])
    expect(recorded.errors).toEqual([])
  })

  it("distingue el límite de peticiones del resto de fallos", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "x-ratelimit-remaining": "0" }),
    } as Response)

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.errors).toEqual(["askRateLimited"])
    expect(recorded.done).toEqual([])
  })

  it("distingue el techo diario de todos del cupo de quien pregunta", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers({ "retry-after": "3600" }),
      json: async () => ({ error: "daily_cap" }),
    } as Response)

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.errors).toEqual(["askDailyCap"])
  })

  it("da el endpoint por no disponible con cualquier otro estado", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response)

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.errors).toEqual(["askUnavailable"])
  })

  /* El fallo llegado a mitad de una respuesta que sí trae texto se avisa
   **además** de entregarla: lo escrito vale, pero se cortó. */
  it("entrega lo que llegó y avisa cuando el flujo falla a mitad", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue(
      ok(bodyOf([sse({ text: "empieza" }, { error: "upstream" })])),
    )

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.done).toEqual([{ full: "empieza", truncated: false }])
    expect(recorded.errors).toEqual(["askFailed"])
  })

  /* Abortar no es un fallo del que haya que avisar: quien aborta ya lo sabe, y
     el nodo donde se escribía puede haberse ido con la página. */
  it("se calla del todo cuando la petición se aborta", async () => {
    // Arrange
    const { recorded, on } = handlers()
    const controller = new AbortController()
    fetchMock.mockImplementation(() => {
      controller.abort()
      return Promise.reject(new DOMException("Aborted", "AbortError"))
    })

    // Act
    await askStream(options(controller.signal), on)

    // Assert
    expect(recorded.done).toEqual([])
    expect(recorded.errors).toEqual([])
  })

  it("avisa del uso por evento, sin conocer la analítica", async () => {
    // Arrange
    const seen = vi.fn()
    document.addEventListener("ask-used", seen)
    fetchMock.mockResolvedValue(ok(bodyOf([sse({ text: "sí" })])))

    // Act
    await askStream(options(new AbortController().signal), handlers().on)

    // Assert
    expect(seen).toHaveBeenCalledOnce()
    document.removeEventListener("ask-used", seen)
  })

  it("recorta el historial al techo antes de mandarlo", async () => {
    // Arrange
    fetchMock.mockResolvedValue(ok(bodyOf([sse({ text: "ya" })])))
    const excess = 4
    const history = Array.from(
      { length: ASK_LIMITS.history + excess },
      (_unused, index) => ({
        role: "user" as const,
        content: `turno ${index}`,
      }),
    )

    // Act
    await askStream(
      { ...options(new AbortController().signal), history },
      handlers().on,
    )

    // Assert
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { history: { content: string }[] }
    /* Contra la constante y no contra un 6 escrito a mano: el techo subió a
       doce al bajar el coste por turno, y una prueba que lo repite por su
       cuenta convierte ese cambio en un fallo rojo que no señala nada. */
    expect(body.history).toHaveLength(ASK_LIMITS.history)
    expect(body.history[0]?.content).toBe(`turno ${excess}`)
  })

  /* La cabecera es lo que permite avisar antes del 429 en vez de después. */
  it("entrega cuántas preguntas quedan cuando el endpoint lo dice", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue(
      ok(bodyOf([sse({ text: "sí" })]), { "x-ratelimit-remaining": "3" }),
    )

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.limits).toEqual([3])
  })

  /* `Number(null)` es 0, así que sin comprobar que la cabecera existe esto
     anunciaría «te quedan cero preguntas» en cada respuesta. */
  it("no inventa un cupo de cero cuando no viene la cabecera", async () => {
    // Arrange
    const { recorded, on } = handlers()
    fetchMock.mockResolvedValue(ok(bodyOf([sse({ text: "sí" })])))

    // Act
    await askStream(options(new AbortController().signal), on)

    // Assert
    expect(recorded.limits).toEqual([])
  })
})

describe("anySignal", () => {
  it("salta cuando salta cualquiera de los dos", () => {
    // Arrange
    const page = new AbortController()
    const question = new AbortController()
    const combined = anySignal([page.signal, question.signal])

    // Act
    question.abort()

    // Assert
    expect(combined.aborted).toBe(true)
    expect(page.signal.aborted).toBe(false)
  })

  it("ya viene abortada si uno lo estaba", () => {
    // Arrange
    const page = new AbortController()
    page.abort()

    // Act
    const combined = anySignal([page.signal, new AbortController().signal])

    // Assert
    expect(combined.aborted).toBe(true)
  })
})
