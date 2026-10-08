/**
 * Red de seguridad para imprimir los desplegables de «Experiencia laboral».
 *
 * El CSS de `Experience.astro` ya fuerza el contenido a la vista en `@media
 * print` con `::details-content`, que es lo que usa Chromium —el navegador que
 * genera los tres PDF en `scripts/build-cv-pdf.mjs`—. Esto cubre al resto: si
 * alguien imprime desde un navegador que todavía no entiende ese pseudoelemento,
 * un empleo plegado saldría en papel sin sus puntos destacados.
 *
 * Se abre lo que estaba cerrado y se vuelve a cerrar al terminar: quien tenía un
 * empleo desplegado en pantalla se lo encuentra igual después de imprimir.
 */
export function mountPrintableDetails(signal: AbortSignal): void {
  /** Sólo lo que abrió esta función, que es lo único que puede volver a cerrar. */
  let reopened: HTMLDetailsElement[] = []

  const restore = (): void => {
    for (const details of reopened) details.open = false
    reopened = []
  }

  window.addEventListener(
    "beforeprint",
    () => {
      /* Restaurar antes de recalcular. Si llega un segundo `beforeprint` sin su
         `afterprint` —reabrir la vista previa basta—, para entonces está todo
         abierto: el filtro daría la lista vacía, `afterprint` no cerraría nada y
         el visitante se quedaría con los empleos desplegados para siempre, que es
         justo lo que este módulo promete no hacer. */
      restore()

      reopened = Array.from(
        document.querySelectorAll<HTMLDetailsElement>("details.job-details"),
      ).filter((details) => !details.open)

      for (const details of reopened) details.open = true
    },
    { signal },
  )

  window.addEventListener("afterprint", restore, { signal })

  /* Desmontar con la vista previa abierta deja el `afterprint` sin escucha. Pasa
     con el reemplazo de un ciclo por su clave, donde el DOM sí sobrevive. */
  signal.addEventListener("abort", restore)
}
