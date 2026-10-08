import { apiJson } from "../../src/lib/apiResponse"
import {
  CONTACT_LIMITS,
  normalizeContact,
  validateContact,
  type ContactDraft,
} from "../../src/lib/contact"
import {
  API_BODY_LIMITS,
  isRecord,
  isSameOrigin,
  readJsonBody,
} from "../_shared/request"
import { consumeRateLimits, type RateLimitRule } from "../_shared/rateLimit"

type Env = Pick<CloudflareBindings, "RATE_LIMIT_DB"> & {
  CF_ACCOUNT_ID?: string
  EMAIL_API_TOKEN?: string
  CONTACT_TO?: string
  CONTACT_FROM?: string
  RATE_LIMIT_SALT?: string
}

/**
 * Tres envíos cada diez minutos por conexión, y treinta al día entre todos.
 *
 * El techo global no existía, y el de conexión sólo frenaba a quien no pudiera
 * cambiar de dirección: cualquiera con IPv6 estrenaba contador en cada envío
 * (SEC-09, ver `rateLimitSubject`). Treinta al día es muchísimo más de lo que
 * recibe este buzón; si alguien lo agota, el formulario responde 429 hasta el
 * día siguiente y el enlace `mailto:` sigue ahí. Mejor eso que un correo real
 * inundado. La regla de conexión va primero para que quien ya está limitado
 * no gaste el cupo de los demás.
 */
const RATE_LIMITS = [
  { name: "contact:ip", max: 3, windowSeconds: 600, scope: "ip" },
  { name: "contact:global", max: 30, windowSeconds: 86_400, scope: "global" },
] as const satisfies readonly RateLimitRule[]
const EMAIL_DEADLINE_MS = 10_000

/** `POST /api/contact`: buzón con límites cerrados y atómicos. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) return apiJson({ error: "forbidden" }, 403)
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return apiJson({ error: "unsupported_media_type" }, 415)
  }

  const configured =
    env.CF_ACCOUNT_ID &&
    env.EMAIL_API_TOKEN &&
    env.CONTACT_TO &&
    env.CONTACT_FROM
  if (!configured) return apiJson({ error: "not_configured" }, 503)

  const parsed = await readJsonBody(request, API_BODY_LIMITS.contact)
  if (!parsed.ok) {
    return apiJson(
      { error: parsed.error },
      parsed.error === "body_too_large" ? 413 : 400,
    )
  }
  if (!isRecord(parsed.value)) return apiJson({ error: "bad_json" }, 400)

  const payload = parsed.value
  // Honeypot: aparenta éxito, pero nunca consume límite ni envía correo.
  if (payload.company) return apiJson({ ok: true }, 200)

  const draft: ContactDraft = {
    email: String(payload.email ?? ""),
    subject: String(payload.subject ?? ""),
    message: String(payload.message ?? ""),
  }
  const problem = validateContact(draft)
  if (problem) return apiJson({ error: "invalid", field: problem }, 400)

  const limits = await consumeRateLimits({
    db: env.RATE_LIMIT_DB,
    salt: env.RATE_LIMIT_SALT,
    ip: request.headers.get("cf-connecting-ip") ?? "",
    rules: RATE_LIMITS,
  })
  if (!limits.ok) {
    if (limits.reason === "limited") {
      return apiJson({ error: "rate_limited" }, 429, {
        "retry-after": String(limits.retryAfter),
      })
    }
    return apiJson({ error: "rate_limiter_unavailable" }, 503)
  }

  const { email, subject, message } = normalizeContact(draft)
  const abort = new AbortController()
  const abortFromClient = (): void => abort.abort(request.signal.reason)
  request.signal.addEventListener("abort", abortFromClient, { once: true })
  let timedOut = false
  const deadline = setTimeout(() => {
    timedOut = true
    abort.abort("email_deadline")
  }, EMAIL_DEADLINE_MS)

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.EMAIL_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          to: [{ address: env.CONTACT_TO }],
          from: { address: env.CONTACT_FROM, name: "Consola del portfolio" },
          reply_to: { address: email },
          subject: `[portfolio] ${subject}`.slice(
            0,
            CONTACT_LIMITS.subject + 12,
          ),
          text: `${message}\n\n—\nEnviado desde el portfolio por ${email}`,
        }),
        signal: abort.signal,
      },
    )

    if (!response.ok) {
      console.error("contact: upstream failed", { status: response.status })
      return apiJson({ error: "upstream_failed" }, 502)
    }
    return apiJson({ ok: true }, 200)
  } catch (error) {
    if (timedOut) return apiJson({ error: "upstream_timeout" }, 504)
    if (request.signal.aborted) return apiJson({ error: "client_closed" }, 499)
    console.error("contact: upstream unavailable", error)
    return apiJson({ error: "upstream_failed" }, 502)
  } finally {
    clearTimeout(deadline)
    request.signal.removeEventListener("abort", abortFromClient)
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  if (request.method === "POST") return next()
  return apiJson({ error: "method_not_allowed" }, 405)
}
