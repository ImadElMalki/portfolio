import type { CvData, Locale } from "@/cv"
import { localized } from "./i18n"

export const JSON_RESUME_SCHEMA_URL =
  "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.2.1/schema.json"

/**
 * Aplana el CV multilingüe a un solo idioma.
 *
 * `cv.json` guarda cada campo traducible como objeto por idioma, pero el
 * estándar JSON Resume espera cadenas planas: el endpoint público sirve esta
 * versión para que cualquier herramienta que lo consuma lo entienda.
 */
export function localizeCv(
  cv: Readonly<CvData>,
  locale: Locale,
  siteUrl: string,
) {
  // `headline` y `tagline` son metadatos del sitio (el `<title>` y la
  // `description` de la página), no campos de JSON Resume: se quedan fuera del
  // endpoint público en vez de viajar como objetos por idioma.
  /* Y `summaryPrint` tampoco: es la misma frase escrita para el papel —ver
     `cvSchema.ts`— y JSON Resume no tiene ese campo. Con `additionalProperties`
     en la raíz el validador del build lo dejaría pasar, pero un consumidor del
     endpoint no sabría cuál de los dos resúmenes es el bueno. */
  const {
    headline: _headline,
    tagline: _tagline,
    summaryPrint: _summaryPrint,
    ...basics
  } = cv.basics

  return {
    $schema: JSON_RESUME_SCHEMA_URL,
    basics: {
      ...basics,
      label: localized(cv.basics.label, locale),
      image: new URL(cv.basics.image, siteUrl).toString(),
      url: new URL(siteUrl).toString(),
      summary: localized(cv.basics.summary, locale),
      location: {
        ...cv.basics.location,
        region: localized(cv.basics.location.region, locale),
      },
    },
    work: cv.work.map((job) => {
      /* Los dos campos de papel se quedan fuera por lo mismo que
         `basics.summaryPrint`. */
      const {
        endDate,
        description,
        summaryPrint: _summaryPrint,
        highlightsPrint: _highlightsPrint,
        ...entry
      } = job
      return {
        ...entry,
        ...(endDate ? { endDate } : {}),
        ...(description ? { description: localized(description, locale) } : {}),
        position: localized(job.position, locale),
        summary: localized(job.summary, locale),
        highlights: localized(job.highlights, locale),
      }
    }),
    /**
     * Los empleos de antes de programar, en su propia clave y no mezclados en
     * `work[]`.
     *
     * El esquema fijado declara `additionalProperties: true` en la raíz, así
     * que la validación del build lo acepta. Mezclarlos en `work` sí cambiaría
     * lo que leen la consola (`cat experience`, que pinta ficha completa) y la
     * trayectoria de la vista rápida, y ninguno de estos empleos trae resumen
     * ni destacados que enseñar ahí.
     */
    otherWork: cv.otherWork.map((job) => ({
      name: job.name,
      position: localized(job.position, locale),
      /* Las claves opcionales se omiten cuando no constan en vez de salir como
         `null`, igual que `hours` en los certificados. */
      ...(job.location ? { location: localized(job.location, locale) } : {}),
      field: localized(job.field, locale),
      startDate: job.startDate,
      endDate: job.endDate,
      ...(job.url ? { url: job.url } : {}),
    })),
    /* Viaja al lado de `otherWork` y por el mismo motivo: no es `skills` de
       JSON Resume —esa lista lleva nivel y la valida el registro de
       tecnologías— y mezclarlas dejaría una habilidad de almacén entre Angular
       y TypeScript. */
    otherSkills: localized(cv.otherSkills, locale),
    education: cv.education.map((item) => {
      /* `id` es una referencia interna del perfil curricular y no forma parte
         de JSON Resume. */
      const { id: _id, endDate, ...entry } = item
      return {
        ...entry,
        ...(endDate ? { endDate } : {}),
        area: localized(item.area, locale),
        studyType: localized(item.studyType, locale),
      }
    }),
    /* `hours` tampoco es campo del estándar, y viaja por la misma puerta que
       `level` en idiomas: `certificates.items` declara
       `additionalProperties: true`. Se omite cuando no consta en vez de salir
       como `null`. */
    certificates: cv.certificates.map((certificate) => ({
      name: localized(certificate.name, locale),
      issuer: certificate.issuer,
      date: certificate.date,
      ...(certificate.hours ? { hours: certificate.hours } : {}),
      /* `url` sí es del estándar. Aquí es la ficha del curso —ver
         `certificateSchema`—, y sale sólo en los siete que la tienen. */
      ...(certificate.url ? { url: certificate.url } : {}),
    })),
    /* `level` no es campo de JSON Resume, pero `languages.items` declara
       `additionalProperties: true` en el esquema v1.2.1, así que viaja sin
       romper la validación del build. Sale tal cual —`B1`, `native`—: es un
       código, no una traducción. */
    languages: cv.languages.map((item) => ({
      language: localized(item.language, locale),
      fluency: localized(item.fluency, locale),
      level: item.level,
    })),
    projects: cv.projects.map((project) => ({
      ...project,
      name: localized(project.name, locale),
      description: localized(project.description, locale),
      overview: localized(project.overview, locale),
      highlights: localized(project.highlights, locale),
      keywords: project.technologies,
      ...(project.links
        ? {
            links: project.links.map((link) => ({
              ...link,
              label: localized(link.label, locale),
            })),
          }
        : {}),
    })),
    skills: cv.skills,
  }
}
