/**
 * Los presupuestos de la salida, en un solo sitio.
 *
 * Los leen `scripts/check-build.mjs` —HTML, CSS y DOM de cada superficie, y el
 * JS total— y las dos mediciones de navegador, `tests/browser/performance.spec.ts`
 * y `scripts/lighthouse-docker.mjs`. Antes cada uno llevaba su copia de los
 * mismos números y el gate y la prueba podían vigilar cifras distintas sin que
 * nada lo dijera (MAINT-03).
 *
 * ## Dos clases de techo
 *
 * - **HTML y DOM** son disparadores de revisión: el margen queda por debajo de
 *   lo que añade una sección o un proyecto, para que el aviso salte con el
 *   siguiente cambio de marcado y no tres después.
 * - **CSS y JS** son techos de lo que descarga quien visita: margen corto,
 *   suficiente para un arreglo e insuficiente para una librería. Un margen de
 *   catorce bytes tampoco informa de nada: cualquier retoque lo rompe y el rojo
 *   deja de distinguir una regresión de un arreglo.
 *
 * ## El CSS viaja dentro del HTML
 *
 * Del 31-08 al 01-10-2026 `inlineStylesheets` valió `"never"` y el CSS vivía en
 * hojas externas y bloqueantes; estos techos contaban esas hojas, su peso en
 * bruto y con Brotli (TEST-05). Desde el 01-10-2026 se incrusta todo salvo la
 * hoja del diálogo de proyecto: el A/B de Lighthouse en el contenedor dio
 * 1 789 ms de LCP con el CSS incrustado frente a 2 045 ms enlazado (PERF-03, ver
 * `astro.config.mjs`). Sólo las fichas enlazan una hoja, la del diálogo; en el
 * resto, `stylesheets`, `cssBytes` y `cssBrotliBytes` quedan a cero —una hoja
 * que reaparezca es un bloqueo nuevo y debe saltar— y el CSS se mide en
 * `inlineCssBytes`, que ahora lo es casi todo.
 *
 * Cada techo lleva la medida con la que se calibró. Cómo se movieron hasta el
 * 30-09-2026 está en `docs/historial-presupuestos.md`.
 *
 * El 07-10-2026 el botón relleno `.cta` pasó de `Hero.astro` al bloque global
 * de `Layout.astro`, porque lo usan también las fichas. Son 491 bytes en bruto
 * —unos 60 con Brotli— que ahora llevan también las páginas sin botón. Se
 * aceptan a cambio de no tener la misma regla escrita en dos componentes, que
 * es como acaban divergiendo.
 */

/**
 * @typedef {object} PageBudget
 * @property {number} htmlBytes      El documento, tal como sale del build.
 * @property {number} domElements    Etiquetas de apertura sin `<script>`.
 * @property {number} stylesheets    `<link rel="stylesheet">`: cada una bloquea.
 * @property {number} cssBytes       Suma de esas hojas, sin comprimir.
 * @property {number} cssBrotliBytes La misma suma con Brotli, que es lo que viaja.
 * @property {number} inlineCssBytes Lo que queda en `<style>` dentro del HTML.
 */

/**
 * Medidas del 07-10-2026 en el comentario de cada superficie: la página más
 * grande de cada una, en bruto y con Brotli. El aire es el de siempre, ~5 %.
 *
 * Bajan todas otra vez: se fueron la paleta de comandos, la vista Markdown y
 * la consola, y con ellas 6,4 KB de CSS global que viajaba incrustado en cada
 * página. La portada baja 19 KB de CSS y 29 KB de HTML, porque llevaba además
 * el conmutador de vistas y el marcado de las dos que se fueron. Las del
 * 06-10-2026, con la vista rápida ya fuera, están en el historial de Git de
 * este archivo.
 *
 * @satisfies {Record<string, PageBudget>}
 */
export const PAGE_BUDGETS = {
  // 171 596 B (29 460 br) · 621 elementos · 92 219 B de CSS en línea.
  //
  // Baja otra vez el 07-10-2026 y por dos sitios: se va el «Ver 5 más» con sus
  // cinco tarjetas, y las doce filas de «Antes de programar» dejan de viajar en
  // el HTML —se descargan de `/prior-work/` al abrir el pliegue—. El CSS sube
  // un poco: entra la hoja de `PriorWork.astro`, que la portada necesita para
  // pintar lo que le llega.
  home: {
    htmlBytes: 180_000,
    domElements: 655,
    stylesheets: 0,
    cssBytes: 0,
    cssBrotliBytes: 0,
    inlineCssBytes: 97_000,
  },
  // 107 345 B (19 804 br) · 253 elementos · 66 983 B en línea
  services: {
    htmlBytes: 110_500,
    domElements: 265,
    stylesheets: 0,
    cssBytes: 0,
    cssBrotliBytes: 0,
    inlineCssBytes: 70_400,
  },
  // 98 637 B (18 289 br) · 172 elementos · mismo CSS que servicios
  about: {
    htmlBytes: 103_500,
    domElements: 180,
    stylesheets: 0,
    cssBytes: 0,
    cssBrotliBytes: 0,
    inlineCssBytes: 70_400,
  },
  // 99 861 B (18 912 br) · 175 elementos · mismo CSS que servicios
  privacy: {
    htmlBytes: 105_000,
    domElements: 185,
    stylesheets: 0,
    cssBytes: 0,
    cssBrotliBytes: 0,
    inlineCssBytes: 70_400,
  },
  // 108 525 B (18 533 br) · 255 elementos · mismo CSS que servicios. Las
  // ocho miniaturas suman los elementos y el HTML que quita la vista rápida.
  projectsIndex: {
    htmlBytes: 114_000,
    domElements: 270,
    stylesheets: 0,
    cssBytes: 0,
    cssBrotliBytes: 0,
    inlineCssBytes: 70_400,
  },
  // la ficha más grande de las 24: 99 560 B (19 424 br) · 278 elementos ·
  // 50 142 B en línea · 1 hoja, la del diálogo: 17 557 B (2 881 br). Es la única
  // que se queda enlazada en todo el sitio (ver `assetsInlineLimit` en
  // `astro.config.mjs`), porque la portada y el índice la adoptan al abrir.
  //
  // Subió el 07-10-2026 con el caso de estudio: sus cinco secciones y su CSS
  // van en la hoja del diálogo —el componente es el mismo— y las migas de pan
  // y el pie con «siguiente proyecto» y los dos CTA, en el HTML. La ficha más
  // grande es ahora la de Strava/Garmin, que es la del caso más largo de los
  // cuatro escritos.
  //
  // El 08-10-2026 sube el CSS en línea 2 776 B: los cuatro controles nuevos del
  // asistente —parar, «Nueva», reintentar y la píldora del final—, que viajan
  // en todas las páginas porque el disparador está en todas. Es la única
  // superficie que rebasaba su techo; el resto suben 1 725 B y caben.
  projectPage: {
    htmlBytes: 101_500,
    domElements: 284,
    stylesheets: 1,
    cssBytes: 18_500,
    cssBrotliBytes: 3_050,
    inlineCssBytes: 52_700,
  },
}

