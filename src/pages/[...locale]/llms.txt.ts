import type { APIRoute } from "astro"
import { getCv, type Locale } from "@/cv"
import { localeStaticPaths, localizedPath, t } from "@/lib/i18n"
import { buildPortfolioMarkdown } from "@/lib/portfolioMarkdown"

export const getStaticPaths = localeStaticPaths

/**
 * Resumen legible por agentes (https://llmstxt.org): un LLM que visite el sitio
 * obtiene el contexto y los enlaces a las versiones en JSON y Markdown, en el
 * idioma de la ruta.
 */
export const GET: APIRoute<{ locale: Locale }> = async ({ props, site }) => {
  const { locale } = props
  const cv = await getCv()
  const base = site?.toString().replace(/\/$/, "") ?? ""
  const url = (path: string) => `${base}${localizedPath(locale, path)}`

  const body = [
    buildPortfolioMarkdown(cv, locale).trimEnd(),
    "",
    `## ${t(locale, "llmsMachineVersions")}`,
    "",
    `- [${t(locale, "jsonAlternate")}](${url("/cv.json")})`,
    `- [${t(locale, "markdownAlternate")}](${url("/cv.md")})`,
    "",
  ].join("\n")

  // Tipo de contenido y caché: `public/_headers` (build estático).
  return new Response(body)
}
