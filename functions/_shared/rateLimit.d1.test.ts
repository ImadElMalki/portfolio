import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler"
import { consumeRateLimits, type RateLimitRule } from "./rateLimit"

/**
 * El limitador contra un D1 de verdad, con el esquema de `migrations/`.
 *
 * `rateLimit.test.ts` usa un doble en memoria que **reimplementa** la semántica
 * del `UPSERT … WHERE count < max` en JavaScript: prueba la lógica de
 * `consumeRateLimits`, pero no la consulta. Un nombre de columna cambiado o una
 * migración que divergiera del `ON CONFLICT` pasaban la CI en verde y en
 * producción caían en el `catch`, es decir en 503 a la vez en `/api/ask` y
 * `/api/contact` (TEST-03).
 *
 * `getPlatformProxy` levanta el D1 local de Wrangler en memoria —`persist:
 * false`, nada en disco— y sin bindings remotos: no hace falta ninguna
 * credencial y no se toca ninguna base real. Las migraciones se aplican con el
 * mismo divisor de SQL que usa `wrangler d1 migrations apply`.
 */

type Env = { RATE_LIMIT_DB: D1Database }

const RULE: RateLimitRule = {
  name: "d1:ip",
  max: 3,
  windowSeconds: 60,
  scope: "ip",
}
const NOW = new Date("2026-09-30T12:00:00Z")

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>
let db: D1Database

beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    environment: "preview",
    persist: false,
    remoteBindings: false,
  })
  db = proxy.env.RATE_LIMIT_DB

  const migrations = readdirSync("migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()
  for (const file of migrations) {
    const sql = readFileSync(join("migrations", file), "utf8")
    await db.batch(
      unstable_splitSqlQuery(sql).map((statement) => db.prepare(statement)),
    )
  }
}, 60_000)

afterAll(async () => {
  await proxy?.dispose()
})

beforeEach(async () => {
  await db.prepare("DELETE FROM rate_limit_counters").run()
})

function consume(
  ip: string,
  now = NOW,
  rules: readonly RateLimitRule[] = [RULE],
) {
  return consumeRateLimits({ db, salt: "d1-salt", ip, rules, now })
}

describe("consumeRateLimits contra D1", () => {
  it("admite exactamente N consumos concurrentes", async () => {
    // Act
    const results = await Promise.all(
      Array.from({ length: 12 }, () => consume("203.0.113.10")),
    )

    // Assert
    expect(results.filter((result) => result.ok)).toHaveLength(RULE.max)
  })

  it("rechaza el consumo N+1 con la regla que lo corta", async () => {
    // Arrange
    for (let n = 0; n < RULE.max; n++) await consume("203.0.113.10")

    // Act
    const result = await consume("203.0.113.10")

    // Assert
    expect(result).toMatchObject({
      ok: false,
      reason: "limited",
      rule: "d1:ip",
    })
  })

  it("borra las filas vencidas en la petición siguiente", async () => {
    // Arrange
    await consume("203.0.113.10")
    const later = new Date(NOW.getTime() + (RULE.windowSeconds + 1) * 1000)

    // Act
    await consume("198.51.100.20", later)

    // Assert
    const row = await db
      .prepare("SELECT COUNT(*) AS rows FROM rate_limit_counters")
      .first<{ rows: number }>()
    expect(row?.rows).toBe(1)
  })

  it("cuenta dos IPv6 de la misma /64 como una sola conexión", async () => {
    // Arrange
    for (let n = 0; n < RULE.max; n++) await consume(`2001:db8:5::${n + 1}`)

    // Act
    const result = await consume("2001:db8:5:0:abcd:ef01:2345:6789")

    // Assert
    expect(result.ok).toBe(false)
  })

  it("corta con la regla global aunque cada conexión tenga cupo", async () => {
    // Arrange
    const rules: RateLimitRule[] = [
      RULE,
      { name: "d1:global", max: 2, windowSeconds: 86_400, scope: "global" },
    ]
    await consume("203.0.113.1", NOW, rules)
    await consume("203.0.113.2", NOW, rules)

    // Act
    const result = await consume("203.0.113.3", NOW, rules)

    // Assert
    expect(result).toMatchObject({ ok: false, rule: "d1:global" })
  })
})
