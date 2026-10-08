/**
 * Convierte capturas de pantalla en las imágenes que consume la galería.
 *
 *   node scripts/prepare-project-shots.mjs <origen> <destino> [--shape phone|popup|browser]
 *
 * El máster que se comitea sale al ancho que fija `scripts/shot-shapes.mjs` para
 * esa forma, con calidad 90: `astro:assets` reencoda después a las variantes que
 * se sirven, así que aquí interesa conservar detalle, no ahorrar bytes. Ese
 * ancho es además el que pide el visor, de modo que ampliar una captura no
 * descarga un archivo nuevo.
 *
 * Falla en vez de arreglar por su cuenta:
 *
 * - Un origen más estrecho que el máster se ampliaría, y el texto de la interfaz
 *   saldría borroso justo en lo que la galería quiere enseñar.
 * - Una proporción fuera de la ventana de su forma descuadra la tira, y suele
 *   significar que la captura lleva sin recortar la barra de estado, o que se
 *   coló un `full_page` que nadie va a poder leer.
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { basename, extname, join } from "node:path"
import sharp from "sharp"
import { SHOT_SHAPES, SHOT_SHAPE_NAMES, isShotShape } from "./shot-shapes.mjs"

const QUALITY = 90

const args = process.argv.slice(2)
const shapeIndex = args.indexOf("--shape")
const shape = shapeIndex === -1 ? "phone" : args[shapeIndex + 1]
const [source, destination] = args.filter(
  (_, index) => index !== shapeIndex && index !== shapeIndex + 1,
)

if (!source || !destination) {
  console.error(
    `Uso: node scripts/prepare-project-shots.mjs <origen> <destino> [--shape ${SHOT_SHAPE_NAMES.join("|")}]`,
  )
  process.exit(1)
}

if (!isShotShape(shape)) {
  console.error(
    `Forma desconocida: ${shape}. Las que hay: ${SHOT_SHAPE_NAMES.join(", ")}`,
  )
  process.exit(1)
}

const { masterWidth, minRatio, maxRatio } = SHOT_SHAPES[shape]

if (!existsSync(source)) {
  console.error(`No existe el directorio de origen: ${source}`)
  process.exit(1)
}

const files = readdirSync(source)
  .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
  .sort()

if (files.length === 0) {
  console.error(`No hay imágenes en ${source}`)
  process.exit(1)
}

mkdirSync(destination, { recursive: true })

const failures = []
let totalKb = 0

for (const file of files) {
  const input = join(source, file)
  const { width, height } = await sharp(input).metadata()

  if (width < masterWidth) {
    failures.push(
      `${file}: ${width} px de ancho, por debajo de ${masterWidth} para la forma «${shape}» — ampliarla dejaría el texto borroso`,
    )
    continue
  }

  const ratio = height / width

  if (ratio < minRatio || ratio > maxRatio) {
    failures.push(
      `${file}: proporción ${width}×${height} (${ratio.toFixed(2)}:1) fuera de la ventana de «${shape}» (${minRatio}–${maxRatio}) — ¿falta recortar la barra de estado, o se coló un full_page?`,
    )
    continue
  }

  const output = join(destination, `${basename(file, extname(file))}.webp`)

  await sharp(input)
    .resize({ width: masterWidth, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(output)

  const kb = statSync(output).size / 1024
  totalKb += kb
  const out = await sharp(output).metadata()
  console.log(
    `✓ ${basename(output)} — ${out.width}×${out.height}, ${kb.toFixed(0)} KB`,
  )
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} captura(s) rechazada(s):\n`)
  for (const failure of failures) console.error(`  · ${failure}`)
  process.exit(1)
}

// El total se vigila también en `check-build.mjs`, pero verlo al capturar evita
// descubrir que un proyecto se pasó de presupuesto tres pasos más tarde.
console.log(
  `\n✓ ${files.length} captura(s) «${shape}» en ${destination} — ${totalKb.toFixed(0)} KB de másteres`,
)
