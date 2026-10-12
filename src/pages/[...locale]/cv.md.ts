import type { APIRoute } from "astro"
import { getCv, type Locale } from "@/cv"
import { localeStaticPaths } from "@/lib/i18n"
import { buildPortfolioMarkdown } from "@/lib/portfolioMarkdown"

export const getStaticPaths = localeStaticPaths

/**
 * Fuente única del CV en Markdown: la usa la vista Markdown del sitio (que lo
 * interpreta en el build) y sirve como descarga directa, un archivo por idioma.
 *
 * El tipo de contenido y la caché los sirve el host (`public/_headers`): en un
 * build estático las cabeceras de esta `Response` se descartan.
 */
export const GET: APIRoute<{ locale: Locale }> = async ({ props }) => {
  const cv = await getCv()
  return new Response(buildPortfolioMarkdown(cv, props.locale))
}
