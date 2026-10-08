import { describe, expect, it } from "vitest"

import cv from "../../cv.json"
import { CASE_STUDIES, caseStudyOf } from "./caseStudies"

const LOCALES = ["es", "ca", "en"] as const

describe("CASE_STUDIES", () => {
  const ids = Object.keys(CASE_STUDIES)

  it("apunta a proyectos que existen", () => {
    const projects = new Set(cv.projects.map(({ id }) => id))

    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(projects, id).toContain(id)
  })

  /**
   * Un caso a medias es peor que ninguno: el lector nota el relleno y deja de
   * creerse el resto. Por eso la ficha sólo pinta estas secciones si hay
   * entrada, y por eso aquí se exige que la entrada esté entera. Los suelos de
   * longitud separan «escrito» de «un par de palabras para que compile».
   */
  it.each(ids)("tiene %s completo en los tres idiomas", (id) => {
    const study = caseStudyOf(id)
    expect(study).toBeDefined()
    if (!study) return

    for (const locale of LOCALES) {
      expect(study.context[locale].length, `context ${locale}`).toBeGreaterThan(
        80,
      )
      expect(study.role[locale].length, `role ${locale}`).toBeGreaterThan(40)
      expect(study.lessons[locale].length, `lessons ${locale}`).toBeGreaterThan(
        80,
      )

      expect(study.decisions.length, "decisiones").toBeGreaterThanOrEqual(2)
      for (const { title, why } of study.decisions) {
        expect(title[locale].trim().length, `title ${locale}`).toBeGreaterThan(
          5,
        )
        expect(why[locale].length, `why ${locale}`).toBeGreaterThan(80)
      }

      expect(study.outcome.length, "resultados").toBeGreaterThanOrEqual(1)
      for (const line of study.outcome) {
        expect(line[locale].length, `outcome ${locale}`).toBeGreaterThan(40)
      }
    }
  })

  /**
   * «Resultado» sin una cifra es una opinión. No se exige en cada línea —hay
   * resultados que de verdad no son numéricos— pero sí que el bloque entero
   * traiga al menos una.
   */
  it.each(ids)("da al menos una cifra en el resultado de %s", (id) => {
    const study = caseStudyOf(id)
    if (!study) return

    for (const locale of LOCALES) {
      const text = study.outcome.map((line) => line[locale]).join(" ")
      expect(text, `outcome ${locale}`).toMatch(/\d/)
    }
  })

  it("no conoce proyectos que no tengan caso", () => {
    expect(caseStudyOf("no-existe")).toBeUndefined()
  })
})
