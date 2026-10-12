import { defineConfig, fontProviders } from "astro/config"
import sitemap from "@astrojs/sitemap"
import { execFileSync } from "node:child_process"
import { copyFile } from "node:fs/promises"
import publicPageSlugs from "./src/lib/publicPageSlugs.json" with { type: "json" }
import cvData from "./cv.json" with { type: "json" }

const localized404Files = {
  name: "localized-404-files",
  hooks: {
    /**
     * Cloudflare Pages busca literalmente el `404.html` más cercano. Astro
     * reserva sólo el 404 de raíz y genera los anidados como `404/index.html`,
     * así que publicamos además las dos copias con el nombre que Pages exige.
     */
    "astro:build:done": async ({ dir }) => {
      await Promise.all(
        ["ca", "en"].map((locale) =>
          copyFile(
            new URL(`./${locale}/404/index.html`, dir),
            new URL(`./${locale}/404.html`, dir),
          ),
        ),
      )
    },
  },
}

// Dominio de producción. Sin `site`, Astro no puede generar URLs absolutas y el
// build sale sin canonical, sin og:image y sin sitemap. `SITE_URL` permite
// apuntar a un preview sin tocar este archivo.
const site = process.env.SITE_URL || "https://imadelmalki.com"

/**
 * Los `hreflang` de las páginas con slug propio en cada idioma.
 *
 * `@astrojs/sitemap` empareja los idiomas comparando el camino que queda
 * **tras** el prefijo, así que sólo agrupa lo que se llama igual en los tres.
 * `/servicios/`, `/ca/serveis/` y `/en/services/` no se llaman igual: el sitemap
 * las publicaba sin una sola alternativa, mientras la página declaraba las
 * cuatro. Y `sobre-mi` era peor por ser medio verdad —agrupaba castellano y
 * catalán, y dejaba fuera `/en/about/`—, que es la contradicción que Search
 * Console señala como «alternativa sin etiqueta de retorno».
 *
 * La tabla sale de `src/lib/publicPageSlugs.json`, el mismo archivo del que
 * salen las rutas de la página: dos copias acabarían discrepando, que es
 * exactamente lo que hay que arreglar aquí.
 */
const publicPageLinks = new Map()

/** Mismo formato que `localizedPath`: el castellano vive en la raíz. */
const localizedHref = (lang, path) =>
  new URL(lang === "es" ? `/${path}/` : `/${lang}/${path}/`, site).href

const rememberGroup = (links) => {
  for (const { url } of links) publicPageLinks.set(url, links)
}

for (const slugs of Object.values(publicPageSlugs)) {
  rememberGroup(
    Object.entries(slugs).map(([lang, slug]) => ({
      lang,
      url: localizedHref(lang, slug),
    })),
  )
}

/**
 * Y una entrada por proyecto, con la misma tabla.
 *
 * `/proyectos/<id>/` tiene el mismo problema que `/servicios/`: el segmento de
 * arriba se llama distinto en cada idioma, así que la integración no sabe
 * emparejarlas y las publicaría sin una sola alternativa mientras la página
 * declara las cuatro. El último tramo es el `id` de `cv.json` y **no** se
 * traduce, por lo que está escrito en `publicPages.ts`.
 */
for (const { id } of cvData.projects) {
  rememberGroup(
    Object.entries(publicPageSlugs.projects).map(([lang, slug]) => ({
      lang,
      url: localizedHref(lang, `${slug}/${id}`),
    })),
  )
}

/**
 * `lastmod` por URL: la fecha del último commit que tocó el **contenido** de
 * esa página.
 *
 * El sitemap salía sin `lastmod` (SEO-03). Google lo usa cuando es coherente y
 * lo ignora cuando no lo es, y la forma más fácil de que no lo sea es sellar
 * todas las URL con la fecha del build. Por eso cada tipo de página tiene sus
 * fuentes —los datos que escriben su texto y, en cada ficha, sus capturas; no
 * los componentes, el layout ni el CSS, que cambian sin que cambie lo que se
 * lee— y la fecha es la del último commit que tocó alguna.
 *
 * En un clon superficial `git log` no sabe cuándo cambió nada, y una fecha
 * inventada es peor que ninguna: ahí se omite. El job `build` de la CI, que es
 * el que produce lo que se despliega, clona con historia completa.
 */
