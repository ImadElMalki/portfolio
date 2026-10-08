import { describe, expect, it } from "vitest"
import {
  formatDateRange,
  formatMonthYear,
  formatYear,
  printableUrl,
  projectStatusLabel,
  slugify,
} from "./cvFormat"

describe("slugify", () => {
  it("quita los acentos, que es de donde salen los `id` de sección", () => {
    expect(slugify("Experiencia laboral")).toBe("experiencia-laboral")
    expect(slugify("Educació")).toBe("educacio")
    expect(slugify("Sobre mí")).toBe("sobre-mi")
  })

  it("colapsa los símbolos y no deja guiones en los extremos", () => {
    expect(slugify("  ¿Qué tal? — Sí  ")).toBe("que-tal-si")
    expect(slugify("C++ / C#")).toBe("c-c")
  })

  it("sirve como nombre de archivo", () => {
    expect(slugify("Imad El Malki Jaddi")).toBe("imad-el-malki-jaddi")
  })
})

describe("fechas", () => {
  it("interpreta la fecha en UTC, no en la zona de quien hace el build", () => {
    // Sin `T00:00:00Z` un build al oeste de Greenwich devolvía el mes anterior.
    expect(formatYear("2024-01-01")).toBe(2024)
    expect(formatMonthYear("2024-01-01", "en")).toBe("January 2024")
  })

  it("traduce el mes a cada idioma", () => {
    expect(formatMonthYear("2024-02-01", "es")).toMatch(/^febrero.* 2024$/)
    expect(formatMonthYear("2024-02-01", "ca")).toMatch(/^febrer.* 2024$/)
    expect(formatMonthYear("2024-02-01", "en")).toBe("February 2024")
  })

  it("cierra el rango abierto con la etiqueta del idioma", () => {
    expect(formatDateRange("2024-02-01", null, "es")).toMatch(/— Actualidad$/)
    expect(formatDateRange("2024-02-01", null, "ca")).toMatch(/— Actualitat$/)
    expect(formatDateRange("2024-02-01", null, "en")).toMatch(/— Present$/)
  })

  it("cierra el rango cerrado con la fecha final", () => {
    expect(formatDateRange("2022-05-01", "2023-05-01", "en")).toBe(
      "May 2022 — May 2023",
    )
  })
})

describe("projectStatusLabel", () => {
  it("traduce los tres estados de `cv.json`", () => {
    expect(projectStatusLabel("published", "es")).toBe("En línea")
    expect(projectStatusLabel("in-development", "ca")).toBe(
      "En desenvolupament",
    )
    expect(projectStatusLabel("private", "en")).toBe("Private code")
  })
})

describe("printableUrl", () => {
  it("deja la dirección tecleable desde una hoja impresa", () => {
    expect(printableUrl("https://www.linkedin.com/in/imad-a0585a284/")).toBe(
      "linkedin.com/in/imad-a0585a284",
    )
    expect(printableUrl("https://github.com/ImadElMalki")).toBe(
      "github.com/ImadElMalki",
    )
  })

  it("no toca lo que ya está limpio", () => {
    expect(printableUrl("amazonspendingtracker.com")).toBe(
      "amazonspendingtracker.com",
    )
  })
})
