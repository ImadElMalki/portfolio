/**
 * Los eventos que cuenta `/api/hit`, en un solo sitio.
 *
 * Los usan el emisor del navegador (`hits.ts`) y el endpoint
 * (`functions/api/hit.ts`), que responde 400 a lo que no esté aquí. Eran dos
 * listas que había que acordarse de tocar a la vez —la fila de eventos de
 * `MAINT-03`—, y una que se quedara atrás tiraba los apuntes nuevos sin que
 * nada avisara: el navegador manda por `sendBeacon` y no lee la respuesta.
 *
 * - `view`: la carga de cada página, con su ruta y su vista.
 * - `project` y `ask`: abrir un proyecto y preguntar al asistente. Hubo
 *   también `palette`, que se fue con la paleta de comandos el 06-10-2026: seis
 *   aperturas en cuarenta días.
 * - `cv-pdf` y `contact-sent`, desde el 06-10-2026: descargar el CV y enviar el
 *   formulario. Son las dos conversiones de la portada, y hasta entonces no se
 *   sabía si alguien llegaba a hacer ninguna de las dos.
 *
 * Ninguno lleva datos de quien lo genera: ver `functions/api/hit.ts`.
 */
export const HIT_EVENTS = [
  "view",
  "project",
  "ask",
  "cv-pdf",
  "contact-sent",
] as const

export type HitEvent = (typeof HIT_EVENTS)[number]
