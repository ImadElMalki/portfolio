import { describe, expect, it } from "vitest"
import cvJson from "../../cv.json"
import { cvSchema, type Locale } from "./cvSchema"
import {
  buildResumeSelection,
  formatResumeDateRange,
  formatResumePhone,
  RESUME_COPY,
} from "./resume"

const cv = cvSchema.parse(cvJson)

describe("buildResumeSelection", () => {
  it("selects projects in the curated order", () => {
    const resume = buildResumeSelection(cv)

    expect(resume.projects.map(({ id }) => id)).toEqual([
      "100-cims",
      "strava-garmin-platform",
    ])
  })

  it("selects the DAW education only", () => {
    const resume = buildResumeSelection(cv)

    expect(resume.education.map(({ id }) => id)).toEqual(["daw"])
  })

  it("selects five role-relevant certificates", () => {
    const resume = buildResumeSelection(cv)

    expect(resume.certificates.map(({ id }) => id)).toEqual([
      "angular-devtalles",
      "spring-boot-starters-viewnext",
      "jpa-viewnext",
      "sql-avanzado-viewnext",
      "docker-devops-midu",
    ])
  })
})

describe("formatResumeDateRange", () => {
  it.each([
    { locale: "es", expected: "jul 2023 - actualidad" },
    { locale: "ca", expected: "jul 2023 - actualitat" },
    { locale: "en", expected: "Jul 2023 - Present" },
  ] satisfies ReadonlyArray<{ locale: Locale; expected: string }>)(
    "formats the current role in $locale",
    ({ locale, expected }) => {
      expect(formatResumeDateRange("2023-07-04", null, locale)).toBe(expected)
    },
  )
})

describe("formatResumePhone", () => {
  it("groups the Spanish E.164 number for people and parsers", () => {
    expect(formatResumePhone("+34641829721")).toBe("+34 641 829 721")
  })
})

describe("RESUME_COPY", () => {
  it.each([
    {
      locale: "es",
      contact: "Datos de contacto",
      training: "Certificaciones",
    },
    {
      locale: "ca",
      contact: "Dades de contacte",
      training: "Certificacions",
    },
    {
      locale: "en",
      contact: "Contact details",
      training: "Certifications",
    },
  ] satisfies ReadonlyArray<{
    locale: Locale
    contact: string
    training: string
  }>)(
    "provides the visual resume labels in $locale",
    ({ locale, contact, training }) => {
      expect(RESUME_COPY[locale].contact).toBe(contact)
      expect(RESUME_COPY[locale].sections.training).toBe(training)
    },
  )
})
