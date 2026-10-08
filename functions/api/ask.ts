import { apiJson, apiStream } from "../../src/lib/apiResponse"
import cvData from "../../cv.json"
import { ABOUT_COPY } from "../../src/data/about"
import { ASK_NOTES } from "../../src/data/askNotes"
import { ASK_BIRTH_DATE, ASK_PROFILE } from "../../src/data/askProfile"
import { AVAILABILITY } from "../../src/data/availability"
import { CONTACT_URLS, SERVICES_COPY } from "../../src/data/services"
import {
  ASK_LIMITS,
  buildSystemPrompt,
  calculateAge,
  chunkFromOpenAiEvent,
  flattenLocalized,
  pickLocale,
  pickPath,
  renderDossier,
  validateAsk,
  type AskRequest,
} from "../../src/lib/ask"
import {
  API_BODY_LIMITS,
  isRecord,
  isSameOrigin,
  readJsonBody,
} from "../_shared/request"
import { consumeRateLimits, type RateLimitRule } from "../_shared/rateLimit"

type Env = Pick<CloudflareBindings, "RATE_LIMIT_DB"> & {
  OPENAI_API_KEY?: string
  ASK_DOSSIER?: string
  RATE_LIMIT_SALT?: string
}

const IP_RULE = {
  name: "ask:ip",
  max: 40,
  windowSeconds: 3600,
  scope: "ip",
} as const satisfies RateLimitRule
const RATE_LIMITS = [
  IP_RULE,
  { name: "ask:global", max: 2000, windowSeconds: 86_400, scope: "global" },
] as const satisfies readonly RateLimitRule[]

const MODEL = "gpt-5.6-luna"
const MAX_TOKENS = 1024
const CONNECT_DEADLINE_MS = 20_000
const IDLE_DEADLINE_MS = 30_000
const TOTAL_DEADLINE_MS = 120_000

const dossiers = new Map<string, string>()

function dossierFor(locale: string, extra: string | undefined): string {
  const key = `${locale}:${extra ?? ""}`
  const cached = dossiers.get(key)
  if (cached) return cached

  const built = renderDossier({
    cv: flattenLocalized(cvData, locale) as Record<string, unknown>,
    availability: flattenLocalized(AVAILABILITY, locale) as Record<
      string,
      unknown
    >[],
    about: flattenLocalized(ABOUT_COPY, locale) as Record<string, unknown>,
    services: flattenLocalized(SERVICES_COPY, locale) as Record<
      string,
      unknown
    >,
    notes: flattenLocalized(ASK_NOTES, locale) as Record<string, unknown>,
    profile: flattenLocalized(ASK_PROFILE, locale) as Record<string, unknown>,
    contactUrl: CONTACT_URLS[locale as keyof typeof CONTACT_URLS],
    ...(extra ? { extra } : {}),
  })
  dossiers.set(key, built)
  return built
}

type TimeoutKind = "connect" | "idle" | "total" | null

