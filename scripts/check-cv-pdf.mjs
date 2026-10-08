#!/usr/bin/env node
/**
 * Comprobaciones sobre los PDF del CV.
 *
 * `check-build.mjs` sólo mira que los tres archivos lleguen a `dist/` y pesen
 * algo, y con eso se publicaron durante meses PDF rotos de formas que nadie ve
 * al abrir el archivo por encima:
 *
 * - el titular y la ubicación salían **invisibles** —presentes en la capa de
 *   texto, pintados a `opacity: 0` porque el muelle de Motion no había
 *   terminado—;
 * - Inter iba incrustada como **28 fuentes Type 3**, o sea dibujo por glifo, y
 *   cada archivo pesaba 400 KB;
 * - la mono la ponía el sistema, así que el PDF de la CI (Liberation Mono) no
 *   era el que se revisaba en local (Consolas);
 * - de todos los enlaces del CV sólo dos llegaban al papel.
 *
 * Las propiedades binarias se comprueban sin una librería de PDF. El texto y
 * su orden de mejor esfuerzo se validan aparte con PDF.js y Poppler en
 * `check-cv-ats.mjs`.
 *
 * Uso: `node scripts/check-cv-pdf.mjs [archivo…]`. Sin argumentos comprueba los
 * tres de `public/`. `scripts/build-cv-pdf.mjs` lo llama al terminar.
 */
import { readFileSync } from "node:fs"
import { argv, exit } from "node:process"
import { pathToFileURL } from "node:url"

const DEFAULT_TARGETS = [
  "public/cv.pdf",
  "public/ca/cv.pdf",
  "public/en/cv.pdf",
]

/**
 * Familias que **tienen** que viajar dentro del archivo. Si una falta, el lector
 * la sustituye por lo que tenga a mano y el CV deja de ser el mismo documento en
 * cada máquina — que es exactamente lo que pasaba con la mono.
 */
const REQUIRED_FONTS = ["Inter"]

/**
 * Los cinco contactos, las dos empresas y los dos cursos con URL.
 */
const MIN_LINKS = 9

/** A4 en puntos, con el margen de redondeo que deja Chromium. */
const A4_POINTS = { width: 595.9, height: 842.9 }

const failures = []

function check(description, condition, detail = "") {
  if (condition) return
  failures.push(detail ? `${description} — ${detail}` : description)
}

/**
 * El PDF se lee como `latin1` y no como `utf8`: los diccionarios son ASCII, pero
 * entre ellos hay flujos binarios que `utf8` destrozaría —y con ellos las
 * posiciones de lo que viene después—.
 */
function readPdf(path) {
  return readFileSync(path).toString("latin1")
}

function countMatches(haystack, pattern) {
  return (haystack.match(pattern) ?? []).length
}

/** Nombres de fuente sin el prefijo de subconjunto (`BAAAAA+Inter` → `Inter`). */
function fontNames(pdf) {
  return [
    ...new Set(
      [...pdf.matchAll(/\/BaseFont\s*\/([^\s/\]>]+)/g)].map(([, name]) =>
        name.replace(/^[A-Z]{6}\+/, ""),
      ),
    ),
  ].sort()
}

function pageCount(pdf) {
  return countMatches(pdf, /\/Type\s*\/Page[^s]/g)
}

