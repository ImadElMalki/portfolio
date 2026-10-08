import { describe, expect, it } from "vitest"

import caQuestions from "../../public/ask-questions/ca.json"
import enQuestions from "../../public/ask-questions/en.json"
import esQuestions from "../../public/ask-questions/es.json"
import { ASK_LIMITS } from "../lib/ask"
import {
  getAskSuggestions,
  isAskQuestionSets,
  type AskQuestionSets,
} from "../lib/askQuestionRotation"
import { LOCALE_CODES, type Locale } from "../lib/locales"
import { ASK_QUESTION_SETS } from "./askQuestions"

const PUBLIC_QUESTION_SETS: Record<Locale, unknown> = {
  es: esQuestions,
  ca: caQuestions,
  en: enQuestions,
}

function verifiedQuestionSets(locale: Locale): AskQuestionSets {
  const sets = PUBLIC_QUESTION_SETS[locale]
  if (!isAskQuestionSets(sets)) {
    throw new Error(`Banco de preguntas inválido para ${locale}`)
  }
  return sets
}

describe("ASK_QUESTION_SETS", () => {
  it("ofrece doce grupos de cuatro preguntas en cada idioma", () => {
    expect(ASK_QUESTION_SETS).toHaveLength(12)

    for (const locale of LOCALE_CODES) {
      const publicSets = verifiedQuestionSets(locale)
      expect(publicSets).toHaveLength(12)
      expect(publicSets.every((set) => set.length === 4)).toBe(true)
      expect(publicSets).toEqual(ASK_QUESTION_SETS.map((set) => set[locale]))
    }
  })

  it("no repite preguntas ni supera el límite de ask", () => {
    for (const locale of LOCALE_CODES) {
      const questions = verifiedQuestionSets(locale).flat()
      expect(new Set(questions).size).toBe(questions.length)
      expect(
        questions.every((question) => question.length <= ASK_LIMITS.question),
      ).toBe(true)
    }
  })

  /**
   * Ni una pregunta de ocio, y que se note si vuelve.
   *
   * El cuarto hueco de cada grupo estuvo reservado a lo personal —correr,
   * CrossFit, montaña, lectura—, así que una de cada cuatro sugerencias de un
   * panel que se llama «Asistente del portfolio» apuntaba al sitio equivocado
   * para quien recluta o viene a encargar algo. Salieron todas.
   *
   * Lo que **no** se ha tocado es el expediente: esas secciones siguen enteras
   * en `askProfile.ts` y el asistente las cuenta en cuanto alguien pregunta. La
   * regla es sobre lo que el sitio **propone**, no sobre lo que sabe.
   *
   * Los términos son los que no pueden aparecer en una pregunta de oficio. Ojo
   * al ampliar la lista: «race» dejaría fuera «¿Qué es Race Hub?», que es un
   * proyecto y no una carrera.
   */
  it("no propone ninguna pregunta de ocio", () => {
    const LEISURE = [
      "correr",
      "córrer",
      "running",
      "crossfit",
      "maratón",
      "marató",
      "marathon",
      "montaña",
      "muntanya",
      "mountain",
      "libro",
      "llibre",
      "book",
      "lectura",
      "leer",
      "llegir",
      "reading",
      "fuera del trabajo",
      "fora de la feina",
      "outside work",
    ]

    for (const locale of LOCALE_CODES) {
      for (const question of verifiedQuestionSets(locale).flat()) {
        const found = LEISURE.filter((term) =>
          question.toLocaleLowerCase().includes(term),
        )
        expect(`${question} → ${found.join(", ")}`).toBe(`${question} → `)
      }
    }
  })

  it("rota de forma circular y cae al primer grupo ante un índice inválido", () => {
    const sets = verifiedQuestionSets("es")
    expect(getAskSuggestions(sets, 0)).toBe(sets[0])
    expect(getAskSuggestions(sets, 12)).toBe(sets[0])
    expect(getAskSuggestions(sets, -1)).toBe(sets[0])
    expect(getAskSuggestions(sets, Number.NaN)).toBe(sets[0])
  })

  it("rechaza bancos incompletos antes de usarlos en el navegador", () => {
    expect(isAskQuestionSets([["Una pregunta"]])).toBe(false)
  })
})
