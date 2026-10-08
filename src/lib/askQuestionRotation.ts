export type AskQuestionTuple = readonly [string, string, string, string]
export type AskQuestionSets = readonly [AskQuestionTuple, ...AskQuestionTuple[]]
export const ASK_QUESTION_SET_COUNT = 12

export function isAskQuestionSets(value: unknown): value is AskQuestionSets {
  return (
    Array.isArray(value) &&
    value.length === ASK_QUESTION_SET_COUNT &&
    value.every(
      (set) =>
        Array.isArray(set) &&
        set.length === 4 &&
        set.every(
          (question) => typeof question === "string" && question.length > 0,
        ),
    )
  )
}

export function getAskSuggestions(
  sets: AskQuestionSets,
  rotation: number,
): AskQuestionTuple {
  const index =
    Number.isSafeInteger(rotation) && rotation >= 0 ? rotation % sets.length : 0
  return sets[index] ?? sets[0]
}
