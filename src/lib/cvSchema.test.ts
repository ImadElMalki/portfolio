import { describe, expect, it } from "vitest"
import cv from "../../cv.json"
import { parseCvFile } from "./cvFileParser"
import { cvSchema, isoDateSchema } from "./cvSchema"

function withFirstWork(patch: Record<string, unknown>): unknown {
  const [first, ...rest] = cv.work
  if (!first) throw new Error("The CV fixture needs one work entry")

  return { ...cv, work: [{ ...first, ...patch }, ...rest] }
}

describe("cvSchema", () => {
  it("accepts the complete production CV", () => {
    expect(cvSchema.safeParse(cv).success).toBe(true)
  })

  it("rejects a missing required translation", () => {
    const invalid = {
      ...cv,
      basics: {
        ...cv.basics,
        label: { es: cv.basics.label.es, ca: cv.basics.label.ca },
      },
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects unknown keys at every object boundary", () => {
    const invalid = {
      ...cv,
      basics: { ...cv.basics, unreviewedField: true },
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })

  /* `featured` decide qué certificados quedan fuera del pliegue en la web. Es
     opcional —seis de los diez no lo llevan— pero no es un campo libre: escribir
     `"true"` en vez de `true` dejaría el pliegue en silencio con el aspecto de
     estar bien. */
  it("accepts certificates with and without the featured flag", () => {
    const [first, ...rest] = cv.certificates
    if (!first) throw new Error("The CV fixture needs one certificate")

    const withoutFlag = { ...first }
    delete (withoutFlag as { featured?: boolean }).featured

    expect(
      cvSchema.safeParse({ ...cv, certificates: [withoutFlag, ...rest] })
        .success,
    ).toBe(true)
    expect(
      cvSchema.safeParse({
        ...cv,
        certificates: [{ ...first, featured: "true" }, ...rest],
      }).success,
    ).toBe(false)
  })

  it("rejects invalid email, URL and calendar dates", () => {
    expect(
      cvSchema.safeParse({
        ...cv,
        basics: { ...cv.basics, email: "not-an-email" },
      }).success,
    ).toBe(false)
    expect(
      cvSchema.safeParse({
        ...cv,
        basics: {
          ...cv.basics,
          profiles: [{ ...cv.basics.profiles[0], url: "not-a-url" }],
        },
      }).success,
    ).toBe(false)
    expect(
      cvSchema.safeParse(withFirstWork({ startDate: "2026-02-30" })).success,
    ).toBe(false)
    expect(isoDateSchema.safeParse("2026-08-16").success).toBe(true)
  })

  it("treats the employer description as optional but fully localized", () => {
    const { description: _dropped, ...withoutDescription } = cv.work[0] ?? {}

    expect(
      cvSchema.safeParse({
        ...cv,
        work: [withoutDescription, ...cv.work.slice(1)],
      }).success,
    ).toBe(true)
    expect(
      cvSchema.safeParse(withFirstWork({ description: { es: "Filial" } }))
        .success,
    ).toBe(false)
  })

  it("rejects duplicate project IDs", () => {
    const [first, second, ...rest] = cv.projects
    if (!first || !second) throw new Error("The CV fixture needs two projects")

    const invalid = {
      ...cv,
      projects: [first, { ...second, id: first.id }, ...rest],
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects duplicate education IDs", () => {
    const [first, second, ...rest] = cv.education
    if (!first || !second) throw new Error("The CV fixture needs two studies")

    const invalid = {
      ...cv,
      education: [first, { ...second, id: first.id }, ...rest],
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects duplicate certificate IDs", () => {
    const [first, second, ...rest] = cv.certificates
    if (!first || !second) {
      throw new Error("The CV fixture needs two certificates")
    }

    const invalid = {
      ...cv,
      certificates: [first, { ...second, id: first.id }, ...rest],
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects resume references that do not exist", () => {
    const invalid = {
      ...cv,
      resume: {
        ...cv.resume,
        projectIds: [cv.resume.projectIds[0], "missing-project"],
      },
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects duplicate resume references", () => {
    const [projectId] = cv.resume.projectIds
    if (!projectId) throw new Error("The CV fixture needs a resume project")

    const invalid = {
      ...cv,
      resume: { ...cv.resume, projectIds: [projectId, projectId] },
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })

  it("requires every resume skill-group translation", () => {
    const [first, ...rest] = cv.resume.skillGroups
    if (!first) throw new Error("The CV fixture needs a resume skill group")

    const invalid = {
      ...cv,
      resume: {
        ...cv.resume,
        skillGroups: [
          { ...first, label: { es: first.label.es, en: first.label.en } },
          ...rest,
        ],
      },
    }

    expect(cvSchema.safeParse(invalid).success).toBe(false)
  })
})

describe("parseCvFile", () => {
  it("wraps the whole document as the single cv entry", () => {
    const parsed = parseCvFile(JSON.stringify(cv))

    expect(Object.keys(parsed)).toEqual(["cv"])
    expect(parsed.cv).toEqual(cv)
  })

  it("rejects a non-object root", () => {
    expect(() => parseCvFile("[]")).toThrow(/root object/)
  })
})
