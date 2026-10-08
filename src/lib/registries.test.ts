import { describe, expect, it } from "vitest"
import cv from "../../cv.json"
import { PROJECT_DEMOS } from "@/data/projectDemos"
import { companyLogo, LOGO_COMPANY_NAMES } from "./companyLogos"
import { cvSchema } from "./cvSchema"
import { TECHNOLOGIES, technologyMetadata } from "./technologyRegistry"

const parsed = cvSchema.parse(cv)

describe("stable registries", () => {
  it("relates every gallery through an existing unique project ID", () => {
    const ids = parsed.projects.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(PROJECT_DEMOS).sort()).toEqual([...ids].sort())
  })

  it("uses unique stable IDs for technologies and covers every skill", () => {
    const ids = TECHNOLOGIES.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const { name } of parsed.skills) {
      expect(technologyMetadata(name), name).toBeDefined()
    }
  })

  /**
   * El mismo contrato para los proyectos, que es por donde se colaba.
   *
   * `ProjectDetail.astro` resuelve el chip con `technologyDefinition(name)?.Icon`:
   * un nombre que no esté en el registro no falla, se pinta como texto pelado. Sin
   * esta comprobación, `"Reactt"` mal escrito degradaba exactamente igual que una
   * tecnología legítima todavía sin icono, y nadie se enteraba.
   */
  it("covers every technology named by a project", () => {
    for (const { id, technologies } of parsed.projects) {
      for (const name of technologies) {
        expect(technologyMetadata(name), `${id}: «${name}»`).toBeDefined()
      }
    }
  })

  /**
   * Y lo mismo para los logos de las empresas, que degradan igual de callados:
   * `Experience.astro` pinta la fila con `companyLogo(name) && <Image …>`, así
   * que un nombre que baile entre `cv.json` y el mapa se queda sin logo sin
   * romper nada. La coincidencia tiene que ser exacta, tildes y apóstrofos
   * incluidos: hay nombres con tilde y con apóstrofo.
   *
   * El contrato va en las dos direcciones: toda empresa con web tiene que
   * tener logo, y el mapa no puede nombrar ninguna que ya no esté en el CV.
   * Las que no tienen web tampoco tienen logo, y por el mismo motivo.
   */
  it("covers every company with a website and invents none", () => {
    const withSite = new Set(
      [...parsed.work, ...parsed.otherWork]
        .filter(({ url }) => url)
        .map(({ name }) => name),
    )

    for (const name of withSite) {
      expect(companyLogo(name), `«${name}» sin logo`).toBeDefined()
    }

    expect(LOGO_COMPANY_NAMES.filter((name) => !withSite.has(name))).toEqual([])
  })
})
