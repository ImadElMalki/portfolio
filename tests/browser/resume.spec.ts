import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const RESUMES = [
  {
    path: "/cv/",
    lang: "es",
    sections: [
      "Experiencia profesional",
      "Formación",
      "Proyectos seleccionados",
      "Perfil profesional",
      "Competencias técnicas",
      "Certificaciones",
      "Idiomas",
    ],
  },
  {
    path: "/ca/cv/",
    lang: "ca",
    sections: [
      "Experiència professional",
      "Formació",
      "Projectes seleccionats",
      "Perfil professional",
      "Competències tècniques",
      "Certificacions",
      "Idiomes",
    ],
  },
  {
    path: "/en/cv/",
    lang: "en",
    sections: [
      "Professional experience",
      "Education",
      "Selected projects",
      "Professional summary",
      "Technical skills",
      "Certifications",
      "Languages",
    ],
  },
] as const

const SECTION_ORDER = [
  "experience",
  "education",
  "projects",
  "summary",
  "skills",
  "training",
  "languages",
]

async function auditResume(page: Page) {
  return new AxeBuilder({ page })
    .include("[data-resume-document]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze()
}

for (const resume of RESUMES) {
  test(`${resume.lang}: el CV visual conserva contenido y semántica`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Chromium es el motor con el que se genera el PDF",
    )

    // Arrange
    await page.goto(resume.path)
    await page.evaluate(() => document.fonts.ready)
    const resumeDocument = page.locator("[data-resume-document]")

    // Act
    const sectionOrder = await resumeDocument
      .locator("[data-resume-section]")
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("data-resume-section")),
      )
    const headings = await resumeDocument
      .locator("[data-resume-section] > h2")
      .allTextContents()
    const accessibility = await auditResume(page)

    // Assert
    await expect(page.locator("html")).toHaveAttribute("lang", resume.lang)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, follow",
    )
    await expect(resumeDocument.locator("h1")).toHaveCount(1)
    await expect(resumeDocument.locator("img")).toHaveCount(1)
    await expect(resumeDocument.locator("img")).toHaveAttribute("alt", "")
    await expect(resumeDocument.locator("img")).toHaveAttribute(
      "src",
      /\/portrait\.webp$/,
    )
    await expect(resumeDocument.locator("table, nav")).toHaveCount(0)
    expect(sectionOrder).toEqual(SECTION_ORDER)
    expect(headings).toEqual(resume.sections)
    await expect(resumeDocument.locator("[data-resume-work]")).toHaveCount(2)
    await expect(resumeDocument.locator("[data-resume-project]")).toHaveCount(2)
    await expect(resumeDocument.locator("[data-resume-education]")).toHaveCount(
      1,
    )
    await expect(
      resumeDocument.locator("[data-resume-certificate]"),
    ).toHaveCount(5)
    await expect(resumeDocument.locator("[data-resume-language]")).toHaveCount(
      5,
    )
    await expect(resumeDocument.locator('[href^="mailto:"]')).toHaveCount(1)
    await expect(resumeDocument.locator('[href^="tel:"]')).toHaveCount(1)
    expect(accessibility.violations).toEqual([])
  })

  test(`${resume.lang}: la hoja A4 mantiene cabecera y dos columnas legibles`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "La geometría fija A4 sólo necesita el motor de impresión",
    )

    // Arrange
    await page.goto(resume.path)
    await page.evaluate(() => document.fonts.ready)
    const resumeDocument = page.locator("[data-resume-document]")

    // Act
    const layout = await resumeDocument.evaluate((root) => {
      const rect = root.getBoundingClientRect()
      const header = root.querySelector<HTMLElement>("[data-resume-header]")
      const primary = root.querySelector<HTMLElement>("[data-resume-primary]")
      const sidebar = root.querySelector<HTMLElement>("[data-resume-sidebar]")
      const photo = root.querySelector<HTMLElement>("[data-resume-photo]")
      const textElements = root.querySelectorAll(
        "h1, h2, h3, p, li, a, strong, span",
      )
      const textStyles = [...textElements]
        .filter((element) => element.textContent?.trim())
        .map((element) => {
          const style = getComputedStyle(element)
          return {
            fontSize: Number.parseFloat(style.fontSize),
            opacity: Number.parseFloat(style.opacity),
            position: style.position,
            visibility: style.visibility,
          }
        })
      const box = (element: HTMLElement | null) => {
        const boxRect = element?.getBoundingClientRect()
        return boxRect
          ? {
              bottom: boxRect.bottom,
              height: boxRect.height,
              left: boxRect.left,
              right: boxRect.right,
              top: boxRect.top,
              width: boxRect.width,
            }
          : null
      }

      return {
        document: box(root as HTMLElement),
        header: box(header),
        primary: box(primary),
        sidebar: box(sidebar),
        photo: box(photo),
        height: rect.height,
        width: rect.width,
        overflowsHorizontally: root.scrollWidth > root.clientWidth,
        overflowsVertically: root.scrollHeight > root.clientHeight,
        minFontSize: Math.min(...textStyles.map(({ fontSize }) => fontSize)),
        hiddenText: textStyles.some(
          ({ opacity, visibility }) =>
            opacity === 0 || visibility !== "visible",
        ),
        positionedText: textStyles.some(
          ({ position }) => position !== "static",
        ),
        photoBorderRadius: photo ? getComputedStyle(photo).borderRadius : "",
      }
    })

    // Assert
    expect(layout.width).toBeCloseTo(210 * (96 / 25.4), 0)
    expect(layout.height).toBeLessThanOrEqual(297 * (96 / 25.4) + 1)
    expect(layout.overflowsHorizontally).toBe(false)
    expect(layout.overflowsVertically).toBe(false)
    expect(layout.minFontSize).toBeGreaterThanOrEqual(12)
    expect(layout.hiddenText).toBe(false)
    expect(layout.positionedText).toBe(false)
    expect(layout.header).not.toBeNull()
    expect(layout.primary).not.toBeNull()
    expect(layout.sidebar).not.toBeNull()
    expect(layout.photo).not.toBeNull()
    expect(layout.primary!.left).toBeLessThan(layout.sidebar!.left)
    expect(layout.primary!.right).toBeLessThan(layout.sidebar!.left)
    expect(layout.primary!.width / layout.sidebar!.width).toBeGreaterThan(1.35)
    expect(layout.primary!.width / layout.sidebar!.width).toBeLessThan(1.7)
    expect(layout.header!.bottom).toBeLessThanOrEqual(layout.primary!.top)
    expect(layout.header!.bottom).toBeLessThanOrEqual(layout.sidebar!.top)
    expect(Math.abs(layout.photo!.width - layout.photo!.height)).toBeLessThan(1)
    expect(layout.photoBorderRadius).toBe("50%")
  })

  test(`${resume.lang}: la alternativa HTML móvil no desborda`, async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.endsWith("mobile"),
      "Este contrato sólo aplica al diseño adaptable",
    )

    // Arrange
    await page.goto(resume.path)
    await page.evaluate(() => document.fonts.ready)
    const resumeDocument = page.locator("[data-resume-document]")

    // Act
    const layout = await resumeDocument.evaluate((root) => {
      const primary = root.querySelector<HTMLElement>("[data-resume-primary]")!
      const sidebar = root.querySelector<HTMLElement>("[data-resume-sidebar]")!
      const primaryRect = primary.getBoundingClientRect()
      const sidebarRect = sidebar.getBoundingClientRect()

      return {
        pageOverflows: document.documentElement.scrollWidth > innerWidth,
        documentOverflows: root.scrollWidth > root.clientWidth,
        primaryLeft: primaryRect.left,
        sidebarLeft: sidebarRect.left,
        primaryBottom: primaryRect.bottom,
        sidebarTop: sidebarRect.top,
      }
    })

    // Assert
    expect(layout.pageOverflows).toBe(false)
    expect(layout.documentOverflows).toBe(false)
    expect(Math.abs(layout.primaryLeft - layout.sidebarLeft)).toBeLessThan(1)
    expect(layout.primaryBottom).toBeLessThanOrEqual(layout.sidebarTop)
  })
}