/**
 * Todo el JS de `dist/_astro` comprimido con gzip, se descargue o no: lo que de
 * verdad baja al abrir la portada lo vigila `tests/browser/navigation.spec.ts`.
 *
 * Medido 42 477 B el 30-09-2026, a 23 bytes del techo anterior (42 500): el
 * margen de ~1 KB que se dejó el 31-08-2026 se lo habían comido las funciones
 * posteriores. Se devuelve a ~1,5 KB. Tras UX-02 y PERF-06, 42 781.
 *
 * El 02-10-2026 baja a 35 496 al salir Motion (2,8 KB) y `<ClientRouter />`
 * (4,5 KB), y el techo baja con él para dejar el mismo ~1,5 KB de aire: con
 * 8,5 KB libres cabría otra librería entera sin que nada avisara, que es
 * justo lo que este techo existe para impedir.
 *
 * El 06-10-2026, 33 110 al salir la vista rápida, que construía su contenido
 * en el navegador, y 17 303 el 07-10 con la paleta, la vista Markdown y la
 * consola fuera: la mitad del total era la consola. Mismo aire.
 *
 * El 08-10-2026, 18 637: los cuatro controles del asistente —parar, «Nueva»,
 * reintentar y la píldora del final— suman 2 373 B en bruto, todos en el
 * fragmento de la barra, que es donde se monta el panel. Dejaban 163 B de
 * margen, y un margen así no distingue una regresión de un arreglo: el techo
 * vuelve a ~1,5 KB.
 */
export const JS_GZIP_BUDGET_BYTES = 20_200

/**
 * La portada en frío, medida en un navegador: los mismos umbrales para la prueba
 * de Playwright y para Lighthouse. `transferBytes` cuenta lo que viaja.
 *
 * `domNodes` no es `PAGE_BUDGETS.home.domElements`: aquél cuenta el marcado
 * estático sin guiones y éste `querySelectorAll("*")` ya montada la página,
 * con los `<script>` y lo que crean los guiones. Medido 636 el 07-10-2026 (621
 * en estático), y 826 el 30-09.
 *
 * `requests` y `transferBytes` bajaron el 01-10-2026, cuando la portada dejó
 * de pedir cinco fuentes y cuatro hojas (PERF-03), y otra vez el 07-10, con la
 * precarga de idiomas fuera —que era lo que inflaba la medida de Lighthouse— y
 * sin la consola ni las otras vistas. Antes del 01-10 eran 36 peticiones y
 * 351 KiB con techos de 45 y 600, tan holgados que nueve descargas de más
 * cabían sin aviso.
 *
 * **`transferBytes` lo manda el móvil, y por las imágenes.** La prueba corre en
 * los tres perfiles, y `Pixel 7` pide el retrato y las miniaturas a 2,625
 * veces la densidad: 237 081 B frente a 165 912 en escritorio, y la diferencia
 * entera son las imágenes. Un techo puesto sobre la medida de escritorio pone
 * la prueba en rojo en móvil, que es justo donde más pesa. `requests` y
 * `domNodes` sí dan igual en los dos: 21 y 636.
 *
 * `lcpMs` es el umbral «bueno» de Core Web Vitals. Desde el 01-10-2026 el job
 * de Lighthouse de la CI lo hace cumplir: un rojo ahí bloquea el despliegue
 * (OPS-09). Medido 2 124 ms de mediana ese día.
 *
 * `tbtMs` bloquea en la prueba de Playwright, que lo mide sin multiplicar la
 * CPU, pero en Lighthouse sólo avisa: allí se simula con la CPU ×4 y hereda el
 * ruido del runner (de 0 a 531 ms con el mismo `dist/`, el 01-10-2026).
 */
export const HOME_RUNTIME_BUDGET = {
  domNodes: 680,
  requests: 25,
  transferBytes: 255 * 1024,
  lcpMs: 2_500,
  cls: 0.1,
  tbtMs: 200,
}
