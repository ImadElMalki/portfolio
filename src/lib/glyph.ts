/**
 * La tira Glyph, encendida a mano.
 *
 * El dibujo entero es CSS —ver `.glyph-bar` en `Layout.astro`—: catorce bloques
 * en el canto de la ventana, una capa atada al scroll y otra a la línea de
 * tiempo del documento. Esto sólo elige qué animación corre en la segunda.
 *
 * ## Por qué hay que borrar el atributo antes de ponerlo
 *
 * El atributo **no se quita solo**, y es deliberado: las tres animaciones
 * terminan en `opacity: 0`, así que dejarlo puesto es inerte, mientras que
 * quitarlo con un temporizador devolvería la capa a su animación de arranque y
 * se vería un segundo destello sin motivo.
 *
 * El precio es que volver a poner el mismo valor no reinicia nada —para el
 * navegador el atributo no ha cambiado—. De ahí el `void root.offsetWidth`: es
 * una lectura de geometría, y obliga a recalcular el estilo antes de la
 * siguiente escritura. Sin ella, encender dos veces seguidas enciende una.
 *
 * ## Dónde no ocurre nada
 *
 * Toda la tira vive dentro de `@supports (animation-timeline: scroll())` y de
 * `prefers-reduced-motion: no-preference`. En Firefox estable y con movimiento
 * reducido esto no pinta nada, y es correcto: es un adorno, y un carril vacío
 * permanente sería ruido. Quien llame a esta función no tiene que comprobarlo.
 */

/**
 * `pulse` es la pasada corta con la que el sitio acusa un cambio —tema, idioma,
 * copiar el correo, enviar el formulario—. `show` es el espectáculo largo del
 * reloj, que es un gesto buscado y por eso dura más.
 */
export type GlyphState = "pulse" | "show"

export function pulseGlyph(state: GlyphState): void {
  const root = document.documentElement

  delete root.dataset.glyph
  void root.offsetWidth
  root.dataset.glyph = state
}