const CONTENT_SOURCES = {
  home: ["cv.json", "src/data/availability.ts", "src/data/projects.ts"],
  about: ["src/data/about.ts"],
  services: ["src/data/services.ts"],
  privacy: ["src/data/privacy.ts"],
  projects: ["cv.json", "src/data/projects.ts"],
  project: ["cv.json", "src/data/projects.ts", "src/data/projectDemos.ts"],
}

const lastCommitDate = (() => {
  try {
    const shallow = execFileSync(
      "git",
      ["rev-parse", "--is-shallow-repository"],
      {
        encoding: "utf8",
      },
    ).trim()
    if (shallow !== "false") return () => undefined
  } catch {
    return () => undefined
  }

  const dates = new Map()
  return (paths) => {
    const key = paths.join("\0")
    if (!dates.has(key)) {
      try {
        const date = execFileSync(
          "git",
          ["log", "-1", "--format=%cI", "--", ...paths],
          { encoding: "utf8" },
        ).trim()
        dates.set(key, date || undefined)
      } catch {
        dates.set(key, undefined)
      }
    }
    return dates.get(key)
  }
})()

/** Qué fuentes escriben la URL, deducido de su camino y de la tabla de slugs. */
function contentSourcesOf(url) {
  const segments = new URL(url).pathname.split("/").filter(Boolean)
  if (segments[0] === "ca" || segments[0] === "en") segments.shift()
  if (segments.length === 0) return CONTENT_SOURCES.home

  const [slug, id] = segments
  const kind = Object.keys(publicPageSlugs).find((name) =>
    Object.values(publicPageSlugs[name]).includes(slug),
  )
  if (kind === "projects" && id) {
    return [...CONTENT_SOURCES.project, `src/assets/projects/${id}`]
  }
  return kind ? CONTENT_SOURCES[kind] : undefined
}

