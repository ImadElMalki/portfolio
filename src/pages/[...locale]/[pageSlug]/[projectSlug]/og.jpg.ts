import type { APIRoute } from "astro"
import { getCv, type Locale } from "@/cv"
import { localized } from "@/lib/i18n"
import { ogFooter, renderOgCard } from "@/lib/ogCard"
import { projectPageStaticPaths } from "@/lib/publicPages"

/**
 * La tarjeta de una ficha de proyecto: `/proyectos/<id>/og.jpg`.
 *
 * Hasta el 08-10-2026 las veinticuatro fichas declaraban la tarjeta de la
 * portada, así que un enlace a un proyecto compartido en LinkedIn enseñaba el
 * retrato y el titular del portfolio sin decir de qué proyecto hablaba. Y un
 * proyecto es justo lo que se comparte: la portada ya la encuentra quien busca
 * el nombre.
 *
 * Las rutas salen de `projectPageStaticPaths`, el mismo origen que las páginas,
 * para que añadir un proyecto a `cv.json` publique las dos cosas y no una.
 */
export const getStaticPaths = async () => {
  const cv = await getCv()
  return projectPageStaticPaths(cv.projects.map(({ id }) => id))
}

export const GET: APIRoute<{ locale: Locale; projectId: string }> = async ({
  props,
  site,
}) => {
  const { locale, projectId } = props
  const cv = await getCv()
  const project = cv.projects.find(({ id }) => id === projectId)
  if (!project) throw new Error(`Unknown project for an OG card: ${projectId}`)

  return new Response(
    await renderOgCard({
      /* Un solo bloque y a 56 px: los nombres largos —«Strava/Garmin Training
         Assistant»— no caben a 76 junto al retrato. Dónde parte lo decide
         satori midiendo, que es lo que hace falta cuando el mismo proyecto se
         llama distinto en cada idioma. */
      title: [localized(project.name, locale)],
      titleSize: 56,
      subtitle: localized(project.description, locale),
      /* Aquí el nombre va al pie: el titular es del proyecto, pero la tarjeta
         sigue siendo de quien lo ha hecho. */
      footer: ogFooter([cv.basics.name, site?.hostname]),
    }),
  )
}
