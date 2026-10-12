/**
 * Contraste WCAG sobre los colores que declara el CSS.
 *
 * El sitio pinta texto con `--accent`, insignias con `--status-*` y los iconos
 * de Habilidades con `--tech`. Los tres son colores que se eligen a ojo y que
 * nada vigilaba: la paleta de acento se sortea entre diez juegos y cada uno
 * tiene que aguantar en claro y en oscuro.
 *
 * Estas funciones las usa `contrast.test.ts`, que lee los `.astro` como texto y
 * mide los valores reales. Por eso aquí se resuelven las dos formas que usa la
 * hoja de estilos —`light-dark()` y `color-mix(… , transparent)`— en vez de
 * duplicar los colores en TypeScript, que es justo la duplicación que
 * terminaría desincronizándose.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** `#abc` y `#aabbcc`. El CSS del proyecto no usa otra notación. */
export function parseHex(value: string): Rgb {
  const hex = value.trim().replace(/^#/, "")

  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : hex

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Color no reconocido: ${value}`)
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

/**
 * Luminancia relativa de la WCAG 2.x (sRGB linealizado).
 *
 * Sin `export`: sólo la usa `contrastRatio`, aquí al lado. Exportada parecía
 * parte de la API del módulo y no la importaba nadie, ni siquiera las pruebas.
 */
function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const srgb = value / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Ratio de contraste WCAG entre dos colores opacos. De 1 a 21. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  )
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  )

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * `color-mix(in srgb, color <ratio>%, base)` en el espacio que usa la hoja.
 *
 * Cuando la base es `transparent` el resultado es `color` con ese alfa, así que
 * hay que componerlo contra lo que haya detrás: eso es exactamente lo que
 * ocurre con las insignias de estado, que se pintan sobre un tinte del 12 % de
 * su propio color.
 */
export function mix(color: Rgb, ratio: number, base: Rgb): Rgb {
  const blend = (a: number, b: number) =>
    Math.round(a * ratio + b * (1 - ratio))

  return {
    r: blend(color.r, base.r),
    g: blend(color.g, base.g),
    b: blend(color.b, base.b),
  }
}

/**
 * Las dos ramas de `light-dark(claro, oscuro)`.
 *
 * Un color suelto vale como valor: devuelve la misma rama dos veces, así quien
 * llama no tiene que distinguir los dos casos.
 */
export function resolveLightDark(value: string): [string, string] {
  const match = value.trim().match(/^light-dark\(\s*(.+?)\s*,\s*(.+?)\s*\)$/s)

  if (!match) {
    const single = value.trim()
    return [single, single]
  }

  const light = match[1]
  const dark = match[2]
  if (!light || !dark) throw new Error(`light-dark() incompleto: ${value}`)

  return [light, dark]
}

/**
 * Declaraciones `--nombre: valor;` de un bloque CSS.
 *
 * Deliberadamente tolerante con los saltos de línea: en `Layout.astro` hay
 * `light-dark()` repartidos en varias líneas por el formateador.
 */
export function parseCustomProperties(block: string): Map<string, string> {
  const properties = new Map<string, string>()

  for (const [, name, value] of block.matchAll(
    /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi,
  )) {
    if (!name || !value) continue
    properties.set(name, value.replace(/\s+/g, " ").trim())
  }

  return properties
}
