import { copyToClipboard } from "./clipboard"
import { pulseGlyph } from "./glyph"

/**
 * El chip de correo copia la dirección en vez de abrir el cliente.
 *
 * Abrir el gestor de correo del sistema es la peor de las opciones probables:
 * mucha gente lee el correo en una pestaña y un `mailto:` le lanza una
 * aplicación que no usa —o ninguna—. Lo que casi siempre se quería era la
 * dirección.
 *
 * ## Pero sigue siendo un enlace
 *
 * El nodo no cambia: es el mismo `<a href="mailto:…">`. Sólo se intercepta el
 * clic primario y sin modificadores, así que `Ctrl`/`Cmd`/`Shift`, el clic
 * central y «copiar dirección de enlace» siguen haciendo lo de siempre, el
 * `href` sigue en el HTML servido y quien prefiera su cliente de correo lo
 * tiene a un modificador. Si el portapapeles no está disponible no se llama a
 * `preventDefault` y el enlace hace su trabajo de toda la vida: la reserva es no
 * hacer nada.
 *
 * ## Sin toast
 *
 * El aviso sale en la propia fila y se va solo a los 1,5 s. Es la regla del
 * sistema —los estados se dicen en línea, `[COPIADO]`, y no en una ventanita
 * flotante— y aquí además evita mover nada de sitio.
 */
const FEEDBACK_MS = 1500

/**
 * Ata el gesto a **una** fila de contacto.
 *
 * Separado de `mountContactCopy` desde que la vista rápida clonaba la fila del
 * hero y ataba el clon al insertarlo. La vista se fundió con el hero el
 * 06-10-2026 y ya no hay clon: queda una fila, y esto como su montaje.
 */
function bindContactCopy(list: HTMLElement, signal: AbortSignal): void {
  const trigger = list.querySelector<HTMLAnchorElement>("[data-contact-copy]")
  const feedback = list.querySelector<HTMLElement>("[data-contact-feedback]")

  if (!trigger || !feedback) return

  let timer: number | undefined

  const say = (message: string, kind: "success" | "error"): void => {
    if (signal.aborted) return

    feedback.textContent = message
    feedback.dataset.kind = kind

    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      feedback.textContent = ""
      delete feedback.dataset.kind
    }, FEEDBACK_MS)
  }

  trigger.addEventListener(
    "click",
    (event) => {
      // Un clic con modificador es una intención declarada —abrir en otra
      // pestaña, forzar el cliente de correo—: ahí no se estorba.
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const address = trigger.dataset.contactCopy
      if (!address || !navigator.clipboard?.writeText) return

      event.preventDefault()

      void copyToClipboard(address).then((copied) => {
        if (copied) {
          say(list.dataset.copied ?? "", "success")
          pulseGlyph("pulse")
          return
        }

        /* Si falla con el permiso denegado ya no se puede deshacer el
           `preventDefault`, así que se dice y se deja el `title` —que lleva la
           dirección entera— como salida. */
        say(list.dataset.copyFailed ?? "", "error")
      })
    },
    { signal },
  )

  signal.addEventListener("abort", () => window.clearTimeout(timer))
}

/** La fila del hero, que es la que existe al cargar la página. */
export function mountContactCopy(signal: AbortSignal): void {
  const list = document.querySelector<HTMLElement>(".contact-list")
  if (list) bindContactCopy(list, signal)
}
