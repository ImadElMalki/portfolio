/**
 * Monta el JS de un componente una vez por documento, con un `AbortSignal`.
 *
 * Hasta el 02-10-2026 el sitio navegaba con `<ClientRouter />`, que sustituía
 * la página sin recargar: los módulos no volvían a correr, así que esto
 * remontaba cada runtime en `astro:page-load` y lo desmontaba en
 * `astro:before-swap`. Sin router cada navegación es un documento nuevo, los
 * módulos corren otra vez solos, y montar es simplemente hacerlo una vez.
 *
 * Se queda la forma —`init(signal)`— porque todos los runtimes la usan y la
 * usarían igual: registrar en `window` o `document` con `{ signal }` deja
 * cada montaje desmontable, y las pruebas desmontan. Hasta el 07-10-2026
 * llevaba también una clave que desmontaba el montaje anterior del mismo
 * nombre, vestigio del router: sin él, cada clave se usaba una vez por
 * documento y no sustituía nada.
 *
 * ```ts
 * onPageLoad((signal) => {
 *   window.addEventListener("scroll", update, { passive: true, signal })
 * })
 * ```
 */
export function onPageLoad(init: (signal: AbortSignal) => void): () => void {
  const controller = new AbortController()
  const mount = () => {
    if (!controller.signal.aborted) init(controller.signal)
  }
  const dispose = () => {
    controller.abort()
    document.removeEventListener("DOMContentLoaded", mount)
  }

  // Los módulos corren con el documento ya analizado; este `if` es para quien
  // llame antes, que entonces espera al `DOMContentLoaded`.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true })
  } else {
    mount()
  }

  return dispose
}

/**
 * Monta una lista de controles sin que uno se lleve por delante a los demás.
 *
 * Los runtimes llaman a ocho o diez `mount*` seguidos dentro del mismo
 * `onPageLoad`, y una excepción en cualquiera —un `querySelector` que devuelve
 * `null` tras mover un marcado, sin ir más lejos— abortaba el resto de la
 * lista. En `UtilityBarRuntime` eso significaba que un fallo de la paleta se
 * llevaba también el contador, el reloj de la barra y el acuse del cambio de
 * idioma, sin ninguna relación entre ellos y sin más pista que un error suelto
 * en la consola.
 *
 * El nombre no es decorativo: es lo único que dice *cuál* de los diez falló.
 */
export function mountAll(
  signal: AbortSignal,
  mounts: ReadonlyArray<readonly [string, (signal: AbortSignal) => void]>,
): void {
  for (const [name, mount] of mounts) {
    try {
      mount(signal)
    } catch (error) {
      console.error(`mount ${name} failed`, error)
    }
  }
}
