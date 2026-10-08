import { getImage } from "astro:assets"
/* Variante de `me.webp` con fondo transparente que conserva la camiseta y los
   hombros. El original y el recorte anterior se conservan por separado. */
import profileImage from "@/assets/me-bust.webp"
import darkProfileImage from "@/assets/me-bust-dark.webp"

/**
 * Las cuatro variantes del retrato, en un solo sitio.
 *
 * Vivían dentro de `Hero.astro`, que es quien las pinta. Salieron de ahí cuando
 * `Layout.astro` tuvo que **precargarlas**: el `<link rel="preload">` va en el
 * `<head>` y el retrato en el cuerpo, así que los dos necesitan exactamente las
 * mismas direcciones. Con dos llamadas a `getImage` escritas por separado,
 * cualquier retoque de calidad o de tamaño en una de ellas habría dado dos
 * ficheros distintos y el navegador habría descargado los dos: una precarga que
 * no sirve para nada y un retrato que pesa el doble.
 *
 * `getImage` y no `<Image>` porque un `<source>` necesita la cadena de
 * `srcset`, y el componente no la expone.
 */
const portrait = (src: ImageMetadata, format: "avif" | "webp") =>
  getImage({
    src,
    width: 240,
    height: 300,
    densities: [1, 2, 3],
    format,
    /* AVIF primero y WebP de reserva para quien no lo lea. A calidad 60 el AVIF
       se ve igual que el WebP a 80 y pesa menos: 20,7 KiB frente a 25,3 en la
       variante 2×, la que pide un móvil. Por debajo de 60 la piel y el pelo
       empezaban a alisarse al ampliar. */
    quality: format === "avif" ? 60 : 80,
    fit: "cover",
    position: "center",
  })

export interface PortraitSources {
  lightAvif: string
  lightWebp: { src: string; srcSet: string }
  darkAvif: string
  darkWebp: string
}

/**
 * Las cadenas de `srcset` listas para el marcado.
 *
 * Astro guarda cada variante por sus parámetros, así que llamar a esto desde el
 * `<head>` y desde el hero no procesa la imagen dos veces.
 */
export async function portraitSources(): Promise<PortraitSources> {
  const [lightAvif, lightWebp, darkAvif, darkWebp] = await Promise.all([
    portrait(profileImage, "avif"),
    portrait(profileImage, "webp"),
    portrait(darkProfileImage, "avif"),
    portrait(darkProfileImage, "webp"),
  ])

  return {
    lightAvif: lightAvif.srcSet.attribute,
    lightWebp: { src: lightWebp.src, srcSet: lightWebp.srcSet.attribute },
    darkAvif: darkAvif.srcSet.attribute,
    darkWebp: darkWebp.srcSet.attribute,
  }
}
