import { describe, expect, it } from "vitest"
import { CONTACT_URLS, SERVICES_COPY } from "@/data/services"
import { LOCALES } from "./i18n"

/**
 * Recorre el módulo de texto entero. Un campo sin traducir no rompe el build ni
 * ninguna otra prueba: sale publicado en castellano dentro de la página inglesa,
 * que es justo el fallo que nadie ve hasta que lo ve un cliente.
 */
function localizedFields(
  value: unknown,
  path = "SERVICES_COPY",
): Array<[string, Record<string, unknown>]> {
  if (typeof value !== "object" || value === null) return []

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  const isLocalized =
    keys.length === LOCALES.length &&
    LOCALES.every((locale) => locale in record)

  if (isLocalized) return [[path, record]]

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      localizedFields(item, `${path}[${index}]`),
    )
  }

  return Object.entries(record).flatMap(([key, item]) =>
    localizedFields(item, `${path}.${key}`),
  )
}

describe("texto de la landing", () => {
  const fields = localizedFields(SERVICES_COPY)

  it("encuentra todos los campos traducibles", () => {
    // Si el módulo crece, este número sube a mano: es la forma de notar que se
    // ha añadido un campo y de que el recorrido no se ha dejado una rama. Bajó
    // de 44 a 28 al dejar la landing en dos bloques: fuera los seis problemas,
    // su título y su cierre, y las tres capacidades con su título y entradilla.
    // El formulario propio deja la reserva externa fuera de la página.
    expect(fields.length).toBe(49)
  })

  it.each(fields)("%s está en los tres idiomas y sin huecos", (_, field) => {
    for (const locale of LOCALES) {
      /* Un `as string` tras el `expect` de arriba no estrechaba nada: `expect`
         no aborta el bucle, así que un valor no-cadena reventaba en el `.trim()`
         con un `TypeError` crudo en vez de con el fallo legible que este test
         existe para dar. Con la guardia, el primer `expect` es el que informa. */
      const value = field[locale]
      expect(typeof value, locale).toBe("string")
      if (typeof value !== "string") continue

      expect(value.trim().length, locale).toBeGreaterThan(0)
    }
  })

  it("no deja el castellano copiado en otro idioma", () => {
    // Un `es` repetido en `ca` o `en` es lo que deja una traducción a medias:
    // parece traducido porque el campo está lleno.
    const untranslated = fields.filter(
      ([, field]) => field.es === field.ca || field.es === field.en,
    )

    expect(untranslated.map(([path]) => path)).toEqual([])
  })
})

describe("contacto", () => {
  it.each(LOCALES)("apunta al formulario localizado en %s", (locale) => {
    // Arrange
    const expectedPath =
      locale === "es"
        ? "/servicios/"
        : locale === "ca"
          ? "/ca/serveis/"
          : "/en/services/"

    // Act
    const url = new URL(CONTACT_URLS[locale])

    // Assert
    expect(url.origin).toBe("https://imadelmalki.com")
    expect(url.pathname).toBe(expectedPath)
    expect(url.hash).toBe("#booking")
  })
})
