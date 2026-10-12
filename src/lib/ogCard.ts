import satori from "satori"
import sharp from "sharp"
import { dataUriToBuffer, readProjectFile } from "@/lib/dataUri"
// Las fuentes van con `?inline`: son de `node_modules`, pesan poco y así viajan
// dentro del bundle. El retrato no, porque además del data URI Vite emitía el
// original de 176 KB a `dist/_astro/`.
import interRegular from "@fontsource/inter/files/inter-latin-400-normal.woff?inline"
import interBold from "@fontsource/inter/files/inter-latin-700-normal.woff?inline"
import interBlack from "@fontsource/inter/files/inter-latin-800-normal.woff?inline"

/**
 * La tarjeta 1200×630 que se ve al compartir un enlace del sitio.
 *
 * Vivía entera dentro de `[...locale]/og.jpg.ts`, con los datos de la portada
 * escritos en medio del diseño. Salió de ahí cuando las fichas de proyecto
 * necesitaron la suya: hasta el 08-10-2026 las veinticuatro compartían la
 * tarjeta de la portada, así que un enlace a `/proyectos/100-cims/` en LinkedIn
 * enseñaba el retrato y el titular del portfolio y no decía de qué proyecto
 * hablaba.
 *
 * Lo que cambia entre una tarjeta y otra es el texto; el diseño, el retrato y
 * las fuentes son los mismos, y tienen que seguir siéndolo.
 *
 * `satori` compone el diseño y devuelve un SVG con los glifos ya convertidos a
 * trazados, así que `sharp` puede rasterizarlo sin depender de las fuentes del
 * sistema donde corra el build.
 */
const WIDTH = 1200
const HEIGHT = 630

/** Los mismos tokens que el tema claro del sitio (ver `Layout.astro`). */
const COLORS = {
  bg: "#f7f8f6",
  text: "#141715",
  muted: "#5f6962",
  accent: "#245f91",
  accentSoft: "#e2edf6",
}

/**
 * `satori` lee ttf, otf y woff, pero **no** woff2, así que no sirven los
 * archivos que descarga la API de fuentes de Astro. `@fontsource/inter` publica
 * woff y es dependencia de desarrollo: solo se usa aquí, durante el build.
 */
const FONTS = [
  {
    name: "Inter",
    data: dataUriToBuffer(interRegular),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "Inter",
    data: dataUriToBuffer(interBold),
    weight: 700 as const,
    style: "normal" as const,
  },
  {
    name: "Inter",
    data: dataUriToBuffer(interBlack),
    weight: 800 as const,
    style: "normal" as const,
  },
]

/** Recortar el retrato es caro; el resultado se reutiliza entre todas las tarjetas. */
let portraitPromise: Promise<string> | null = null

function loadPortrait(): Promise<string> {
  // `satori` no decodifica webp: el retrato se recorta y se pasa a png.
  portraitPromise ??= readProjectFile("src/assets/me.webp")
    .then((source) =>
      sharp(source)
        .resize(360, 450, { fit: "cover", position: "centre" })
        .png()
        .toBuffer(),
    )
    .then((buffer) => `data:image/png;base64,${buffer.toString("base64")}`)

  return portraitPromise
}

export interface OgCardContent {
  /**
   * El titular, una línea por elemento.
   *
   * La portada parte el nombre en dos para que ocupe el alto de la tarjeta; una
   * ficha manda el nombre del proyecto en una sola.
   */
  title: readonly string[]
  /** Cuerpo del titular. Una ficha baja de 76 porque su título es más largo. */
  titleSize: number
  /** Dos líneas como mucho: lo recorta `lineClamp`, no esta función. */
  subtitle: string
  /** El renglón del pie, con su punto de acento delante. */
  footer: string
}

/**
 * El JPEG listo para servir.
 *
 * `Uint8Array<ArrayBuffer>` y no `Uint8Array` a secas: el genérico por defecto
 * admite también un búfer compartido, y `Response` no lo acepta como cuerpo.
 */
export async function renderOgCard(
  card: OgCardContent,
): Promise<Uint8Array<ArrayBuffer>> {
  const portrait = await loadPortrait()

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: "64px",
          padding: "72px",
          backgroundColor: COLORS.bg,
          backgroundImage: `radial-gradient(circle at 50% -40%, ${COLORS.accentSoft} 0%, ${COLORS.bg} 62%)`,
          fontFamily: "Inter",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                flex: "1",
                minWidth: "0",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      width: "56px",
                      height: "6px",
                      borderRadius: "999px",
                      backgroundColor: COLORS.accent,
                      marginBottom: "32px",
                    },
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      color: COLORS.text,
                      fontSize: `${card.titleSize}px`,
                      fontWeight: 800,
                      letterSpacing: "-3.5px",
                      lineHeight: 1.02,
                    },
                    children: card.title.map((line) => ({
                      type: "div",
                      props: { children: line },
                    })),
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "block",
                      marginTop: "28px",
                      color: COLORS.muted,
                      fontSize: "29px",
                      fontWeight: 400,
                      lineHeight: 1.4,
                      lineClamp: 2,
                    },
                    children: card.subtitle,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      marginTop: "auto",
                      paddingTop: "40px",
                      color: COLORS.accent,
                      fontSize: "24px",
                      fontWeight: 700,
                    },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            width: "10px",
                            height: "10px",
                            borderRadius: "999px",
                            backgroundColor: COLORS.accent,
                          },
                        },
                      },
                      { type: "div", props: { children: card.footer } },
                    ],
                  },
                },
              ],
            },
          },
          {
            type: "img",
            props: {
              src: portrait,
              width: 360,
              height: 450,
              // Sin borde: al combinarlo con `borderRadius`, satori deja un
              // artefacto en la esquina inferior derecha.
              style: { borderRadius: "28px", objectFit: "cover" },
            },
          },
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts: FONTS },
  )

  // JPEG y no PNG: la tarjeta lleva una foto, y en PNG pesaba 330 KB — por
  // encima del límite que aplica WhatsApp al previsualizar. Aquí son ~45 KB, y
  // lo interpretan todos los scrapers (X, LinkedIn, Slack, Telegram).
  const jpeg = await sharp(Buffer.from(svg))
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()

  return new Uint8Array(jpeg)
}

/** El renglón del pie: lo que separa los datos de una tarjeta, siempre igual. */
export function ogFooter(parts: readonly (string | undefined)[]): string {
  return parts.filter(Boolean).join("  ·  ")
}
