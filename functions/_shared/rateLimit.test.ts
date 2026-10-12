import { describe, expect, it, vi } from "vitest"
import {
  anonymizeIp,
  consumeRateLimits,
  rateLimitSubject,
  type RateLimitRule,
} from "./rateLimit"

interface Counter {
  count: number
  expiresAt: number
}

function createFakeD1(options: { fail?: boolean } = {}): {
  db: D1Database
  counters: Map<string, Counter>
} {
  const counters = new Map<string, Counter>()
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (options.fail) throw new Error("D1 unavailable")
              const now = Number(values[0])
              for (const [key, row] of counters) {
                if (row.expiresAt <= now) counters.delete(key)
              }
              return { success: true }
            },
            async first<T>() {
              if (options.fail) throw new Error("D1 unavailable")
              if (!sql.includes("RETURNING count")) return null
              const scope = String(values[0])
              const bucket = Number(values[1])
              const expiresAt = Number(values[2])
              const max = Number(values[3])
              const key = `${scope}:${bucket}`
              const current = counters.get(key)
              if (current && current.count >= max) return null
              const next = { count: (current?.count ?? 0) + 1, expiresAt }
              counters.set(key, next)
              return { count: next.count } as T
            },
          }
        },
      }
    },
  } as unknown as D1Database

  return { db, counters }
}

const RULE: RateLimitRule = {
  name: "test:ip",
  max: 3,
  windowSeconds: 60,
  scope: "ip",
}

