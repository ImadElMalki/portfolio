import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

/**
 * Los iconos que Google necesita, derivados del `favicon.svg`.
 *
 * ## Por qué existe esto
 *
 * El sitio declaraba **sólo** un SVG. Es lo correcto para un navegador —una
 * imagen que sirve para la pestaña y para la pantalla de inicio— y no basta
 * para el resultado de búsqueda, por dos motivos distintos:
 *
 * 1. **`/favicon.ico` daba 404.** El rastreador de favicons de Google es un bot
 *    aparte del que indexa, va a su ritmo y, cuando no resuelve lo declarado en
 *    el marcado, cae a la raíz. Ahí no había nada, así que se quedaba con lo
 *    último que tenía en caché: el icono anterior del sitio, un `</>` dentro de
 *    un cuadrado redondeado que dejó de ser el favicon el 23-08-2026.
 * 2. **El SVG lleva un `<style>` con `prefers-color-scheme` dentro.** Un
 *    navegador lo resuelve; un rasterizador de terceros no tiene por qué, y de
 *    hacerlo mal el resultado es un glifo negro sobre nada.
 *
 * Un PNG plano no depende de ninguna de las dos cosas.
 *
 * ## Por qué se aplana sobre el fondo claro
 *
 * El punto y coma es tinta sólida sin contorno. Sobre transparente se ve en un
 * fondo claro y desaparece en uno oscuro, y el resultado de búsqueda se pinta
 * en los dos según lo que tenga puesto quien mira. Aplanado sobre `--bg` del
 * tema claro es una teja que se lee siempre, y sigue siendo el mismo dibujo.
 *
 * `apple-touch-icon` lo agradece además por su cuenta: iOS rellena de negro
 * cualquier transparencia y luego le pone la esquina redondeada él.
 *
 * ## Y por qué el ICO se escribe a mano
 *
 * `sharp` no exporta ICO. No hace falta una dependencia para esto: desde
 * Windows Vista un ICO puede contener PNG tal cual, y es lo que entienden todos
 * los navegadores a los que llega el sitio y el rastreador de Google. El
 * contenedor son seis bytes de cabecera y dieciséis por imagen.
 *
 * Uso: `npm run favicons`. Los archivos se versionan, como el PDF del CV.
 */

const PUBLIC = new URL("../public/", import.meta.url)

/** `--bg` del tema claro (ver `Layout.astro`). El icono es una teja, no un recorte. */
const BACKGROUND = { r: 0xf7, g: 0xf8, b: 0xf6, alpha: 1 }

/** Las medidas que van dentro del `.ico`. 48 es la que Google prefiere. */
const ICO_SIZES = [16, 32, 48]

async function render(svg, size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Empaqueta varios PNG en un ICO.
 *
 * `width`/`height` van en un solo byte y el 0 significa 256; aquí ninguna
 * medida llega, pero el `% 256` deja la regla escrita por si mañana entra.
 */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reservado
  header.writeUInt16LE(1, 2) // 1 = icono
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = []

  for (const { size, data } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size % 256, 0)
    entry.writeUInt8(size % 256, 1)
    entry.writeUInt8(0, 2) // paleta: ninguna
    entry.writeUInt8(0, 3) // reservado
    entry.writeUInt16LE(1, 4) // planos
    entry.writeUInt16LE(32, 6) // bits por píxel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)])
}

async function main() {
  const svg = await readFile(new URL("favicon.svg", PUBLIC))

  const sized = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, data: await render(svg, size) })),
  )
  await writeFile(new URL("favicon.ico", PUBLIC), ico(sized))

  await writeFile(new URL("icon-96.png", PUBLIC), await render(svg, 96))
  await writeFile(
    new URL("apple-touch-icon.png", PUBLIC),
    await render(svg, 180),
  )

  console.log(
    `iconos escritos en ${fileURLToPath(PUBLIC)}: favicon.ico (${ICO_SIZES.join(
      "/",
    )}), icon-96.png, apple-touch-icon.png`,
  )
}

await main()
