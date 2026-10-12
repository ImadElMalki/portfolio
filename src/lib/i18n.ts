import { getRelativeLocaleUrl } from "astro:i18n"
import type { Locale } from "@/lib/cvSchema"
import { DEFAULT_LOCALE, LOCALES } from "@/lib/ui"

/**
 * Lo que necesita el runtime de i18n de Astro, y sólo eso.
 *
 * El diccionario y las constantes de idioma están en `ui.ts` porque los usa
 * también el JS del navegador, y `getRelativeLocaleUrl` arrastra medio Astro al
 * paquete de cliente. Este archivo lo reexporta todo, así que importar de aquí
 * sigue funcionando igual que siempre —desde el servidor—.
 */
export * from "@/lib/ui"

/** `("ca", "/cv.md")` → `/ca/cv.md`; en castellano devuelve la ruta tal cual. */
export function localizedPath(locale: Locale, path = "/"): string {
  const clean = path.replace(/^\/+|\/+$/g, "")
  const localizedUrl = getRelativeLocaleUrl(locale, clean)

  // Con `build.format: "directory"`, Astro normaliza las rutas de página con
  // una barra final. Los endpoints conservan una extensión real y no son
  // directorios: `/cv.md/` funciona por redirección en preview, pero no es la
  // URL pública canónica ni un nombre de descarga fiable en Pages.
  return /\.[a-z0-9]+$/i.test(clean)
    ? localizedUrl.replace(/\/$/, "")
    : localizedUrl
}

/**
 * Rutas estáticas de `[...locale]`: el idioma por defecto va sin parámetro para
 * que salga en la raíz, los demás con su prefijo.
 */
export function localeStaticPaths(): ReadonlyArray<{
  params: { locale: Locale | undefined }
  props: { locale: Locale }
}> {
  return LOCALES.map((locale) => ({
    params: { locale: locale === DEFAULT_LOCALE ? undefined : locale },
    props: { locale },
  }))
}
