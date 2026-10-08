import {
  mailtoUrl,
  normalizeContact,
  suggestEmail,
  validateContact,
  type ContactDraft,
  type ContactProblem,
} from "./contact"
import { pulseGlyph } from "./glyph"

/**
 * El formulario de contacto de la portada.
 *
 * Comparte con la consola el endpoint y —lo que importa— las reglas: los dos
 * validan con `validateContact` antes de enviar, así que ninguno de los dos
 * puede dar por bueno algo que el servidor rechace.
 *
 * El envío va por `fetch()` y no por el `submit` nativo del navegador. No es
 * una preferencia: la CSP del sitio declara `form-action 'none'`, de modo que
 * un `<form action method>` lo bloquearía el navegador antes de salir. La
 * contrapartida es que sin JS no hay envío, y por eso el `mailto:` que hay
 * debajo del formulario está siempre visible en vez de aparecer sólo al fallar.
 */
export function mountContactForm(signal: AbortSignal): void {
  /* Por los `data-*` y no por las clases, igual que la barra de utilidades: las
     clases son de estilo y renombrar una para maquetar rompería esto en
     silencio. */
  const root = document.querySelector<HTMLElement>("[data-contact]")
  const form = root?.querySelector<HTMLFormElement>("[data-contact-form]")
  const button = root?.querySelector<HTMLButtonElement>("[data-contact-send]")
  const status = root?.querySelector<HTMLElement>("[data-contact-status]")
  if (!root || !form || !button || !status) return

  const trap = form.querySelector<HTMLInputElement>("[data-contact-trap]")
  const fallback = root.querySelector<HTMLAnchorElement>(".contact-mailto")
  const text = root.dataset

  const fieldOf = (problem: ContactProblem) =>
    form.elements.namedItem(problem) as HTMLElement | null

  const draftOf = (): ContactDraft => ({
    email: (form.elements.namedItem("email") as HTMLInputElement).value,
    subject: (form.elements.namedItem("subject") as HTMLInputElement).value,
    message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
  })

  const say = (message: string, state: "error" | "sending" | "sent" | "") => {
    status.textContent = message
    if (state) status.dataset.state = state
    else delete status.dataset.state
  }

  const busy = (isBusy: boolean) => {
    button.disabled = isBusy
    button.textContent = isBusy ? (text.sending ?? "") : (text.send ?? "")
  }

  const problemText = (problem: ContactProblem) =>
    ({
      email: text.badEmail,
      subject: text.badSubject,
      message: text.badMessage,
    })[problem] ?? ""

  /**
   * El dedazo en el dominio, corregido antes de enviar.
   *
   * `pedro@gmial.com` es una dirección válida y `validateContact` la deja pasar
   * —debe—, así que esto no es una segunda validación: es el único momento en
   * que se puede avisar. Si se envía, el error no lo ve nadie hasta que la
   * respuesta no llega, semanas después y sin que quien escribió sepa por qué.
   *
   * Avisa una vez y no bloquea: al segundo envío con la misma dirección, el
   * mensaje sale tal cual. Quien tenga de verdad un dominio parecido a un
   * dedazo pulsa dos veces, y quien se equivocó lo ve a tiempo.
   */
  let suggestedFor = ""

  const suggestion = (email: string): string | null => {
    const suggested = suggestEmail(email)
    if (!suggested || suggestedFor === email) return null
    suggestedFor = email
    return suggested
  }

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault()

      const draft = draftOf()
      const problem = validateContact(draft)

      if (!problem) {
        const suggested = suggestion(draft.email)
        if (suggested) {
          const field = fieldOf("email") as HTMLInputElement | null
          say(
            (text.emailSuggestion ?? "").replace("{mail}", suggested),
            "error",
          )
          form.dataset.expanded = ""
          if (field) {
            field.value = suggested
            field.focus()
            field.select()
          }
          return
        }
      }

      if (problem) {
        say(problemText(problem), "error")
        /* Correo y asunto empiezan en `display: none` —el formulario se abre
           solo al escribir el mensaje, ver `.field--secondary` en
           `Contact.astro`—, y no se puede enfocar lo que no se pinta. Este
           atributo es la segunda puerta de esa regla: se abre antes de mover el
           foco, no después. */
        form.dataset.expanded = ""
        /* El foco va al campo que falla y no al principio del formulario: quien
           usa lector de pantalla ya ha oído el motivo por la región viva, y lo
           siguiente que necesita es estar donde se arregla. */
        fieldOf(problem)?.focus()
        return
      }

      busy(true)
      /* El envío en curso también es un estado del panel, no un renglón suelto:
         el corchete de `[ENVIANDO…]` lo pone el CSS a partir de `data-state`,
         igual que los de enviado y error. */
      say(text.sending ?? "", "sending")

      let ok = false
      let rateLimited = false

      try {
        const response = await fetch(
          root.dataset.contactUrl ?? "/api/contact",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...normalizeContact(draft),
              company: trap?.value ?? "",
            }),
            signal,
          },
        )
        ok = response.ok
        rateLimited = response.status === 429
      } catch {
        ok = false
      }

      // Si se desmontó mientras esperaba la respuesta, no hay nada que escribir:
      // el formulario ya no es de nadie.
      if (signal.aborted) return

      busy(false)

      if (ok) {
        say(text.sent ?? "", "sent")
        /* Y la tira Glyph lo acusa. Sólo en el envío correcto: un error ya se
           cuenta en su sitio, y encender la carcasa para decir que algo ha
           fallado sería celebrarlo. */
        pulseGlyph("pulse")
        /* El contador lo escucha (`hits.ts`); el formulario no sabe que
           existe, igual que el asistente con `ask-used`. */
        document.dispatchEvent(new CustomEvent("contact-sent"))
        form.reset()
        /* Y el formulario vuelve a su estado mínimo. Sin esto, tras un envío
           correcto quedaría vacío pero con los tres campos abiertos, que es
           justo lo que el revelado progresivo evita. */
        delete form.dataset.expanded
        return
      }

      if (rateLimited) {
        say(text.rateLimited ?? "", "error")
        return
      }

      say(text.failed ?? "", "error")

      /* El respaldo se lleva lo ya escrito en vez de abrir un correo en blanco:
         quien acaba de redactar un mensaje no debería teclearlo dos veces.
         Se reaprovecha el enlace que ya está en la página —un nodo menos— y
         cambia también su etiqueta, porque ahora hace otra cosa. */
      if (fallback && text.email) {
        fallback.href = mailtoUrl(text.email, draft)
        fallback.textContent = text.fallback ?? text.email
      }
    },
    { signal },
  )
}
