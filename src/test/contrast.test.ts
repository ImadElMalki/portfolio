import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import cv from "../../cv.json"
import {
  contrastRatio,
  mix,
  parseCustomProperties,
  parseHex,
  resolveLightDark,
} from "./contrast"
import { cvSchema } from "../lib/cvSchema"

const { projects, skills } = cvSchema.parse(cv)

/**
 * Contraste de los colores que se eligen a ojo.
 *
 * Las pruebas leen los `.astro` **como texto** y miden las declaraciones reales.
 * Duplicar los colores aquí en TypeScript sería más cómodo de escribir y
 * garantizaría la deriva: el día que alguien retoque un hex en el CSS, la copia
 * de la prueba seguiría diciendo que todo va bien.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8")

function requiredProperty(
  properties: ReadonlyMap<string, string>,
  token: string,
): string {
  const value = properties.get(token)
  if (!value) throw new Error(`falta ${token}`)
  return value
}

function capturedPair(match: RegExpMatchArray): readonly [string, string] {
  const name = match[1]
  const block = match[2]
  if (!name || !block) throw new Error(`captura CSS incompleta: ${match[0]}`)
  return [name, block]
}

const LAYOUT = read("../layouts/Layout.astro")
const SKILLS = read("../components/sections/Skills.astro")
/* El formulario salió de `Contact.astro` a su propio componente cuando la
   landing de servicios pasó a usar el mismo: la regla del contorno vive ahí. */
const CONTACT = read("../components/ContactForm.astro")
const TECHNOLOGY_REGISTRY = read("../lib/technologyRegistry.ts")

/** El `:root` base, que es donde viven los tokens que no dependen del acento. */
const rootBlock = LAYOUT.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ""
const rootProperties = parseCustomProperties(rootBlock)

const backgrounds = resolveLightDark(rootProperties.get("--bg") ?? "")
const surfaces = resolveLightDark(rootProperties.get("--surface") ?? "")

const BG = { light: parseHex(backgrounds[0]), dark: parseHex(backgrounds[1]) }
const SURFACE = {
  light: parseHex(surfaces[0]),
  dark: parseHex(surfaces[1]),
}

/** Paletas de acento declaradas como `:root[data-accent="…"]`. */
const accentBlocks = new Map(
  [...LAYOUT.matchAll(/:root\[data-accent="([a-z]+)"\]\s*\{([^}]*)\}/g)].map(
    (match) => {
      const [name, block] = capturedPair(match)
      return [name, parseCustomProperties(block)] as const
    },
  ),
)

