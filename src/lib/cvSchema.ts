import { z } from "astro/zod"

/* Reexportados y no declarados aquí: este módulo arrastra zod, y hay JS de
   cliente que sólo necesita los códigos. Ver `locales.ts`. */
export { LOCALE_CODES, type Locale, type Localized } from "./locales"

const nonEmptyString = z.string().trim().min(1)
const stableIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const localizedStringSchema = z
  .object({ es: nonEmptyString, ca: nonEmptyString, en: nonEmptyString })
  .strict()
const localizedStringArraySchema = z
  .object({
    es: z.array(nonEmptyString),
    ca: z.array(nonEmptyString),
    en: z.array(nonEmptyString),
  })
  .strict()

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    )
  }, "Expected a valid ISO calendar date")

export const projectStatusSchema = z.enum([
  "published",
  "in-development",
  "private",
])
export const projectLinkKindSchema = z.enum(["website", "store", "source"])

const profileSchema = z
  .object({
    network: nonEmptyString,
    username: nonEmptyString,
    url: z.url(),
  })
  .strict()

const workSchema = z
  .object({
    name: nonEmptyString,
    /**
     * Qué es la empresa, no qué se hizo allí: «Subsidiaria de IBM». Es el mismo
     * campo que define JSON Resume para esto, así que sale en `/cv.json` sin
     * inventarse claves —el esquema público valida el endpoint en el build.
     * Opcional: sólo lo llevan las empresas donde aporta algo.
     */
    description: localizedStringSchema.optional(),
    position: localizedStringSchema,
    url: z.url(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    summary: localizedStringSchema,
    highlights: localizedStringArraySchema,
    /**
     * La misma experiencia, escrita para el papel.
     *
     * La web habla en primera persona —«Implemento componentes, mantengo la
     * aplicación»— porque es la voz de quien enseña su trabajo. Un currículum en
     * PDF no: ahí la convención es nominal e impersonal —«Implementación de
     * componentes; mantenimiento de la aplicación»—, que es además la forma en
     * la que están escritas las ofertas contra las que un ATS lo compara.
     *
     * Dos campos y no una reescritura del único que había: cambiar `summary` y
     * `highlights` a forma nominal arrastraría también la web, el Markdown,
     * `/cv.json` y el expediente del asistente, y ahí la primera persona es
     * deliberada.
     *
     * Opcionales: sin ellos, `Experience.astro` imprime los de pantalla. El
     * endpoint público los deja fuera —`localizedCv.ts`— porque no son campos de
     * JSON Resume y el esquema del estándar valida esa salida en el build.
     */
    summaryPrint: localizedStringSchema.optional(),
    highlightsPrint: localizedStringArraySchema.optional(),
  })
  .strict()

/**
 * Los empleos de antes de programar: almacén, cocina, atención al cliente.
 *
 * Esquema propio y no `workSchema` porque aquél exige `url`, `summary` y
 * `highlights` en tres idiomas, y ninguno de estos empleos tiene nada de eso
 * que contar en un portfolio de desarrollo. Además `cv.work` alimenta el
 * `worksFor` de JSON-LD, la trayectoria de la vista rápida y las fichas
 * completas de `cat experience`: mezclarlos ahí obligaría a inventarse datos o
 * a poner guardas en cinco consumidores para no romper nada.
 *
 * `field` es el sector —«Logística», «Hostelería»—, que es lo que da sentido a
 * la fila cuando el nombre de la empresa no dice nada por sí solo.
 *
 * `endDate` no es `.nullable()` a propósito: esto es historia cerrada, y un
 * `null` aquí significaría «sigo de mozo de almacén».
 */
const otherWorkSchema = z
  .object({
    name: nonEmptyString,
    position: localizedStringSchema,
    /**
     * Dónde, y sólo donde no es obvio.
     *
     * Cuatro de estos empleos fueron en los Países Bajos. Sin decirlo, la tira
     * se lee como si los doce hubieran pasado en el Penedès, y que alguien se
     * fuera a trabajar fuera a los diecinueve años es justo la clase de cosa
     * que un renglón de contexto sí debe contar. Los de aquí no lo llevan: el
     * país de quien firma el currículum ya está en la cabecera.
     */
    location: localizedStringSchema.optional(),
    field: localizedStringSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    /* Enlaza cuando hay web, y ahora mismo la tienen las doce. Sigue siendo
       opcional a propósito: la alternativa a una web que no existe es dejar el
       nombre en texto, no inventarse un enlace —mismo criterio que en
       `certificateSchema`—. */
    url: z.url().optional(),
  })
  .strict()

const educationSchema = z
  .object({
    id: stableIdSchema,
    institution: nonEmptyString,
    area: localizedStringSchema,
    studyType: localizedStringSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
  })
  .strict()

/**
 * Un curso acreditado, no un título: por eso `date` es una fecha suelta y no un
 * rango —lo que consta en el papel es el día en que se aprobó—.
 *
 * `name`, `issuer`, `date` y `url` son los campos que define JSON Resume para
 * `certificates`, así que el endpoint público los sirve sin inventarse claves.
 * `hours` no es del estándar, pero `certificates.items` declara
 * `additionalProperties: true` en el esquema v1.2.1 y viaja sin romper la
 * validación del build —el mismo caso que `level` en idiomas—. Es opcional: hay
 * certificados que no acreditan horas, como el test de nivel de inglés.
 *
 * Va en entero porque es lo que se lee en la fila —«34 h»—, y de ahí que las
 * formaciones de DevTalles lleven la duración de catálogo redondeada: «Astro»
 * son 25,5 h repartidas en 263 clases y «Angular: De cero a experto» eran
 * 33 h 32 min en 345 cuando se cursó. Ojo con esa última: el catálogo anuncia
 * hoy 45,5 h y 454 lecciones porque el curso siguió creciendo, así que la cifra
 * de aquí es la de entonces —que es la que acredita el papel— y no cuadrará con
 * lo que se lea al abrir el enlace.
 *
 * Los tres de midu.dev tienen duración conocida (1 h 11, 1 h 44 y 1 h 43) y aun
 * así no llevan `hours`: en entero habría que redondearlos, y el total de la
 * cabecera dejaría de ser el mínimo comprobable que dice ser.
 *
 * `issuer` no se traduce: es un nombre propio.
 *
 * `featured` decide cuáles se ven de entrada en la web; el resto va a un
 * desplegable. Es un campo y no un orden porque nueve de los diecisiete
 * certificados comparten el día de expedición —`2025-02-08`, la tanda entera de
 * Viewnext—, así que ordenar por fecha no elige nada. Entra por la misma puerta
 * que `hours`, y como los demás consumidores toman campos explícitos, no se
 * escapa a `/cv.json` ni al Markdown.
 *
 * `url` es a dónde lleva el nombre: **la ficha del curso**, no un enlace de
 * verificación. Se intentó lo segundo y no hay tal cosa para estos emisores —el
 * portal de DevTalles da el certificado sólo a quien ha iniciado sesión, y la
 * formación de Viewnext es interna—, mientras que la ficha sí dice qué se
 * estudió y cuánto duraba, que es lo que quiere saber quien lee.
 *
 * **Opcional a propósito**, y la regla no cambia: no se inventa. Siete de los
 * diecisiete tienen ficha pública y enlazan; los diez restantes se quedan en
 * texto. Una URL que no lleva a donde promete es peor que ninguna, porque
 * invita a pulsar y deja tirado a quien lo intenta.
 */
const certificateSchema = z
  .object({
    id: stableIdSchema,
    name: localizedStringSchema,
    issuer: nonEmptyString,
    date: isoDateSchema,
    hours: z.number().int().positive().optional(),
    featured: z.boolean().optional(),
    url: z.url().optional(),
  })
  .strict()

/**
 * Escala del medidor de idiomas.
 *
 * `native` no es un nivel del MCER —el marco describe a quien aprende una
 * lengua, no a quien creció en ella—, pero el medidor necesita un valor para
 * pintar la fila llena, y escribir «C2» en la lengua materna diría algo que el
 * marco no dice. Va al final porque el orden de este array **es** el número de
 * segmentos que se rellenan.
 */
export const CEFR_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "native",
] as const

