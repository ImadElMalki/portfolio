import type { APIRoute } from "astro"
import { getCv, type Locale } from "@/cv"
import { localeStaticPaths, localizedPath } from "@/lib/i18n"
import { localizeCv } from "@/lib/localizedCv"

export const getStaticPaths = localeStaticPaths

/**
 * El CV en formato JSON Resume, ya en un solo idioma, para herramientas y agentes.
 *
 * El build estático solo escribe el cuerpo a disco: el tipo de contenido, el
 * CORS y la caché los sirve el host y viven en `public/_headers`.
 */
export const GET: APIRoute<{ locale: Locale }> = async ({ props, site }) => {
  if (!site)
    throw new Error("Astro site is required for absolute JSON Resume URLs")
  const cv = await getCv()
  const canonical = new URL(localizedPath(props.locale), site).toString()

  return new Response(
    JSON.stringify(localizeCv(cv, props.locale, canonical), null, 2),
  )
}
