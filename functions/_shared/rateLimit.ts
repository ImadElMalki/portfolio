export interface RateLimitRule {
  name: string
  max: number
  windowSeconds: number
  scope: "ip" | "global"
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | {
      ok: false
      reason: "limited"
      rule: string
      /** Segundos hasta que abre la ventana siguiente: el `retry-after`. */
      retryAfter: number
    }
  | { ok: false; reason: "unavailable" }

const encoder = new TextEncoder()

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i
const HEXTET = /^[0-9a-f]{1,4}$/i

/** Las ocho palabras de una IPv6, con `::` desplegado; `null` si no es una. */
function ipv6Hextets(address: string): string[] | null {
  const halves = address.split("::")
  if (halves.length > 2) return null

  const groups = (part: string | undefined): string[] => {
    if (!part) return []
    return part.split(":").flatMap((group) => {
      /* Una IPv4 incrustada al final (`64:ff9b::192.0.2.1`) ocupa dos palabras. */
      if (!group.includes(".")) return [group]
      const bytes = group.split(".").map(Number)
      if (bytes.length !== 4 || bytes.some((b) => !(b >= 0 && b <= 255))) {
        return ["x"]
      }
      const [a = 0, b = 0, c = 0, d = 0] = bytes
      return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)]
    })
  }

  const head = groups(halves[0])
  const tail = groups(halves[1])
  const hextets =
    halves.length === 2
      ? [
          ...head,
          ...Array<string>(Math.max(0, 8 - head.length - tail.length)).fill(
            "0",
          ),
          ...tail,
        ]
      : head

  if (hextets.length !== 8 || !hextets.every((g) => HEXTET.test(g))) {
    return null
  }
  if (halves.length === 2 && head.length + tail.length > 7) return null
  return hextets
}

/**
 * A quién se le cuenta el límite: la IPv4 entera, o la **red /64** de una IPv6.
 *
 * Un proveedor entrega a cada cliente una /64 como mínimo, así que dentro de ella
 * una IPv6 se puede cambiar a voluntad: contada entera, cada dirección nueva era
 * un contador nuevo y el límite por IP no limitaba a nadie que tuviera IPv6
 * (SEC-09). La /64 es lo que identifica a una conexión, igual que la IPv4.
 *
 * Una IPv4 escrita como IPv6 (`::ffff:a.b.c.d`) cuenta como la IPv4 que es. Lo que
 * no se reconoce pasa tal cual: el HMAC de abajo sigue sin dejar ver nada.
 */
export function rateLimitSubject(ip: string): string {
  const address = ip.trim().replace(/%.*$/, "")
  const mapped = address.match(IPV4_MAPPED)?.[1]
  if (mapped) return mapped
  if (!address.includes(":")) return address

  const hextets = ipv6Hextets(address)
  if (!hextets) return address
  return `${hextets
    .slice(0, 4)
    .map((group) => parseInt(group, 16).toString(16))
    .join(":")}::/64`
}

/** HMAC estable para que D1 nunca reciba la IP en claro ni un hash reversible. */
export async function anonymizeIp(ip: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return hex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(ip || "unknown")),
  )
}

async function consumeOne(
  db: D1Database,
  scope: string,
  rule: RateLimitRule,
  nowSeconds: number,
): Promise<RateLimitResult> {
  const bucketStart =
    Math.floor(nowSeconds / rule.windowSeconds) * rule.windowSeconds
  const expiresAt = bucketStart + rule.windowSeconds

  const row = await db
    .prepare(
      `INSERT INTO rate_limit_counters
         (scope, bucket_start, count, expires_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(scope, bucket_start) DO UPDATE SET
         count = rate_limit_counters.count + 1,
         expires_at = excluded.expires_at
       WHERE rate_limit_counters.count < ?4
       RETURNING count`,
    )
    .bind(scope, bucketStart, expiresAt, rule.max)
    .first<{ count: number }>()

  if (!row) {
    return {
      ok: false,
      reason: "limited",
      rule: rule.name,
      retryAfter: Math.max(1, expiresAt - nowSeconds),
    }
  }
  return { ok: true, remaining: Math.max(0, rule.max - row.count) }
}

/**
 * Consume las reglas en orden. La de IP va antes que la global para que un
 * visitante ya limitado no desgaste el techo diario del resto.
 *
 * No hay transacción, y el orden tiene una consecuencia asumida: si la regla
 * global ya está agotada, el contador por IP **ya se incrementó** cuando se
 * descubre. Una hora con el techo diario tocado gasta cupo individual de quien
 * ni siquiera llegó a preguntar. Se acepta porque la alternativa —comprobar
 * antes de consumir— abre la carrera que este diseño existe para cerrar, y
 * porque la ventana por IP dura una hora: se recupera sola.
 */
export async function consumeRateLimits(params: {
  db: D1Database | undefined
  salt: string | undefined
  ip: string
  rules: readonly RateLimitRule[]
  now?: Date
}): Promise<RateLimitResult> {
  const { db, salt, ip, rules, now = new Date() } = params
  if (!db || !salt) return { ok: false, reason: "unavailable" }

  try {
    const digest = await anonymizeIp(rateLimitSubject(ip), salt)
    const nowSeconds = Math.floor(now.getTime() / 1000)
    let remaining = 0

    /**
     * La limpieza, **una vez por petición** y no una por regla: con dos reglas
     * el segundo `DELETE` no podía encontrar nada que el primero no hubiera
     * borrado ya, y era otro viaje a D1 antes del primer token (PERF-02). El
     * índice por expiración evita que lea la tabla entera.
     *
     * Sigue siendo **perezosa**: sólo ocurre cuando entra una petición, así que
     * sin tráfico una fila vencida sigue ahí. No cuenta para nada —el
     * `bucket_start` de la ventana en curso es otro—, pero la política de
     * privacidad describe exactamente esto y no «se borra a las 24 horas».
     * Pages Functions no tiene manejador programado; una purga garantizada
     * exigiría un Worker aparte con su Cron Trigger y el mismo binding de D1.
     */
    await db
      .prepare("DELETE FROM rate_limit_counters WHERE expires_at <= ?1")
      .bind(nowSeconds)
      .run()

    for (const rule of rules) {
      const scope =
        rule.scope === "global" ? rule.name : `${rule.name}:${digest}`
      const result = await consumeOne(db, scope, rule, nowSeconds)
      if (!result.ok) return result
      if (rule.scope === "ip") remaining = result.remaining
    }

    return { ok: true, remaining }
  } catch (error) {
    console.error("rate-limit: unavailable", error)
    return { ok: false, reason: "unavailable" }
  }
}
