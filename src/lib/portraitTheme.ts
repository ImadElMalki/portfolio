/**
 * El retrato del hero sigue al conmutador de tema.
 *
 * Hasta el 11-09-2026 esto no existía porque no hacía falta: había dos `<img>`
 * y el CSS enseñaba uno u otro según `data-theme`, sin una línea de JavaScript.
 * El precio era que el navegador **descargaba los dos**, los dos con
 * `fetchpriority="high"`, y uno no se pintaba nunca — ver `PERF-04` en
 * `AUDIT-2026-09-11.md`.
 *
 * Ahora es un `<picture>` con un `<source media>`, que es lo único que el
 * *preload scanner* sabe leer para pedir una sola imagen. A cambio, elegir deja
 * de ser cosa del CSS: un `media` no entiende de `data-theme`. Esto es esa
 * diferencia, y nada más.
 *
 * El primer pintado **no** depende de este módulo: lo resuelve el guion en línea
 * que va pegado al `<picture>` en `Hero.astro`. Aquí sólo se atienden los
 * cambios posteriores, que siempre vienen de un gesto —el conmutador, o el
 * sistema cambiando de tema con la preferencia en `auto`—, y para eso llegar
 * con el resto de los montajes es de sobra.
 */

/** `all` fuerza el `<source>` oscuro; `not all` lo desactiva y gana el `<img>`. */
function mediaFor(resolved: string): string {
  return resolved === "dark" ? "all" : "not all"
}

/**
 * Las fuentes oscuras son dos desde el 01-10-2026, AVIF y WebP de reserva, y
 * las dos tienen que cambiar a la vez: si sólo cambiara la primera, un
 * navegador sin AVIF seguiría eligiendo la segunda con el tema de antes.
 */
export function mountPortraitTheme(signal: AbortSignal): void {
  const sources = document.querySelectorAll<HTMLSourceElement>(
    "[data-portrait-source]",
  )
  if (sources.length === 0) return

  document.addEventListener(
    "theme-changed",
    (event) => {
      const resolved = (event as CustomEvent<{ resolved?: string }>).detail
        ?.resolved
      if (!resolved) return
      for (const source of sources) source.media = mediaFor(resolved)
    },
    { signal },
  )
}
