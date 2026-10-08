/**
 * Formas de captura de la galería de proyectos.
 *
 * Cada forma acopla tres cosas que tienen que moverse juntas:
 *
 * 1. `masterWidth` — el ancho al que `prepare-project-shots.mjs` reduce el
 *    máster que se comitea.
 * 2. `minRatio`/`maxRatio` — la ventana de proporciones que se acepta. Fuera de
 *    ella la captura desencaja la tira, y casi siempre significa que se coló un
 *    recorte mal hecho o un `full_page` accidental.
 * 3. El ancho mayor que pide el visor en `ProjectDetail.astro`, que es
 *    justamente `masterWidth`: así la variante que sirve el visor es la misma
 *    que la miniatura ya emite como `src` de reserva, y no se descarga dos
 *    veces lo mismo.
 *
 * Este archivo es `.mjs` y no `.ts` porque lo comparten dos scripts de Node
 * (`prepare-project-shots.mjs` y `check-build.mjs`) que corren sin compilar.
 * El tipo `ShotShape` de `src/data/projectDemos.ts` enumera las mismas claves.
 */

export const SHOT_SHAPES = {
  /** Captura de móvil a pantalla completa, sin la barra de estado. */
  phone: {
    masterWidth: 720,
    minRatio: 1.77,
    maxRatio: 2.45,
  },
  /**
   * Ventana emergente de una extensión de Chrome.
   *
   * 768 es el mínimo que sirve: la más estrecha de las tres extensiones mide
   * 384 CSS px y se captura a escala 2. Las otras dan 840 y 920, y se reducen.
   */
  popup: {
    masterWidth: 768,
    minRatio: 1.1,
    maxRatio: 2.6,
  },
  /** Aplicación web en escritorio. 1440×900 da 0,625. */
  browser: {
    masterWidth: 1280,
    minRatio: 0.45,
    maxRatio: 1.0,
  },
}

/** @type {(shape: string) => shape is keyof typeof SHOT_SHAPES} */
export function isShotShape(shape) {
  return Object.hasOwn(SHOT_SHAPES, shape)
}

export const SHOT_SHAPE_NAMES = Object.keys(SHOT_SHAPES)