/** Los nombres que sortea el script inline del `<head>`. */
const accentNames = [
  ...(LAYOUT.match(/const accents = \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(
    /"([a-z]+)"/g,
  ),
].map((match) => {
  const name = match[1]
  if (!name) throw new Error(`nombre de acento ausente: ${match[0]}`)
  return name
})

describe("fondos de referencia", () => {
  it("los lee del CSS, no de una copia", () => {
    // Si esto falla, el resto de las medidas están hechas contra un fondo que
    // ya no existe: es la guardia de todo el archivo.
    expect(BG.light).toEqual(parseHex("#f7f8f6"))
    expect(BG.dark).toEqual(parseHex("#0d100e"))
    expect(SURFACE.light).toEqual(parseHex("#ffffff"))
  })
})

describe("contorno de los controles", () => {
  /**
   * Los campos del formulario de contacto, que son lo único del sitio que se
   * rellena escribiendo.
   *
   * La WCAG 2.2 mide el contorno de un control aparte del texto —criterio
   * 1.4.11, «contraste de lo que no es texto»— y pide 3:1 contra los colores
   * que tiene al lado: el fondo de la página por fuera y el relleno del campo
   * por dentro. Ni axe ni Lighthouse lo comprueban, así que esta es la única
   * red que hay: sin ella se puede bajar el filete y seguir puntuando 100.
   */
  const control = resolveLightDark(
    requiredProperty(rootProperties, "--border-control"),
  )
  const CONTROL = {
    light: parseHex(control[0]),
    dark: parseHex(control[1]),
  }

  it("se despega del fondo de la página en los dos temas", () => {
    expect(contrastRatio(CONTROL.light, BG.light)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(CONTROL.dark, BG.dark)).toBeGreaterThanOrEqual(3)
  })

  it("se despega también del relleno del propio campo", () => {
    expect(contrastRatio(CONTROL.light, SURFACE.light)).toBeGreaterThanOrEqual(
      3,
    )
    expect(contrastRatio(CONTROL.dark, SURFACE.dark)).toBeGreaterThanOrEqual(3)
  })

  /**
   * Y que los campos lo **usen**.
   *
   * Las dos medidas de arriba comprueban el valor del token, no dónde se
   * aplica: cambiar `var(--border-control)` por `var(--border)` en el
   * formulario las dejaría las dos en verde con el filete otra vez en 1,49:1.
   * Ninguna herramienta lo vería —axe y Lighthouse miran contraste de texto, no
   * de contornos—, así que la regla se lee del CSS.
   */
  const fieldRule =
    /\.contact input,\s*\.contact textarea\s*\{([^}]*)\}/.exec(CONTACT)?.[1] ??
    ""

  it("los campos del formulario dibujan su contorno con ese token", () => {
    // Si esto falla, el selector se ha renombrado y la comprobación de abajo
    // estaría midiendo una cadena vacía.
    expect(fieldRule, "no se encuentra la regla de los campos").not.toBe("")

    const boundary = fieldRule
      .split(";")
      .filter((declaration) =>
        /^\s*border(-(top|right|bottom|left))?(-color)?\s*:/.test(declaration),
      )
      .join(";")

    expect(boundary).toContain("var(--border-control)")
    expect(boundary).not.toMatch(/var\(--border(-hover)?\)/)
  })
})

describe("paletas de acento", () => {
  it("el sorteo y el CSS declaran las mismas paletas", () => {
    // La paleta por defecto vive en el `:root` base y no tiene bloque propio.
    // Cualquier otro nombre sin bloque saldría sorteado y no pintaría nada.
    const withoutBlock = accentNames.filter((name) => !accentBlocks.has(name))
    expect(withoutBlock).toHaveLength(1)

    // Y al revés: un bloque que nadie sortea es CSS muerto.
    for (const name of accentBlocks.keys()) {
      expect(accentNames).toContain(name)
    }
  })

  it("hay al menos las diez paletas del sorteo", () => {
    expect(accentNames.length).toBeGreaterThanOrEqual(10)
    expect(new Set(accentNames).size).toBe(accentNames.length)
  })

  /**
   * `--accent` se usa como color de **texto** —`article a:hover`, el marcador de
   * las listas de Experiencia, el conmutador de Markdown activo—, así que le
   * aplica el 4.5:1 de la WCAG AA para texto normal, no el 3:1 de los gráficos.
   */
  it.each(
    // `?? rootProperties` es la paleta por defecto, la que no tiene bloque.
    accentNames.map(
      (name) => [name, accentBlocks.get(name) ?? rootProperties] as const,
    ),
  )("«%s» llega a AA en claro y en oscuro", (_name, properties) => {
    const pairs = [
      ["--accent-light", BG.light],
      ["--accent-light-strong", BG.light],
      ["--accent-dark", BG.dark],
      ["--accent-dark-strong", BG.dark],
    ] as const

    for (const [token, background] of pairs) {
      expect(
        contrastRatio(
          parseHex(requiredProperty(properties, token)),
          background,
        ),
        `${token} sobre el fondo`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  /**
   * El relleno sólido —el CTA «Ver demo» en hover y el botón de cerrar del
   * diálogo— pinta blanco sobre `--action-fill`, que es el tono fuerte en claro y
   * el suave en oscuro. Los dos son extremos oscuros de la paleta justamente para
   * que el blanco pase AA; con `--accent-dark`, que es claro, se quedaría en 2:1.
   */
  it.each(
    accentNames.map(
      (name) => [name, accentBlocks.get(name) ?? rootProperties] as const,
    ),
  )(
    "«%s» mantiene AA con texto blanco sobre el relleno",
    (_name, properties) => {
      const fills = ["--accent-light-strong", "--accent-dark-soft"] as const

      for (const fill of fills) {
        expect(
          contrastRatio(
            { r: 255, g: 255, b: 255 },
            parseHex(requiredProperty(properties, fill)),
          ),
          `blanco sobre ${fill}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  /**
   * Los estados suaves siguen pintando `--action-text` (el tono fuerte) sobre
   * `--action-bg` (el suave). Es la pareja con menos margen de toda la paleta.
   */
  it.each(
    accentNames.map(
      (name) => [name, accentBlocks.get(name) ?? rootProperties] as const,
    ),
  )("«%s» mantiene AA en el botón de acción", (_name, properties) => {
    const combinations = [
      ["--accent-light-strong", "--accent-light-soft"],
      ["--accent-dark-strong", "--accent-dark-soft"],
    ] as const

    for (const [text, background] of combinations) {
      expect(
        contrastRatio(
          parseHex(requiredProperty(properties, text)),
          parseHex(requiredProperty(properties, background)),
        ),
        `${text} sobre ${background}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe("insignias de estado", () => {
  /**
   * El umbral **subió** de 3:1 a 4.5:1 cuando la insignia dejó de ser una
   * píldora rellena.
   *
   * Antes el color era fondo y la etiqueta iba en blanco encima: al color le
   * bastaba con separarse de la tarjeta (1.4.11, contraste de lo que no es
   * texto) porque quien cargaba con la legibilidad era el blanco. Ahora el
   * color **es** el texto —etiqueta y medidor sobre `--surface`—, así que le
   * aplica la 1.4.3 de texto y tiene que llegar a 4.5:1 él solo.
   *
   * El fondo de referencia es `--surface` —la tarjeta de Projects y el panel de
   * ProjectDetail—, no `--bg`.
   */
  it.each(["--status-published", "--status-development", "--status-private"])(
    "%s se lee como etiqueta sobre la tarjeta",
    (token) => {
      const [light, dark] = resolveLightDark(
        requiredProperty(rootProperties, token),
      )

      const themes = [
        [parseHex(light), SURFACE.light],
        [parseHex(dark), SURFACE.dark],
      ] as const

      for (const [status, surface] of themes) {
        expect(contrastRatio(status, surface)).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it("los tres estados se distinguen entre sí", () => {
    // El gris de «Código privado» era indistinguible de un chip neutro. Que
    // los tres tokens sean distintos es el mínimo para que el color aporte algo.
    const values = ["published", "development", "private"].map((state) =>
      rootProperties.get(`--status-${state}`),
    )

    expect(new Set(values).size).toBe(3)
  })
})

describe("colores de marca de las tecnologías", () => {
  /** El chip encendido es `color-mix(in srgb, var(--tech) 10%, var(--surface))`. */
  const CHIP_TINT = 0.1

  /* El mapa vive en un bloque global de `Skills.astro` —lo consumen los chips de
     Habilidades y los del diálogo de cada proyecto—, así que el selector va
     suelto y un bloque puede cubrir varias tecnologías: la familia Cloudflare y
     el verde que comparten Room y WorkManager. */
  const techBlocks = [
    ...SKILLS.matchAll(
      /((?:\[data-tech="[^"]+"\]\s*,\s*)*\[data-tech="[^"]+"\])\s*\{([^}]*)\}/g,
    ),
  ].flatMap((match) => {
    const [selector, block] = capturedPair(match)
    const properties = parseCustomProperties(block)

    return [...selector.matchAll(/\[data-tech="([^"]+)"\]/g)].map(
      (id) => [id[1] as string, properties] as const,
    )
  })

  /* Sin la rama `Icon:`, que era de cuando el registro llevaba el icono dentro
     —hoy vive en `techIcons.ts`—, y abierta por la derecha: la entrada acabó
     creciendo con `group`, y una expresión que exigía la llave justo después de
     `name` dejó de encontrar ni una sola línea. Lo que aquí importa es el par
     nombre → ID; lo que venga detrás es cosa del registro. */
  const idByName = new Map(
    [
      ...TECHNOLOGY_REGISTRY.matchAll(
        /\{ id: "([^"]+)", name: "([^"]+)"[^}]*\}/g,
      ),
    ].map((match) => [match[2] as string, match[1] as string]),
  )

  /* Todo lo que nombra `cv.json`, no sólo las habilidades: los chips del diálogo
     salen de `projects[].technologies`, y ahí hay dieciséis tecnologías que no
     aparecen en la lista de habilidades. Con el suelo puesto sólo en las
     habilidades, esas dieciséis se quedaban con el acento genérico sin que nadie
     lo hubiera decidido. */
  const namedTechnologies = [
    ...new Set([
      ...skills.map(({ name }) => name),
      ...projects.flatMap(({ technologies }) => technologies),
    ]),
  ]

  it("hay una regla por tecnología nombrada en el CV", () => {
    const coloured = new Set(techBlocks.map(([id]) => id))

    for (const name of namedTechnologies) {
      const id = idByName.get(name)
      expect(id, `«${name}» no tiene ID estable`).toBeDefined()
      expect(coloured, `«${name}» se queda sin color de marca`).toContain(id)
    }
  })

  it("cada ID CSS pertenece al registro estable", () => {
    const ids = new Set(idByName.values())

    for (const [id] of techBlocks) {
      expect(ids, `ID «${id}» no existe en el registro`).toContain(id)
    }
  })

  /**
   * El icono es un elemento gráfico portador de información: WCAG 1.4.11 pide
   * 3:1, no 4.5:1. El nombre de la tecnología se queda en `--text` justamente
   * para no tener que someterlo a este límite.
   */
  it.each(techBlocks)(
    "«%s» llega a 3:1 sobre el chip encendido",
    (_tech, properties) => {
      const [light, dark] = resolveLightDark(
        requiredProperty(properties, "--tech"),
      )

      const themes = [
        [parseHex(light), SURFACE.light],
        [parseHex(dark), SURFACE.dark],
      ] as const

      for (const [tech, surface] of themes) {
        expect(
          contrastRatio(tech, mix(tech, CHIP_TINT, surface)),
        ).toBeGreaterThanOrEqual(3)
      }
    },
  )
})
