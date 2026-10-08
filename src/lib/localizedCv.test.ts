import { describe, expect, it } from "vitest"
import { Validator } from "jsonschema"
import jsonResumeSchema from "@jsonresume/schema/schema.json"
import cv from "../../cv.json"
import { LOCALES } from "./i18n"
import { cvSchema } from "./cvSchema"
import { JSON_RESUME_SCHEMA_URL, localizeCv } from "./localizedCv"

const cvData = cvSchema.parse(cv)
const SITE = "https://imadelmalki.com/"

/** Todo lo que sirve `/cv.json` debe ser una cadena, no un objeto por idioma. */
function assertFlat(value: unknown, path: string) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertFlat(item, `${path}[${i}]`))
    return
  }

  if (value === null || typeof value !== "object") return

  const keys = Object.keys(value)
  expect(
    LOCALES.every((locale) => keys.includes(locale)),
    `${path} sigue siendo un campo por idioma`,
  ).toBe(false)

  for (const [key, nested] of Object.entries(value)) {
    assertFlat(nested, `${path}.${key}`)
  }
}

describe("localizeCv", () => {
  it("aplana todos los campos traducibles al idioma pedido", () => {
    for (const locale of LOCALES) {
      assertFlat(localizeCv(cvData, locale, SITE), `cv[${locale}]`)
    }
  })

  it("elige el idioma correcto en cada campo", () => {
    const en = localizeCv(cvData, "en", "https://imadelmalki.com/en/")

    expect(en.basics.label).toBe(cvData.basics.label.en)
    expect(en.basics.summary).toBe(cvData.basics.summary.en)
    expect(en.work[0]?.position).toBe(cvData.work[0]?.position.en)
    expect(en.work[0]?.description).toBe(cvData.work[0]?.description?.en)
    // Las empresas sin nota no emiten la clave, que es opcional en JSON Resume.
    // Se busca por contenido y no por índice: `work` crece y se reordena cada
    // vez que cambia el historial, y un `1` fijo se rompe con ello.
    const sinNota = cvData.work.findIndex((job) => !job.description)
    expect(sinNota, "todas las empresas llevan nota").toBeGreaterThanOrEqual(0)
    expect(en.work[sinNota]).not.toHaveProperty("description")
    expect(en.languages[0]?.fluency).toBe(cvData.languages[0]?.fluency.en)
    expect(en.projects[3]?.name).toBe("Strava/Garmin Training Assistant")
    expect(en.basics.location.region).toBe("Barcelona")
  })

  it("deja fuera los metadatos del sitio, que no son JSON Resume", () => {
    const localizedCv = localizeCv(cvData, "es", SITE)
    const basics = localizedCv.basics

    expect(basics).not.toHaveProperty("headline")
    expect(basics).not.toHaveProperty("tagline")
    expect(basics).toHaveProperty("email")
    expect(basics).toHaveProperty("profiles")
    expect(basics.image).toBe("https://imadelmalki.com/portrait.webp")
    expect(basics.location.countryCode).toBe("ES")
    expect(localizedCv).not.toHaveProperty("resume")
    expect(localizedCv.education[0]).not.toHaveProperty("id")
    expect(localizedCv.certificates[0]).not.toHaveProperty("id")
  })

  it("conserva las secciones y su número de entradas", () => {
    const es = localizeCv(cvData, "es", SITE)

    expect(es.work).toHaveLength(cvData.work.length)
    expect(es.education).toHaveLength(cvData.education.length)
    expect(es.projects).toHaveLength(cvData.projects.length)
    expect(es.skills).toEqual(cvData.skills)
  })

  it("emite un JSON Resume válido contra la revisión fijada", () => {
    const validator = new Validator()

    for (const locale of LOCALES) {
      const localizedCv = localizeCv(
        cvData,
        locale,
        new URL(locale === "es" ? "/" : `/${locale}/`, SITE).toString(),
      )
      const result = validator.validate(localizedCv, jsonResumeSchema)

      expect(localizedCv.$schema).toBe(JSON_RESUME_SCHEMA_URL)
      expect(result.errors, locale).toEqual([])
    }
  })
})
