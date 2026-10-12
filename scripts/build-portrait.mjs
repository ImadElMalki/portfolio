/**
 * Recorta el fondo del retrato y deja el resultado en `src/assets/me-cutout.webp`.
 *
 * El original es una foto de estudio tipo carnet: fondo claro y plano, y una
 * camiseta blanca. Medido sobre el fichero:
 *
 *   fondo      luminancia 200-255 (media 242)
 *   camiseta   luminancia 196-239   ← dentro del rango del fondo
 *   cuello     122-166
 *   pelo        26
 *
 * O sea que **un umbral global es imposible**: cualquier corte que borre el
 * fondo borra los hombros. Y aquí no hay modelo de segmentación —`sharp`
 * redimensiona y recorta, no separa sujetos—, así que el recorte se hace con
 * geometría y conectividad, que sí bastan para esta foto concreta.
 *
 * ## Se inunda desde los dos extremos
 *
 * Durante varias versiones esto sólo inundaba desde arriba y retiraba la
 * camiseta clasificando por brillo. Las dos mitades salían distintas y se veía:
 * el fondo, resuelto por conectividad, quedaba limpio; la camiseta, resuelta por
 * estadística, dejaba flecos —una isla de 983 px en un hombro y un sobrante bajo
 * el cuello— que no se arreglaban bajando el umbral, porque sus pliegues en
 * sombra comparten rango con el labio inferior.
 *
 * La camiseta también toca un canto y también es una región conexa y clara, así
 * que admite exactamente el mismo trato que el fondo:
 *
 * 1. **Desde arriba**, hasta `FLOOD_LIMIT`. Ahí el único objeto es la cabeza y
 *    contrasta 216 puntos contra el fondo, así que el relleno se para solo en el
 *    pelo y sale un recorte limpio, sin aureola.
 * 2. **Desde abajo**, desde el canto inferior y desde los laterales por debajo de
 *    `BOTTOM_SEED`. Se lleva la camiseta entera y se para en el cuello, que es
 *    piel y está muy por debajo de `BOTTOM_TOL`.
 *
 * Lo que sobrevive es lo que no toca ningún canto: la cabeza y el cuello. El
 * contorno lo decide la figura, no un umbral ni una banda horizontal — que es lo
 * que antes seccionaba el cuello con una línea recta.
 *
 * ## Cuándo hay que volver a ejecutarlo
 *
 * Sólo si cambia `src/assets/me.webp`. El resultado se versiona, así que el
 * build no depende de esto. `node scripts/build-portrait.mjs`.
 */
import { fileURLToPath } from "node:url"
import path from "node:path"
import sharp from "sharp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE = path.join(root, "src/assets/me.webp")
const TARGET = path.join(root, "src/assets/me-cutout.webp")

/**
 * Hasta dónde llega la inundación de arriba.
 *
 * Medido: no hay fuga hacia la camiseta hasta 0,88. Se queda en 0,72, que ya deja
 * la cara entera por encima —importa porque decide desde dónde puede mandar
 * cualquier criterio de brillo— y evita acercarse al margen.
 */
const FLOOD_LIMIT = 0.72
/** Un píxel cuenta como fondo para la inundación de arriba a partir de aquí. */
const FLOOD_TOL = 206

/**
 * Desde dónde se siembra la inundación de abajo por los laterales.
 *
 * El canto inferior entero siempre es semilla; los laterales sólo por debajo de
 * esto, para no reintroducir por el costado un relleno que la inundación de
 * arriba ya resolvió con su propia tolerancia.
 */
const BOTTOM_SEED = 0.75
/**
 * Tolerancia de la inundación de abajo.
 *
 * 180 y no menos: el cuello llega a 166 y con 170 el margen serían cuatro puntos,
 * que no es margen. Comprobado sobre el original, con 180 los seis puntos de
 * muestreo del cuello (35-155) sobreviven y la isla del hombro (197) se borra.
 */
const BOTTOM_TOL = 180

/**
 * Islas opacas por debajo de esto se descartan.
 *
 * Red de seguridad: con las dos inundaciones no debería quedar ninguna, pero una
 * mota suelta de doscientos píxeles se ve en pantalla y perseguirla a mano cuesta
 * más que este filtro.
 */
