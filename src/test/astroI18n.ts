/** Test double for Astro's virtual module; mirrors this project's i18n config. */
export function getRelativeLocaleUrl(locale: string, path = ""): string {
  const clean = path.replace(/^\/+|\/+$/g, "")
  /* Con `build.format: "directory"` Astro normaliza las rutas de página con
     barra final, y `localizedPath` existe justamente para quitársela a los
     endpoints con extensión. Sin la barra aquí, el doble no reproducía el caso
     que ese código trata. */
  const suffix = clean ? `/${clean}/` : "/"
  return locale === "es" ? suffix : `/${locale}${suffix}`
}