const languageSchema = z
  .object({
    language: localizedStringSchema,
    fluency: localizedStringSchema,
    level: z.enum(CEFR_LEVELS),
  })
  .strict()

/**
 * Escala del medidor de habilidades.
 *
 * Como en `CEFR_LEVELS`, **el orden de este array es el número de segmentos**
 * que se rellenan: `basic` uno, `intermediate` dos, `advanced` tres. Así la
 * escala vive en un sitio y no en un mapa aparte que se pueda desincronizar.
 *
 * `level` es campo de JSON Resume, así que estos valores viajan tal cual a
 * `/cv.json`. Se quedan en inglés y sin traducir por eso mismo: es un valor de
 * dato, no una etiqueta de interfaz — el medidor no escribe la palabra, pinta
 * barras.
 */
export const SKILL_LEVELS = ["basic", "intermediate", "advanced"] as const

const projectLinkSchema = z
  .object({
    label: localizedStringSchema,
    url: z.url(),
    kind: projectLinkKindSchema,
  })
  .strict()

const projectSchema = z
  .object({
    id: stableIdSchema,
    name: localizedStringSchema,
    status: projectStatusSchema,
    technologies: z.array(nonEmptyString),
    /** La frase corta de la tarjeta: directa y sin jerga. */
    description: localizedStringSchema,
    /** El párrafo técnico, solo dentro del diálogo y en las salidas para
     *  máquinas. Separado de `description` porque antes era el mismo campo y
     *  salía dos veces: entero en la tarjeta y otra vez al abrir el detalle. */
    overview: localizedStringSchema,
    highlights: localizedStringArraySchema,
    links: z.array(projectLinkSchema).optional(),
    /**
     * Cuáles se ven de entrada en la web; el resto va al pliegue.
     *
     * Mismo campo y mismo criterio que en `certificates` y en `skills`: la
     * elección es editorial y vive en el archivo, no calculada en el componente.
     * El orden del array es orden de autor y lo leen el PDF, `/cv.json` y `/cv.md`,
     * así que mover un proyecto para destacarlo movería también esos tres. Una
     * marca no.
     *
     * Opcional: sin ninguna marcada, `Projects.astro` se cae a los dos primeros.
     */
    featured: z.boolean().optional(),
  })
  .strict()

