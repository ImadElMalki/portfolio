import type { APIRoute } from "astro"
import { getCv, type Locale } from "@/cv"
import { localeStaticPaths, localized, localizedPath } from "@/lib/i18n"
import { projectPagePath } from "@/lib/publicPages"

export const getStaticPaths = localeStaticPaths

/**
 * A dónde puede llevar una respuesta del asistente.
 *
 * El asistente contesta en texto plano y sin Markdown —lo pide el prompt—, así
 * que una respuesta que nombra un proyecto es un callejón: se lee, se cierra y
 * no pasa nada. Los enlaces no los escribe el modelo, que se los inventaría:
 * los pone el panel cotejando el nombre que ha salido con esta tabla.
 *
 * ## Por qué un fichero y no atributos en el HTML
 *
 * Son ocho nombres con su dirección, y la píldora del asistente está en todas
 * las páginas indexables: metidos en el marcado viajarían en cada visita para
 * los pocos que abren el panel. Se piden al abrirlo, como el banco de
 * preguntas, y por el mismo motivo.
 *
 * ## Y por qué una ruta y no un fichero en `public/`
 *
 * El banco de preguntas lo escribe un guion y se versiona, porque es texto
 * redactado. Esto no: son los proyectos de `cv.json` y las direcciones que
 * calcula `publicPages.ts`. Generándolo en el build no hay copia que se quede
 * atrás cuando se añada un proyecto o cambie un slug.
 */
export const GET: APIRoute<{ locale: Locale }> = async ({ props }) => {
  const { locale } = props
  const cv = await getCv()

  return new Response(
    JSON.stringify({
      projects: cv.projects.map((project) => ({
        name: localized(project.name, locale),
        url: projectPagePath(project.id, locale),
      })),
      /* La portada y su cierre: el formulario propio, no el buzón. Es el mismo
         sitio al que manda el botón «Hablemos» del hero. */
      contact: `${localizedPath(locale, "/")}#contact`,
      cv: localizedPath(locale, "/cv.pdf"),
    }),
  )
}
