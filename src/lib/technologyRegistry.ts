/**
 * Nombre fuente → ID estable de cada tecnología que nombra `cv.json`.
 *
 * Tiene que estar **completa**: cubre tanto `skills` como los `technologies` de
 * cada proyecto, y `registries.test.ts` falla si aparece un nombre que no esté
 * aquí. No es celo de inventario — `ProjectDetail.astro` resuelve el chip con
 * `technologyDefinition(name)?.Icon`, así que un nombre sin registrar no rompe
 * nada: se pinta como texto pelado, igual que un `"Reactt"` mal escrito.
 *
 * Estar aquí no implica tener icono. El icono es cosa de `techIcons.ts`, que
 * cubre los ids que tienen `.astro` en `src/icons/` y deja fuera el resto.
 *
 * Orden alfabético por nombre, con la familia Cloudflare junta.
 */
/**
 * El grupo con el que se pinta cada tecnología en la sección de habilidades.
 *
 * Vive aquí y no en `cv.json` a propósito: el currículum sigue el esquema de
 * JSON Resume —`name` y `level`, nada más— y ese fichero lo sirve
 * `/cv.json` en público. La categoría es una decisión de **presentación**, no
 * un dato del currículum: agrupar Angular con CSS y Java con Spring Boot es una
 * forma de enseñar la lista, y cambiarla no cambia lo que alguien sabe hacer.
 *
 * Y va en este registro y no en `Skills.astro` porque aquí ya está el mapa de
 * nombre a identificador, que es la misma llave. Un sitio, una llave.
 *
 * ## Qué es «mobile-other»
 *
 * Kotlin, Room y WorkManager son Android; Power Apps, Power BI, Elementor y
 * WordPress son low-code; Capacitor y las extensiones de Chrome son plataformas
 * de empaquetado. Ninguna es web, ni servidor, ni nube, ni utillaje de trabajo,
 * y Kotlin —la única de las nueve que hoy figura en `skills`— se quedaría sola
 * en un grupo «Mobile» de un solo chip, que se lee como un fallo de maquetación
 * y no como una categoría.
 */
export type TechnologyGroup =
  "frontend" | "backend" | "cloud-data" | "mobile-other" | "tools"

export const TECHNOLOGIES = [
  { id: "angular", name: "Angular", group: "frontend" },
  { id: "astro", name: "Astro", group: "frontend" },
  { id: "capacitor", name: "Capacitor", group: "mobile-other" },
  { id: "chrome-extensions", name: "Chrome Extensions", group: "mobile-other" },
  { id: "cloudflare-workers", name: "Cloudflare Workers", group: "cloud-data" },
  { id: "cloudflare-d1", name: "D1", group: "cloud-data" },
  { id: "cloudflare-queues", name: "Queues", group: "cloud-data" },
  { id: "cloudflare-r2", name: "R2", group: "cloud-data" },
  { id: "css", name: "CSS", group: "frontend" },
  { id: "docker", name: "Docker", group: "tools" },
  { id: "elementor", name: "Elementor", group: "mobile-other" },
  { id: "git", name: "Git", group: "tools" },
  { id: "github", name: "GitHub", group: "tools" },
  { id: "gmail-api", name: "Gmail API", group: "backend" },
  { id: "hono", name: "Hono", group: "backend" },
  { id: "html", name: "HTML", group: "frontend" },
  { id: "java", name: "Java", group: "backend" },
  { id: "javascript", name: "JavaScript", group: "frontend" },
  { id: "kotlin", name: "Kotlin", group: "mobile-other" },
  { id: "mysql", name: "MySQL", group: "cloud-data" },
  { id: "oauth", name: "OAuth", group: "backend" },
  { id: "php", name: "PHP", group: "backend" },
  { id: "playwright", name: "Playwright", group: "tools" },
  { id: "postgresql", name: "PostgreSQL", group: "cloud-data" },
  { id: "power-apps", name: "Power Apps", group: "mobile-other" },
  { id: "power-bi", name: "Power BI", group: "mobile-other" },
  { id: "python", name: "Python", group: "backend" },
  { id: "react", name: "React", group: "frontend" },
  { id: "room", name: "Room", group: "mobile-other" },
  { id: "spring-boot", name: "Spring Boot", group: "backend" },
  { id: "supabase", name: "Supabase", group: "cloud-data" },
  { id: "svelte", name: "Svelte", group: "frontend" },
  { id: "typescript", name: "TypeScript", group: "frontend" },
  { id: "vitest", name: "Vitest", group: "tools" },
  { id: "wordpress", name: "WordPress", group: "mobile-other" },
  { id: "work-manager", name: "WorkManager", group: "mobile-other" },
] as const

export type TechnologyId = (typeof TECHNOLOGIES)[number]["id"]
export type TechnologyDefinition = (typeof TECHNOLOGIES)[number]

export function technologyMetadata(
  name: string,
): TechnologyDefinition | undefined {
  return TECHNOLOGIES.find((technology) => technology.name === name)
}
