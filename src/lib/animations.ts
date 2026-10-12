/**
 * Lo que el CSS no sabe escribir, con la Web Animations API del navegador.
 *
 * El sitio anima casi todo sin JS: la aparición de las secciones va con
 * `animation-timeline: view()`, el cambio de tema con View Transitions, el punto
 * del índice lateral con una `transition` y todos los hover igual. Aquí queda
 * sólo **orquestar** varios elementos con retardo escalonado, que el CSS no sabe
 * hacer sin conocer cuántos son.
 *
 * ## Sin librería desde el 02-10-2026
 *
 * Hasta entonces esto envolvía `motion/mini` (2,5 KB comprimidos), que hacía dos
 * cosas: convertir el muelle de la casa a una curva `linear()` y llamar a
 * `element.animate()`. La segunda ya la hace el navegador, y la primera basta
 * con hacerla una vez: la curva vive en el CSS como `--ease-spring`
 * (`Layout.astro`), y de ahí la leen el CSS y esto. Una sola fuente.
 *
 * ## Dos reglas para todo lo de aquí
 *
 * 1. `prefers-reduced-motion` se comprueba en cada animación, no una vez al
 *    cargar: la preferencia puede cambiar con la página abierta.
 * 2. `element.animate()` no escribe en el atributo `style` ni inyecta hojas, así
 *    que la CSP del sitio, que bloquea los dos, no tiene nada que decir.
 */

/** Separación entre elementos de una entrada escalonada. */
const STAGGER_STEP_MS = 40

/** Lo que vale `--spring-duration` si el CSS no ha llegado. */
const FALLBACK_DURATION_MS = 550

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Un tiempo de CSS en milisegundos, con su unidad.
 *
 * No basta con `parseFloat`: el minificador reescribe `550ms` como `.55s`, que
 * es más corto, y leído sin unidad daba una entrada de medio milisegundo.
 */
export function toMilliseconds(value: string): number | undefined {
  const match = /^\s*(\d*\.?\d+)(ms|s)\s*$/.exec(value)
  if (!match) return undefined
  const amount = Number.parseFloat(match[1] ?? "")
  return match[2] === "s" ? amount * 1000 : amount
}

/**
 * El muelle de la casa, leído del CSS.
 *
 * Sin `linear()` (Safari anterior a 17.2) `element.animate()` lanzaría con esa
 * curva, así que se comprueba antes y se cae a `ease-out`: se pierde el muelle,
 * no la entrada.
 */
function springTiming(): { duration: number; easing: string } {
  const style = getComputedStyle(document.documentElement)
  const duration =
    toMilliseconds(style.getPropertyValue("--spring-duration")) ??
    FALLBACK_DURATION_MS
  const curve = style.getPropertyValue("--ease-spring").trim()
  const easing =
    curve && CSS.supports("transition-timing-function", curve)
      ? curve
      : "ease-out"

  return { duration, easing }
}

/**
 * Entrada escalonada de un grupo de elementos: un fundido.
 *
 * Con movimiento reducido no se degrada a «lo mismo pero rápido»: no se anima
 * nada y los elementos se quedan como los pintó el servidor. Eso importa aquí
 * más que en otros sitios, porque el fotograma inicial es `opacity: 0` y
 * cualquier fallo dejaría el contenido invisible. Por eso ese estado lo pone la
 * animación y nunca el CSS: si este guion no llega a correr, todo se ve.
 *
 * `fill: "backwards"` es lo que mantiene invisible cada elemento mientras espera
 * su turno; sin él, los últimos se verían un instante antes de fundirse. Al
 * acabar no queda nada aplicado, porque el valor final es el del CSS.
 */
export function revealSequence(elements: Element[]): void {
  if (prefersReducedMotion()) return

  const { duration, easing } = springTiming()
  elements.forEach((element, index) => {
    element.animate(
      { opacity: [0, 1] },
      { duration, easing, delay: index * STAGGER_STEP_MS, fill: "backwards" },
    )
  })
}

/**
 * No hay aquí un ayudante de «revelar al entrar en pantalla», y es deliberado.
 *
 * Eso ya lo hace el layout en CSS con `animation-timeline: view()` sobre cada
 * `#web-view > section`, sin JS y ligado al scroll real. Añadir encima un
 * `IntersectionObserver` por tarjeta funde el mismo contenido dos veces: al
 * probarlo en Experiencia y Educación, la sección llegaba a `opacity: 1` y sólo
 * entonces empezaba la entrada del artículo. Si hace falta revelar algo al
 * bajar, el sitio es el CSS del layout.
 */
