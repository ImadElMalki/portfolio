#!/usr/bin/env node
/**
 * Verifica la extracción de mejor esfuerzo del CV visual con dos motores
 * independientes. No certifica compatibilidad con todos los ATS: comprueba
 * que la fotografía y las dos columnas no conviertan el contenido en una
 * imagen ni rompan el orden de lectura que define el HTML dedicado.
 *
 * PDF.js es el gate portátil del build; Poppler se activa con `--poppler` en
 * local y en CI.
 */
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { argv, exit } from "node:process"
import { pathToFileURL } from "node:url"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

import cv from "../cv.json" with { type: "json" }

const DEFAULT_TARGETS = [
  { locale: "es", path: "public/cv.pdf" },
  { locale: "ca", path: "public/ca/cv.pdf" },
  { locale: "en", path: "public/en/cv.pdf" },
]

const LOCALE_TAGS = { es: "es-ES", ca: "ca-ES", en: "en-GB" }
const PRESENT = { es: "actualidad", ca: "actualitat", en: "Present" }
const SECTIONS = {
  es: [
    "Experiencia profesional",
    "Formación",
    "Proyectos seleccionados",
    "Perfil profesional",
    "Competencias técnicas",
    "Certificaciones",
    "Idiomas",
  ],
  ca: [
    "Experiència professional",
    "Formació",
    "Projectes seleccionats",
    "Perfil professional",
    "Competències tècniques",
    "Certificacions",
    "Idiomes",
  ],
  en: [
    "Professional experience",
    "Education",
    "Selected projects",
    "Professional summary",
    "Technical skills",
    "Certifications",
    "Languages",
  ],
}

function normalizeText(value) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim()
}

