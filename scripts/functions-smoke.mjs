#!/usr/bin/env node
/**
 * Humo sobre las cuatro Pages Functions, con `wrangler pages dev`.
 *
 * `astro check` no mira `functions/` y `check-build.mjs` mira `dist/`, así que
 * hasta ahora el cableado de los endpoints —el `Origin`, el tipo de contenido,
 * qué código sale sin cada binding, qué pasa con un `GET`— no se ejecutaba en
 * ninguna comprobación. Las partes puras sí (`contact.test.ts`, `ask.test.ts`),
 * pero justo eso es lo que no se equivoca.
 *
 * ## Se arranca sin ningún binding, y es el caso interesante
 *
 * Los tres endpoints tienen escrita una degradación concreta para cuando no
 * están configurados —`hit` calla con 204, `contact` y `ask` piden a la consola
 * que ofrezca el buzón con 503— y esa degradación es la que sostiene la promesa
 * de que el sitio no depende de ellos. Sin secretos ni bindings, este guion
 * corre tal cual en CI: es exactamente el escenario que hay que probar.
 *
 * Y de paso responde una pregunta que estaba en el aire: exportar `onRequest` y
 * `onRequestPost` en el mismo módulo funciona, y el `GET` acaba en el 405 del
 * primero en vez de caer al asset estático.
 */
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"

const PORT = Number(process.env.SMOKE_PORT ?? 8799)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = BASE
const JSON_TYPE = { "content-type": "application/json" }

if (!existsSync("dist/index.html")) {
  console.error("✗ falta dist/: ejecuta `npm run build` antes")
  process.exit(1)
}

const failures = []

function check(description, condition, detail = "") {
  if (condition) return
  failures.push(detail ? `${description} — ${detail}` : description)
}

/** Wrangler directamente y no por `npx`: un proceso menos que matar después. */
const server = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "pages",
    "dev",
    "dist",
    "--ip",
    "127.0.0.1",
    "--port",
    String(PORT),
    "--compatibility-date",
    "2026-08-01",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" },
  },
)

let log = ""
server.stdout.on("data", (chunk) => (log += chunk))
server.stderr.on("data", (chunk) => (log += chunk))

/** En Windows `kill()` no se lleva a workerd, que es nieto del proceso. */
function stopServer() {
  if (server.exitCode !== null) return
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    })
  } else {
    server.kill("SIGTERM")
  }
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`wrangler terminó con ${server.exitCode}:\n${log}`)
    }
    try {
      const response = await fetch(BASE, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return
    } catch {
      // Todavía no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`wrangler no respondió en ${timeoutMs} ms:\n${log}`)
}

const post = (path, { body = {}, headers = JSON_TYPE, origin = ORIGIN } = {}) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...headers, origin },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

try {
  await waitForServer()

  /* El sitio se sigue sirviendo: las Functions no se comen las rutas estáticas. */
  const home = await fetch(BASE)
  check("/ responde 200", home.status === 200, String(home.status))

  /* Sin binding ni secretos, cada uno con su degradación escrita. */
  const hit = await post("/api/hit", {
    body: { event: "view", path: "/", view: "web" },
  })
  check(
    "POST /api/hit sin binding → 204",
    hit.status === 204,
    String(hit.status),
  )

  const contact = await post("/api/contact", {
    body: { email: "a@b.com", subject: "Hola", message: "Qué tal" },
  })
  check(
    "POST /api/contact sin configurar → 503",
    contact.status === 503,
    String(contact.status),
  )

  const ask = await post("/api/ask", {
    body: { locale: "es", question: "¿Qué sabe hacer?", history: [] },
  })
  check("POST /api/ask sin clave → 503", ask.status === 503, String(ask.status))

  /**
   * La sonda de configuración, que aquí tiene que decir que no hay nada.
   *
   * Este guion arranca **sin ningún binding**, así que es el único sitio donde
   * se puede comprobar que `/api/health` distingue de verdad: si alguien
   * devolviera `ok` por defecto, o se dejara una comprobación escrita en
   * positivo, aquí saldría 200 con todo en `true` y esto lo caza.
   */
  const health = await fetch(`${BASE}/api/health`)
  check(
    "GET /api/health sin configurar → 503",
    health.status === 503,
    String(health.status),
  )
  const healthBody = await health.json().catch(() => null)
  check(
    "GET /api/health: ok en false",
    healthBody?.ok === false,
    JSON.stringify(healthBody),
  )
  /* Las tres que dependen de un secreto. `hits` no entra: `wrangler pages dev`
     lee `wrangler.jsonc` y sí monta el dataset de Analytics Engine, así que
     aquí vale `true` de verdad y exigir lo contrario sería una prueba que
     miente. */
  check(
    "GET /api/health: sin secretos, las tres piezas en false",
    healthBody?.checks &&
      Object.keys(healthBody.checks).length === 4 &&
      [
        healthBody.checks.ask,
        healthBody.checks.rateLimit,
        healthBody.checks.contact,
      ].every((value) => value === false),
    JSON.stringify(healthBody?.checks),
  )
  /* Y no se le escapa ningún valor: lo que viaja son booleanos y nada más. */
  check(
    "GET /api/health: sólo booleanos",
    Object.values(healthBody?.checks ?? {}).every(
      (value) => typeof value === "boolean",
    ),
    JSON.stringify(healthBody?.checks),
  )

  /* Un método que no es POST no cae al asset estático: lo corta `onRequest`. */
  for (const path of ["/api/hit", "/api/contact", "/api/ask"]) {
    const response = await fetch(`${BASE}${path}`)
    check(`GET ${path} → 405`, response.status === 405, String(response.status))
  }

  /* Y en `health` es al revés: el `GET` es el bueno y lo demás se corta. */
  const healthPost = await post("/api/health")
  check(
    "POST /api/health → 405",
    healthPost.status === 405,
    String(healthPost.status),
  )

  /* Desde otro origen no se atiende, y se comprueba antes que nada. */
  for (const path of ["/api/hit", "/api/contact", "/api/ask"]) {
    const response = await post(path, { origin: "https://ajeno.example" })
    check(
      `POST ${path} desde otro origen → 403`,
      response.status === 403,
      String(response.status),
    )
  }

  /* El tipo de contenido se exige donde hay cuerpo que interpretar. */
  for (const path of ["/api/contact", "/api/ask"]) {
    const response = await post(path, {
      headers: { "content-type": "text/plain" },
    })
    check(
      `POST ${path} sin JSON → 415`,
      response.status === 415,
      String(response.status),
    )
  }

  /**
   * Las cabeceras que `public/_headers` **no** pone.
   *
   * La documentación de Pages dice que ese archivo no se aplica a lo que
   * responde una Function, así que las escribe `src/lib/apiResponse.ts`. Si
   * alguien devuelve un `new Response` a pelo, esto lo caza.
   */
  for (const [path, response] of [
    ["/api/hit", hit],
    ["/api/contact", contact],
    ["/api/ask", ask],
    ["/api/health", health],
  ]) {
    check(
      `${path}: nosniff`,
      response.headers.get("x-content-type-options") === "nosniff",
      String(response.headers.get("x-content-type-options")),
    )
    check(
      `${path}: sin caché`,
      response.headers.get("cache-control") === "no-store",
      String(response.headers.get("cache-control")),
    )
  }
} catch (error) {
  failures.push(String(error.message ?? error))
} finally {
  stopServer()
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} comprobación(es) fallida(s):\n`)
  for (const failure of failures) console.error(`  · ${failure}`)
  process.exit(1)
}

console.log("✓ las Pages Functions degradan como está escrito")
