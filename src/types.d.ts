import type Mail from "@/icons/Mail.astro"

/** Un icono `.astro` sin props (todos los de `src/icons`). */
export type AstroIcon = typeof Mail

/**
 * Mapa de clave → componente de icono, para las claves que salen de datos
 * (`cv.json`) y no de un union del esquema. Convivía con un alias `SocialIcon`
 * idéntico: dos nombres para la misma forma, uno en `Hero.astro` y otro en
 * `ProjectDetail.astro`.
 */
export type IconMap = Record<string, AstroIcon | undefined>
