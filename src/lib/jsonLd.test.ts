import { describe, expect, it } from "vitest"
import cv from "../../cv.json"
import { cvSchema } from "./cvSchema"
import { buildProfileJsonLd, serializeJsonLd } from "./jsonLd"

const cvData = cvSchema.parse(cv)
const SITE = "https://imadelmalki.com/"

/** La portada de un idioma, que es el caso que la mayoría de estas pruebas usa. */
const home = (locale: "es" | "ca" | "en") => ({
  canonical: `https://imadelmalki.com/${locale === "es" ? "" : `${locale}/`}`,
  title: "Título de la página",
  description: "Descripción de la página",
})

describe("serializeJsonLd", () => {
  it("escapa `<` para que un `</script>` del CV no cierre la etiqueta", () => {
    const json = serializeJsonLd({ description: "</script><img onerror=x>" })

    expect(json).not.toContain("</script>")
    expect(json).toContain("\\u003c/script")
    expect(JSON.parse(json).description).toBe("</script><img onerror=x>")
  })
})

describe("buildProfileJsonLd", () => {
  it("declara ProfilePage localizada y Person con ID estable", () => {
    const ld = buildProfileJsonLd(cvData, SITE, "ca", home("ca"))

    /* Nodo a nodo y no `toMatchObject` sobre el `@graph` entero: con un array,
       esa aserción exige además que la longitud coincida, así que se rompía al
       colgar los proyectos del grafo aunque los dos primeros nodos siguieran
       intactos. Lo que importa aquí es su forma, no cuántos vecinos tienen. */
    expect(ld["@context"]).toBe("https://schema.org")
    expect(ld["@graph"][0]).toMatchObject({
      "@type": "ProfilePage",
      "@id": "https://imadelmalki.com/ca/#page",
      url: "https://imadelmalki.com/ca/",
      inLanguage: "ca",
      mainEntity: { "@id": "https://imadelmalki.com/#person" },
    })
    expect(ld["@graph"][1]).toMatchObject({
      "@type": "Person",
      "@id": "https://imadelmalki.com/#person",
      givenName: "Imad",
      familyName: "El Malki Jaddi",
      email: cvData.basics.email,
      jobTitle: cvData.basics.label.ca,
    })

    const person = ld["@graph"][1]
    expect(person).not.toHaveProperty("inLanguage")
    /* El email va pelado, sin `mailto:`: schema.org lo pide así y Google
       descarta la propiedad si llega con esquema. Negar el valor con prefijo no
       comprobaba nada —no hay camino que lo produzca—, así que se afirma el que
       sí debe salir. */
    expect(person).toHaveProperty("email", cvData.basics.email)
  })

  it("compone canonical e imagen absolutas por idioma", () => {
    const ld = buildProfileJsonLd(cvData, SITE, "en", home("en"))

    expect(ld["@graph"][0]).toMatchObject({
      url: "https://imadelmalki.com/en/",
    })
    expect(ld["@graph"][1]).toMatchObject({
      url: "https://imadelmalki.com/en/",
      image: { contentUrl: "https://imadelmalki.com/portrait.webp" },
    })
  })

  it("sólo lista como empleo actual el trabajo sin fecha de fin", () => {
    const ld = buildProfileJsonLd(cvData, SITE, "es", home("es"))
    const current = cvData.work.filter(({ endDate }) => endDate === null)
    const person = ld["@graph"][1]

    if (!person || !("worksFor" in person)) {
      throw new Error("Person node missing from JSON-LD graph")
    }

    expect(person.worksFor).toHaveLength(current.length)
    expect(person.worksFor.map(({ name }) => name)).toEqual(
      current.map(({ name }) => name),
    )
    /* Un centro por nodo y sin repetidos: el Bachillerato pasó por dos
       institutos y en `cv.json` van en un campo separados por ` · `, porque en
       la página son una fila. En el grafo no pueden salir como una sola
       organización llamada «A · B». */
    expect(person.alumniOf).toEqual(
      [
        ...new Set(
          cvData.education.flatMap(({ institution }) =>
            institution.split(" · "),
          ),
        ),
      ].map((name) => ({ "@type": "EducationalOrganization", name })),
    )
    // Titulaciones y certificados comparten la lista: el `@id` correlativo se
    // reparte entre las dos, así que se comprueba que no se repita ninguno.
    const credentials = person.hasCredential ?? []

    expect(credentials).toHaveLength(
      cvData.education.length + cvData.certificates.length,
    )
    expect(new Set(credentials.map(({ "@id": id }) => id)).size).toBe(
      credentials.length,
    )
  })

  /**
   * Los proyectos, como nodos y no como texto suelto.
   *
   * Lo que se comprueba es lo que un buscador necesita para entenderlos: que
   * hay uno por proyecto, que cada `@id` es único —un id repetido colapsa dos
   * nodos en uno— y que cuelgan de la misma `Person` por `author`, que es la
   * relación que los ata a quien los hizo.
   */
  describe("proyectos", () => {
    /* `SITE` acaba en barra y el generador la recorta, así que los `@id` se
       componen sobre la versión sin ella. */
    const base = SITE.replace(/\/$/, "")
    const projects = () =>
      buildProfileJsonLd(cvData, SITE, "es", home("es"))["@graph"].filter(
        /* Con predicado: `filter` a secas no estrecha la unión del grafo, y sin
           estrechar no existen `author` ni `programmingLanguage` para TS. */
        (
          node,
        ): node is Extract<typeof node, { programmingLanguage: string[] }> =>
          node["@type"] === "SoftwareSourceCode",
      )

    it("emite uno por proyecto, con identificadores únicos", () => {
      const nodes = projects()
      expect(nodes).toHaveLength(cvData.projects.length)
      expect(new Set(nodes.map((node) => node["@id"])).size).toBe(nodes.length)
    })

    it("los ata a la persona y lleva el stack", () => {
      const [first] = projects()
      expect(first?.author).toEqual({ "@id": `${base}/#person` })
      expect(first?.programmingLanguage).toEqual(
        cvData.projects[0]?.technologies,
      )
    })

    /* Un proyecto privado no tiene enlace público. Emitir `url` vacío o
       inventado es peor que no emitirlo: el dato falso sí se indexa. */
    it("omite url y repositorio cuando el proyecto no los tiene", () => {
      for (const node of projects()) {
        const id = String(node["@id"]).replace(`${base}/#project-`, "")
        const links = cvData.projects.find((p) => p.id === id)?.links ?? []
        const hasSource = links.some((link) => link.kind === "source")
        const hasSite = links.some((link) => link.kind === "website")

        expect("codeRepository" in node).toBe(hasSource)
        expect("url" in node).toBe(hasSite)
      }
    })
  })

  /**
   * El nodo de la página describe **esa** página.
   *
   * Hasta el 11-09-2026 no: la función recomponía siempre la portada, así que
   * las 36 URL indexables emitían el mismo `@id` y una `url` que contradecía su
   * propio `<link rel="canonical">`. Es el `SEO-02` del informe de ese día, y
   * lo que estas pruebas impiden que vuelva.
   */
  describe("el nodo de la página", () => {
    const pageNode = (page: Parameters<typeof buildProfileJsonLd>[3]) =>
      buildProfileJsonLd(cvData, SITE, "es", page)["@graph"][0]

    it("usa la canónica que recibe, y no la de la portada", () => {
      const node = pageNode({
        canonical: "https://imadelmalki.com/servicios/",
        title: "Servicios",
        description: "Lo que hago",
      })

      expect(node).toMatchObject({
        "@type": "WebPage",
        "@id": "https://imadelmalki.com/servicios/#page",
        url: "https://imadelmalki.com/servicios/",
        name: "Servicios",
        description: "Lo que hago",
      })
    })

    it("reserva ProfilePage para la portada", () => {
      expect(pageNode(home("es"))).toMatchObject({
        "@type": "ProfilePage",
        "@id": "https://imadelmalki.com/#page",
      })
      /* Y el titular del CV, no el `<title>`: describe a la persona mejor. */
      expect(pageNode(home("es"))).toMatchObject({
        name: cvData.basics.headline.es,
        description: cvData.basics.tagline.es,
      })
    })

    it("la ficha de un proyecto es una ItemPage cuyo sujeto es ese proyecto", () => {
      const id = cvData.projects[0]!.id
      const node = pageNode({
        canonical: `https://imadelmalki.com/proyectos/${id}/`,
        title: "Race Hub",
        description: "Una ficha",
        projectId: id,
      })

      expect(node).toMatchObject({
        "@type": "ItemPage",
        "@id": `https://imadelmalki.com/proyectos/${id}/#page`,
        mainEntity: { "@id": `https://imadelmalki.com/#project-${id}` },
      })
      /* El sujeto tiene que existir en el grafo: un `mainEntity` que apunta a un
         `@id` que nadie declara es un nodo colgando de nada. */
      const graph = buildProfileJsonLd(cvData, SITE, "es", {
        canonical: `https://imadelmalki.com/proyectos/${id}/`,
        title: "Race Hub",
        description: "Una ficha",
        projectId: id,
      })["@graph"]

      expect(
        graph.some(
          (n) => n["@id"] === `https://imadelmalki.com/#project-${id}`,
        ),
      ).toBe(true)
    })

    it("la ficha lleva migas de portada, índice y proyecto", () => {
      const id = cvData.projects[0]!.id
      const graph = buildProfileJsonLd(cvData, SITE, "es", {
        canonical: `https://imadelmalki.com/proyectos/${id}/`,
        title: "Race Hub",
        description: "Una ficha",
        projectId: id,
      })["@graph"]
      /* Con predicado, igual que arriba con los proyectos: `find` a secas no
         estrecha la unión del grafo y sin estrechar no existe
         `itemListElement`. */
      const crumbs = graph.find(
        (n): n is Extract<typeof n, { itemListElement: unknown[] }> =>
          n["@type"] === "BreadcrumbList",
      )

      expect(crumbs).toBeDefined()
      expect(crumbs?.itemListElement.map(({ item }) => item)).toEqual([
        "https://imadelmalki.com/",
        "https://imadelmalki.com/proyectos/",
        `https://imadelmalki.com/proyectos/${id}/`,
      ])
      expect(crumbs?.itemListElement.map(({ position }) => position)).toEqual([
        1, 2, 3,
      ])
    })

    it("sólo la portada declara imagen principal", () => {
      expect(pageNode(home("es"))).toHaveProperty("primaryImageOfPage")
      expect(
        pageNode({
          canonical: "https://imadelmalki.com/sobre-mi/",
          title: "Sobre mí",
          description: "Quién soy",
        }),
      ).not.toHaveProperty("primaryImageOfPage")
    })

    it("la portada declara la fecha de su contenido", () => {
      const node = pageNode({
        ...home("es"),
        dateModified: "2026-10-06T12:00:00+02:00",
      })

      expect(node).toHaveProperty("dateModified", "2026-10-06T12:00:00+02:00")
    })

    it("sólo la ProfilePage lleva dateModified", () => {
      const node = pageNode({
        canonical: "https://imadelmalki.com/sobre-mi/",
        title: "Sobre mí",
        description: "Quién soy",
        dateModified: "2026-10-06T12:00:00+02:00",
      })

      expect(node).not.toHaveProperty("dateModified")
    })

    /* Lo que originó el hallazgo: dos páginas distintas no pueden compartir el
       identificador del nodo que las describe. */
    it("da un @id distinto a cada página", () => {
      const ids = [
        home("es"),
        {
          canonical: "https://imadelmalki.com/servicios/",
          title: "a",
          description: "b",
        },
        {
          canonical: "https://imadelmalki.com/sobre-mi/",
          title: "c",
          description: "d",
        },
        {
          canonical: "https://imadelmalki.com/proyectos/race-hub/",
          title: "e",
          description: "f",
          projectId: "race-hub",
        },
      ].map((page) => pageNode(page)?.["@id"])

      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  it("serializa a JSON válido con el CV real", () => {
    for (const locale of ["es", "ca", "en"] as const) {
      const json = serializeJsonLd(
        buildProfileJsonLd(cvData, SITE, locale, home(locale)),
      )
      expect(() => JSON.parse(json)).not.toThrow()
    }
  })
})