/** `POST /api/ask`: OpenAI en streaming, limitado por D1 y con cancelación. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) return apiJson({ error: "forbidden" }, 403)
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return apiJson({ error: "unsupported_media_type" }, 415)
  }
  if (!env.OPENAI_API_KEY) return apiJson({ error: "not_configured" }, 503)

  const parsed = await readJsonBody(request, API_BODY_LIMITS.ask)
  if (!parsed.ok) {
    return apiJson(
      { error: parsed.error },
      parsed.error === "body_too_large" ? 413 : 400,
    )
  }
  if (!isRecord(parsed.value)) return apiJson({ error: "bad_json" }, 400)

  const payload = parsed.value as Partial<AskRequest>
  const problem = validateAsk(payload)
  if (problem) return apiJson({ error: "invalid", field: problem }, 400)

  const limits = await consumeRateLimits({
    db: env.RATE_LIMIT_DB,
    salt: env.RATE_LIMIT_SALT,
    ip: request.headers.get("cf-connecting-ip") ?? "",
    rules: RATE_LIMITS,
  })
  /**
   * Tres «no» distintos, y quien pregunta merece saber cuál le ha tocado.
   *
   * Hasta el 30-09-2026 el límite por conexión, el techo diario de todos y el
   * 429 de OpenAI —cuota o facturación agotadas— salían igual, como
   * `rate_limited`: con la cuenta del proveedor sin saldo, cada visitante leía
   * «demasiadas preguntas seguidas» a la primera pregunta (UX-02). Ahora el
   * 429 es sólo de quien pregunta y lleva su cupo; los otros dos son 503 con
   * código propio, porque no hay nada que esa persona pueda hacer distinto.
   */
  if (!limits.ok) {
    if (limits.reason === "limited") {
      const retryAfter = String(limits.retryAfter)
      if (limits.rule === IP_RULE.name) {
        return apiJson({ error: "rate_limited" }, 429, {
          "retry-after": retryAfter,
          "x-ratelimit-limit": String(IP_RULE.max),
          "x-ratelimit-remaining": "0",
        })
      }
      return apiJson({ error: "daily_cap" }, 503, { "retry-after": retryAfter })
    }
    return apiJson({ error: "rate_limiter_unavailable" }, 503)
  }

  const locale = pickLocale(payload.locale)
  const question = (payload.question ?? "").trim()
  const history = (payload.history ?? []).slice(-ASK_LIMITS.history)
  const today = new Date().toISOString().slice(0, 10)
  const path = pickPath(payload.path)
  const prompt = buildSystemPrompt(dossierFor(locale, env.ASK_DOSSIER), {
    locale,
    today,
    age: calculateAge(ASK_BIRTH_DATE, today),
    ...(path ? { path } : {}),
  })

  const abort = new AbortController()
  let timeoutKind: TimeoutKind = null
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const abortFromClient = (): void => {
    abort.abort(request.signal.reason)
    void reader?.cancel("client_closed")
  }
  request.signal.addEventListener("abort", abortFromClient, { once: true })
  const totalDeadline = setTimeout(() => {
    timeoutKind = "total"
    abort.abort("openai_total_deadline")
    void reader?.cancel("openai_total_deadline")
  }, TOTAL_DEADLINE_MS)
  const connectDeadline = setTimeout(() => {
    timeoutKind = "connect"
    abort.abort("openai_connect_deadline")
  }, CONNECT_DEADLINE_MS)

  const finish = (): void => {
    clearTimeout(connectDeadline)
    clearTimeout(totalDeadline)
    request.signal.removeEventListener("abort", abortFromClient)
  }

  let upstream: Response
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: MAX_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
        reasoning_effort: "none",
        messages: [
          { role: "system", content: prompt.cached },
          { role: "system", content: prompt.tail },
          ...history.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
          /* Detrás del historial, que lo escribe el navegador y por tanto
             cualquiera: un turno de `assistant` fabricado puede decir que las
             reglas ya no valen, y lo último que lee el modelo antes de la
             pregunta tiene que ser que sí valen. Ver `buildSystemPrompt`. */
          { role: "system", content: prompt.guard },
          { role: "user", content: question },
        ],
      }),
      signal: abort.signal,
    })
    clearTimeout(connectDeadline)
  } catch (error) {
    finish()
    if (timeoutKind) return apiJson({ error: "upstream_timeout" }, 504)
    if (request.signal.aborted) return apiJson({ error: "client_closed" }, 499)
    console.error("ask: upstream unavailable", error)
    return apiJson({ error: "upstream_failed" }, 502)
  }

  const upstreamBody = upstream.body
  if (!upstream.ok || !upstreamBody) {
    finish()
    console.error("ask: upstream failed", { status: upstream.status })
    /* El 429 de OpenAI es del proveedor —cuota, saldo, su propio límite—, no
       de quien pregunta: 503 y código propio, no el `rate_limited` de arriba. */
    if (upstream.status === 429) {
      return apiJson({ error: "upstream_busy" }, 503)
    }
    if (upstream.status === 503) {
      return apiJson({ error: "upstream_failed" }, 503)
    }
    return apiJson({ error: "upstream_failed" }, 502)
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let closed = false

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = upstreamBody.getReader()
      let buffer = ""
      const usage: Record<string, unknown> = { locale, model: MODEL }

      const send = (chunk: unknown): void => {
        if (!closed) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          )
        }
      }

      const readWithIdleDeadline = async (): Promise<
        ReadableStreamReadResult<Uint8Array>
      > => {
        let idleDeadline: ReturnType<typeof setTimeout> | undefined
        try {
          return await Promise.race([
            reader!.read(),
            new Promise<never>((_resolve, reject) => {
              idleDeadline = setTimeout(() => {
                timeoutKind = "idle"
                abort.abort("openai_idle_deadline")
                void reader?.cancel("openai_idle_deadline")
                reject(new Error("openai_idle_deadline"))
              }, IDLE_DEADLINE_MS)
            }),
          ])
        } finally {
          if (idleDeadline) clearTimeout(idleDeadline)
        }
      }

      try {
        for (;;) {
          const { done, value } = await readWithIdleDeadline()
          if (done) {
            if (timeoutKind) throw new Error(`openai_${timeoutKind}_deadline`)
            break
          }
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6)
            if (raw === "[DONE]") continue

            let event: unknown
            try {
              event = JSON.parse(raw)
            } catch {
              continue
            }

            const chunk = chunkFromOpenAiEvent(event)
            if (!chunk) continue
            if (chunk.kind === "text") send({ text: chunk.text })
            else if (chunk.kind === "error") {
              if (chunk.error === "upstream") {
                console.error("ask: upstream event error")
              }
              send({ error: "upstream_failed" })
            } else if (chunk.kind === "truncated") {
              Object.assign(usage, chunk.usage, { truncated: true })
              send({ truncated: true })
            } else Object.assign(usage, chunk.usage)
          }
        }
        console.log("ask", JSON.stringify(usage))
      } catch (error) {
        if (!request.signal.aborted) {
          if (timeoutKind) send({ error: "upstream_timeout" })
          else {
            console.error("ask: stream failed", error)
            send({ error: "upstream_failed" })
          }
        }
      } finally {
        finish()
        if (!closed) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
          closed = true
        }
      }
    },
    async cancel(reason) {
      closed = true
      abort.abort(reason)
      try {
        await reader?.cancel(reason)
      } finally {
        finish()
      }
    },
  })

  return apiStream(body, {
    "x-ratelimit-limit": String(IP_RULE.max),
    "x-ratelimit-remaining": String(limits.remaining),
  })
}

export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  if (request.method === "POST") return next()
  return apiJson({ error: "method_not_allowed" }, 405)
}
