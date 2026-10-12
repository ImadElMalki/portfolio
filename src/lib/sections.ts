import type { Locale } from "@/cv"
import { t, type UiKey } from "./ui"

/**
 * ID estable y título de cada bloque público del portfolio, **en el orden del
 * documento**: el que sale en el Markdown, en `/cv.json` y en la consola.
 *
 * La página no lo usa. Desde que Educación e Idiomas bajaron por debajo de
 * Proyectos hay dos órdenes, y separarlos era la única forma de mover la web
 * sin mover el CV: ver `WEB_SECTIONS`.
 */
export const PORTFOLIO_SECTIONS = [
  { name: "hero", id: "home", titleKey: "home" },
  { name: "about", id: "about", titleKey: "sectionAbout" },
  {
    name: "experience",
    id: "experience",
    titleKey: "sectionExperience",
  },
  { name: "education", id: "education", titleKey: "sectionEducation" },
  {
    name: "certificates",
    id: "certificates",
    titleKey: "sectionCertificates",
  },
  { name: "languages", id: "languages", titleKey: "sectionLanguages" },
  { name: "projects", id: "projects", titleKey: "sectionProjects" },
  { name: "skills", id: "skills", titleKey: "sectionSkills" },
] as const satisfies ReadonlyArray<{
  name: string
  id: string
  titleKey: UiKey
}>

export type SectionName = (typeof PORTFOLIO_SECTIONS)[number]["name"]

function sectionDefinition(name: SectionName) {
  const definition = PORTFOLIO_SECTIONS.find((item) => item.name === name)

  if (!definition) throw new Error(`Unknown portfolio section: ${name}`)
  return definition
}

/**
 * El mismo material en el orden de la **página**.
 *
 * Un CV en papel abre por la formación; una portada que se lee en pantalla, no:
 * quien entra quiere ver qué se ha construido antes de dónde se estudió. Así
 * que aquí Proyectos sube y Educación e Idiomas caen detrás.
 *
 * Es una permutación de `PORTFOLIO_SECTIONS`, no una lista aparte —se deriva de
 * ella y `sections.test.ts` comprueba que no falte ni sobre ninguna—, para que
 * añadir una sección al documento y olvidarla en la web falle en las pruebas y
 * no en producción.
 */
const WEB_ORDER = [
  "hero",
  "about",
  "experience",
  "projects",
  "education",
  "certificates",
  "languages",
  "skills",
] as const satisfies ReadonlyArray<SectionName>

export const WEB_SECTIONS = WEB_ORDER.map(sectionDefinition)

export function sectionTitle(name: SectionName, locale: Locale): string {
  return t(locale, sectionDefinition(name).titleKey)
}

export function sectionId(name: SectionName): string {
  return sectionDefinition(name).id
}

/**
 * Número de instrumento del encabezado: `"01"`, `"02"`…
 *
 * Se cuenta **sin el hero**, que es la única sección sin `<h2>` en la página:
 * numerando la lista entera, «Sobre mí» —el primer encabezado que se ve—
 * abriría en 02 y eso se lee como un fallo, no como un índice.
 *
 * Recibe el `id` y no el `name` para no tocar las seis llamadas a `<Section>`,
 * que ya pasan `sectionId(...)`. Devuelve `undefined` para lo que no está en la
 * lista —la landing de servicios monta `<Section>` con ids propios—.
 *
 * Cuenta sobre `WEB_SECTIONS` y no sobre el orden del documento: la insignia se
 * pinta en la página, y numerar por el Markdown dejaría a Educación con un 03
 * apareciendo la quinta, que se lee como un fallo.
 */
export function sectionOrdinal(id: string): string | undefined {
  const index = NUMBERED_SECTIONS.findIndex((section) => section.id === id)

  return index === -1 ? undefined : String(index + 1).padStart(2, "0")
}

/** Las secciones que llevan número: todas menos el hero, que es la portada. */
const NUMBERED_SECTIONS = WEB_SECTIONS.filter(
  (section) => section.name !== "hero",
)

/**
 * El denominador del contador de la barra, con el mismo formato que el
 * numerador.
 *
 * Sale de la misma lista que `sectionOrdinal`, así que añadir una sección al CV
 * mueve las dos mitades a la vez y no hay un `07` escrito a mano en ningún
 * sitio esperando a quedarse desfasado.
 */
export const SECTION_TOTAL = String(NUMBERED_SECTIONS.length).padStart(2, "0")

/**
 * Ancla de cierre de la portada.
 *
 * **No** entra en `PORTFOLIO_SECTIONS` a propósito: esa lista es el documento
 * —el Markdown, el PDF y la consola—, y un «## Contacto» ahí duplicaría en el
 * CV lo que la cabecera ya dice. El formulario es de la web y sólo de la web.
 *
 * En el índice lateral sí aparece, que es asunto del índice: es la última
 * parada de la página y la única que pide algo a quien la lee.
 */
export const CLOSING_SECTION_ID = "contact"

export function navSections(
  locale: Locale,
): ReadonlyArray<{ id: string; label: string }> {
  return [
    // `WEB_SECTIONS`: el índice lateral marca por dónde va el scroll, así que
    // tiene que ir en el orden en que se atraviesan las secciones.
    ...WEB_SECTIONS.map(({ id, titleKey }) => ({
      id,
      label: t(locale, titleKey),
    })),
    { id: CLOSING_SECTION_ID, label: t(locale, "contactHeading") },
  ]
}
