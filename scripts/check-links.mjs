#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

const DIST = "dist"

/**
 * Qué se comprueba. Sin bandera, todo, que es lo que quiere quien lo lanza a
 * mano.
 *
 * `--internal`: enlaces internos y anclas, contra `dist/`. Es lo que corre en
 * el gate de despliegue: un tercero que devuelve 404 o 5xx no debe bloquear una
 * publicación que no ha tocado ese enlace, y en septiembre tumbó dos (OPS-16).
 *
 * `--external`: sólo las URL de terceros. Lo corre cada semana el workflow
 * programado, que avisa sin frenar nada.
 */
const args = new Set(process.argv.slice(2))
const CHECK_INTERNAL = !args.has("--external")
const CHECK_EXTERNAL = !args.has("--internal")
const SITE_ORIGINS = new Set(
  ["https://imadelmalki.com", process.env.SITE_URL].filter(Boolean),
)
const failures = []
/**
 * Lo que no se pudo comprobar, que no es lo mismo que lo que está roto.
 *
 * Un enlace muerto lo dice el servidor con un 404. Un timeout o un `fetch
 * failed` no dicen nada del enlace: dicen que **desde aquí** no se llegó, y eso
 * depende de la red del que comprueba. El 11-09-2026 esa diferencia tumbó dos
 * despliegues seguidos por `vdholland.nl`, que desde un cliente normal responde
 * 302 y desde un runner de GitHub no responde.
 *
 * El script ya aceptaba esa clase de cosa por el lado del HTTP —401, 403, 405,
 * 429 y el 999 de LinkedIn son WAF anti-bot, no enlaces rotos— y la rechazaba
 * por el lado de la red, que es la misma situación con otra forma. Se iguala.
 */
const unreachable = []
const external = new Set()

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

function publicUrl(path) {
  const normalized = relative(DIST, path).replaceAll("\\", "/")
  return `https://local.invalid/${normalized.replace(/index\.html$/, "")}`
}

function localFile(url) {
  const path = decodeURIComponent(url.pathname).replace(/^\/+/, "")
  return join(DIST, path.endsWith("/") || !path ? path : path)
}

const htmlFiles = filesUnder(DIST).filter((path) => path.endsWith(".html"))
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8")
  const base = publicUrl(file)
  const ids = new Set(
    [...html.matchAll(/\bid=(?:"([^"]+)"|'([^']+)')/g)].map(
      (match) => match[1] ?? match[2],
    ),
  )

  for (const match of html.matchAll(
    /<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)')/gi,
  )) {
    const href = (match[1] ?? match[2] ?? "").replaceAll("&amp;", "&")
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) continue

    let url
    try {
      url = new URL(href, base)
    } catch {
      failures.push(`${relative(DIST, file)}: URL inválida ${href}`)
      continue
    }

    if (
      url.origin === "https://local.invalid" ||
      SITE_ORIGINS.has(url.origin)
    ) {
      if (!CHECK_INTERNAL) continue
      if (url.pathname === new URL(base).pathname && url.hash) {
        if (!ids.has(decodeURIComponent(url.hash.slice(1)))) {
          failures.push(`${relative(DIST, file)}: ancla ausente ${href}`)
        }
        continue
      }

      let target = localFile(url)
      if (target.endsWith("/") || !/\.[a-z0-9]+$/i.test(target)) {
        target = join(target, "index.html")
      }
      if (!existsSync(target)) {
        failures.push(`${relative(DIST, file)}: destino ausente ${href}`)
      }
      continue
    }

    if (
      CHECK_EXTERNAL &&
      (url.protocol === "http:" || url.protocol === "https:")
    ) {
      url.hash = ""
      external.add(url.href)
    }
  }
}

async function checkExternal(url) {
  const signal = AbortSignal.timeout(15_000)
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal,
      headers: { "user-agent": "portfolio-link-check/1.0" },
    })
    if (response.status === 405) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: {
          range: "bytes=0-0",
          "user-agent": "portfolio-link-check/1.0",
        },
      })
    }
    if (
      response.status >= 400 &&
      // LinkedIn usa 999 para bloquear comprobadores automáticos aunque el
      // perfil exista; equivale a los 403/429 anti-bot que también se aceptan.
      ![401, 403, 405, 429, 999].includes(response.status)
    ) {
      failures.push(`${url}: HTTP ${response.status}`)
    }
  } catch (error) {
    /* Aquí no llega ninguna respuesta: es DNS, TLS, timeout o red. Nada de eso
       dice que el enlace esté roto, así que se anota y no se bloquea. Que el
       servidor conteste 404 sí lo dice, y eso sigue cayendo en `failures`. */
    unreachable.push(
      `${url}: ${error instanceof Error ? error.message : error}`,
    )
  }
}

const queue = [...external]
const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
  for (;;) {
    const url = queue.shift()
    if (!url) return
    await checkExternal(url)
  }
})
await Promise.all(workers)

/* Se avisa siempre, falle o no: un dominio que lleva semanas sin contestar
   desde la CI merece una mirada aunque no bloquee, y si no se imprime nunca
   nadie se entera de que dejó de comprobarse. En GitHub sale como aviso del
   job. */
if (unreachable.length) {
  const detail = unreachable.map((item) => `  · ${item}`).join("\n")
  console.warn(
    `⚠ ${unreachable.length} URL externa(s) no alcanzable(s) desde aquí; no se dan por rotas:\n${detail}`,
  )
  if (process.env.GITHUB_ACTIONS) {
    for (const item of unreachable) {
      console.log(`::warning::enlace externo no comprobable — ${item}`)
    }
  }
}

if (failures.length) {
  console.error(
    `✗ ${failures.length} enlace(s) fallido(s):\n${failures.map((item) => `  · ${item}`).join("\n")}`,
  )
  process.exit(1)
}
const checked = [
  CHECK_INTERNAL && "enlaces internos",
  CHECK_EXTERNAL &&
    `${external.size - unreachable.length} de ${external.size} URL externas`,
].filter(Boolean)
console.log(`✓ ${checked.join(" y ")} comprobados`)
