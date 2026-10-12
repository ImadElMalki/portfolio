import type { Locale } from "@/cv"
import SLUGS from "./publicPageSlugs.json"
import { DEFAULT_LOCALE, LOCALES, localizedPath } from "./i18n"

export const PUBLIC_PAGE_NAMES = [
  "about",
  "services",
  "privacy",
  "projects",
] as const
export type PublicPage = (typeof PUBLIC_PAGE_NAMES)[number]

/**
 * Los slugs viven en JSON y no aquí, y no es por gusto: `astro.config.mjs` los
 * necesita para escribir los `hreflang` del sitemap y no puede importar un
 * `.ts`. Duplicar la tabla era garantizar que un día dijeran cosas distintas —y
 * el sitemap ya lo hizo: proponía `/en/about/` sin ninguna alternativa mientras
 * la página declaraba las cuatro.
 */
export const PUBLIC_PAGE_SLUGS = SLUGS satisfies Record<
  PublicPage,
  Record<Locale, string>
>

export interface PublicPageStaticPath {
  params: { locale: Locale | undefined; pageSlug: string }
  props: { locale: Locale; page: PublicPage }
}

export function publicPagePath(page: PublicPage, locale: Locale): string {
  return localizedPath(locale, PUBLIC_PAGE_SLUGS[page][locale])
}

export function publicPageHrefs(page: PublicPage): Record<Locale, string> {
  return {
    es: publicPagePath(page, "es"),
    ca: publicPagePath(page, "ca"),
    en: publicPagePath(page, "en"),
  }
}

export function publicPageStaticPaths(): readonly PublicPageStaticPath[] {
  return PUBLIC_PAGE_NAMES.flatMap((page) =>
    LOCALES.map((locale) => ({
      params: {
        locale: locale === DEFAULT_LOCALE ? undefined : locale,
        pageSlug: PUBLIC_PAGE_SLUGS[page][locale],
      },
      props: { locale, page },
    })),
  )
}

/**
 * Cada proyecto, su propia dirección.
 *
 * El detalle de un proyecto vivía sólo en un `<dialog>` de la portada y en
 * `/project-details/`, que lleva `noindex` y está fuera del sitemap: no había
 * ninguna URL que enviar por correo ni que un buscador pudiera indexar. Desde
 * aquí sale `/proyectos/<id>/` —con `projectes` y `projects` en los otros dos
 * idiomas—, y el diálogo pasa a ser el atajo, no la única puerta.
 *
 * ## El identificador no se traduce, y el segmento sí
 *
 * El último tramo es el `id` de `cv.json`, el mismo que ya nombra el diálogo y
 * el hash `#proyecto/<id>`. Se queda igual en los tres idiomas por la razón que
 * ya está escrita en `Projects.astro`: una dirección compartida tiene que
 * seguir abriendo el mismo proyecto aunque quien la reciba lea el sitio en otro
 * idioma. Lo que sí se traduce es el segmento de arriba, porque es una palabra
 * que se lee, no una clave.
 */
export function projectPagePath(projectId: string, locale: Locale): string {
  return localizedPath(
    locale,
    `${PUBLIC_PAGE_SLUGS.projects[locale]}/${projectId}`,
  )
}

export function projectPageHrefs(projectId: string): Record<Locale, string> {
  return {
    es: projectPagePath(projectId, "es"),
    ca: projectPagePath(projectId, "ca"),
    en: projectPagePath(projectId, "en"),
  }
}

export interface ProjectPageStaticPath {
  params: {
    locale: Locale | undefined
    pageSlug: string
    projectSlug: string
  }
  props: { locale: Locale; projectId: string }
}

export function projectPageStaticPaths(
  projectIds: readonly string[],
): readonly ProjectPageStaticPath[] {
  return projectIds.flatMap((projectId) =>
    LOCALES.map((locale) => ({
      params: {
        locale: locale === DEFAULT_LOCALE ? undefined : locale,
        pageSlug: PUBLIC_PAGE_SLUGS.projects[locale],
        projectSlug: projectId,
      },
      props: { locale, projectId },
    })),
  )
}
