import type { CvData, Locale } from "./cvSchema"
import { INTL_LOCALES } from "./ui"

interface ResumeCopy {
  readonly contact: string
  readonly present: string
  readonly sections: {
    readonly summary: string
    readonly skills: string
    readonly experience: string
    readonly projects: string
    readonly education: string
    readonly training: string
    readonly languages: string
  }
  readonly stack: string
}

export const RESUME_COPY = {
  es: {
    contact: "Datos de contacto",
    present: "actualidad",
    sections: {
      summary: "Perfil profesional",
      skills: "Competencias técnicas",
      experience: "Experiencia profesional",
      projects: "Proyectos seleccionados",
      education: "Formación",
      training: "Certificaciones",
      languages: "Idiomas",
    },
    stack: "Tecnologías",
  },
  ca: {
    contact: "Dades de contacte",
    present: "actualitat",
    sections: {
      summary: "Perfil professional",
      skills: "Competències tècniques",
      experience: "Experiència professional",
      projects: "Projectes seleccionats",
      education: "Formació",
      training: "Certificacions",
      languages: "Idiomes",
    },
    stack: "Tecnologies",
  },
  en: {
    contact: "Contact details",
    present: "Present",
    sections: {
      summary: "Professional summary",
      skills: "Technical skills",
      experience: "Professional experience",
      projects: "Selected projects",
      education: "Education",
      training: "Certifications",
      languages: "Languages",
    },
    stack: "Technologies",
  },
} as const satisfies Record<Locale, ResumeCopy>

type ResumeProject = CvData["projects"][number]
type ResumeEducation = CvData["education"][number]
type ResumeCertificate = CvData["certificates"][number]

export interface ResumeSelection {
  readonly skillGroups: CvData["resume"]["skillGroups"]
  readonly projects: readonly ResumeProject[]
  readonly education: readonly ResumeEducation[]
  readonly certificates: readonly ResumeCertificate[]
}

function selectByIds<T extends { readonly id: string }>(
  items: readonly T[],
  ids: readonly string[],
): readonly T[] {
  const byId = new Map(items.map((item) => [item.id, item]))

  return ids.map((id) => {
    const item = byId.get(id)
    if (!item) throw new Error(`Unknown resume reference: ${id}`)
    return item
  })
}

export function buildResumeSelection(cv: Readonly<CvData>): ResumeSelection {
  return {
    skillGroups: cv.resume.skillGroups,
    projects: selectByIds(cv.projects, cv.resume.projectIds),
    education: selectByIds(cv.education, cv.resume.educationIds),
    certificates: selectByIds(cv.certificates, cv.resume.certificateIds),
  }
}

function formatResumeDate(value: string, locale: Locale): string {
  const formatted = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))

  return formatted.replaceAll(".", "").replace(/\s+del\s+(?=\d{4}$)/, " ")
}

export function formatResumeDateRange(
  startDate: string,
  endDate: string | null,
  locale: Locale,
): string {
  const end = endDate
    ? formatResumeDate(endDate, locale)
    : RESUME_COPY[locale].present

  return `${formatResumeDate(startDate, locale)} - ${end}`
}

export function formatResumePhone(phone: string): string {
  const spanishNumber = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(phone)
  if (!spanishNumber) return phone

  return `+34 ${spanishNumber[1]} ${spanishNumber[2]} ${spanishNumber[3]}`
}
