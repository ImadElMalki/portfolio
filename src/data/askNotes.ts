/* Mismo motivo que en el original: el tipo se declara en `locales.ts` y no en
   `@/cv`, que abre con `import { getEntry } from "astro:content"`. El Worker
   de `/api/ask` lee este módulo y no vive dentro de Astro. */
import type { Localized } from "@/lib/locales"

export interface AskAnswer {
  question: Localized
  answer: Localized
}

/**
 * Versión neutra de `src/data/askNotes.ts` para la copia pública.
 *
 * `scripts/export-public.mjs` la pone en su sitio al exportar. Ver la nota de
 * `scripts/public/askProfile.ts`: se conserva la forma —las cuatro claves y
 * sus tipos— y no el contenido.
 *
 * `canon` lleva una pregunta porque el prompt la recorre y una lista vacía
 * dejaría un bloque sin nada que decir; `site` describe el repositorio, que es
 * lo que de verdad es público aquí.
 */
export const ASK_NOTES = {
  site: [
    {
      es: "Este sitio está construido con Astro y desplegado en Cloudflare Pages, sin framework de interfaz en el navegador. El código es público; el expediente con el que responde el asistente, no.",
      ca: "Aquest lloc està construït amb Astro i desplegat a Cloudflare Pages, sense framework d'interfície al navegador. El codi és públic; l'expedient amb què respon l'assistent, no.",
      en: "This site is built with Astro and deployed to Cloudflare Pages, with no UI framework in the browser. The code is public; the dossier the assistant answers from is not.",
    },
  ] as const satisfies readonly Localized[],

  framing: [
    {
      es: "En esta copia pública no hay notas de encuadre: viven en el repositorio privado.",
      ca: "En aquesta còpia pública no hi ha notes d'enquadrament: viuen al repositori privat.",
      en: "This public copy carries no framing notes: they live in the private repository.",
    },
  ] as const satisfies readonly Localized[],

  fit: [
    {
      es: "En esta copia pública no hay notas de encaje: viven en el repositorio privado.",
      ca: "En aquesta còpia pública no hi ha notes d'encaix: viuen al repositori privat.",
      en: "This public copy carries no fit notes: they live in the private repository.",
    },
  ] as const satisfies readonly Localized[],

  canon: [
    {
      question: {
        es: "¿Qué es esto?",
        ca: "Què és això?",
        en: "What is this?",
      },
      answer: {
        es: "El código de un portfolio personal, publicado como muestra de trabajo. Las respuestas de referencia del asistente están en el repositorio privado.",
        ca: "El codi d'un portafolis personal, publicat com a mostra de treball. Les respostes de referència de l'assistent són al repositori privat.",
        en: "The code of a personal portfolio, published as a work sample. The assistant's reference answers live in the private repository.",
      },
    },
  ] as const satisfies readonly AskAnswer[],
} as const
