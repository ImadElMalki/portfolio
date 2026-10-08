/**
 * Trae las filas de «Antes de programar» al abrir el pliegue.
 *
 * Hasta el 07-10-2026 los doce empleos viajaban en el HTML de la portada,
 * escondidos tras `display: none` hasta que alguien encontraba el visor del
 * retrato. Escondido no es ausente: estaban en el código fuente, en el DOM y
 * al alcance de cualquier lector automático. Ahora el pliegue llega vacío y
 * las filas se descargan de `/prior-work/` la primera vez que se abre.
 *
 * Mismo patrón que el diálogo de proyecto (`ProjectDialogRuntime.astro`), y
 * por los mismos motivos: una petición, memorizada, y el marcado lo pinta el
 * mismo componente en los dos sitios para que el CSS acotado encaje.
 *
 * ## Sin JavaScript no hay pliegue
 *
 * El control se esconde con CSS mientras `<html>` no lleve `data-js` (ver
 * `Experience.astro`). Un `<details>` que se abre y no enseña nada es peor que
 * uno que no está: promete contenido y da un hueco.
 */
/** Lo que ya se pidió, para no repetir la petición al cerrar y abrir. */
let pending: Promise<void> | null = null

async function load(fold: HTMLDetailsElement, signal: AbortSignal) {
  const url = fold.dataset.priorWorkUrl
  const host = fold.querySelector("[data-prior-work-list]")
  if (!url || !host) return

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const parsed = new DOMParser().parseFromString(
    await response.text(),
    "text/html",
  )
  if (signal.aborted) return

  const rows = parsed.querySelectorAll("[data-prior-work-list] > li")
  if (rows.length === 0) throw new Error("sin filas")

  /* Un fragmento y no doce `append`: así el navegador maqueta una vez, y con
     el pliegue ya abierto la diferencia se ve. */
  const batch = document.createDocumentFragment()
  for (const row of rows) batch.append(document.importNode(row, true))
  host.append(batch)
}

export function mountPriorWork(signal: AbortSignal): void {
  const fold = document.querySelector<HTMLDetailsElement>("[data-prior-work]")
  if (!fold) return

  fold.addEventListener(
    "toggle",
    () => {
      if (!fold.open || pending) return
      pending = load(fold, signal).catch((error: unknown) => {
        /* Se suelta la memoria para que el siguiente intento vuelva a pedir:
           una red que falla una vez no tiene por qué fallar siempre. */
        pending = null
        if (!signal.aborted) console.error("prior work", error)
      })
    },
    { signal },
  )
}
