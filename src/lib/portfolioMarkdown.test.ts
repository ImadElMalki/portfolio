import { describe, expect, it } from "vitest"
import cv from "../../cv.json"
import type { CvData } from "@/cv"
import { cvSchema } from "./cvSchema"
import { LOCALES, t } from "./i18n"
import { buildPortfolioMarkdown } from "./portfolioMarkdown"
import { PORTFOLIO_SECTIONS } from "./sections"

const cvData = cvSchema.parse(cv)

/** CV mínimo con los caracteres que hay que escapar en cada sitio. */
const trickyCv: CvData = {
  basics: {
    name: "Ada *Lovelace*",
    label: { es: "Analista", ca: "Analista", en: "Analyst" },
    image: "/portrait.webp",
    email: "ada@example.com",
    headline: { es: "Ada", ca: "Ada", en: "Ada" },
    tagline: { es: "Ada", ca: "Ada", en: "Ada" },
    summary: {
      es: "Notas [entre] corchetes",
      ca: "Notes [entre] claudàtors",
      en: "Notes [in] brackets",
    },
    location: {
      city: "Londres",
      region: { es: "Inglaterra", ca: "Anglaterra", en: "England" },
      countryCode: "ES",
    },
    profiles: [
      {
        network: "GitHub",
        username: "ada_l",
        url: "https://example.com/a(b)c",
      },
    ],
  },
  work: [],
  otherWork: [],
  otherSkills: { es: [], ca: [], en: [] },
  education: [
    {
      id: "mathematics",
      institution: "University of London",
      area: { es: "Matemáticas", ca: "Matemàtiques", en: "Mathematics" },
      studyType: { es: "Grado", ca: "Grau", en: "Degree" },
      startDate: "1835-09-01",
      endDate: "1837-06-30",
    },
  ],
  certificates: [
    {
      id: "sql-avanzado",
      name: { es: "SQL *avanzado*", ca: "SQL *avançat*", en: "Advanced *SQL*" },
      issuer: "View_next",
      date: "2025-02-08",
      hours: 8,
    },
  ],
  languages: [],
  projects: [
    {
      id: "analytical-engine",
      name: {
        es: "Motor <analítico>",
        ca: "Motor <analític>",
        en: "Analytical <engine>",
      },
      status: "published",
      technologies: ["C_1"],
      description: { es: "Uno", ca: "Un", en: "One" },
      overview: { es: "Uno largo", ca: "Un llarg", en: "One long" },
      highlights: { es: [], ca: [], en: [] },
    },
    {
      id: "difference-engine",
      name: {
        es: "Máquina diferencial",
        ca: "Màquina diferencial",
        en: "Difference engine",
      },
      status: "private",
      technologies: [],
      description: { es: "Dos", ca: "Dos", en: "Two" },
      overview: { es: "Dos largo", ca: "Dos llarg", en: "Two long" },
      highlights: { es: [], ca: [], en: [] },
    },
  ],
  resume: {
    label: { es: "Analista", ca: "Analista", en: "Analyst" },
    skillGroups: [
      {
        label: { es: "Datos", ca: "Dades", en: "Data" },
        items: ["SQL"],
      },
    ],
    projectIds: ["analytical-engine", "difference-engine"],
    educationIds: ["mathematics"],
    certificateIds: ["sql-avanzado"],
  },
  skills: [{ name: "Álgebra", level: "advanced" }],
}

describe("buildPortfolioMarkdown", () => {
  it("empieza en `#` y acaba con un salto de línea", () => {
    const md = buildPortfolioMarkdown(cvData, "es")

    expect(md.startsWith("# ")).toBe(true)
    expect(md.endsWith("\n")).toBe(true)
    expect(md.endsWith("\n\n")).toBe(false)
  })

  /**
   * Contar encabezados no era comprobar el orden: reordenar `PORTFOLIO_SECTIONS`
   * dejaba el test en verde, que es justo el invariante que
   * `buildPortfolioMarkdown` existe para sostener.
   *
   * El primer `##` es el del hero —«Contacto», que no sale de su `titleKey`—, así
   * que se compara desde el segundo.
   */
  it("mantiene el orden de las secciones en los tres idiomas", () => {
    for (const locale of LOCALES) {
      const md = buildPortfolioMarkdown(cvData, locale)
      const headings = [...md.matchAll(/^## (.+)$/gm)].map(([, text]) => text)
      const expected = PORTFOLIO_SECTIONS.filter(
        ({ name }) => name !== "hero",
      ).map(({ titleKey }) => t(locale, titleKey))

      expect(headings, locale).toHaveLength(PORTFOLIO_SECTIONS.length)
      expect(headings.slice(1), locale).toEqual(expected)
    }
  })

  it("usa un solo `#`: el resto del documento cuelga de él", () => {
    const md = buildPortfolioMarkdown(cvData, "en")
    expect([...md.matchAll(/^# /gm)]).toHaveLength(1)
  })

  it("escapa los caracteres que romperían el formato", () => {
    const md = buildPortfolioMarkdown(trickyCv, "es")

    expect(md).toContain("# Ada \\*Lovelace\\*")
    expect(md).toContain("Notas \\[entre\\] corchetes")
    expect(md).toContain("Motor \\<analítico\\>")
    expect(md).toContain("C\\_1")
  })

  /* Los perfiles iban a renglón por cabeza con el `username` como texto del
     enlace, y el de LinkedIn es `imad-el-malki-jaddi-a0585a284`: un
     identificador con sufijo generado ocupando una línea de un documento que se
     lee. Ahora es una línea con el nombre de la red. */
  it("pone los perfiles en una línea y sin el identificador", () => {
    const md = buildPortfolioMarkdown(cvData, "es")

    expect(md).toContain("- **Perfiles:** [LinkedIn](")
    expect(md).not.toContain("[imad-el-malki-jaddi-a0585a284]")
    expect(md).not.toContain("- **LinkedIn:**")
  })

  it("codifica los paréntesis del destino de un enlace", () => {
    const md = buildPortfolioMarkdown(trickyCv, "es")
    expect(md).toContain("(https://example.com/a%28b%29c)")
  })

  it("traduce las etiquetas fijas, no sólo el contenido", () => {
    expect(buildPortfolioMarkdown(cvData, "es")).toContain("## Contacto")
    expect(buildPortfolioMarkdown(cvData, "ca")).toContain("## Contacte")
    expect(buildPortfolioMarkdown(cvData, "en")).toContain("## Contact")
  })

  it("omite las secciones vacías de un proyecto sin enlaces ni destacados", () => {
    const md = buildPortfolioMarkdown(trickyCv, "en")

    expect(md).not.toContain("**Highlights:**")
    expect(md).not.toContain("**Links:**")
  })
})