const MIN_ISLAND = 5000

/**
 * La cola: dónde empieza y dónde acaba de apagarse lo que quede.
 *
 * Estuvo en 0,80 → 0,93 y se comía el cuello: a y=0,86 la opacidad ya había
 * caído al 24 %, y por debajo del mentón eso no se lee como un desvanecido sino
 * como una sombra que devora. Es la tercera vez que este degradado estropea el
 * cuello, y la lección se repite: **una cola horizontal sobre una zona con
 * contenido siempre parece un corte**, porque no sigue la forma de nada.
 *
 * Ahora arranca en 0,92, donde ya sólo queda el último jirón de la prenda, y su
 * único trabajo es que ese jirón no acabe en un canto recto contra el borde del
 * encuadre. El cuello llega entero.
 */
const TAIL_FROM = 0.92
const TAIL_TO = 0.99

const { data, info } = await sharp(SOURCE)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info
const luminance = (i) =>
  0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]

/** Relleno 4-conexo sobre lo claro, acotado a una franja vertical. */
const flood = (seeds, tolerance, yMin, yMax, marked) => {
  const pending = []
  const visit = (x, y) => {
    if (x < 0 || y < yMin || x >= W || y >= yMax) return
    const cell = y * W + x
    if (marked[cell] || luminance(cell * C) < tolerance) return
    marked[cell] = 1
    pending.push(cell)
  }
  for (const [x, y] of seeds) visit(x, y)
  while (pending.length) {
    const cell = pending.pop()
    const x = cell % W
    const y = (cell / W) | 0
    visit(x + 1, y)
    visit(x - 1, y)
    visit(x, y + 1)
    visit(x, y - 1)
  }
}

const background = new Uint8Array(W * H)

// --- 1. Desde arriba: el fondo por encima de los hombros --------------------
const limit = Math.round(H * FLOOD_LIMIT)
{
  const seeds = []
  for (let x = 0; x < W; x++) seeds.push([x, 0])
  for (let y = 0; y < limit; y++) {
    seeds.push([0, y])
    seeds.push([W - 1, y])
  }
  flood(seeds, FLOOD_TOL, 0, limit, background)
}

// --- 2. Desde abajo: la camiseta --------------------------------------------
{
  const seeds = []
  for (let x = 0; x < W; x++) seeds.push([x, H - 1])
  for (let y = Math.round(H * BOTTOM_SEED); y < H; y++) {
    seeds.push([0, y])
    seeds.push([W - 1, y])
  }
  flood(seeds, BOTTOM_TOL, 0, H, background)
}

// --- 3. Islas: lo opaco que no cuelga del componente principal --------------
const island = new Uint8Array(W * H)
{
  const seen = new Uint8Array(W * H)
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || background[start]) continue
    const stack = [start]
    const cells = []
    seen[start] = 1
    while (stack.length) {
      const cell = stack.pop()
      cells.push(cell)
      const x = cell % W
      const y = (cell / W) | 0
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const next = ny * W + nx
        if (seen[next] || background[next]) continue
        seen[next] = 1
        stack.push(next)
      }
    }
    if (cells.length < MIN_ISLAND) for (const cell of cells) island[cell] = 1
  }
}

// --- 4. El alfa --------------------------------------------------------------
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const tailFrom = H * TAIL_FROM
const tailTo = H * TAIL_TO
let cleared = 0

for (let y = 0; y < H; y++) {
  const tail = 1 - smooth((y - tailFrom) / (tailTo - tailFrom))
  for (let x = 0; x < W; x++) {
    const cell = y * W + x
    const opaque = !background[cell] && !island[cell]
    const alpha = opaque ? tail : 0
    if (alpha < 0.5) cleared++
    data[cell * C + 3] = Math.round(255 * alpha)
  }
}

await sharp(data, { raw: { width: W, height: H, channels: C } })
  .webp({ quality: 82, alphaQuality: 100 })
  .toFile(TARGET)

const share = ((cleared / (W * H)) * 100).toFixed(1)
console.log(`retrato recortado → ${path.relative(root, TARGET)}`)
console.log(`  ${W}×${H}, ${share}% del lienzo transparente`)