export default defineConfig({
  site,
  // El castellano vive en la raíz; catalán e inglés van con prefijo.
  i18n: {
    defaultLocale: "es",
    locales: ["es", "ca", "en"],
    routing: { prefixDefaultLocale: false },
  },
  /**
   * El CSS de cada página va dentro de su HTML: cero hojas bloqueantes. Todo
   * menos la hoja del diálogo de proyecto, que decide `assetsInlineLimit` en
   * el bloque `vite` de más abajo.
   *
   * ## La historia, porque esto ya se cambió dos veces
   *
   * Hasta el 31-08-2026 aquí ponía `"always"`, medido sobre `vite preview` con
   * 3G rápida y la CPU al 25 %: mediana de FCP/LCP de **1 528 ms incrustado
   * frente a 1 736 ms externo**. Ese día pasó a `"never"` porque la portada
   * pesaba 329 KB —llevaba dentro los diálogos de proyecto, sus galerías y la
   * vista Markdown— y con la hoja encima no cabía en el presupuesto de HTML. Se
   * dejó escrito que antes de tocar el primer pintado había que repetir el A/B.
   *
   * Se repitió el 01-10-2026 con `scripts/lighthouse-docker.mjs` en el
   * contenedor —compresión real, Lighthouse 13, perfil móvil—, cinco rondas
   * alternando variantes para que la deriva de la máquina no favoreciera a
   * ninguna: LCP mediano de **1 789 ms incrustado frente a 2 045 ms con las
   * cuatro hojas enlazadas**, y 1 671 ms sumando la Inter variable. Lo que se
   * ahorra son los viajes: cada hoja enlazada es una petición más que el primer
   * pintado tiene que esperar.
   *
   * Y ya cabe: la portada salió de los 329 KB a ~107 KB, y con la hoja dentro
   * mide ~215 KB, por debajo de los 220 KiB que tenía de techo la última vez
   * que fue incrustada. Los techos actuales están en `scripts/budgets.mjs`.
   *
   * El precio es la caché: el CSS deja de compartirse entre páginas, y cada
   * navegación lo vuelve a traer dentro del documento (~17 KiB con Brotli en la
   * portada). Para un sitio al que casi todo el mundo llega por una sola
   * página, pesa más el primer pintado.
   *
   * `"auto"` y no `"always"` sólo por esa excepción: con `"auto"` Astro le
   * pregunta a `assetsInlineLimit` hoja por hoja.
   */
  build: { inlineStylesheets: "auto" },
  vite: {
    /**
     * La fecha de contenido de la portada, para el `dateModified` de su
     * `ProfilePage`. Es la misma cuenta que el `lastmod` del sitemap —el último
     * commit que tocó las fuentes de `CONTENT_SOURCES.home`— y por eso sale de
     * aquí y no de una segunda lectura de Git: las dos fechas no pueden
     * discrepar. En un clon superficial vale `null` y la página no la declara.
     */
    define: {
      __HOME_CONTENT_DATE__: JSON.stringify(
        lastCommitDate(CONTENT_SOURCES.home) ?? null,
      ),
    },
    build: {
      /**
       * Se incrusta toda hoja salvo la del diálogo de proyecto.
       *
       * Esa hoja viaja con la ficha y no con la página (PERF-06): la portada y
       * el índice no la incluyen, y el guion del diálogo adopta los
       * `<link rel="stylesheet">` de `/project-details/` al abrir el primero.
       * Si la ficha la trajera incrustada, no habría `<link>` que adoptar, y
       * adoptar su `<style>` entero metería otra vez todo el CSS global detrás
       * del de la página: los estilos con ámbito de Astro van con `:where()`,
       * no suman especificidad, y el orden decide.
       *
       * Se reconoce por `.detail-standalone`, una clase que sólo dibuja esa
       * hoja, y no por el nombre del trozo, que Rollup elige y puede cambiar.
       * Lo vigilan `check-build` (`/project-details/` tiene que enlazarla) y la
       * prueba del arrastre de la tira de capturas, que sin ella no desborda.
       *
       * Esta misma opción decide si Vite incrusta imágenes, fuentes y guiones
       * pequeños: para todo lo que no es CSS se devuelve `undefined`, que deja
       * el límite por defecto de 4 KiB, el de siempre.
       */
      assetsInlineLimit: (filePath, content) =>
        filePath.endsWith(".css")
          ? !content.includes(".detail-standalone")
          : undefined,
    },
  },
  /**
   * `prefetchAll: false` a propósito: prefetchear todo pondría en cola también
   * los anclas del índice lateral, que no navegan a ningún sitio. Precarga
   * sólo lo que lleva `data-astro-prefetch`, que hoy son los enlaces del
   * conmutador de idioma, y sólo al pasar el puntero o enfocarlos.
   *
   * Hasta el 06-10-2026 `languagePrefetch.ts` pedía además las otras dos
   * versiones de la página después del `load`: ~84 KB con Brotli por visita a
   * la portada, el doble que la propia portada, para el ~7 % de visitas que van
   * a `/ca/` o `/en/`. Con el `hover` el cambio de idioma sigue saliendo de la
   * caché en cuanto alguien apunta al conmutador.
   */
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  markdown: {
    /**
     * Shiki colorea cada token con un `style` inline, y la CSP de más abajo
     * emite `style-src 'self' 'sha256-…'` sin `'unsafe-inline'`: el navegador
     * los rechazaría. Astro avisa de ello en cada build.
     *
     * Apagarlo no cambia una sola línea de la salida: el único Markdown del
     * sitio es el CV que compone `src/lib/portfolioMarkdown.ts`, y ahí no hay
     * ningún bloque de código. `prism` también resolvería el aviso, pero
     * añadiría una hoja de estilos que nadie usa.
     */
    syntaxHighlight: false,
  },
  security: {
    // Astro calcula el hash de cada estilo y guion que procesa —no el de los
    // `is:inline`— y los declara en un <meta> al final del <head>, así que no
    // hace falta `unsafe-inline`. Cada página lleva sólo los suyos: ver
    // `scripts/csp.mjs`. Lo que no se puede expresar en un <meta>
    // (`frame-ancestors`, HSTS) va en `public/_headers`.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
      ],
    },
  },
  integrations: [
    localized404Files,
    sitemap({
      // Los fragmentos diferidos tienen fallback web, pero no son landings que
      // deban competir con la portada en buscadores. El CV HTML es una fuente
      // accesible para el PDF y lleva `noindex`, así que tampoco se anuncia.
      filter: (url) =>
        !url.includes("/project-details/") &&
        !url.includes("/prior-work/") &&
        !url.endsWith("/cv/"),
      /**
       * Sin `filter`: desde el 23-08-2026 la landing de servicios entra en el
       * sitemap con todo lo demás.
       *
       * Estuvo fuera mientras llevaba `noindex` en el marcado, porque una URL
       * que el sitemap propone y la página rechaza es la contradicción que
       * señala Search Console. Al quitarse el `noindex` la razón desaparece, y
       * dejarla fuera sería el desajuste contrario: una página que pide ser
       * indexada y un sitemap que no la nombra.
       *
       * `scripts/check-build.mjs` comprueba que las dos mitades siguen de
       * acuerdo, ahora en el sentido nuevo.
       */
      i18n: {
        defaultLocale: "es",
        // Las mismas etiquetas que emite `LOCALE_TAGS` en los `hreflang` de la
        // página: dos juegos distintos para las mismas URLs confunden a Google.
        locales: { es: "es", ca: "ca", en: "en" },
      },
      /**
       * `x-default` apuntando al castellano, igual que el `<link>` de la página.
       * La integración sólo emite un `hreflang` por idioma, así que sin esto la
       * página y el sitemap declaraban juegos distintos — justo el desajuste que
       * vigila `scripts/check-build.mjs`.
       *
       * El array `links` sale de una caché compartida por las tres URLs de la
       * misma página: hay que copiarlo, no empujar dentro.
       */
      serialize(item) {
        const sources = contentSourcesOf(item.url)
        const lastmod = sources && lastCommitDate(sources)
        const dated = lastmod ? { ...item, lastmod } : item

        /* Las páginas con slug propio por idioma traen los suyos de la tabla;
           las tres portadas siguen usando los que arma la integración. */
        const links = publicPageLinks.get(item.url) ?? item.links
        const defaultLink = links?.find(({ lang }) => lang === "es")

        if (!defaultLink) return dated

        return {
          ...dated,
          links: [...links, { url: defaultLink.url, lang: "x-default" }],
        }
      },
    }),
  ],
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-inter",
      // Fontsource y no Google: la API de Google devuelve el archivo variable
      // aunque se le pidan pesos sueltos, y de ahí venían las fuentes Type 3
      // del PDF. Fontsource publica un archivo por peso.
      provider: fontProviders.fontsource(),
      /**
       * Pesos sueltos y **no** el rango variable `"400 800"`.
       *
       * Chromium no sabe incrustar la instancia de una fuente variable en un
       * PDF: la convierte en fuentes Type 3, un procedimiento de dibujo por
       * glifo. Los tres CV salían así —28 subconjuntos Type 3 y 400 KB por
       * archivo— hasta que estos pesos dejaron de ser un rango.
       *
       * La lista manda sobre el CSS: cualquier `font-weight` intermedio
       * (había 650, 750 y 780) se redondea al vecino más cercano y el PDF
       * vuelve a diferir de la web.
       */
      weights: ["400", "500", "600", "700", "800"],
      styles: ["normal"],
      // Solo `latin`: ni el CV ni la interfaz (es/ca/en) usan un solo glifo del
      // rango `latin-ext`, y `preload` descarga el archivo aunque su
      // `unicode-range` no case nunca. Eran 83 KB en el camino crítico.
      subsets: ["latin"],
      display: "swap",
      fallbacks: [
        "ui-sans-serif",
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "sans-serif",
      ],
    },
    {
      /**
       * La misma Inter, para pantalla: un archivo variable y no cinco sueltos.
       *
       * Los cinco pesos de arriba pesan ~118 KiB y la portada los pedía todos
       * al maquetar, justo antes del primer pintado. En la CI terminaban de
       * bajar antes de pintarse la página y Lighthouse los contaba como si lo
       * bloquearan: las fuentes eran más de la mitad de los bytes de su LCP
       * simulado, e Inter la mayor parte (PERF-03). Este pesa 36 KiB.
       *
       * Es la Inter de Fontsource recortada por
       * `scripts/fonts/instance_variable_fonts.py`: peso de 400 a 800, que es lo que
       * pide el CSS, y el tamaño óptico fijado en 14, el de los estáticos. Sin
       * fijarlo, el navegador lo ajusta al cuerpo de letra y los titulares
       * cambiarían de dibujo. Fijado, cada peso es el del archivo suelto.
       *
       * Los estáticos siguen para lo que acaba en papel: el CV en PDF
       * (`cv.astro`) y la impresión de cualquier página, que vuelve a ellos
       * dentro de `@media print` en `Layout.astro`. Sólo se descargan ahí.
       */
      name: "Inter",
      cssVariable: "--font-inter-variable",
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/inter-latin-400-800.woff2"],
            weight: "400 800",
            style: "normal",
          },
        ],
      },
      display: "swap",
      fallbacks: [
        "ui-sans-serif",
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "sans-serif",
      ],
    },
    {
      /**
       * La tipografía del nombre, y sólo del nombre.
       *
       * Space Grotesk sale de Colophon, la misma fundición que dibujó las tipos
       * de Nothing, así que comparte el ADN que el resto del sitio imita a mano:
       * terminaciones rectas, cuenco cuadrado y las diagonales cortadas en
       * ángulo recto. Es la pieza que faltaba para que el `h1` deje de ser una
       * grotesca de sistema con mucho peso.
       *
       * Un solo peso porque un solo elemento la usa. Y suelto, no un rango
       * variable, por lo mismo que Inter y Doto: Chromium convierte las
       * instancias variables en fuentes Type 3 al imprimir. Aun así el papel no
       * la ve nunca —`Hero.astro` devuelve el `h1` a Inter dentro de
       * `@media print` y `scripts/check-cv-pdf.mjs` lo vigila—, pero el archivo
       * suelto es también el que menos pesa.
       */
      name: "Space Grotesk",
      cssVariable: "--font-space-grotesk",
      provider: fontProviders.fontsource(),
      weights: ["700"],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    },
    {
      name: "Doto",
      /**
       * Matriz de puntos para las cifras, no para el texto.
       *
       * Se sirve a través de `--font-display` (ver `Layout.astro`) y la usan las
       * marcas de `DateRange`, el ordinal de cada sección y el código del 404:
       * lecturas de instrumento, todas cortas y casi todas numéricas.
       *
       * Estuvo también en el nombre del hero y se revirtió: a 43-72 px los
       * puntos pesaban más que las letras en lo primero que se lee de la página.
       * A tamaño de cuerpo es directamente ilegible, así que no se ofrece como
       * tipografía general por mucho que ahora tenga token.
       *
       * Un solo peso y `latin`: por debajo de eso no hay nada que recortar.
       * Doto se publica como variable, pero aquí se piden **700 sueltos** por
       * la misma razón que Inter —Chromium convierte las instancias variables
       * en fuentes Type 3 al imprimir—. Aun así el papel no la usa nunca:
       * `Hero.astro` la devuelve a Inter dentro de `@media print`, y
       * `scripts/check-cv-pdf.mjs` es quien vigila que siga siendo así.
       */
      cssVariable: "--font-doto",
      provider: fontProviders.fontsource(),
      weights: ["700"],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["ui-monospace", "monospace"],
    },
    {
      /**
       * La mono se sirve y no se toma prestada del sistema.
       *
       * `--font-mono` era una pila de fuentes locales, así que las fechas, los
       * badges y las etiquetas de habilidad salían en Consolas al generar los
       * PDF desde Windows y en Liberation Mono al generarlos en la CI (ubuntu):
       * el archivo publicado no era el que se revisaba en local.
       */
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      provider: fontProviders.fontsource(),
      // 400 para las fechas y 700 para los badges; no hay más pesos mono en la
      // interfaz.
      weights: ["400", "700"],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: [
        "ui-monospace",
        "SFMono-Regular",
        "Consolas",
        "Liberation Mono",
        "Menlo",
        "monospace",
      ],
    },
    {
      /**
       * La misma mono, para pantalla, por lo mismo que Inter: un archivo
       * variable recortado a 400-700 (30 KiB) en vez de los dos sueltos de
       * arriba (43 KiB). La recorta el mismo
       * `scripts/fonts/instance_variable_fonts.py`; JetBrains Mono no tiene eje
       * de tamaño óptico, así que no hay nada más que fijar. Los sueltos quedan
       * para imprimir.
       */
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono-variable",
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/jetbrains-mono-latin-400-700.woff2"],
            weight: "400 700",
            style: "normal",
          },
        ],
      },
      display: "swap",
      fallbacks: [
        "ui-monospace",
        "SFMono-Regular",
        "Consolas",
        "Liberation Mono",
        "Menlo",
        "monospace",
      ],
    },
  ],
})
