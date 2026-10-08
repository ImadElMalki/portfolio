import type { Locale, ProjectStatus } from "@/cv"
import { INTL_LOCALES, t, type UiKey } from "./ui"

/**
 * Formato compartido del CV.
 *
 * Estas utilidades estaban duplicadas en Projects.astro, MarkdownView.astro,
 * Section.astro y portfolioMarkdown.ts. Al centralizarlas, la página y `/cv.md`
 * muestran siempre lo mismo, y en el idioma que toca.
 */

const STATUS_KEYS = {
  published: "statusPublished",
  "in-development": "statusInDevelopment",
  private: "statusPrivate",
} as const satisfies Record<ProjectStatus, UiKey>

export function projectStatusLabel(
  status: ProjectStatus,
  locale: Locale,
): string {
  return t(locale, STATUS_KEYS[status])
}

export function currentLabel(locale: Locale): string {
  return t(locale, "current")
}

/** Un formateador por idioma: construirlos es caro y se reutilizan en el build. */
const monthYearFormatters = new Map<Locale, Intl.DateTimeFormat>()

function monthYearFormatter(locale: Locale): Intl.DateTimeFormat {
  let formatter = monthYearFormatters.get(locale)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    monthYearFormatters.set(locale, formatter)
  }

  return formatter
}

/** `2024-02-01` → `febrero de 2024` · `febrer de 2024` · `February 2024` */
export function formatMonthYear(date: string, locale: Locale): string {
  return monthYearFormatter(locale).format(new Date(`${date}T00:00:00Z`))
}

/** `2024-02-01` → `2024` */
export function formatYear(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCFullYear()
}

/**
 * `2024-02-01` → `2024.02`
 *
 * La lectura de instrumento del chip de fechas. Sin traducir a propósito: es
 * una marca de tiempo, no una frase, y el mes en letra ya viaja en el `title` y
 * en el texto para lector de pantalla que pone `DateRange.astro`.
 *
 * Se lee de la cadena ISO y no de un `Date`: el mes de `getUTCMonth()` empieza
 * en cero y ese `+ 1` es el error clásico de esta función.
 */
export function formatYearMonth(date: string): string {
  return date.slice(0, 7).replace("-", ".")
}

/** `febrero de 2024 — Actualidad` */
export function formatDateRange(
  startDate: string,
  endDate: string | null,
  locale: Locale,
): string {
  return `${formatMonthYear(startDate, locale)} — ${
    endDate ? formatMonthYear(endDate, locale) : currentLabel(locale)
  }`
}

/** `Experiencia laboral` → `experiencia-laboral` (sin acentos, apto para id o nombre de archivo) */
/**
 * `2018–2020`, y un solo año cuando entrada y salida coinciden.
 *
 * Misma convención que `credentialMeta` en `Certifications.astro`: el mes de
 * entrada en un almacén no le dice nada a quien lee, y `formatDateRange` está
 * para rangos con mes, que es lo que sí importa en los empleos de arriba.
 *
 * Vive aquí desde el 07-10-2026: lo usan `Experience.astro` para el rótulo del
 * pliegue y `PriorWork.astro` para cada fila, y son dos componentes desde que
 * las filas se descargan aparte.
 */
export function yearRange(startDate: string, endDate: string): string {
  const from = startDate.slice(0, 4)
  const to = endDate.slice(0, 4)
  return from === to ? from : `${from}–${to}`
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/**
 * La misma dirección, legible en papel.
 *
 * En el PDF el enlace va entero en el `href` —Chromium lo convierte en una
 * anotación clicable—, así que lo que se escribe es sólo lo que hay que poder
 * teclear desde una hoja impresa: sin protocolo, sin `www.` y sin la barra
 * final. `https://www.linkedin.com/in/imad-el-malki-jaddi-a0585a284/` ocupaba
 * media línea del contacto y no aportaba un solo carácter útil.
 */
export function printableUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
}
