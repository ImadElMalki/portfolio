// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const askStreamMock = vi.hoisted(() => vi.fn())

/**
 * El cliente del flujo se sustituye entero.
 *
 * Lo que se prueba aquí es el panel —qué pinta, qué guarda y qué deja hacer—,
 * no cómo se lee un SSE: de eso responde `askClient.test.ts`. `anySignal` se
 * queda, porque parar depende de que los dos cortes se encadenen de verdad.
 */
vi.mock("./askClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./askClient")>()),
  askStream: askStreamMock,
}))

import { mountAskDock } from "./askDock"

let mount: AbortController

/** Doce grupos de cuatro, que es lo que `isAskQuestionSets` admite. */
const BANK = Array.from({ length: 12 }, (_, set) =>
  Array.from({ length: 4 }, (_, index) => `pregunta ${set}-${index}`),
)

const ACTIONS = {
  projects: [
    { name: "100 Cims", url: "/proyectos/100-cims/" },
    { name: "Race Hub", url: "/proyectos/race-hub/" },
  ],
  contact: "/#contact",
  cv: "/cv.pdf",
}

/** Los dos ficheros que pide el panel al abrirse; lo demás no se sirve. */
function serve(url: string): Promise<Response> {
  const body = url.includes("ask-actions") ? ACTIONS : BANK
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    }),
  )
}

function render(): { trigger: HTMLButtonElement } {
  document.body.innerHTML = `
    <div
      data-ask-dock
      data-locale="es"
      data-ask-url="/api/ask"
      data-ask-questions-url="/ask-questions/es.json"
    >
      <button type="button" data-ask-dock-trigger aria-expanded="false">
        Preguntar sobre Imad
      </button>
    </div>
  `
  return {
    trigger: document.querySelector<HTMLButtonElement>(
      "[data-ask-dock-trigger]",
    )!,
  }
}

/** Abre el panel y deja escrita una pregunta, que es el estado de partida. */
function open(question: string): {
  panel: HTMLDialogElement
  input: HTMLInputElement
  send: HTMLButtonElement
} {
  const { trigger } = render()
  mountAskDock(mount.signal)
  trigger.click()

  const panel = document.querySelector<HTMLDialogElement>(".ask-dock-panel")!
  const input = panel.querySelector<HTMLInputElement>(".ask-dock-input")!
  input.value = question
  return {
    panel,
    input,
    send: panel.querySelector<HTMLButtonElement>(".ask-dock-send")!,
  }
}

function lines(panel: HTMLDialogElement): string[] {
  return [...panel.querySelectorAll(".ask-dock-line")].map(
    (line) => line.textContent ?? "",
  )
}

beforeEach(() => {
  mount = new AbortController()
  window.sessionStorage.clear()
  vi.stubGlobal("fetch", vi.fn(serve))
  /* happy-dom no abre diálogos modales, y el panel se construye igual: lo único
     que hace `showModal` aquí es marcarlo abierto. */
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true
  }
})

afterEach(() => {
  mount.abort()
  vi.unstubAllGlobals()
  askStreamMock.mockReset()
})

