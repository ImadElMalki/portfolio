import { describe, expect, it } from "vitest"
import {
  DEFAULT_LOCALE,
  INTL_LOCALES,
  isLocale,
  localeFromPath,
  localeStaticPaths,
  localized,
  localizedPath,
  LOCALE_NAMES,
  LOCALE_TAGS,
  LOCALES,
  OG_LOCALES,
  t,
  UI_KEYS,
} from "./i18n"

describe("localizedPath", () => {
  it("deja el castellano en la raíz y prefija los demás", () => {
    expect(localizedPath("es")).toBe("/")
    expect(localizedPath("ca")).toBe("/ca/")
    expect(localizedPath("en")).toBe("/en/")
  })

  it("prefija también las rutas de los endpoints", () => {
    expect(localizedPath("es", "/cv.md")).toBe("/cv.md")
    expect(localizedPath("ca", "/cv.json")).toBe("/ca/cv.json")
    expect(localizedPath("en", "/llms.txt")).toBe("/en/llms.txt")
  })

  it("tolera una ruta sin barra inicial", () => {
    expect(localizedPath("ca", "og.jpg")).toBe("/ca/og.jpg")
  })
})

describe("localeFromPath", () => {
  it("reconoce el prefijo y cae al idioma por defecto sin él", () => {
    expect(localeFromPath("/ca/cv.md")).toBe("ca")
    expect(localeFromPath("/en/")).toBe("en")
    expect(localeFromPath("/")).toBe(DEFAULT_LOCALE)
    expect(localeFromPath("/cv.json")).toBe(DEFAULT_LOCALE)
    expect(localeFromPath("/fr/")).toBe(DEFAULT_LOCALE)
  })
})

describe("localeStaticPaths", () => {
  it("deja el idioma por defecto sin parámetro para que salga en la raíz", () => {
    expect(localeStaticPaths()).toEqual([
      { params: { locale: undefined }, props: { locale: "es" } },
      { params: { locale: "ca" }, props: { locale: "ca" } },
      { params: { locale: "en" }, props: { locale: "en" } },
    ])
  })
})

describe("mapas de idioma", () => {
  it("cubren exactamente los idiomas declarados", () => {
    for (const map of [
      LOCALE_NAMES,
      LOCALE_TAGS,
      OG_LOCALES,
      INTL_LOCALES,
    ] as const) {
      expect(Object.keys(map).sort()).toEqual([...LOCALES].sort())
    }
  })

  it("emite `hreflang` sin región: la página y el sitemap comparten juego", () => {
    for (const tag of Object.values(LOCALE_TAGS)) {
      expect(tag).toMatch(/^[a-z]{2}$/)
    }
  })

  it("isLocale rechaza lo que no es un idioma del sitio", () => {
    expect(isLocale("es")).toBe(true)
    expect(isLocale("fr")).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe("diccionario de interfaz", () => {
  it("no deja ninguna clave sin traducir en ningún idioma", () => {
    // El tipo ya obliga a las tres claves; esto vigila las cadenas vacías, que
    // sí compilan y dejan un botón sin etiqueta accesible.
    expect(UI_KEYS.length).toBeGreaterThan(30)

    for (const key of UI_KEYS) {
      for (const locale of LOCALES) {
        expect(t(locale, key).trim(), `${key}.${locale}`).not.toBe("")
      }
    }
  })
})

describe("localized", () => {
  it("saca el campo del idioma pedido", () => {
    const field = { es: "Hola", ca: "Hola", en: "Hello" }
    expect(localized(field, "en")).toBe("Hello")
    expect(localized(field, "ca")).toBe("Hola")
  })
})
