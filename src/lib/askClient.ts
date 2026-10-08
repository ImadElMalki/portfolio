import { ASK_LIMITS, type AskTurn } from "./ask"
import type { Locale } from "./locales"

/**
 * El cliente de `/api/ask`: pregunta y va entregando la respuesta según llega.
 *
 * Vivía dentro de `sendAsk`, en el cierre de `mountPortfolioConsole`, cuando la
 * consola era el único sitio desde el que se podía preguntar. Fueron dos
 * —la consola y el panel— hasta que la consola se fue el 06-10-2026, y queda
 * aparte del panel porque el formato del flujo lo decide `functions/api/ask.ts`
 * y se prueba sin DOM.
 *
 * Aquí no se toca el DOM. Quien llama decide dónde se pinta el texto; esto sólo
 * sabe pedir, leer el flujo y avisar. La única excepción es el aviso de uso, que
 * es un evento en `document` y no una llamada al contador: así ni este módulo ni
 * el panel saben que existe la analítica —lo escucha `hits.ts`—.
 */

/**
 * Qué puede salir mal. Son claves de `ui.ts`, listas para `t()`.
 *
 * `askDailyCap` no es `askRateLimited`: aquél es el techo diario de todos y éste
 * el cupo de quien pregunta. Decir «demasiadas preguntas seguidas» a quien no ha
 * hecho ninguna era culparle de algo que no ha hecho.
 */
export type AskFailure =
  "askUnavailable" | "askRateLimited" | "askDailyCap" | "askFailed"

export interface AskHandlers {
  /**
   * Un trozo más de respuesta.
   *
   * Llega el añadido y el total: quien pinta una línea que crece quiere el
   * total, y quien vaya a hacer otra cosa —medir, ir escribiendo— tiene el
   * añadido sin volver a diferenciar.
   */
  onText(delta: string, full: string): void
  /**
   * La respuesta ha terminado y hay texto. `truncated` no es un fallo: la
   * respuesta vale, sólo que llegó al techo de longitud.
   */
  onDone(full: string, meta: { truncated: boolean }): void
  /** No hay respuesta que pintar. Excluyente con `onDone`. */
  onError(kind: AskFailure): void
  /**
   * Cuántas preguntas le quedan a esta IP en la ventana en curso.
   *
   * Opcional porque no todo el mundo la pinta, y porque la cabecera sólo
   * aparece cuando el endpoint pudo consultar el limitador: si D1 está caído no
   * hay número que dar, y entonces esto sencillamente no se llama. Ver
   * `x-ratelimit-remaining` en `functions/api/ask.ts`.
   */
  onLimit?(remaining: number): void
}

export interface AskOptions {
  url: string
  locale: Locale
  question: string
  /** La memoria de la conversación; se recorta aquí, no en quien llama. */
  history: readonly AskTurn[]
  /**
   * Desde dónde se pregunta.
   *
   * Va tal cual sale de `location.pathname`; el endpoint la acepta o la tira
   * entera —ver `pickPath`—, porque acaba dentro del prompt. Sin ella el
   * asistente responde igual, sólo que sin saber qué se está mirando.
   */
  path?: string
  /**
   * Corta la petición.
   *
   * Quien llama encadena el de la página con el suyo, para que tanto navegar
   * como pulsar Ctrl+C acaben con la llamada al modelo. Sin esto, cambiar de
   * página en mitad de una respuesta dejaba la petición corriendo hasta el
   * final —y pagándose entera— para escribirla donde ya no hay nada.
   */
  signal: AbortSignal
}

/**
 * Pregunta y va entregando la respuesta.
 *
 * El cuerpo es SSE, pero se lee con un lector de flujo y no con `EventSource`:
 * aquél no admite `POST`, y la pregunta no cabe —ni debería ir— en la URL. El
 * formato es un objeto JSON por línea `data:`, que es lo mínimo que hace falta
 * para distinguir texto de error.
 *
 * Nunca lanza: un fallo sale por `onError`, y abortar no sale por ningún sitio
 * —quien aborta ya sabe que lo ha hecho—.
 */
export async function askStream(
  { url, locale, question, history, path, signal }: AskOptions,
  handlers: AskHandlers,
): Promise<void> {
  document.dispatchEvent(new CustomEvent("ask-used"))

  let answer = ""
  let failed: AskFailure | null = null
  let truncated = false

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        question,
        history: history.slice(-ASK_LIMITS.history),
        ...(path ? { path } : {}),
      }),
      signal,
    })

    /* Antes de mirar si ha ido bien: la cabecera viene también en el 429, y es
       justo ahí donde saber que quedan cero explica lo que acaba de pasar. */
    const header = response.headers.get("x-ratelimit-remaining")
    /* `Number(null)` es 0, así que sin comprobar antes que la cabecera existe
       esto anunciaría «te quedan cero preguntas» cada vez que no viniera. */
    if (header !== null) {
      const remaining = Number(header)
      if (Number.isInteger(remaining)) handlers.onLimit?.(remaining)
    }

    if (response.status === 429) failed = "askRateLimited"
    else if (!response.ok || !response.body) {
      /* El techo diario llega como 503 con su código: no es un fallo del
         asistente ni de quien pregunta, y se dice distinto. */
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      failed = body?.error === "daily_cap" ? "askDailyCap" : "askUnavailable"
    }

    if (!failed && response.body) {
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader()
      let buffer = ""

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (signal.aborted) {
          void reader.cancel()
          return
        }

        buffer += value
        /* Los trozos de red no respetan los límites de los eventos: puede
           llegar medio `data:`. Se corta por línea completa y lo que sobra
           espera al trozo siguiente. */
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const payload = line.slice(6)
          if (payload === "[DONE]") continue

          try {
            const chunk = JSON.parse(payload) as {
              text?: string
              error?: string
              truncated?: boolean
            }
            if (chunk.error) failed = "askFailed"
            if (chunk.truncated) truncated = true
            if (chunk.text) {
              answer += chunk.text
              handlers.onText(chunk.text, answer)
            }
          } catch {
            // Una línea ilegible se ignora: el resto del flujo sigue valiendo.
          }
        }
      }
    }
  } catch {
    /* Abortar entra por aquí —`fetch` lanza `AbortError`— y no es un fallo que
       haya que contar a nadie: quien abortó ya lo sabe, y el nodo donde se
       estaba escribiendo puede haberse ido con la página. */
    if (signal.aborted) return
    failed = "askUnavailable"
  }

  if (signal.aborted) return

  if (!answer) {
    handlers.onError(failed ?? "askUnavailable")
    return
  }

  handlers.onDone(answer, { truncated })
  /* El fallo llegado a mitad de una respuesta que sí trae texto se avisa
   **además** de entregarla: lo que hay escrito vale, pero se cortó. */
  if (failed) handlers.onError(failed)
}

/**
 * Un `AbortSignal` que salta cuando salte cualquiera de los dos.
 *
 * `AbortSignal.any` es lo que hace esto en una línea, y está en todos los
 * navegadores a los que llega el sitio; el respaldo es para quien no lo tenga
 * todavía, donde vale más una pregunta que no se puede cancelar que una que no
 * se puede hacer.
 */
export function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function")
    return AbortSignal.any([...signals])

  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      signal: controller.signal,
    })
  }
  return controller.signal
}