function formatDate(value, locale) {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T00:00:00.000Z`))
    .replaceAll(".", "")
    .replace(/\s+del\s+(?=\d{4}$)/, " ")
}

function formatDateRange(item, locale) {
  const end = item.endDate ? formatDate(item.endDate, locale) : PRESENT[locale]
  return `${formatDate(item.startDate, locale)} - ${end}`
}

function selected(collection, ids) {
  const byId = new Map(collection.map((item) => [item.id, item]))
  return ids.map((id) => byId.get(id))
}

function expectedMarkers(locale) {
  const [
    experience,
    education,
    projects,
    summary,
    skills,
    training,
    languages,
  ] = SECTIONS[locale]
  const chosenProjects = selected(cv.projects, cv.resume.projectIds)
  const chosenEducation = selected(cv.education, cv.resume.educationIds)
  const chosenCertificates = selected(cv.certificates, cv.resume.certificateIds)
  const linkedIn = cv.basics.profiles.find(
    ({ network }) => network === "LinkedIn",
  )
  const github = cv.basics.profiles.find(({ network }) => network === "GitHub")
  const phone = cv.basics.phone.replace(
    /^\+34(\d{3})(\d{3})(\d{3})$/,
    "+34 $1 $2 $3",
  )
  const country =
    new Intl.DisplayNames([LOCALE_TAGS[locale]], { type: "region" }).of(
      cv.basics.location.countryCode,
    ) ?? cv.basics.location.countryCode
  const location = `${cv.basics.location.city}, ${cv.basics.location.region[locale]}, ${country}`
  const profileSummary =
    cv.basics.summaryPrint?.[locale] ?? cv.basics.summary[locale]

  return [
    cv.basics.name,
    cv.resume.label[locale],
    cv.basics.email,
    `linkedin.com/in/${linkedIn.username}`,
    phone,
    `github.com/${github.username}`,
    "imadelmalki.com",
    location,
    experience,
    ...cv.work.flatMap((job) => {
      const roleSummary = job.summaryPrint?.[locale] ?? job.summary[locale]
      const highlights = job.highlightsPrint?.[locale] ?? job.highlights[locale]

      return [
        job.position[locale],
        job.name,
        ...(job.description ? [job.description[locale]] : []),
        formatDateRange(job, locale),
        roleSummary,
        ...highlights,
      ]
    }),
    education,
    ...chosenEducation.flatMap((item) => [
      item.studyType[locale],
      item.area[locale],
      item.institution,
      formatDateRange(item, locale),
    ]),
    projects,
    ...chosenProjects.flatMap((project) => [
      project.name[locale],
      ...project.technologies,
      ...project.highlights[locale].slice(0, 2),
    ]),
    summary,
    profileSummary,
    skills,
    ...cv.resume.skillGroups.flatMap((group) => [
      group.label[locale],
      ...group.items,
    ]),
    training,
    ...chosenCertificates.flatMap((certificate) => [
      certificate.name[locale],
      certificate.issuer,
      certificate.date.slice(0, 4),
      ...(certificate.hours ? [`${certificate.hours} h`] : []),
    ]),
    languages,
    ...cv.languages.flatMap((language) => [
      language.language[locale],
      language.fluency[locale],
      ...(language.level === "native" ? [] : [language.level]),
    ]),
  ]
}

function assertExtractedText(extractor, target, rawText) {
  const text = normalizeText(rawText)
  const comparableText = text.toLocaleLowerCase(LOCALE_TAGS[target.locale])
  const failures = []
  let cursor = 0

  for (const rawMarker of expectedMarkers(target.locale)) {
    const marker = normalizeText(rawMarker)
    const comparableMarker = marker.toLocaleLowerCase(
      LOCALE_TAGS[target.locale],
    )
    const index = comparableText.indexOf(comparableMarker, cursor)
    if (index === -1) {
      failures.push(`no encuentra en orden «${marker}»`)
      continue
    }
    cursor = index + marker.length
  }

  if (text.includes("localhost") || text.includes("127.0.0.1")) {
    failures.push("contiene una dirección local")
  }
  if (text.includes("+13")) failures.push("contiene el texto obsoleto «+13»")
  if (text.includes("�")) failures.push("contiene caracteres de sustitución")

  if (failures.length > 0) {
    throw new Error(
      `${target.path} (${extractor}):\n${failures
        .map((failure) => `  · ${failure}`)
        .join("\n")}`,
    )
  }
}

async function extractWithPdfJs(path) {
  const loadingTask = getDocument({
    data: new Uint8Array(await readFile(path)),
    enableScripting: false,
    useSystemFonts: false,
  })
  const document = await loadingTask.promise
  const pages = []

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => item.str ?? "").join(" "))
    }
  } finally {
    await loadingTask.destroy()
  }

  return pages.join("\n")
}

function extractWithPoppler(path) {
  try {
    /* `-raw` sigue el flujo de contenido etiquetado que emite Chromium. El
       modo heurístico de Poppler mezcla renglones a la misma altura entre las
       dos columnas aunque ambos estén completos, que es justo la concesión
       visual elegida para este documento. */
    return execFileSync("pdftotext", ["-raw", "-enc", "UTF-8", path, "-"], {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    })
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "Poppler no está instalado: falta `pdftotext` para el gate independiente",
      )
    }
    throw error
  }
}

export async function verifyCvAtsPdfs(
  targets = DEFAULT_TARGETS,
  { requirePoppler = false } = {},
) {
  for (const target of targets) {
    assertExtractedText("PDF.js", target, await extractWithPdfJs(target.path))
    if (requirePoppler) {
      assertExtractedText("Poppler", target, extractWithPoppler(target.path))
    }
  }

  const extractors = requirePoppler ? "PDF.js y Poppler" : "PDF.js"
  console.log(
    `✓ ${targets.length} PDF conservan texto y orden de extracción con ${extractors}`,
  )
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  const requirePoppler = argv.includes("--poppler")
  const paths = argv.slice(2).filter((value) => value !== "--poppler")
  const targets =
    paths.length === 0
      ? DEFAULT_TARGETS
      : paths.map((path, index) => ({
          locale: DEFAULT_TARGETS[index]?.locale,
          path,
        }))

  if (targets.some(({ locale }) => !locale)) {
    console.error("\n✗ indica como máximo tres PDF en orden ES, CA y EN")
    exit(1)
  }

  try {
    await verifyCvAtsPdfs(targets, { requirePoppler })
  } catch (error) {
    console.error(`\n✗ ${error.message}`)
    exit(1)
  }
}