const resumeSchema = z
  .object({
    label: localizedStringSchema,
    skillGroups: z
      .array(
        z
          .object({
            label: localizedStringSchema,
            items: z.array(nonEmptyString).min(1),
          })
          .strict(),
      )
      .min(1),
    projectIds: z.array(stableIdSchema).length(2),
    educationIds: z.array(stableIdSchema).min(1),
    certificateIds: z.array(stableIdSchema).min(1),
  })
  .strict()

export const cvSchema = z
  .object({
    basics: z
      .object({
        name: nonEmptyString,
        label: localizedStringSchema,
        image: z.string().regex(/^\/[a-zA-Z0-9._/-]+$/),
        email: z.email(),
        /**
         * En formato E.164 (`+` y dígitos), que es lo que pide `wa.me` tras
         * quitarle el `+`. `phone` es campo del estándar JSON Resume, así que
         * viaja al endpoint público sin inventarse claves.
         *
         * Opcional: sin él, el enlace de WhatsApp sencillamente no se pinta.
         */
        phone: z
          .string()
          .regex(/^\+\d{6,15}$/)
          .optional(),
        headline: localizedStringSchema,
        tagline: localizedStringSchema,
        summary: localizedStringSchema,
        /* El perfil profesional del PDF, por lo mismo que `summaryPrint` en los
           empleos: en papel se escribe en tercera persona y sin «me gusta». */
        summaryPrint: localizedStringSchema.optional(),
        location: z
          .object({
            city: nonEmptyString,
            region: localizedStringSchema,
            countryCode: z.literal("ES"),
          })
          .strict(),
        profiles: z.array(profileSchema),
      })
      .strict(),
    work: z.array(workSchema),
    otherWork: z.array(otherWorkSchema),
    /* Lo que se aprendió en aquellos años y no cabe en `skills`: esa lista la
       valida el registro de tecnologías, y una habilidad de almacén no es una
       tecnología del portfolio. Array por idioma —el mismo helper que los
       destacados de cada empleo—, que se une con ` · ` al pintarlo. */
    otherSkills: localizedStringArraySchema,
    education: z.array(educationSchema),
    certificates: z.array(certificateSchema),
    languages: z.array(languageSchema),
    projects: z.array(projectSchema),
    /** Selección editorial del CV dedicado. Los IDs apuntan a los datos
     *  anteriores para no duplicar empleos, proyectos ni cursos. */
    resume: resumeSchema,
    /**
     * `level` es **obligatorio**, y esa es la decisión que hay aquí.
     *
     * Podría ser opcional —JSON Resume lo declara así— pero una habilidad sin
     * nivel saldría como una fila sin medidor, indistinguible de un descuido,
     * y con veinte en la lista nadie lo vería. Exigirlo convierte el olvido en
     * un build que falla, que es donde se quiere que aparezca.
     *
     * `featured` sí es opcional, y va por el mismo camino que el de los
     * certificados: decide cuáles enseña la vista rápida, donde caben ocho de
     * las veintitantas. El nivel dice cuánto se maneja cada una, pero no cuál
     * quieres que se vea primero —Svelte es `intermediate` y es con lo que está
     * hecha media aplicación de carreras—, y ésa es una decisión editorial que
     * no se puede deducir del nivel. Sin ninguna marcada, la vista ordena por
     * nivel como hacía antes: la marca añade, no sustituye.
     */
    skills: z.array(
      z
        .object({
          name: nonEmptyString,
          level: z.enum(SKILL_LEVELS),
          featured: z.boolean().optional(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine(({ projects, education, certificates, resume }, context) => {
    const collections = [
      ["projects", projects],
      ["education", education],
      ["certificates", certificates],
    ] as const

    for (const [collection, items] of collections) {
      const seen = new Set<string>()

      items.forEach(({ id }, index) => {
        if (seen.has(id)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate ${collection} id: ${id}`,
            path: [collection, index, "id"],
          })
        }
        seen.add(id)
      })
    }

    const selections = [
      ["projectIds", resume.projectIds, new Set(projects.map(({ id }) => id))],
      [
        "educationIds",
        resume.educationIds,
        new Set(education.map(({ id }) => id)),
      ],
      [
        "certificateIds",
        resume.certificateIds,
        new Set(certificates.map(({ id }) => id)),
      ],
    ] as const

    for (const [field, ids, knownIds] of selections) {
      const seen = new Set<string>()

      ids.forEach((id, index) => {
        if (seen.has(id)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate resume reference: ${id}`,
            path: ["resume", field, index],
          })
        }
        if (!knownIds.has(id)) {
          context.addIssue({
            code: "custom",
            message: `Unknown resume reference: ${id}`,
            path: ["resume", field, index],
          })
        }
        seen.add(id)
      })
    }
  })

export type CvData = z.infer<typeof cvSchema>
export type CefrLevel = (typeof CEFR_LEVELS)[number]
/* Sólo el tipo. La vista rápida ordena por nivel en el navegador y necesita
   nombrarlo, pero importar `SKILL_LEVELS` —el valor— arrastraría Zod entero al
   paquete de cliente; un `import type` se borra al compilar. */
export type SkillLevel = (typeof SKILL_LEVELS)[number]
export type ProjectStatus = z.infer<typeof projectStatusSchema>
export type ProjectLinkKind = z.infer<typeof projectLinkKindSchema>
