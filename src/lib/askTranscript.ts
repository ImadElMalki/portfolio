import { ASK_LIMITS, type AskTurn } from "./ask"

/**
 * La conversación, guardada fuera de la página.
 *
 * El panel del asistente está en todas las páginas, y su memoria vivía dentro
 * de un cierre que muere con cada una: navegar a «Sobre mí» borraba lo que se
 * había preguntado en la portada. Hasta el 06-10-2026 la compartía además con
 * la vista consola, que también preguntaba.
 *
 * En `sessionStorage` y no en `localStorage`: es el ámbito que corresponde —lo
 * que se ha preguntado en esta pestaña— y así no queda nada escrito de una
 * visita para la siguiente. Es también lo que evita que una conversación con datos de quien
 * pregunta sobreviva a cerrar el navegador.
 *
 * Se recorta a `ASK_LIMITS.history` al leer y al escribir. No es una precaución
 * de más: es el mismo techo que aplica el endpoint, y guardar más sería guardar
 * lo que nunca se va a mandar.
 */

const KEY = "portfolio:ask-turns"

function isTurn(value: unknown): value is AskTurn {
  if (!value || typeof value !== "object") return false
  const turn = value as Record<string, unknown>
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string"
  )
}

/**
 * Lo guardado, o nada.
 *
 * Nunca lanza y nunca devuelve algo a medio validar: lo que hay ahí lo puede
 * haber escrito cualquiera —es almacenamiento del navegador— y de aquí sale
 * directo a una petición que se paga. Un solo turno con mala forma tira la
 * lectura entera en vez de colarse.
 */
export function readTurns(): AskTurn[] {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isTurn)) return []
    return parsed.slice(-ASK_LIMITS.history)
  } catch {
    /* Hay navegadores que bloquean `sessionStorage`, y un JSON roto entra por
       aquí también. Sin memoria se pregunta igual: se pierde el contexto entre
       vistas, no la capacidad de preguntar. */
    return []
  }
}

/**
 * Olvida la conversación.
 *
 * Es lo que hace «Nueva»: sin esto, vaciar la lista en memoria dejaba los
 * turnos escritos, y bastaba cambiar de página para que volvieran —el panel los
 * lee al montar—. Borrar la clave y no escribir `[]` es la misma diferencia de
 * siempre: lo que no está no ocupa ni hay que validarlo al leerlo.
 */
export function clearTurns(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // Si no se pudo escribir tampoco se pudo guardar nada que borrar.
  }
}

export function writeTurns(turns: readonly AskTurn[]): void {
  try {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify(turns.slice(-ASK_LIMITS.history)),
    )
  } catch {
    // La copia en memoria de quien llama sigue viva mientras dure el montaje.
  }
}
