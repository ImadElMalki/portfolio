import { describe, expect, it } from "vitest"
import { LOCALES } from "./i18n"
import {
  CLOSING_SECTION_ID,
  navSections,
  PORTFOLIO_SECTIONS,
  sectionId,
  sectionOrdinal,
  sectionTitle,
  WEB_SECTIONS,
} from "./sections"

describe("secciones", () => {
  it("mantiene anclas estables aunque cambie el idioma visible", () => {
    expect(sectionId("experience")).toBe("experience")
    expect(sectionTitle("projects", "ca")).toBe("Projectes")
  })

  it("no repite ningún `id` dentro de un idioma", () => {
    // Los `id` alimentan los enlaces del índice lateral: dos iguales dejarían
    // una sección inalcanzable.
    for (const locale of LOCALES) {
      const ids = navSections(locale).map(({ id }) => id)
      expect(new Set(ids).size, locale).toBe(ids.length)
    }
  })

  it("abre el índice con el hero, sigue la página y cierra en contacto", () => {
    for (const locale of LOCALES) {
      const sections = navSections(locale)

      expect(sections, locale).toHaveLength(WEB_SECTIONS.length + 1)
      expect(sections[0]?.id).toBe(sectionId("hero"))
      expect(sections.map(({ id }) => id)).toEqual([
        ...WEB_SECTIONS.map(({ id }) => id),
        CLOSING_SECTION_ID,
      ])
    }
  })

  it("lleva en la web el mismo material que el documento, reordenado", () => {
    // Si `WEB_SECTIONS` deja de ser una permutación exacta, o falta una sección
    // en la página o sobra una que el CV no tiene. Las dos cosas se descubrirían
    // mirando la web, no ejecutando nada.
    const byId = (sections: ReadonlyArray<{ id: string }>) =>
      sections.map(({ id }) => id).sort()

    expect(byId(WEB_SECTIONS)).toEqual(byId(PORTFOLIO_SECTIONS))
  })

  it("baja educación e idiomas por debajo de proyectos", () => {
    const order = WEB_SECTIONS.map(({ name }) => name)

    expect(order.indexOf("projects")).toBeLessThan(order.indexOf("education"))
    expect(order.indexOf("projects")).toBeLessThan(order.indexOf("languages"))
    expect(order.indexOf("projects")).toBeLessThan(
      order.indexOf("certificates"),
    )
  })

  it("deja el cierre fuera del documento del CV", () => {
    // El Markdown, el PDF y la consola se conducen con `PORTFOLIO_SECTIONS`. El
    // formulario es de la web: si se colara ahí, saldría un «## Contacto» vacío
    // en el CV descargable.
    expect(PORTFOLIO_SECTIONS.map(({ id }) => id as string)).not.toContain(
      CLOSING_SECTION_ID,
    )
  })

  it("numera los encabezados desde 01 y sin contar el hero", () => {
    // El hero no pinta `<h2>`, así que el primer número que se ve en la página
    // es el de «Sobre mí». Si contara la lista entera abriría en 02.
    expect(sectionOrdinal(sectionId("hero"))).toBeUndefined()
    expect(sectionOrdinal(sectionId("about"))).toBe("01")
    expect(sectionOrdinal(sectionId("skills"))).toBe("07")
  })

  it("numera por el orden de la página, no por el del documento", () => {
    // Proyectos va delante de Educación en pantalla aunque el CV los liste al
    // revés: la insignia se pinta en la página, así que cuenta como la página.
    expect(sectionOrdinal(sectionId("projects"))).toBe("03")
    expect(sectionOrdinal(sectionId("education"))).toBe("04")
    expect(sectionOrdinal(sectionId("certificates"))).toBe("05")
    expect(sectionOrdinal(sectionId("languages"))).toBe("06")
  })

  it("no numera secciones ajenas al portfolio", () => {
    // La landing de servicios monta `<Section>` con ids propios.
    expect(sectionOrdinal("servicios-precio")).toBeUndefined()
  })

  it("numera de forma correlativa y con dos dígitos", () => {
    const ordinals = WEB_SECTIONS.filter(({ name }) => name !== "hero").map(
      ({ id }) => sectionOrdinal(id),
    )

    expect(ordinals).toEqual(
      ordinals.map((_, index) => String(index + 1).padStart(2, "0")),
    )
  })

  it("genera `id` aptos para un fragmento de URL", () => {
    for (const locale of LOCALES) {
      for (const { id, label } of navSections(locale)) {
        expect(id, `${locale}: ${label}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      }
    }
  })
})
