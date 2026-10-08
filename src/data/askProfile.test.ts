import { describe, expect, it } from "vitest"

import cvData from "../../cv.json"
import { flattenLocalized } from "../lib/ask"
import { ASK_PROFILE } from "./askProfile"

describe("ASK_PROFILE", () => {
  /**
   * Aquí se exigía la correspondencia 1:1 con `cv.otherWork`: doce empresas
   * detalladas, ni una más ni una menos. Ahora se exige lo contrario.
   *
   * El perfil del asistente ya no habla de la etapa anterior a programar, y la
   * única forma de que un modelo no cuente algo es que no lo tenga delante. Los
   * empleos siguen en `cv.json` —el currículum no miente sobre seis años— pero
   * ninguno de sus nombres puede aparecer en lo que se le envía.
   */
  it("no trae ni un nombre de los empleos anteriores a programar", () => {
    const profile = JSON.stringify(ASK_PROFILE)

    expect(cvData.otherWork.length).toBeGreaterThan(0)
    for (const { name } of cvData.otherWork) {
      expect(profile, name).not.toContain(name)
    }
  })

  /**
   * El suelo era de 5 000 caracteres, escrito a mano. Medía el expediente de
   * entonces, no una propiedad: la copia pública sustituye este módulo por un
   * stub (`scripts/export-public.mjs`) y allí daba rojo sin que nada
   * estuviera roto. Ahora se exige que cada sección traiga hechos y que cada
   * hecho diga algo en los tres idiomas, que es lo que de verdad se vigila:
   * una traducción que falta aplana el objeto a `[object Object]` o deja un
   * `undefined`, y las dos cosas acaban dentro del prompt.
   */
  it("está completo en los tres idiomas", () => {
    expect(ASK_PROFILE.sections.length).toBeGreaterThan(0)

    for (const locale of ["es", "ca", "en"]) {
      const profile = JSON.stringify(flattenLocalized(ASK_PROFILE, locale))
      expect(profile).not.toContain("[object Object]")
      expect(profile).not.toContain("undefined")

      for (const section of ASK_PROFILE.sections) {
        const title = section.title[locale as keyof typeof section.title]
        expect(title.trim().length, `título ${locale}`).toBeGreaterThan(0)
        expect(section.facts.length, title).toBeGreaterThan(0)

        for (const fact of section.facts) {
          const text = fact[locale as keyof typeof fact]
          expect(text.trim().length, `${title} · ${locale}`).toBeGreaterThan(20)
        }
      }
    }
  })
})
