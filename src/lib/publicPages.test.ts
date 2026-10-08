import { describe, expect, it } from "vitest"
import { ABOUT_COPY } from "@/data/about"
import { PRIVACY_COPY } from "@/data/privacy"
import { LOCALES, t } from "./i18n"
import {
  PUBLIC_PAGE_SLUGS,
  projectPageHrefs,
  projectPagePath,
  projectPageStaticPaths,
  publicPageHrefs,
  publicPagePath,
  publicPageStaticPaths,
} from "./publicPages"

const EXPECTED_PATHS = [
  { page: "about", locale: "es", path: "/sobre-mi/" },
  { page: "about", locale: "ca", path: "/ca/sobre-mi/" },
  { page: "about", locale: "en", path: "/en/about/" },
  { page: "services", locale: "es", path: "/servicios/" },
  { page: "services", locale: "ca", path: "/ca/serveis/" },
  { page: "services", locale: "en", path: "/en/services/" },
  { page: "privacy", locale: "es", path: "/privacidad/" },
  { page: "privacy", locale: "ca", path: "/ca/privacitat/" },
  { page: "privacy", locale: "en", path: "/en/privacy/" },
  { page: "projects", locale: "es", path: "/proyectos/" },
  { page: "projects", locale: "ca", path: "/ca/projectes/" },
  { page: "projects", locale: "en", path: "/en/projects/" },
] as const

describe("rutas de las páginas públicas", () => {
  it.each(EXPECTED_PATHS)(
    "publica $page en $locale como $path",
    ({ page, locale, path }) => {
      expect(publicPagePath(page, locale)).toBe(path)
    },
  )

  it("compone los destinos trilingües de Sobre mí", () => {
    expect(publicPageHrefs("about")).toEqual({
      es: "/sobre-mi/",
      ca: "/ca/sobre-mi/",
      en: "/en/about/",
    })
  })

  it("genera destinos distintos", () => {
    const paths = EXPECTED_PATHS.map(({ page, locale }) =>
      publicPagePath(page, locale),
    )

    expect(new Set(paths).size).toBe(paths.length)
  })

  it("emite una ruta estática por página e idioma", () => {
    expect(publicPageStaticPaths()).toEqual(
      EXPECTED_PATHS.map(({ page, locale }) => ({
        params: {
          locale: locale === "es" ? undefined : locale,
          pageSlug: PUBLIC_PAGE_SLUGS[page][locale],
        },
        props: { locale, page },
      })),
    )
  })
})

describe("rutas de la ficha de cada proyecto", () => {
  /* El identificador es el mismo en los tres idiomas y el segmento de arriba no:
     es justo la combinación que el sitemap no sabe emparejar solo, y por la que
     `astro.config.mjs` tiene que declarar el grupo a mano. */
  it.each([
    ["es", "/proyectos/riolan-solutions/"],
    ["ca", "/ca/projectes/riolan-solutions/"],
    ["en", "/en/projects/riolan-solutions/"],
  ] as const)("publica la ficha en %s como %s", (locale, path) => {
    expect(projectPagePath("riolan-solutions", locale)).toBe(path)
  })

  it("no traduce el identificador del proyecto", () => {
    // Arrange / Act
    const hrefs = projectPageHrefs("100-cims")

    // Assert
    for (const href of Object.values(hrefs)) {
      expect(href).toMatch(/\/100-cims\/$/)
    }
  })

  it("compone los tres destinos de una ficha", () => {
    expect(projectPageHrefs("race-hub")).toEqual({
      es: "/proyectos/race-hub/",
      ca: "/ca/projectes/race-hub/",
      en: "/en/projects/race-hub/",
    })
  })

  it("emite una ruta estática por proyecto e idioma", () => {
    // Arrange
    const ids = ["race-hub", "100-cims"]

    // Act
    const paths = projectPageStaticPaths(ids)

    // Assert
    expect(paths).toHaveLength(ids.length * LOCALES.length)
    expect(paths[0]).toEqual({
      params: {
        locale: undefined,
        pageSlug: "proyectos",
        projectSlug: "race-hub",
      },
      props: { locale: "es", projectId: "race-hub" },
    })
  })

  it("no colisiona con las rutas de una sola pieza", () => {
    // Arrange / Act
    const pageSlugs = new Set(
      publicPageStaticPaths().map(
        ({ params }) => `${params.locale ?? "es"}/${params.pageSlug}`,
      ),
    )
    const projectSlugs = projectPageStaticPaths(["proyectos"]).map(
      ({ params }) =>
        `${params.locale ?? "es"}/${params.pageSlug}/${params.projectSlug}`,
    )

    // Assert: un proyecto llamado como el segmento sigue teniendo dos tramos.
    for (const slug of projectSlugs) expect(pageSlugs.has(slug)).toBe(false)
  })
})

describe("texto de privacidad", () => {
  const fields = localizedFields(PRIVACY_COPY, "PRIVACY_COPY")

  it("cubre las secciones esenciales", () => {
    // Arrange / Act
    const titles = PRIVACY_COPY.sections.map((section) => section.title.es)

    // Assert
    expect(titles).toEqual(
      expect.arrayContaining([
        "Responsable",
        "Base jurídica",
        "Proveedores y destinatarios",
        "Transferencias internacionales",
        "Conservación",
        "Tus derechos",
      ]),
    )
  })

  it.each(fields)("%s está completo en los tres idiomas", (_path, field) => {
    // Arrange / Act / Assert
    for (const locale of LOCALES) {
      expect(String(field[locale] ?? "").trim()).not.toBe("")
    }
  })
})

function localizedFields(
  value: unknown,
  path = "ABOUT_COPY",
): Array<[string, Record<string, unknown>]> {
  if (typeof value !== "object" || value === null) return []

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  const isLocalized =
    keys.length === LOCALES.length &&
    LOCALES.every((locale) => locale in record)

  if (isLocalized) return [[path, record]]

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      localizedFields(item, `${path}[${index}]`),
    )
  }

  return Object.entries(record).flatMap(([key, item]) =>
    localizedFields(item, `${path}.${key}`),
  )
}

describe("texto de Sobre mí", () => {
  const fields = localizedFields(ABOUT_COPY)

  it("organiza el relato en tres bloques", () => {
    expect(ABOUT_COPY.sections).toHaveLength(3)
  })

  it("encuentra contenido traducible en toda la página", () => {
    expect(fields.length).toBeGreaterThan(15)
  })

  it.each(fields)("%s está completo en los tres idiomas", (_, field) => {
    for (const locale of LOCALES) {
      const value = field[locale]
      expect(typeof value, locale).toBe("string")
      if (typeof value !== "string") continue

      expect(value.trim().length, locale).toBeGreaterThan(0)
    }
  })

  it.each([
    ["es", "Leer sobre mí"],
    ["ca", "Llegir sobre mi"],
    ["en", "Read about me"],
  ] as const)("usa una invitación técnica y directa en %s", (locale, label) => {
    expect(t(locale, "aboutMore")).toBe(label)
  })
})
