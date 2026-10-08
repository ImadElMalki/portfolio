/**
 * Los dos plegados de la barra de utilidades en pantalla estrecha.
 *
 * La fila no siempre cabe en un móvil, y se partía en dos comiéndose 102 px
 * justo encima del hero, que es lo primero que se ve. Se recoge por los dos
 * lados y en ninguno se pierde nada, pero **cada lado tiene su propio ancho**:
 *
 * - **Idioma, por debajo de 700 px.** Las tres celdas ES/EN/CA (130 px) pasan a
 *   un botón con el idioma actual, y las tres siguen ahí debajo. No suben de
 *   ahí: 130 px no sobran en ningún teléfono.
 * - **Vistas, cuando no caben.** Resumen, Markdown, consola y PDF pasan tras un
 *   botón «⋯», y eso no lo decide un ancho: lo mide `barFit.ts` en el propio
 *   navegador —despliega, mira si la fila se ha partido y la recoge si se ha
 *   partido—. Se intentó con un `@media` a 700 px y luego a 380, y los dos
 *   números fallaron en el mismo teléfono: lo que ocupan seis controles depende
 *   del cuerpo de letra y del ajuste de tamaño de pantalla del sistema, no del
 *   ancho de la ventana.
 *
 * Plegados los dos quedan tres celdas, que caben incluso a 320 px.
 *
 * ## Un solo guion para los dos
 *
 * Son el mismo gesto —un disparador, un panel, y se cierra al tocar fuera, con
 * `Escape` o al bajar—, así que se recorren en un bucle en vez de escribirse dos
 * veces. El marcado es idéntico en cualquier ancho y lo reparte el CSS: en ancho
 * los disparadores están `display: none` y los paneles fluyen en línea, así que
 * esto no reconstruye nada al girar el teléfono ni tiene un segundo modo que
 * mantener. El atributo que pone y quita no lo mira ninguna regla de escritorio.
 */
export function mountBarMenus(signal: AbortSignal): void {
  const menus = Array.from(
    document.querySelectorAll<HTMLElement>("[data-bar-menu]"),
  )
    .map((control) => ({
      control,
      trigger: control.querySelector<HTMLButtonElement>(
        "[data-bar-menu-trigger]",
      ),
    }))
    .filter(
      (menu): menu is { control: HTMLElement; trigger: HTMLButtonElement } =>
        menu.trigger !== null,
    )

  if (menus.length === 0) return

  /** Dónde estaba el scroll cuando se abrió el panel que esté abierto. */
  let openedAt = 0

  const closeAll = (except?: HTMLElement): void => {
    for (const { control, trigger } of menus) {
      if (control === except || control.dataset.menuOpen === undefined) continue
      delete control.dataset.menuOpen
      trigger.ariaExpanded = "false"
    }
  }

  for (const { control, trigger } of menus) {
    trigger.addEventListener(
      "click",
      () => {
        const wasOpen = control.dataset.menuOpen !== undefined
        /* Cerrar los demás antes de abrir éste: dos paneles abiertos a la vez se
           solapan, y los dos salen del mismo borde derecho. */
        closeAll(wasOpen ? undefined : control)

        if (wasOpen) {
          delete control.dataset.menuOpen
          trigger.ariaExpanded = "false"
        } else {
          control.dataset.menuOpen = ""
          trigger.ariaExpanded = "true"
          openedAt = window.scrollY
        }
      },
      { signal },
    )

    /* Salir del control con el tabulador cierra: sin esto el panel se queda
       abierto detrás mientras se recorre el resto de la barra. */
    control.addEventListener(
      "focusout",
      (event) => {
        const next = event.relatedTarget
        if (next instanceof Node && control.contains(next)) return
        closeAll(undefined)
      },
      { signal },
    )
  }

  /* Con `pointerdown` y no con `click`: en un móvil descartar tocando fuera no
     debería esperar a que se resuelva el clic. Lo de dentro queda excluido o
     cerraría antes de que el enlace llegara a navegar. */
  document.addEventListener(
    "pointerdown",
    (event) => {
      const inside = menus.find(
        ({ control }) =>
          event.target instanceof Node && control.contains(event.target),
      )
      closeAll(inside?.control)
    },
    { signal },
  )

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return
      const open = menus.find(
        ({ control }) => control.dataset.menuOpen !== undefined,
      )
      if (!open) return
      closeAll(undefined)
      /* El foco vuelve al disparador: si se abrió con teclado, cerrar sin
         devolverlo deja el recorrido al principio del documento. */
      open.trigger.focus()
    },
    { signal },
  )

  /**
   * Desplazarse cierra el panel: la barra sube con el documento, y una hoja
   * flotando sobre un ancla que ya no se ve es un estado huérfano.
   *
   * Con un recorrido mínimo, y no con cualquier evento: `scroll` se emite
   * también cuando el navegador acerca un elemento a la vista para poder
   * pulsarlo —o cuando el dedo tiembla sobre el disparador—, y cerrar por eso
   * quitaba el panel en el mismo gesto que lo abría.
   */
  window.addEventListener(
    "scroll",
    () => {
      if (Math.abs(window.scrollY - openedAt) < 8) return
      closeAll(undefined)
    },
    { signal },
  )
}
