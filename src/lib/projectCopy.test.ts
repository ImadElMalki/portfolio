import { describe, expect, it } from "vitest"

import cv from "../../cv.json"
import { cvSchema } from "./cvSchema"

const data = cvSchema.parse(cv)

/**
 * El resumen, congelado.
 *
 * No es una copia por si acaso: es la única frase del sitio que habla de él en
 * primera persona y que un cambio de una palabra puede dejar diciendo otra
 * cosa. Cambiarlo es deliberado, y actualizar esta constante es la parte
 * deliberada.
 *
 * Reescrito el 07-10-2026: el anterior ("Me gusta crear aplicaciones útiles,
 * resolver problemas reales y convertir ideas en productos funcionales") lo
 * firma cualquiera. Éste dice desde cuándo, dónde y con quién, que es lo que
 * ya decía `summaryPrint` en el PDF.
 */
const EXPECTED_SUMMARY = {
  es: "Soy desarrollador de software especializado en Angular y Java. Desde 2023 trabajo en VIEWNEXT, desarrollando aplicaciones web junto a equipos de Java y QA. Fuera del trabajo construyo proyectos propios de principio a fin, con su base de datos, su despliegue y sus decisiones de producto; varios están publicados y en uso.",
  ca: "Soc desenvolupador de programari especialitzat en Angular i Java. Des del 2023 treballo a VIEWNEXT, desenvolupant aplicacions web amb equips de Java i QA. Fora de la feina construeixo projectes propis de cap a fi, amb la seva base de dades, el seu desplegament i les seves decisions de producte; uns quants estan publicats i en ús.",
  en: "I am a software developer specialising in Angular and Java. Since 2023 I have been at VIEWNEXT, building web applications alongside Java and QA teams. Outside work I build my own projects end to end, database, deployment and product decisions included; several of them are published and in use.",
} as const

const EXPECTED_PROJECTS = [
  {
    id: "amazon-spending-tracker",
    name: {
      es: "Amazon Spending Tracker",
      ca: "Amazon Spending Tracker",
      en: "Amazon Spending Tracker",
    },
    description: {
      es: "Reconstruye tus compras desde los correos de Amazon, evita pedidos duplicados y calcula el gasto anual.",
      ca: "Reconstrueix les teves compres a partir dels correus d'Amazon, evita comandes duplicades i calcula la despesa anual.",
      en: "Rebuilds your purchase history from Amazon emails, avoids duplicate orders and calculates your yearly spending.",
    },
  },
  {
    id: "100-cims",
    name: { es: "100 Cims", ca: "100 Cims", en: "100 Cims" },
    description: {
      es: "Reúne las cimas del reto 100 Cims en un catálogo con fichas, fotografías y datos preparados automáticamente.",
      ca: "Reuneix els cims del repte 100 Cims en un catàleg amb fitxes, fotografies i dades preparades automàticament.",
      en: "Brings the 100 Cims challenge together in a catalogue with individual peak pages, photographs and automatically prepared data.",
    },
  },
  {
    id: "race-hub",
    name: { es: "Race Hub", ca: "Race Hub", en: "Race Hub" },
    description: {
      es: "Organiza tus carreras, calcula ritmos, splits y desnivel, y sincroniza recordatorios con Google Calendar.",
      ca: "Organitza les teves curses, calcula ritmes, parcials i desnivell, i sincronitza recordatoris amb Google Calendar.",
      en: "Organises your races, calculates paces, splits and elevation gain, and syncs reminders with Google Calendar.",
    },
  },
  {
    id: "strava-garmin-platform",
    name: {
      es: "Asistente Strava/Garmin",
      ca: "Assistent Strava/Garmin",
      en: "Strava/Garmin Training Assistant",
    },
    description: {
      es: "Procesa actividades de Strava y Garmin, las cruza con el plan y el clima, y publica un título y un resumen generados con IA.",
      ca: "Processa activitats de Strava i Garmin, les compara amb el pla d'entrenament i la meteorologia, i publica un títol i un resum generats amb IA.",
      en: "Processes Strava and Garmin activities, matches them against the training plan and weather, and publishes an AI-generated title and summary.",
    },
  },
  {
    id: "race-spending-tracker",
    name: {
      es: "Race Spending Tracker",
      ca: "Race Spending Tracker",
      en: "Race Spending Tracker",
    },
    description: {
      es: "Detecta inscripciones de nueve plataformas en tus correos y PDFs, recupera sus importes y controla el presupuesto anual.",
      ca: "Detecta inscripcions de nou plataformes als correus i PDFs, en recupera els imports i controla el pressupost anual.",
      en: "Detects entries from nine platforms in emails and PDFs, recovers their costs and tracks the yearly budget.",
    },
  },
  {
    id: "caixabank-spending-tracker",
    name: {
      es: "CaixaBank Spending Tracker",
      ca: "CaixaBank Spending Tracker",
      en: "CaixaBank Spending Tracker",
    },
    description: {
      es: "Ordena y clasifica los movimientos a partir de los avisos del banco para mostrar tu gasto mensual con precisión.",
      ca: "Ordena i classifica els moviments a partir dels avisos del banc per mostrar la teva despesa mensual amb precisió.",
      en: "Orders and classifies transactions from bank alerts to give you an accurate view of your monthly spending.",
    },
  },
  {
    id: "riolan-solutions",
    name: {
      es: "Riolan Solutions",
      ca: "Riolan Solutions",
      en: "Riolan Solutions",
    },
    description: {
      es: "Presenta los servicios, trabajos y vías de contacto de una empresa de lampistería y reformas en una sola web.",
      ca: "Presenta els serveis, els treballs i les vies de contacte d'una empresa de lampisteria i reformes en un sol web.",
      en: "Presents the services, completed work and contact options of a plumbing and renovation company on a single website.",
    },
  },
] as const

describe("texto breve del portfolio", () => {
  it("mantiene el resumen acordado en los tres idiomas", () => {
    expect(data.basics.summary).toEqual(EXPECTED_SUMMARY)
  })

  it.each(EXPECTED_PROJECTS)(
    "$id conserva un nombre y una descripción completos",
    ({ id, name, description }) => {
      const project = data.projects.find((item) => item.id === id)

      expect(project, id).toBeDefined()
      expect(project?.name).toEqual(name)
      expect(project?.description).toEqual(description)
    },
  )

  it("no usa guiones largos retóricos en el resumen ni en los proyectos", () => {
    const prose = [
      ...Object.values(data.basics.summary),
      ...data.projects.flatMap((project) => [
        ...Object.values(project.name),
        ...Object.values(project.description),
        ...Object.values(project.overview),
        ...Object.values(project.highlights).flat(),
      ]),
    ]

    expect(prose.some((text) => text.includes("—"))).toBe(false)
  })
})
