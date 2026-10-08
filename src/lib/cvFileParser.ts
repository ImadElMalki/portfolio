function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Mantiene el documento raíz de `cv.json` como una sola entrada estable. */
export function parseCvFile(
  fileContent: string,
): Record<string, Record<string, unknown>> {
  const parsed: unknown = JSON.parse(fileContent)

  if (!isRecord(parsed)) {
    throw new TypeError("cv.json must contain one root object")
  }

  return { cv: parsed }
}
