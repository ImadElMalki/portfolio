import { readFile } from "node:fs/promises"
import path from "node:path"

/**
 * Extrae los bytes de un data URI en base64.
 *
 * Así llegan las fuentes que necesita la tarjeta OG: se importan con `?inline`,
 * porque dentro del bundle ya no queda una ruta de disco que leer.
 */
export function dataUriToBuffer(dataUri: string): Buffer {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1)
  return Buffer.from(base64, "base64")
}

/**
 * Lee un archivo del proyecto durante el build.
 *
 * No sirve `import.meta.url` (apunta al chunk empaquetado, no al fuente) ni
 * `?inline` para el retrato: Vite emitía además el original de 176 KB a
 * `dist/_astro/`, un archivo que nadie pide. El build siempre corre desde la
 * raíz del proyecto, así que se resuelve desde ahí.
 */
export function readProjectFile(relativePath: string): Promise<Buffer> {
  return readFile(path.resolve(process.cwd(), relativePath))
}
