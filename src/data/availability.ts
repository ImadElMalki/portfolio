import type { Localized } from "@/lib/locales"

/**
 * Qué busca y en qué condiciones, para el expediente del asistente.
 *
 * Lo leía también la vista rápida, que se fundió con el hero el 06-10-2026. El
 * hero no pinta esta lista: pinta `HERO_STATUS`, más abajo.
 *
 * ## Revísalo antes de publicar
 *
 * Es el único texto del sitio que afirma algo sobre tu **situación**, no sobre
 * tu trabajo pasado. Lo de abajo está derivado de lo que ya hay en el
 * repositorio —el stack de `cv.json`, la ubicación de `basics.location`, la
 * oferta de `services.ts`— y deliberadamente no dice ninguna fecha ni ninguna
 * cifra, porque eso no se puede deducir de ningún fichero. Cámbialo por lo que
 * sea verdad hoy.
 *
 * ## Por qué vive aquí y no en `cv.json`
 *
 * `cv.json` se valida contra JSON Resume y alimenta el PDF, el Markdown y el
 * endpoint público: es el currículum, y una preferencia de contratación no lo
 * es. Misma frontera que `about.ts` y `services.ts`.
 *
 * ## Por qué no caduca solo
 *
 * No lleva fecha a propósito. Un «disponible desde marzo» sin nadie que lo
 * actualice envejece y hace más daño que no decir nada; lo de abajo sigue
 * siendo cierto mientras la respuesta sea sí.
 */
export interface AvailabilityFact {
  label: Localized
  value: Localized
}

export const AVAILABILITY: readonly AvailabilityFact[] = [
  {
    label: { es: "Situación", ca: "Situació", en: "Status" },
    value: {
      es: "No está en búsqueda activa; escucha oportunidades interesantes",
      ca: "No està en cerca activa; escolta oportunitats interessants",
      en: "Not actively looking; open to hearing about interesting opportunities",
    },
  },
  {
    label: {
      es: "Modalidad actual",
      ca: "Modalitat actual",
      en: "Current working mode",
    },
    value: {
      es: "Trabaja en remoto",
      ca: "Treballa en remot",
      en: "Works remotely",
    },
  },
  {
    label: { es: "Movilidad", ca: "Mobilitat", en: "Mobility" },
    value: {
      es: "Carnet B y vehículo propio",
      ca: "Carnet B i vehicle propi",
      en: "Driving licence (B) and own car",
    },
  },
  {
    label: { es: "Enfoque", ca: "Enfocament", en: "Focus" },
    value: {
      es: "Frontend con Angular y backend con Java y Spring Boot",
      ca: "Frontend amb Angular i backend amb Java i Spring Boot",
      en: "Frontend with Angular and backend with Java and Spring Boot",
    },
  },
]

/**
 * La situación, como la dice el hero: en primera persona y en una línea.
 *
 * Es la primera ficha de `AVAILABILITY` dicha por quien firma la página.
 * Aquélla va en tercera persona porque la lee el asistente, y va aparte para
 * que retocar el rótulo no toque el expediente: cualquier cambio en el
 * prefijo del prompt deja sin acierto la caché de OpenAI.
 *
 * Sin «en remoto»: es la modalidad del empleo actual, no una condición, y en
 * la primera línea que lee quien contrata se tomaría por una.
 */
export const HERO_STATUS: Localized = {
  es: "Escucho propuestas interesantes",
  ca: "Escolto propostes interessants",
  en: "Open to interesting opportunities",
}
