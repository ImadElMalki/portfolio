import type { CvData } from "./cvSchema"

/**
 * Cifras que se calculan del CV al generar el sitio: los años del hero.
 *
 * Vivían en `briefView.ts`, que las calculaba en el navegador sobre `/cv.json`.
 * La vista rápida se fundió con el hero y ahora las pinta el servidor, así que
 * se quedan aquí, sin DOM, y se prueban sin navegador.
 */

type Job = Pick<CvData["work"][number], "startDate" | "endDate">

/**
 * Meses trabajados, sumando tramos.
 *
 * Se suman los tramos en vez de restar la primera fecha de hoy: entre INETUM y
 * VIEWNEXT hay nueve meses de hueco, y contarlos sería inflar la cifra. El
 * empleo en curso cierra en `now`.
 */
export function experienceMonths(
  work: readonly Job[],
  now: Date = new Date(),
): number {
  return work.reduce((total, job) => {
    const start = new Date(`${job.startDate}T00:00:00Z`)
    const end = job.endDate ? new Date(`${job.endDate}T00:00:00Z`) : now
    const months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth())

    return total + Math.max(0, months)
  }, 0)
}

/** Años completos: un rótulo no dice «3,4 años». */
export const experienceYears = (work: readonly Job[], now?: Date): number =>
  Math.floor(experienceMonths(work, now) / 12)
