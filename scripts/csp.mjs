/**
 * Lectura de la CSP que Astro incrusta en cada página.
 *
 * La usa `check-build.mjs` para comprobar que cada documento declare los
 * hashes de sus propios guiones y estilos en línea.
 *
 * Hasta el 07-10-2026 el build reescribía además cada `<meta>` con la unión de
 * los hashes de todas las páginas. `security.csp` los calcula por módulo de
 * ruta, y con `<ClientRouter />` un salto entre módulos dejaba mandando la
 * política de la página de origen: el `<style>` del destino —la hoja entera,
 * que va incrustada— quedaba rechazado y la página salía sin estilos, en 126 de
 * los 196 pares posibles. Sin router desde el 02-10-2026, cada navegación
 * analiza su propio `<meta>` y la unión sólo engordaba la política de todas.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const META =
  /(<meta\s+http-equiv="content-security-policy"\s+content=")([^"]*)(")/i

/** Documentos HTML completos de un directorio, recursivo.
 *
 * Un HTML sin `<!doctype>` es un fragmento, no un documento: no navega nadie a
 * él y no puede llevar su propio `<meta>`. Lo fueron los `cv.fragment.html` de
 * la vista Markdown hasta el 06-10-2026; el filtro se queda por si vuelve otro.
 */
export function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) return htmlFiles(full)
    if (!entry.name.endsWith(".html")) return []
    return /^<!doctype html>/i.test(readFileSync(full, "utf8")) ? [full] : []
  })
}

/** El valor del `<meta>`, o `null` si la página no lleva CSP. */
export function cspOf(html) {
  return html.match(META)?.[2] ?? null
}

/**
 * El documento a partir de su `<meta>` CSP: lo único que la política gobierna.
 *
 * Una política en `<meta>` no se aplica a lo que va delante, y Astro la pone al
 * final del `<head>`. Los guiones `is:inline` de `Layout.astro` van antes y
 * corren por eso, no porque lleven hash: Astro no se lo calcula a ningún
 * `is:inline`. Uno en el cuerpo queda detrás, y el navegador lo bloquea. Sin
 * `<meta>`, `""`.
 */
export function governedByCsp(html) {
  const at = html.search(META)
  return at === -1 ? "" : html.slice(at)
}

/** Los trozos de una directiva, separados por espacios. `[]` si no está. */
function tokensOf(csp, directive) {
  const found = csp.match(new RegExp(`(^|;)\\s*${directive}\\s([^;]*)`))
  return found ? found[2].trim().split(/\s+/).filter(Boolean) : []
}

/** Sólo los hashes de una directiva, con sus comillas: `'sha256-…'`. */
export function hashesOf(csp, directive) {
  return tokensOf(csp, directive).filter((token) => token.includes("sha256-"))
}
