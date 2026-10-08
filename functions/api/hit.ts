import { apiEmpty } from "../../src/lib/apiResponse"
import { HIT_EVENTS } from "../../src/lib/hitEvents"
import {
  API_BODY_LIMITS,
  isRecord,
  isSameOrigin,
  readJsonBody,
} from "../_shared/request"
import { consumeRateLimits, type RateLimitRule } from "../_shared/rateLimit"

type Env = Partial<Pick<CloudflareBindings, "HITS" | "RATE_LIMIT_DB">> & {
  RATE_LIMIT_SALT?: string
}

/* La lista es la de `src/lib/hitEvents.ts`, la misma que usa el emisor. */
const EVENTS = new Set<string>(HIT_EVENTS)
const MAX_PATH = 120

/**
 * Techo de escritura, holgado a propósito.
 *
 * Hasta el 11-09-2026 no había ninguno: validado el origen y las listas
 * blancas, cualquiera podía escribir en Analytics Engine sin freno, y el
 * dataset es **de sólo añadir** —`wrangler.jsonc` razona que una tanda escrita
 * por error «no se puede sacar de ahí»—. Con lo de `request.ts`, que deja pasar
 * la petición sin cabecera `Origin` para poder diagnosticar con curl, el freno
 * no lo ponía nadie. Es el `SEC-08` de `AUDIT-2026-09.md`.
 *
 * 120 por hora y conexión no estorba a una visita real ni de lejos: el
 * contador deduplica por documento (`hits.ts`), así que una sesión larga deja
 * unos pocos apuntes, no ciento veinte. Lo que corta es el bucle.
 *
 * Y un techo diario global, porque el de conexión no frenaba a quien rota
 * direcciones IPv6 (SEC-09): veinte mil apuntes al día es órdenes de magnitud
 * más que el tráfico real, y sin él el dataset no tenía límite.
 */
const RATE_LIMITS = [
  { name: "hit:ip", max: 120, windowSeconds: 3600, scope: "ip" },
  { name: "hit:global", max: 20_000, windowSeconds: 86_400, scope: "global" },
] as const satisfies readonly RateLimitRule[]

function cleanPath(value: unknown): string {
  if (typeof value !== "string") return "/"
  const path = value.split(/[?#]/)[0] ?? "/"
  if (!path.startsWith("/") || path.length > MAX_PATH) return "/"
  return /^[\w\-/.]*$/.test(path) ? path : "/"
}

function cleanLabel(value: unknown): string {
  return typeof value === "string" && /^[a-z-]{1,24}$/.test(value) ? value : ""
}

/** Analítica propia, sin identificadores ni cookies. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) return apiEmpty(403)
  if (!env.HITS) return apiEmpty(204)

  const parsed = await readJsonBody(request, API_BODY_LIMITS.hit)
  if (!parsed.ok) return apiEmpty(parsed.error === "body_too_large" ? 413 : 400)
  if (!isRecord(parsed.value)) return apiEmpty(400)

  const event = cleanLabel(parsed.value.event)
  if (!EVENTS.has(event)) return apiEmpty(400)
  const isView = event === "view"

  /**
   * Se consume **después** de validar, para no gastar cupo con lo que se iba a
   * rechazar igual, y **antes** de escribir, que es lo que hay que frenar.
   *
   * Un `unavailable` —sin `RATE_LIMIT_DB` ni sal— cuenta igual y escribe: ese
   * es el preview sin bindings y el desarrollo local, no un abuso, y dejar de
   * contar ahí perdería datos legítimos por una causa que no es la que este
   * techo vigila. En `/api/ask` y `/api/contact` la decisión es la contraria
   * —fallan cerrado con 503— porque allí lo que hay detrás es dinero y un
   * buzón, y aquí un contador.
   */
  const limits = await consumeRateLimits({
    db: env.RATE_LIMIT_DB,
    salt: env.RATE_LIMIT_SALT,
    ip: request.headers.get("cf-connecting-ip") ?? "",
    rules: RATE_LIMITS,
  })
  /* 204 igualmente: el contrato del endpoint es no decirle nada a nadie, y un
     429 aquí sólo le enseñaría al bucle dónde está el techo. */
  if (!limits.ok && limits.reason === "limited") return apiEmpty(204)

  try {
    env.HITS.writeDataPoint({
      indexes: [event],
      blobs: [
        event,
        isView ? cleanPath(parsed.value.path) : "",
        isView ? cleanLabel(parsed.value.view) || "web" : "",
      ],
    })
  } catch (error) {
    console.error("hit: write failed", error)
  }

  return apiEmpty(204)
}

export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  if (request.method === "POST") return next()
  return apiEmpty(405)
}
