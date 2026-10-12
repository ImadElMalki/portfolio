import type { Localized } from "@/lib/locales"

/**
 * El texto de `/proyectos/` y de cada ficha.
 *
 * Vive aquí y **no** en el diccionario de `ui.ts` por una razón medible: ese
 * diccionario viaja al navegador —lo importa el JS de cliente para `t()`— y se
 * empaqueta entero, así que cuatro cadenas nuevas por tres idiomas engordaban
 * `ui.js` lo justo para pasarse del presupuesto de JS comprimido. Se midió: con
 * ellas dentro, 42 540 bytes contra un techo de 42 500.
 *
 * Estas cadenas sólo las pinta el servidor, en páginas que no llevan guion
 * propio, así que no hay nada que ganar mandándoselas a nadie. Es el mismo sitio
 * donde ya viven `PRIVACY_COPY` y `ABOUT_COPY`, y por el mismo motivo.
 */
export const PROJECTS_COPY = {
  /* La entradilla del índice. Dice de qué va la lista sin repetir el título,
     que es lo que ya lleva el `<h1>`. */
  intro: {
    es: "Cada proyecto con su ficha: capturas, decisiones técnicas y enlaces.",
    ca: "Cada projecte amb la seva fitxa: captures, decisions tècniques i enllaços.",
    en: "One page per project: screenshots, technical decisions and links.",
  },
  /* Descripción de la ficha individual. Se completa con el nombre del proyecto,
     así que no lleva punto final ni sujeto. */
  pageDescription: {
    es: "Capturas, decisiones técnicas y enlaces del proyecto",
    ca: "Captures, decisions tècniques i enllaços del projecte",
    en: "Screenshots, technical decisions and links for the project",
  },
  /* El rótulo del enlace de cada entrada del índice hacia su ficha. */
  openPage: {
    es: "Ver ficha completa",
    ca: "Veure fitxa completa",
    en: "View full page",
  },
  /* El enlace de la portada hacia el índice. Sin él, `/proyectos/` sólo se
     alcanzaría desde el sitemap o volviendo desde una ficha: una página que
     ningún enlace del sitio nombra es una página huérfana. */
  indexLink: {
    es: "Ver todos los proyectos",
    ca: "Veure tots els projectes",
    en: "View all projects",
  },
  /* El control con corchetes de la ficha: devuelve al índice y no a la portada,
     porque es de donde se viene. El equivalente hacia la portada es
     `backToPortfolio`, que sí está en `ui.ts` porque lo usan cuatro sitios. */
  backToProjects: {
    es: "Volver a proyectos",
    ca: "Tornar a projectes",
    en: "Back to projects",
  },
  /* El rótulo de la píldora del asistente **en una ficha**. El panel es el
     mismo; lo que cambia es que ahí «esto» tiene referente, porque el guion
     manda la ruta con la pregunta. Vive aquí y no en `ui.ts` por lo de arriba:
     lo pinta el servidor y no tiene por qué viajar en el JS de nadie. */
  askHere: {
    es: "Preguntar sobre este proyecto",
    ca: "Preguntar sobre aquest projecte",
    en: "Ask about this project",
  },
} as const satisfies Record<string, Localized>
