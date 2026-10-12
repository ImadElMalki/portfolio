/**
 * La secuencia de arranque del rótulo, la primera vez y sólo la primera.
 *
 * `SYS.OK · ACCENT OCEAN · LOCALE ES`, escrito carácter a carácter en 400 ms, y
 * después el rótulo de siempre. Es lo que hace un aparato al encenderse: dice
 * qué es y con qué ajustes, una vez, y se calla.
 *
 * Quién decide si corre **no es este módulo**: lo hace un guion en línea del
 * `<head>` que pone `data-booting` antes del primer pintado, comprobando
 * `localStorage`. Aquí sólo se escribe y se retira. Repartirlo así es lo que
 * evita que quien vuelve vea un fotograma del texto de arranque.
 */

/** Lo que dura la secuencia entera, repartido entre los caracteres que haya. */
const BOOT_MS = 400

export function mountBootSequence(signal: AbortSignal): void {
  const root = document.documentElement
  if (!("booting" in root.dataset)) return

  const slot = document.querySelector<HTMLElement>("[data-bar-boot]")

  if (!slot) {
    delete root.dataset.booting
    return
  }

  /**
   * El nombre de la paleta sale del atributo, no de `--accent-name`.
   *
   * Leer la variable CSS devuelve el valor entrecomillado —`"OCEAN"`, con las
   * comillas dentro de la cadena— y habría que limpiarlo; el atributo ya trae
   * la palabra. Escribir la variable desde JS ni se plantea: es lo que daba un
   * error de CSP en cada navegación.
   */
  const accent = (root.dataset.accent ?? "ocean").toUpperCase()
  const locale = (root.lang || "es").toUpperCase()
  const line = `SYS.OK · ACCENT ${accent} · LOCALE ${locale}`

  const step = Math.max(1, Math.round(BOOT_MS / line.length))
  let index = 0
  let timer: number | undefined

  const finish = (): void => {
    window.clearTimeout(timer)
    delete root.dataset.booting
    slot.textContent = ""
  }

  const type = (): void => {
    if (signal.aborted) return

    index += 1
    slot.textContent = line.slice(0, index)

    if (index < line.length) {
      timer = window.setTimeout(type, step)
      return
    }

    /* Un respiro con la línea entera puesta antes de dar paso al rótulo: sin
       él, la última letra y el intercambio caen en el mismo fotograma y la
       secuencia se lee como un parpadeo en vez de como un arranque. */
    timer = window.setTimeout(finish, step * 4)
  }

  type()

  /* Desmontar a mitad del arranque lo cancela y deja el rótulo puesto: el
     `data-booting` no puede quedarse escondiendo la barra. */
  signal.addEventListener("abort", finish)
}
