import type { CvData, Locale } from "@/cv"
import { formatDateRange, projectStatusLabel } from "./cvFormat"
import { localized, t } from "./i18n"
import { PORTFOLIO_SECTIONS, type SectionName } from "./sections"

function normalizeInline(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function escapeMarkdown(value: string): string {
  return normalizeInline(value).replace(/([\\`*_[\]<>])/g, "\\$1")
}

function escapeLinkDestination(value: string): string {
  return value.trim().replace(/\(/g, "%28").replace(/\)/g, "%29")
}

function markdownLink(label: string, url: string): string {
  return `[${escapeMarkdown(label)}](${escapeLinkDestination(url)})`
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${escapeMarkdown(item)}`).join("\n")
}

/**
 * Construye la única representación portable del CV, en el idioma pedido.
 *
 * La salida termina con un salto de línea para que el archivo descargado siga
 * la convención habitual de los documentos de texto.
 */
export function buildPortfolioMarkdown(
  cv: Readonly<CvData>,
  locale: Locale,
): string {
  const {
    basics,
    work,
    otherWork,
    otherSkills,
    education,
    certificates,
    languages,
    projects,
    skills,
  } = cv
  const location = [
    basics.location.city,
    localized(basics.location.region, locale),
  ]
    .filter(Boolean)
    .map(escapeMarkdown)
    .join(", ")

  const contactLines = [
    location ? `- **${t(locale, "markdownLabelLocation")}:** ${location}` : "",
    basics.email
      ? `- **${t(locale, "markdownLabelEmail")}:** ${markdownLink(
          basics.email,
          `mailto:${basics.email}`,
        )}`
      : "",
    /* Una línea para los dos perfiles, y el rótulo de la red como texto del
       enlace. Antes iba un renglón por perfil con el `username` dentro, y el de
       LinkedIn es un identificador con sufijo generado —
       `imad-el-malki-jaddi-a0585a284`— que no se puede leer ni sirve para nada
       en un documento. La URL sigue entera en el destino, que es donde importa. */
    basics.profiles.length
      ? `- **${t(locale, "markdownLabelProfiles")}:** ${basics.profiles
          .map(({ network, url }) => markdownLink(network, url))
          .join(" · ")}`
      : "",
  ].filter(Boolean)

  const workEntries = work.map((job) => {
    const linkedName = job.url
      ? markdownLink(job.name, job.url)
      : escapeMarkdown(job.name)
    // Qué es la empresa, junto al nombre: «### VIEWNEXT · Subsidiaria de IBM».
    const company = job.description
      ? `${linkedName} · ${escapeMarkdown(localized(job.description, locale))}`
      : linkedName
    const jobHighlights = localized(job.highlights, locale)
    const highlights = jobHighlights.length
      ? `\n\n${bulletList(jobHighlights)}`
      : ""

    return (
      [
        `### ${company}`,
        `**${escapeMarkdown(localized(job.position, locale))}** · ${escapeMarkdown(
          formatDateRange(job.startDate, job.endDate, locale),
        )}`,
        escapeMarkdown(localized(job.summary, locale)),
      ].join("\n\n") + highlights
    )
  })

  /**
   * Los empleos de antes de programar, en una línea cada uno.
   *
   * Un «####» y una viñeta por empleo, no un «###» por empresa como arriba:
   * seis encabezados de tercer nivel pondrían la parte que ya no vende al mismo
   * peso que VIEWNEXT. El año basta —el mes de entrada en un almacén no le dice
   * nada a quien lee— y el orden es el mismo que el de la web.
   */
  const priorYears = (start: string, end: string): string =>
    start.slice(0, 4) === end.slice(0, 4)
      ? start.slice(0, 4)
      : `${start.slice(0, 4)}–${end.slice(0, 4)}`

  const priorRange =
    otherWork.length > 0
      ? priorYears(
          otherWork.reduce(
            (min, job) => (job.startDate < min ? job.startDate : min),
            otherWork[0]!.startDate,
          ),
          otherWork.reduce(
            (max, job) => (job.endDate > max ? job.endDate : max),
            otherWork[0]!.endDate,
          ),
        )
      : ""

  const priorEntries = otherWork.map((job) => {
    const employer = job.url
      ? markdownLink(job.name, job.url)
      : escapeMarkdown(job.name)
    const tail = [
      job.location ? escapeMarkdown(localized(job.location, locale)) : "",
      escapeMarkdown(localized(job.field, locale)),
      priorYears(job.startDate, job.endDate),
    ].filter(Boolean)

    return `- **${escapeMarkdown(localized(job.position, locale))}** — ${employer} · ${tail.join(
      " · ",
    )}`
  })

  /* Las habilidades de aquellos años cierran el bloque, en la misma lista: son
     una viñeta más de lo mismo, y un encabezado propio para tres palabras
     partiría en dos algo que se lee de una vez. */
  const priorSkillsEntry = `- **${escapeMarkdown(t(locale, "priorSkills"))}** — ${localized(
    otherSkills,
    locale,
  )
    .map(escapeMarkdown)
    .join(" · ")}`

  const priorWorkBlock =
    priorEntries.length > 0
      ? `\n\n#### ${escapeMarkdown(t(locale, "priorWork"))} · ${priorRange}\n\n${[
          ...priorEntries,
          priorSkillsEntry,
        ].join("\n")}`
      : ""

  const educationEntries = education.map((item) =>
    [
      `### ${escapeMarkdown(item.institution)}`,
      `**${escapeMarkdown(localized(item.studyType, locale))} ${t(
        locale,
        "markdownEducationJoin",
      )} ${escapeMarkdown(localized(item.area, locale))}**`,
      escapeMarkdown(formatDateRange(item.startDate, item.endDate, locale)),
    ].join("\n\n"),
  )

  /* Una línea por certificado y no un `###` por curso: son diez entradas de un
     renglón, y diez encabezados de tercer nivel harían de una banda de datos la
     sección más larga del documento. El nombre en negrita hace de etiqueta y el
     resto —emisor, horas, año— cuelga detrás. */
  const certificateEntries = certificates.map(
    ({ name, issuer, date, hours, url }) => {
      const title = localized(name, locale)
      /* El nombre en negrita hace de etiqueta, y si hay ficha del curso es además
       el enlace. Los diez de formación interna se quedan en texto. */
      const label = url
        ? `**${markdownLink(title, url)}**`
        : `**${escapeMarkdown(title)}**`

      return `- ${label} · ${[
        escapeMarkdown(issuer),
        hours ? `${hours} h` : "",
        date.slice(0, 4),
      ]
        .filter(Boolean)
        .join(" · ")}`
    },
  )

  /* El código del MCER va detrás de la fluidez y sólo cuando dice algo: en la
     lengua materna el marco no aplica, y un «(native)» entre paréntesis después
     de «Nativo» sería la misma palabra dos veces. */
  const languageEntries = languages.map(
    ({ language, fluency, level }) =>
      `- **${escapeMarkdown(localized(language, locale))}:** ${escapeMarkdown(
        localized(fluency, locale),
      )}${level === "native" ? "" : ` (${level})`}`,
  )

  const projectEntries = projects.map((project) => {
    const details = [
      `**${t(locale, "markdownLabelStatus")}:** ${escapeMarkdown(
        projectStatusLabel(project.status, locale),
      )}`,
      // El párrafo largo y no la frase de la tarjeta: en un CV impreso o leído
      // por una máquina lo que aporta es el detalle técnico.
      escapeMarkdown(localized(project.overview, locale)),
    ]

    if (project.technologies.length) {
      details.push(
        `**${t(locale, "markdownLabelTechnologies")}:** ${project.technologies
          .map(escapeMarkdown)
          .join(" · ")}`,
      )
    }

    const projectHighlights = localized(project.highlights, locale)

    if (projectHighlights.length) {
      details.push(
        [
          `**${t(locale, "markdownLabelHighlights")}:**`,
          bulletList(projectHighlights),
        ].join("\n"),
      )
    }

    if (project.links?.length) {
      details.push(
        [
          `**${t(locale, "markdownLabelLinks")}:**`,
          ...project.links.map(
            ({ label, url }) =>
              `- ${markdownLink(localized(label, locale), url)}`,
          ),
        ].join("\n"),
      )
    }

    return `### ${escapeMarkdown(localized(project.name, locale))}\n\n${details.join("\n\n")}`
  })

  const sectionContent = {
    hero: [
      `# ${escapeMarkdown(basics.name)}`,
      `> ${escapeMarkdown(localized(basics.label, locale))}`,
      `## ${t(locale, "markdownHeadingContact")}\n\n${contactLines.join("\n")}`,
    ].join("\n\n"),
    about: `## ${t(locale, "sectionAbout")}\n\n${escapeMarkdown(
      localized(basics.summary, locale),
    )}`,
    experience: `## ${t(locale, "sectionExperience")}\n\n${workEntries.join(
      "\n\n",
    )}${priorWorkBlock}`,
    education: `## ${t(locale, "sectionEducation")}\n\n${educationEntries.join("\n\n")}`,
    certificates: `## ${t(locale, "sectionCertificates")}\n\n${certificateEntries.join("\n")}`,
    languages: `## ${t(locale, "sectionLanguages")}\n\n${languageEntries.join("\n")}`,
    projects: `## ${t(locale, "sectionProjects")}\n\n${projectEntries.join("\n\n")}`,
    skills: `## ${t(locale, "sectionSkills")}\n\n${bulletList(
      skills.map(({ name }) => name),
    )}`,
  } satisfies Record<SectionName, string>

  const sections = PORTFOLIO_SECTIONS.map(({ name }) => sectionContent[name])

  return `${sections.join("\n\n")}\n`
}
