/* De `locales.ts` y no el alias `LOCALES` de `ui.ts`: aquél es una constante sin
   dependencias, y éste arrastraría el diccionario entero al paquete de cliente.
   El propio `locales.ts` explica por qué existe. */
import { LOCALE_CODES, type Locale } from "./locales"

/**
 * Le dice a quien llega que el sitio está en su idioma.
 *
 * El marcado lo emite `Layout.astro` con los tres idiomas dentro, oculto; aquí
 * sólo se elige uno y se descubre. El porqué de que sea un aviso y no una
 * redirección está escrito allí.
 *
 * ## La marca va en `localStorage`
 *
 * Es una preferencia —«ya sé que existe, no me lo repitas»— y las preferencias
 * de este sitio viven ahí: `theme` y `portfolio-accent`. En `sessionStorage`
 * volvería a salir en cada pestaña nueva, que es exactamente la clase de aviso
 * que acaba molestando.
 */
const STORAGE_KEY = "portfolio-locale-hint"

interface Hint {
  body: string
  action: string
  href: string
  tag: string
}

const isLocale = (value: string): value is Locale =>
  (LOCALE_CODES as readonly string[]).includes(value)

/**
 * El primer idioma pedido que el sitio hable.
 *
 * Se recorre `navigator.languages` en orden —es la lista de preferencia real de
 * quien navega— y se compara sólo la subetiqueta primaria: llegan como `es-ES`,
 * `ca-ES` o `en-GB`, y aquí las variantes regionales no cambian nada.
 */
function preferredLocale(): Locale | undefined {
  const requested = navigator.languages?.length
    ? navigator.languages
    : [navigator.language]

  for (const value of requested) {
    const primary = value.split("-")[0]?.toLowerCase() ?? ""
    if (isLocale(primary)) return primary
  }

  return undefined
}

export function mountLocaleSuggest(signal: AbortSignal): void {
  const hint = document.querySelector<HTMLElement>("[data-locale-hint]")
  if (!hint) return

  const body = hint.querySelector<HTMLElement>("[data-locale-hint-body]")
  const action = hint.querySelector<HTMLAnchorElement>(
    "[data-locale-hint-action]",
  )
  const dismiss = hint.querySelector<HTMLButtonElement>(
    "[data-locale-hint-dismiss]",
  )
  if (!body || !action || !dismiss) return

  const remember = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // Con el almacenamiento bloqueado el aviso vuelve en la carga siguiente.
      // Es preferible a no enseñarlo nunca: lo peor que pasa es repetirse.
    }
  }

  const close = (): void => {
    hint.hidden = true
    remember()
  }

  /* Lo barato primero: descartado, fuera. Ni se lee `navigator` ni se toca el
     DOM. Es el camino de la inmensa mayoría de las cargas. */
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return
  } catch {
    // Sin almacenamiento se sigue: el aviso se enseña y se podrá cerrar.
  }

  const preferred = preferredLocale()
  const current = hint.dataset.locale
  if (!preferred || preferred === current) return

  let hints: Partial<Record<Locale, Hint>>
  try {
    hints = JSON.parse(hint.dataset.hints ?? "{}") as Partial<
      Record<Locale, Hint>
    >
  } catch {
    return
  }

  const chosen = hints[preferred]
  if (!chosen) return

  body.textContent = chosen.body
  body.lang = chosen.tag
  action.textContent = chosen.action
  action.href = chosen.href
  action.hreflang = chosen.tag
  action.lang = chosen.tag
  hint.hidden = false

  dismiss.addEventListener("click", close, { signal })

  /* Elegir idioma a mano cuenta como respuesta: quien ya ha pulsado el
     conmutador de la barra no necesita que se lo sigan sugiriendo. Incluye el
     enlace del propio aviso, que también lo lleva. */
  for (const link of document.querySelectorAll("[data-language-link]")) {
    link.addEventListener("click", remember, { signal })
  }
}
