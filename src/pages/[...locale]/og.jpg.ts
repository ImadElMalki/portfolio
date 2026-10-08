import type { APIRoute } from "astro"
import { getCv, type Locale } from "@/cv"
import { localeStaticPaths, localized } from "@/lib/i18n"
import { ogFooter, renderOgCard } from "@/lib/ogCard"

export const getStaticPaths = localeStaticPaths

/**
 * Tarjeta para compartir la portada, un JPEG de 1200×630 por idioma.
 *
 * Antes se servía el retrato en crudo (1920×2240, 172 KB): con
 * `twitter:card = summary_large_image`, que espera 1.91:1, el recorte central se
 * comía la foto en X, LinkedIn y WhatsApp. Aquí la proporción ya es la correcta
 * y el texto viaja dentro de la imagen.
 *
 * El diseño lo compone `ogCard.ts`, que es el mismo que usan las fichas de
 * proyecto: aquí queda sólo qué pone.
 */
export const GET: APIRoute<{ locale: Locale }> = async ({ props, site }) => {
  const { locale } = props
  const { basics } = await getCv()

  /* El nombre partido en dos renglones: a 76 px, los dos apellidos en la misma
     línea no caben junto al retrato. */
  const [givenName, ...familyNameParts] = basics.name.trim().split(/\s+/)
  const familyName = familyNameParts.join(" ")

  return new Response(
    await renderOgCard({
      title: [givenName, familyName].filter(Boolean) as string[],
      titleSize: 76,
      subtitle: localized(basics.label, locale),
      footer: ogFooter([
        basics.location.city,
        localized(basics.location.region, locale),
        site?.hostname,
      ]),
    }),
  )
}