function verify(path) {
  const pdf = readPdf(path)
  const name = path.replace(/^public\//, "")
  const kb = Buffer.byteLength(pdf, "latin1") / 1024

  check(`${name}: una sola página`, pageCount(pdf) === 1, `${pageCount(pdf)}`)

  /* Sin fuentes Type 3. Chromium las genera cuando no sabe incrustar la fuente
     —el caso de una instancia variable— y entonces el texto es un dibujo: pesa
     más, se lee peor y algunos extractores de los que usan los portales de
     empleo no sacan nada. */
  check(`${name}: sin fuentes Type 3`, !/\/Subtype\s*\/Type3/.test(pdf))

  const fonts = fontNames(pdf)
  for (const family of REQUIRED_FONTS) {
    check(
      `${name}: ${family} incrustada`,
      fonts.some((font) => font.startsWith(family)),
      fonts.join(", ") || "ninguna fuente incrustada",
    )
  }
  check(
    `${name}: sólo Inter`,
    fonts.every((font) => font.startsWith("Inter")),
    fonts.join(", ") || "ninguna fuente incrustada",
  )

  /* Una fuente declarada pero no incrustada la pone el lector. `FontFile2` es el
     archivo TrueType de verdad dentro del PDF. */
  check(
    `${name}: los tipos viajan dentro del archivo`,
    countMatches(pdf, /\/FontFile2/g) >= REQUIRED_FONTS.length,
  )

  const links = countMatches(pdf, /\/URI\s*\(/g)
  check(
    `${name}: al menos ${MIN_LINKS} enlaces`,
    links >= MIN_LINKS,
    `${links}`,
  )
  check(`${name}: el correo es pulsable`, /\/URI\s*\(mailto:/.test(pdf))
  check(`${name}: el teléfono es pulsable`, /\/URI\s*\(tel:/.test(pdf))
  check(
    `${name}: el portfolio es pulsable`,
    /\/URI\s*\(https:\/\/imadelmalki\.com\/?\)/.test(pdf),
  )
  check(
    `${name}: LinkedIn es pulsable`,
    /\/URI\s*\(https:\/\/www\.linkedin\.com\/in\//.test(pdf),
  )
  check(
    `${name}: GitHub es pulsable`,
    /\/URI\s*\(https:\/\/github\.com\//.test(pdf),
  )

  const images = countMatches(pdf, /\/Subtype\s*\/Image/g)
  check(
    `${name}: sólo contiene el retrato`,
    images === 1,
    `${images} imágenes raster`,
  )

  /* El generador imprime desde un servidor local con puerto efímero, así que un
     enlace interno sin reescribir se sella como `http://127.0.0.1:<puerto>/`:
     muerto para quien abra el PDF, y distinto en cada ejecución. Estuvo en los
     tres archivos publicados hasta el 31-08-2026. */
  const localLinks = (pdf.match(/\/URI\s*\(([^)]*)\)/g) ?? []).filter((uri) =>
    /127\.0\.0\.1|localhost|:\d{4,5}\//.test(uri),
  )
  check(
    `${name}: ningún enlace apunta al servidor de build`,
    localLinks.length === 0,
    localLinks.join(", "),
  )

  /**
   * El árbol de estructura mantiene encabezados, listas y enlaces disponibles
   * para tecnologías de asistencia y extractores. Las dos columnas siguen
   * siendo una concesión visual y ningún gate local certifica todos los ATS.
   *
   * `page.pdf({ tagged: true })` marca el contenido con su papel —encabezado,
   * párrafo, lista— y eso es lo que permite a un extractor devolver el texto en
   * el orden del documento en vez de por coordenadas. La bandera se pasa en
   * `build-cv-pdf.mjs`, pero pasarla no garantiza que llegue: Chromium la ignora
   * en silencio si algo del documento se lo impide, y el PDF sale igual de
   * bonito y mudo. Se comprueba en el archivo.
   */
  check(
    `${name}: el árbol de estructura viaja dentro`,
    /\/Marked\s+true/.test(pdf) && /\/StructTreeRoot/.test(pdf),
  )

  const mediaBox = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(
    pdf,
  )
  const [width, height] = mediaBox?.slice(1).map(Number) ?? []
  check(
    `${name}: hoja A4`,
    Math.abs(width - A4_POINTS.width) < 2 &&
      Math.abs(height - A4_POINTS.height) < 2,
    mediaBox ? `${width}×${height} pt` : "sin MediaBox",
  )

  /* El suelo detecta un PDF truncado o en blanco. El techo deja margen al
     retrato optimizado sin tolerar que se incruste el original a tamaño pleno. */
  check(
    `${name}: entre 20 y 360 KB`,
    kb > 20 && kb < 360,
    `${kb.toFixed(0)} KB`,
  )

  return fonts
}

/**
 * Comprueba los archivos y devuelve el control sólo si todos pasan. La lanza
 * `build-cv-pdf.mjs`, así que un fallo tiene que dejar el comando en rojo.
 */
export function verifyCvPdfs(targets = DEFAULT_TARGETS) {
  failures.length = 0

  const fontsByFile = targets.map((path) => [path, verify(path)])

  /* Los tres idiomas salen de la misma hoja de estilos: si uno incrusta otras
     fuentes, es que la máquina puso una suya. Así se cazó que la CI generaba con
     Liberation Mono lo que en local se revisaba con Consolas. */
  const [[, reference]] = fontsByFile
  for (const [path, fonts] of fontsByFile.slice(1)) {
    check(
      `${path}: mismas fuentes que ${fontsByFile[0][0]}`,
      fonts.join("|") === reference.join("|"),
      `${fonts.join(", ")} vs ${reference.join(", ")}`,
    )
  }

  if (failures.length > 0) {
    const detail = failures.map((failure) => `  · ${failure}`).join("\n")
    throw new Error(
      `${failures.length} comprobación(es) fallida(s) en los PDF:\n${detail}`,
    )
  }

  console.log(`✓ ${targets.length} PDF pasan todas las comprobaciones`)
}

/** Ejecutado a mano (`node scripts/check-cv-pdf.mjs`), no importado. */
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  const targets = argv.slice(2)

  try {
    verifyCvPdfs(targets.length > 0 ? targets : DEFAULT_TARGETS)
  } catch (error) {
    console.error(`\n✗ ${error.message}`)
    exit(1)
  }
}