describe("anonymizeIp", () => {
  it("produce un HMAC estable que no contiene la IP", async () => {
    // Arrange
    const ip = "203.0.113.10"

    // Act
    const first = await anonymizeIp(ip, "salt-a")
    const second = await anonymizeIp(ip, "salt-a")
    const otherSalt = await anonymizeIp(ip, "salt-b")

    // Assert
    expect(first).toBe(second)
    expect(first).not.toBe(otherSalt)
    expect(first).not.toContain(ip)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe("rateLimitSubject", () => {
  it.each([
    ["IPv4 intacta", "203.0.113.10", "203.0.113.10"],
    [
      "IPv6 completa, a su /64",
      "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      "2001:db8:85a3:0::/64",
    ],
    ["IPv6 abreviada", "2001:db8::1", "2001:db8:0:0::/64"],
    ["mayúsculas", "2001:DB8:AB::CDEF", "2001:db8:ab:0::/64"],
    ["IPv4 escrita como IPv6", "::ffff:198.51.100.7", "198.51.100.7"],
    ["identificador de zona", "fe80::1%eth0", "fe80:0:0:0::/64"],
    ["IPv4 incrustada (NAT64)", "64:ff9b::192.0.2.1", "64:ff9b:0:0::/64"],
    ["bucle local", "::1", "0:0:0:0::/64"],
    ["vacía", "", ""],
    ["no es una IP", "no-es-una-ip", "no-es-una-ip"],
    ["nueve palabras", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7:8:9"],
    ["dos abreviaturas", "1::2::3", "1::2::3"],
  ])("%s", (_name, ip, expected) => {
    // Act
    const subject = rateLimitSubject(ip)

    // Assert
    expect(subject).toBe(expected)
  })
})

describe("consumeRateLimits", () => {
  it("cuenta dos IPv6 de la misma /64 como una sola conexión", async () => {
    // Arrange
    const { db } = createFakeD1()
    const now = new Date("2026-09-30T12:00:00Z")
    for (let n = 0; n < RULE.max; n++) {
      await consumeRateLimits({
        db,
        salt: "test-salt",
        ip: `2001:db8:1:2::${n + 1}`,
        rules: [RULE],
        now,
      })
    }

    // Act
    const result = await consumeRateLimits({
      db,
      salt: "test-salt",
      ip: "2001:db8:1:2:ffff:ffff:ffff:ffff",
      rules: [RULE],
      now,
    })

    // Assert
    expect(result).toMatchObject({
      ok: false,
      reason: "limited",
      rule: RULE.name,
    })
  })

  it("no mezcla dos /64 distintas", async () => {
    // Arrange
    const { db } = createFakeD1()
    const now = new Date("2026-09-30T12:00:00Z")
    for (let n = 0; n < RULE.max; n++) {
      await consumeRateLimits({
        db,
        salt: "test-salt",
        ip: "2001:db8:1:2::1",
        rules: [RULE],
        now,
      })
    }

    // Act
    const result = await consumeRateLimits({
      db,
      salt: "test-salt",
      ip: "2001:db8:1:3::1",
      rules: [RULE],
      now,
    })

    // Assert
    expect(result.ok).toBe(true)
  })

  it("corta con la regla global aunque cada conexión tenga cupo", async () => {
    // Arrange
    const { db } = createFakeD1()
    const now = new Date("2026-09-30T12:00:00Z")
    const rules: RateLimitRule[] = [
      RULE,
      { name: "test:global", max: 2, windowSeconds: 86_400, scope: "global" },
    ]
    for (const ip of ["203.0.113.1", "203.0.113.2"]) {
      await consumeRateLimits({ db, salt: "test-salt", ip, rules, now })
    }

    // Act
    const result = await consumeRateLimits({
      db,
      salt: "test-salt",
      ip: "203.0.113.3",
      rules,
      now,
    })

    // Assert
    expect(result).toMatchObject({
      ok: false,
      reason: "limited",
      rule: "test:global",
    })
  })

  it("dice cuántos segundos faltan para la ventana siguiente", async () => {
    // Arrange
    const { db } = createFakeD1()
    const now = new Date("2026-09-30T12:00:15Z")
    for (let n = 0; n < RULE.max; n++) {
      await consumeRateLimits({
        db,
        salt: "s",
        ip: "203.0.113.9",
        rules: [RULE],
        now,
      })
    }

    // Act
    const result = await consumeRateLimits({
      db,
      salt: "s",
      ip: "203.0.113.9",
      rules: [RULE],
      now,
    })

    // Assert: la ventana de 60 s empezó a las 12:00:00 y quedan 45.
    expect(result).toMatchObject({ ok: false, retryAfter: 45 })
  })

  it("admite exactamente N consumos concurrentes", async () => {
    // Arrange
    const { db } = createFakeD1()
    const calls = Array.from({ length: 20 }, () =>
      consumeRateLimits({
        db,
        salt: "test-salt",
        ip: "203.0.113.10",
        rules: [RULE],
        now: new Date("2026-08-31T12:00:00Z"),
      }),
    )

    // Act
    const results = await Promise.all(calls)

    // Assert
    expect(results.filter((result) => result.ok)).toHaveLength(RULE.max)
    expect(results.filter((result) => !result.ok)).toHaveLength(17)
  })

  it("elimina ventanas expiradas y permite una nueva", async () => {
    // Arrange
    const { db, counters } = createFakeD1()
    const firstWindow = new Date("2026-08-31T12:00:00Z")
    await Promise.all(
      Array.from({ length: RULE.max }, () =>
        consumeRateLimits({
          db,
          salt: "test-salt",
          ip: "203.0.113.10",
          rules: [RULE],
          now: firstWindow,
        }),
      ),
    )

    // Act
    const next = await consumeRateLimits({
      db,
      salt: "test-salt",
      ip: "203.0.113.10",
      rules: [RULE],
      now: new Date(firstWindow.getTime() + 61_000),
    })

    // Assert
    expect(next).toEqual({ ok: true, remaining: 2 })
    expect(counters.size).toBe(1)
  })

  it.each([
    ["binding ausente", undefined, "salt"],
    ["secreto ausente", createFakeD1().db, undefined],
    ["D1 falla", createFakeD1({ fail: true }).db, "salt"],
  ])("falla cerrado cuando %s", async (_name, db, salt) => {
    // Arrange
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    // Act
    const result = await consumeRateLimits({
      db,
      salt,
      ip: "203.0.113.10",
      rules: [RULE],
    })

    // Assert
    expect(result).toEqual({ ok: false, reason: "unavailable" })
    errorSpy.mockRestore()
  })
})
