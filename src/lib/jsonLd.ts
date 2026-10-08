import type { CvData, Locale } from "@/cv"
import { localized, localizedPath, LOCALE_TAGS, t } from "./i18n"
import { projectPagePath, publicPagePath } from "./publicPages"
import { sectionTitle } from "./sections"

/**
 * Serializa el JSON-LD para incrustarlo en un `<script>`.
 *
 * `JSON.stringify` no escapa `<`, así que un `</script>` dentro de cualquier
 * texto del CV cerraría la etiqueta antes de tiempo y rompería la página entera.
 * Escapar el signo de menor lo impide y sigue siendo JSON válido.
 */
export function serializeJsonLd(jsonLd: unknown): string {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c")
}

/**
 * Los centros de una titulación, uno por nodo.
 *
 * El Bachillerato pasó por dos institutos y en `cv.json` van en un solo campo
 * separados por ` · `, porque en la página son una fila y no dos. Aquí no
 * pueden salir así: un `EducationalOrganization` llamado «A · B» es una
 * organización que no existe. Se parte, y cada centro sale como lo que es.
 */
function educationalOrganizations(institution: string) {
  return institution.split(" · ").map((name) => ({
    "@type": "EducationalOrganization",
    name,
  }))
}

export interface JsonLdPage {
  /**
   * La canónica de **esta** página, la misma que declara `<link rel="canonical">`.
   *
   * Hasta el 11-09-2026 no existía este parámetro y la función recomponía
   * siempre la portada, así que las 36 URL indexables emitían un nodo con el
   * mismo `@id` diciendo ser `https://imadelmalki.com/` mientras su propio
   * canonical decía otra cosa. Es el `SEO-02` de `AUDIT-2026-09-11.md`: un
   * `@id` repetido es justo lo que un `@id` existe para no ser.
   */
  canonical: string
  /** El título de la página, para el nodo que la describe. */
  title: string
  /** Su descripción, la misma de la etiqueta `description`. */
  description: string
  /** El `id` del proyecto del que trata, si la página es su ficha. */
  projectId?: string
  /**
   * Cuándo cambió por última vez lo que dice la página, en ISO 8601.
   *
   * Google lo recomienda en `ProfilePage` y es la misma fecha que el `lastmod`
   * del sitemap. Sólo la declara la portada: es la única `ProfilePage`.
   */
  dateModified?: string
}

/** El `@id` estable de un proyecto, compartido por todas las páginas. */
function projectNodeId(base: string, projectId: string): string {
  return `${base}/#project-${projectId}`
}

/**
 * El nodo que describe la página, y las migas cuando es una ficha.
 *
 * El tipo depende de qué es la página, que es la información que antes se
 * perdía: la portada es la `ProfilePage` de una persona, la ficha de un proyecto
 * es una `ItemPage` cuyo sujeto es ese proyecto, y lo demás son `WebPage`.
 * `mainEntity` es lo que ata cada una a su sujeto sin inventar nodos nuevos: los
 * de los proyectos ya existen y son los mismos en todo el sitio.
 */
function pageNodes(
  page: JsonLdPage,
  locale: Locale,
  base: string,
  personId: string,
  imageId: string,
  isHome: boolean,
  /* El nombre del proyecto a secas, no el `<title>`: la última miga nombra la
     página donde ya estás, y «Race Hub · Imad El Malki Jaddi» ahí es el título
     del documento repitiendo el sitio en el que se está. */
  projectName?: string,
) {
  const canonical = page.canonical
  const pageId = `${canonical}#page`
  const breadcrumbId = `${canonical}#breadcrumb`
  const absolute = (path: string) => new URL(path, `${base}/`).toString()

  const type = page.projectId ? "ItemPage" : isHome ? "ProfilePage" : "WebPage"
  const subject = page.projectId
    ? projectNodeId(base, page.projectId)
    : personId

  const node = {
    "@type": type,
    "@id": pageId,
    url: canonical,
    name: page.title,
    description: page.description,
    inLanguage: LOCALE_TAGS[locale],
    mainEntity: { "@id": subject },
    /* La tarjeta compuesta es la de la portada; sólo allí es la imagen
       principal de la página. En una ficha la imagen que manda son sus
       capturas, y declarar el retrato sería decir que la página va de quien la
       escribió. */
    ...(isHome ? { primaryImageOfPage: { "@id": imageId } } : {}),
    ...(isHome && page.dateModified ? { dateModified: page.dateModified } : {}),
    ...(page.projectId ? { breadcrumb: { "@id": breadcrumbId } } : {}),
  }

  if (!page.projectId) return [node]

  return [
    node,
    {
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: [
        [t(locale, "home"), localizedPath(locale)],
        [sectionTitle("projects", locale), publicPagePath("projects", locale)],
        [projectName ?? page.title, projectPagePath(page.projectId, locale)],
      ].map(([name, path], index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
        item: absolute(path as string),
      })),
    },
  ]
}

/**
 * Construye el grafo localizado de una página.
 *
 * La `Person` y los proyectos son entidades del sitio, no de la página: llevan
 * `@id` anclados al dominio y se repiten igual en todas, que es como se supone
 * que funciona un grafo. Lo que cambia de una página a otra es el nodo que
 * **la describe a ella**, y de eso se encarga `pageNodes`.
 */
