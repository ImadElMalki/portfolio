/**
 * El visor del retrato: la única puerta a «Sobre mí».
 *
 * Manteniendo pulsado sobre la foto del hero, las cuatro escuadras se cierran
 * sobre ella; al completarse el recorrido el visor queda enfocado y la página
 * «Sobre mí» pasa a estar descubierta para siempre en este navegador.
 * `About.astro` no enseña su enlace hasta entonces.
 *
 * El dibujo es todo CSS —ver `Hero.astro`—; aquí sólo se cuenta el tiempo y se
 * guarda el hallazgo. Se anota en dos sitios a propósito:
 *
 * - `data-about-found` en `<html>`, que es lo que lee el CSS. Lo pone también,
 *   antes del primer pintado, el script en línea de `Layout.astro`, para que el
 *   enlace no aparezca de golpe en cada recarga.
 * - `sessionStorage`, que es lo que sobrevive a recargar y a navegar.
 *
 * El enlace sigue en el HTML aunque esté oculto: la página tiene que seguir
 * siendo rastreable e indexable, y esconderla de los buscadores nunca fue el
 * objetivo.
 */

/**
 * La misma clave que lee el script en línea de `Layout.astro`, y **en el almacén
 * de sesión**, no en el local.
 *
 * El hallazgo dura lo que la pestaña: recargar y navegar lo conservan,
 * cerrarla lo borra. Es deliberado —el secreto se vuelve a ganar en
 * cada visita— y además quita de en medio una diferencia entre navegadores que
 * no se podía arreglar: Safari borra el almacenamiento escribible por scripts a
 * los siete días sin visitar el sitio, así que en `localStorage` el mismo
 * secreto duraba para siempre en Chrome y una semana en un iPhone.
 *
 * Las otras tres claves del sitio —`theme`, `portfolio-accent` y
 * `portfolio-booted`— se quedan en `localStorage`: una preferencia y dos cosas
 * que sí tienen que sobrevivir a cerrar el navegador.
 */
const STORAGE_KEY = "portfolio-about"

/**
 * Lo que hay que aguantar, en milisegundos.
 *
 * Coincide con la transición de `--arm` en `Hero.astro`: el recorrido termina
 * exactamente cuando las escuadras acaban de cerrarse, así que el enfoque no se
 * confirma ni antes de que la imagen lo cuente ni un rato después.
 *
 * Y es bastante más que una pulsación: 0,9 s no se alcanzan por accidente, que
 * es la mitad de la gracia.
 *
 * Bajó de 1200 a 900 el 31-08-2026. En un teléfono el menú nativo de la imagen
 * —«Guardar imagen»— asoma alrededor de los 500 ms; ahora se bloquea por CSS y
 * por `contextmenu`, pero acortar el margen entre ese umbral y el nuestro deja
 * menos sitio a un navegador que decida ignorarlo. Sigue siendo el triple de
 * una pulsación corriente.
 */
const HOLD_MS = 900

export function mountPortraitFocus(signal: AbortSignal): void {
  const portrait = document.querySelector<HTMLElement>("[data-portrait]")
  const trigger = document.querySelector<HTMLButtonElement>(
    "[data-portrait-focus-trigger]",
  )

  if (!portrait || !trigger) return

  let timer: number | undefined

  const isLocked = () => portrait.dataset.portraitFocus === "locked"

  /**
   * Soltar antes de tiempo devuelve las escuadras a su sitio.
   *
   * Una vez enfocado no se desenfoca: el estado `locked` es el premio y quitarlo
   * al soltar sería enseñar el hallazgo y retirarlo en el mismo gesto.
   */
  const cancel = (): void => {
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }

    if (!isLocked()) delete portrait.dataset.portraitFocus
  }

  const lock = (): void => {
    timer = undefined
    portrait.dataset.portraitFocus = "locked"
    document.documentElement.dataset.aboutFound = ""

    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // Con el almacenamiento bloqueado el hallazgo dura lo que la página. Es
      // preferible a no dejar entrar: la página existe, sólo que hay que
      // volver a encontrarla.
    }
  }

  const start = (): void => {
    if (isLocked() || timer !== undefined) return

    portrait.dataset.portraitFocus = "holding"
    timer = window.setTimeout(lock, HOLD_MS)
  }

  trigger.addEventListener(
    "pointerdown",
    (event) => {
      // Sin esto, mantener pulsado sobre una imagen arrastra la imagen en
      // escritorio y selecciona en móvil, y el gesto se pierde a mitad.
      event.preventDefault()
      start()
    },
    { signal },
  )

  for (const type of ["pointerup", "pointerleave", "pointercancel"] as const) {
    trigger.addEventListener(type, cancel, { signal })
  }

  /**
   * Lo que hacía que este gesto no existiera en un teléfono.
   *
   * Mantener pulsado sobre una imagen abre el menú nativo del navegador
   * —«Guardar imagen», «Copiar imagen»— alrededor de los 500 ms, y ese diálogo
   * cancela el puntero: llegaba un `pointercancel`, `cancel()` borraba la cuenta
   * y los 900 ms no se alcanzaban **nunca**. El «sobre mí» era inalcanzable
   * desde móvil, que es la mitad de las visitas.
   *
   * `preventDefault()` en `pointerdown` no basta —no es el evento que dispara el
   * menú—, así que se ataja donde toca. La otra mitad la ponen
   * `-webkit-touch-callout` y `user-select` en `Hero.astro`: iOS decide el
   * callout por CSS y no llega a emitir `contextmenu`.
   */
  trigger.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault()
    },
    { signal },
  )

  /**
   * El mismo gesto con el teclado.
   *
   * `event.repeat` se ignora: mantener una tecla dispara `keydown` en ráfaga y
   * sin filtrarlo cada repetición reiniciaría la cuenta y nunca llegaría a los
   * 900 ms. El `preventDefault` es por el espacio, que si no baja la página
   * mientras se aguanta.
   */
  trigger.addEventListener(
    "keydown",
    (event) => {
      if (event.repeat || (event.key !== " " && event.key !== "Enter")) return

      event.preventDefault()
      start()
    },
    { signal },
  )

  trigger.addEventListener("keyup", cancel, { signal })
  // Salir del botón con el tabulador a mitad de la cuenta también cancela.
  trigger.addEventListener("blur", cancel, { signal })

  // Al desmontar no puede quedar un temporizador corriendo contra el retrato.
  signal.addEventListener("abort", cancel)
}