describe("mountAskDock", () => {
  it("para la respuesta, conserva lo que había llegado y no lo guarda", async () => {
    // Arrange
    askStreamMock.mockImplementation(
      async (
        options: { signal: AbortSignal },
        handlers: { onText(delta: string, full: string): void },
      ) => {
        handlers.onText("Trabaja en ", "Trabaja en ")
        await new Promise<void>((resolve) => {
          options.signal.addEventListener("abort", () => resolve(), {
            once: true,
          })
        })
      },
    )
    const { panel, send } = open("¿Dónde trabaja?")

    // Act
    send.click()
    await vi.waitFor(() => {
      expect(lines(panel)).toContain("Trabaja en ")
    })
    send.click()

    // Assert
    await vi.waitFor(() => {
      expect(lines(panel)).toContain("(respuesta detenida)")
    })
    expect(lines(panel)).toContain("Trabaja en ")
    /* Lo parado no es una respuesta: no viaja en la siguiente pregunta. */
    expect(window.sessionStorage.getItem("portfolio:ask-turns")).toBeNull()
    expect(panel.querySelector(".ask-dock-line--live")).toBeNull()
  })

  it("«Nueva» borra la conversación pintada y la guardada", async () => {
    // Arrange
    askStreamMock.mockImplementation(
      async (
        _options: unknown,
        handlers: {
          onText(delta: string, full: string): void
          onDone(full: string, meta: { truncated: boolean }): void
        },
      ) => {
        handlers.onText("Angular y Java.", "Angular y Java.")
        handlers.onDone("Angular y Java.", { truncated: false })
      },
    )
    const { panel, send } = open("¿Qué tecnologías usa?")
    const restart = panel.querySelector<HTMLButtonElement>(".ask-dock-new")!

    // Act
    send.click()
    await vi.waitFor(() => {
      expect(restart.hidden).toBe(false)
    })
    restart.click()

    // Assert
    expect(lines(panel)).toEqual([])
    expect(window.sessionStorage.getItem("portfolio:ask-turns")).toBeNull()
    expect(restart.hidden).toBe(true)
  })

  it("ofrece reintentar un corte, y vuelve a preguntar lo mismo", async () => {
    // Arrange
    askStreamMock.mockImplementation(
      async (_options: unknown, handlers: { onError(kind: string): void }) => {
        handlers.onError("askFailed")
      },
    )
    const { panel, send } = open("¿Qué hace en VIEWNEXT?")

    // Act
    send.click()
    const retry = await vi.waitFor(() => {
      const button = panel.querySelector<HTMLButtonElement>(
        ".ask-dock-again button",
      )
      expect(button).not.toBeNull()
      return button!
    })
    retry.click()

    // Assert
    await vi.waitFor(() => {
      expect(askStreamMock).toHaveBeenCalledTimes(2)
    })
    expect(askStreamMock.mock.calls[1]?.[0]).toMatchObject({
      question: "¿Qué hace en VIEWNEXT?",
    })
  })

  it("no ofrece reintentar lo que no puede salir distinto", async () => {
    // Arrange
    askStreamMock.mockImplementation(
      async (_options: unknown, handlers: { onError(kind: string): void }) => {
        handlers.onError("askRateLimited")
      },
    )
    const { panel, send } = open("¿Qué hace en VIEWNEXT?")

    // Act
    send.click()

    // Assert
    await vi.waitFor(() => {
      expect(lines(panel)).toContain(
        "Demasiadas preguntas seguidas. Prueba dentro de un rato.",
      )
    })
    expect(panel.querySelector(".ask-dock-again")).toBeNull()
  })

  /**
   * Lo que convierte una respuesta en un clic.
   *
   * El modelo escribe texto plano y nombra los proyectos como figuran en el
   * expediente; el enlace lo pone el panel cotejando ese nombre. Si alguien
   * afloja el cotejo, esto no lo ve —pero sí lo ve la prueba de al lado—.
   */
  it("enlaza la ficha del proyecto que nombra la respuesta", async () => {
    // Arrange
    askStreamMock.mockImplementation(
      async (
        _options: unknown,
        handlers: {
          onText(delta: string, full: string): void
          onDone(full: string, meta: { truncated: boolean }): void
        },
      ) => {
        const answer = "En 100 Cims resolvió la sincronización sin conexión."
        handlers.onText(answer, answer)
        handlers.onDone(answer, { truncated: false })
      },
    )
    const { panel, send } = open("¿Qué proyecto enseña mejor su trabajo?")

    // Act
    send.click()

    // Assert
    const link = await vi.waitFor(() => {
      const anchor = panel.querySelector<HTMLAnchorElement>(".ask-dock-link")
      expect(anchor).not.toBeNull()
      return anchor!
    })
    expect(link.getAttribute("href")).toBe("/proyectos/100-cims/")
    expect(link.textContent).toBe("100 Cims")
    /* Sólo el que se ha nombrado: «Race Hub» está en la tabla y no en el texto. */
    expect(panel.querySelectorAll(".ask-dock-link")).toHaveLength(1)
  })

  it("no enlaza nada cuando la respuesta no nombra ningún proyecto", async () => {
    // Arrange
    askStreamMock.mockImplementation(
      async (
        _options: unknown,
        handlers: {
          onText(delta: string, full: string): void
          onDone(full: string, meta: { truncated: boolean }): void
        },
      ) => {
        const answer = "Trabaja con Angular y Java desde 2021."
        handlers.onText(answer, answer)
        handlers.onDone(answer, { truncated: false })
      },
    )
    const { panel, send } = open("¿Con qué trabaja?")

    // Act
    send.click()

    // Assert
    await vi.waitFor(() => {
      expect(lines(panel)).toContain("Trabaja con Angular y Java desde 2021.")
    })
    expect(panel.querySelector(".ask-dock-link")).toBeNull()
  })

  it("el pie lleva las dos salidas, y la pregunta dice desde dónde se hace", async () => {
    // Arrange
    askStreamMock.mockImplementation(async () => {})
    const { panel, send } = open("¿Puede encargarse de un proyecto entero?")

    // Assert: las salidas llegan con la tabla, antes de preguntar nada
    const ctas = await vi.waitFor(() => {
      const found = panel.querySelectorAll<HTMLAnchorElement>(".ask-dock-cta")
      expect(found).toHaveLength(2)
      return found
    })
    expect([...ctas].map((cta) => cta.getAttribute("href"))).toEqual([
      "/#contact",
      "/cv.pdf",
    ])

    // Act
    send.click()

    // Assert
    await vi.waitFor(() => {
      expect(askStreamMock).toHaveBeenCalled()
    })
    expect(askStreamMock.mock.calls[0]?.[0]).toMatchObject({
      path: window.location.pathname,
    })
  })

  it("tras responder propone dos preguntas más", async () => {
    // Arrange
    askStreamMock.mockImplementation(
      async (
        _options: unknown,
        handlers: { onDone(full: string, meta: { truncated: boolean }): void },
      ) => {
        handlers.onDone("Sí.", { truncated: false })
      },
    )
    const { panel, send } = open("¿Trabaja en remoto?")
    await vi.waitFor(() => {
      expect(panel.querySelectorAll(".ask-dock-suggestion")).toHaveLength(4)
    })

    // Act
    send.click()

    // Assert
    await vi.waitFor(() => {
      expect(panel.querySelectorAll(".ask-dock-suggestion")).toHaveLength(2)
    })
  })

  it("quien ha subido a releer no es arrastrado al final", async () => {
    // Arrange
    let push!: (full: string) => void
    askStreamMock.mockImplementation(
      async (
        options: { signal: AbortSignal },
        handlers: { onText(delta: string, full: string): void },
      ) => {
        push = (full) => handlers.onText(full, full)
        await new Promise<void>((resolve) => {
          options.signal.addEventListener("abort", () => resolve(), {
            once: true,
          })
        })
      },
    )
    const { panel, send } = open("Cuéntame su trayectoria")
    const answer = panel.querySelector<HTMLElement>(".ask-dock-answer")!
    const jump = panel.querySelector<HTMLButtonElement>(".ask-dock-jump")!
    /* happy-dom no maqueta, así que el desplazamiento se declara: una caja de
       200 px con 1 000 de contenido, mirando el principio. */
    Object.defineProperty(answer, "scrollHeight", { value: 1000 })
    Object.defineProperty(answer, "clientHeight", { value: 200 })

    // Act
    send.click()
    await vi.waitFor(() => {
      expect(askStreamMock).toHaveBeenCalled()
    })
    answer.scrollTop = 0
    answer.dispatchEvent(new Event("scroll"))
    push("Empezó en 2021.")

    // Assert
    expect(jump.hidden).toBe(false)
    expect(answer.scrollTop).toBe(0)

    // Act: la píldora devuelve al final
    jump.click()

    // Assert
    expect(jump.hidden).toBe(true)
    expect(answer.scrollTop).toBe(1000)
  })
})