export function buildProfileJsonLd(
  cv: Readonly<CvData>,
  siteUrl: string,
  locale: Locale,
  page: JsonLdPage,
) {
  const { basics, work, education, certificates, skills } = cv
  const base = siteUrl.replace(/\/$/, "")
  const home = new URL(localizedPath(locale), `${base}/`).toString()
  const canonical = page.canonical || home
  const isHome = canonical === home
  const personId = `${base}/#person`
  const imageId = `${base}/portrait.webp#primary-image`
  const [givenName = basics.name, ...familyNameParts] = basics.name
    .trim()
    .split(/\s+/)
  const familyName = familyNameParts.join(" ")

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...pageNodes(
        /* La portada conserva el titular y el lema del CV, que es lo que
           describe a la persona mejor que el `<title>`; el resto de las páginas
           se describen con el suyo. */
        isHome
          ? {
              ...page,
              canonical,
              title: localized(basics.headline, locale),
              description: localized(basics.tagline, locale),
            }
          : { ...page, canonical },
        locale,
        base,
        personId,
        imageId,
        isHome,
        page.projectId
          ? localized(
              cv.projects.find(({ id }) => id === page.projectId)!.name,
              locale,
            )
          : undefined,
      ),
      {
        "@type": "Person",
        "@id": personId,
        name: basics.name,
        givenName,
        familyName,
        jobTitle: localized(basics.label, locale),
        description: localized(basics.summary, locale),
        email: basics.email,
        url: canonical,
        image: {
          "@type": "ImageObject",
          "@id": imageId,
          contentUrl: new URL(basics.image, `${base}/`).toString(),
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: basics.location.city,
          addressRegion: localized(basics.location.region, locale),
          addressCountry: basics.location.countryCode,
        },
        sameAs: basics.profiles.map(({ url }) => url),
        knowsAbout: skills.map(({ name }) => name),
        knowsLanguage: cv.languages.map(({ language }) =>
          localized(language, locale),
        ),
        worksFor: work
          .filter(({ endDate }) => endDate === null)
          .map(({ name, url }) => ({
            "@type": "Organization",
            name,
            url,
          })),
        /* Sin repetidos: quien estudia dos titulaciones en el mismo centro no
           es dos veces alumno de él. */
        alumniOf: Object.values(
          Object.fromEntries(
            education
              .flatMap(({ institution }) =>
                educationalOrganizations(institution),
              )
              .map((organization) => [organization.name, organization]),
          ),
        ),
        /* Titulaciones y certificados comparten lista porque schema.org sólo
           tiene una: los distingue `credentialCategory` y quién los reconoce
           —una `EducationalOrganization` frente a la empresa que impartió el
           curso—. Los `@id` siguen siendo correlativos sobre la lista entera
           para que no se repita ninguno. */
        hasCredential: [
          ...education.map(
            ({ institution, area, studyType, startDate, endDate }) => ({
              "@type": "EducationalOccupationalCredential",
              name: `${localized(studyType, locale)} · ${localized(area, locale)}`,
              credentialCategory: localized(studyType, locale),
              dateCreated: endDate ?? startDate,
              /* Uno o varios: JSON-LD admite lista en cualquier propiedad, y
                 un título cursado en dos centros lo reconocen los dos. */
              recognizedBy: educationalOrganizations(institution),
            }),
          ),
          ...certificates.map(({ name, issuer, date, url }) => ({
            "@type": "EducationalOccupationalCredential",
            name: localized(name, locale),
            credentialCategory: "certificate",
            dateCreated: date,
            recognizedBy: { "@type": "Organization", name: issuer },
            /* La ficha del curso, donde la hay: es lo que le da a un buscador
               algo con lo que cotejar el nombre del certificado. */
            ...(url ? { url } : {}),
          })),
        ].map((credential, index) => ({
          ...credential,
          "@id": `${personId}-credential-${index + 1}`,
        })),
      },
      ...projectNodes(cv, locale, base, personId),
    ],
  }
}

/**
 * Un nodo por proyecto, colgando de la misma `Person`.
 *
 * Sin esto, los siete proyectos son para un buscador un tocho de texto dentro
 * de la página: se leen, pero no se sabe que son **cosas** con nombre, autor y
 * tecnologías. Como nodos del grafo sí, y de paso quedan enlazados a quien los
 * hizo por `author`, que es la relación que interesa —el sujeto de la página
 * sigue siendo la persona, no el catálogo—.
 *
 * ## `SoftwareSourceCode` y no `CreativeWork`
 *
 * Es el tipo específico para código, y admite justo lo que estos proyectos
 * tienen: `programmingLanguage` para el stack y `codeRepository` para el
 * enlace al fuente. `CreativeWork` sería el genérico y perdería las dos.
 *
 * ## Los privados también entran
 *
 * `status: "private"` significa que no hay enlace público, no que el proyecto
 * sea secreto: ya se lee entero en la página. Lo que cambia es que no lleva
 * `url` ni `codeRepository`, porque no existen — inventarlos sería peor que
 * omitirlos.
 */
function projectNodes(
  cv: Readonly<CvData>,
  locale: Locale,
  base: string,
  personId: string,
) {
  return cv.projects.map((project) => {
    const { id, name, description, technologies, links } = project
    /* `kind` sale del `z.enum` del esquema, así que estos dos siempre son el
       que dicen ser: no hace falta adivinar por el dominio de la URL. */
    const source = links?.find((link) => link.kind === "source")
    const site = links?.find((link) => link.kind === "website")

    return {
      "@type": "SoftwareSourceCode",
      "@id": projectNodeId(base, id),
      name: localized(name, locale),
      description: localized(description, locale),
      programmingLanguage: technologies,
      author: { "@id": personId },
      ...(site ? { url: site.url } : {}),
      ...(source ? { codeRepository: source.url } : {}),
    }
  })
}
