import { apiJson } from "../../src/lib/apiResponse"

type Env = Partial<Pick<CloudflareBindings, "HITS" | "RATE_LIMIT_DB">> & {
  OPENAI_API_KEY?: string
  RATE_LIMIT_SALT?: string
  CF_ACCOUNT_ID?: string
  EMAIL_API_TOKEN?: string
  CONTACT_TO?: string
  CONTACT_FROM?: string
}

/**
 * `GET /api/health`: qué está configurado, en booleanos.
 *
 * El sitio no depende de ninguna Function —sin configurar, cada una tiene
 * escrita su degradación— y eso, que es una virtud, es también el problema: un
 * despliegue al que le falte un secreto **no se nota**. El asistente responde
 * 503 y la interfaz ofrece el buzón; el contador calla con 204. Nada en el
 * build avisa, y la única sonda que había —`POST /api/ask` con `{}`— sólo prueba
 * la clave de OpenAI, porque la validación del cuerpo va antes del limitador:
 * sin D1 o sin la sal, esa sonda sigue dando 400 como si todo estuviera bien.
 *
 * Es la idea I12 de `AUDIT-2026-09-30.md`.
 *
 * ## Booleanos, nunca valores
 *
 * No sale ni un fragmento de clave, ni el nombre de la base, ni el buzón. Lo
 * que se publica —que el asistente está configurado o no— es lo mismo que ya
 * revela pedirle una pregunta y mirar el código, así que no hace falta un
 * `HEALTH_TOKEN`; si algún día se quiere privado, aquí es donde entraría.
 *
 * ## Y no toca nada
 *
 * Mira los bindings y los secretos, no los usa: ni una consulta a D1 ni una
 * llamada al proveedor. Un endpoint sin autenticar que escriba o lea de la base
 * es una forma barata de hacer que la pague otro, y un `SELECT 1` tampoco
 * distingue los fallos que importan —lo que se cae es el proveedor o el
 * despliegue, no la base—.
 *
 * El 503 es para que una sonda externa no tenga que leer el cuerpo: si falta
 * algo, el código ya lo dice.
 */
export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  const checks = {
    /** `functions/api/ask.ts`: sin clave, 503 y el asistente queda mudo. */
    ask: Boolean(env.OPENAI_API_KEY),
    /** El limitador que comparten `ask` y `contact`. Las dos piezas o ninguna. */
    rateLimit:
      typeof env.RATE_LIMIT_DB?.prepare === "function" &&
      Boolean(env.RATE_LIMIT_SALT),
    /** `functions/api/contact.ts`: las cuatro, o el formulario no envía. */
    contact: Boolean(
      env.CF_ACCOUNT_ID &&
      env.EMAIL_API_TOKEN &&
      env.CONTACT_TO &&
      env.CONTACT_FROM,
    ),
    /** `functions/api/hit.ts`: sin el dataset, las visitas no se cuentan. */
    hits: typeof env.HITS?.writeDataPoint === "function",
  }

  const ok = Object.values(checks).every(Boolean)
  return apiJson({ ok, checks }, ok ? 200 : 503)
}

export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  if (request.method === "GET") return next()
  return apiJson({ error: "method_not_allowed" }, 405)
}
