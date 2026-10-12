#!/usr/bin/env node
/**
 * Comprueba que el `dist/` que se va a subir es exactamente el que pasó las
 * pruebas.
 *
 * Sin esto el manifiesto era papel mojado: `write-deployment-manifest.mjs`
 * calculaba la huella, la metía **dentro** del propio artefacto y nadie la
 * volvía a mirar. Lo que garantizaba la procedencia era el `download-artifact`,
 * no el manifiesto —y eso no cubre un `dist/` reconstruido en el job de
 * despliegue, ni un artefacto de otro commit descargado por error.
 *
 * Se ejecuta en `deploy-preview` y `deploy-production`, después de descargar y
 * antes de `wrangler pages deploy`. Falla el job en vez de publicar.
 */
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

const DIST = "dist"
const MANIFEST = join(DIST, "deployment-manifest.json")

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesUnder(path) : Promise.resolve([path])
    }),
  )
  return files.flat()
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(await readFile(MANIFEST, "utf8"))
} catch (error) {
  fail(`no se pudo leer ${MANIFEST}: ${error.message}`)
}

/* El mismo recorrido, el mismo orden y la misma exclusión que el escritor: si
   divergen, la comprobación deja de significar nada aunque siga en verde. */
const files = (await filesUnder(DIST))
  .filter((path) => path !== MANIFEST)
  .sort((a, b) => a.localeCompare(b))
const digest = createHash("sha256")
for (const path of files) {
  digest.update(relative(DIST, path).replaceAll("\\", "/"))
  digest.update("\0")
  digest.update(await readFile(path))
}
const artifactSha256 = digest.digest("hex")

if (files.length !== manifest.files) {
  fail(
    `el artefacto trae ${files.length} archivos y el manifiesto ${manifest.files}`,
  )
}
if (artifactSha256 !== manifest.artifactSha256) {
  fail(
    `huella del artefacto ${artifactSha256}, declarada ${manifest.artifactSha256}`,
  )
}

/* El commit se comprueba sólo cuando quien invoca dice cuál espera: en local no
   hay un SHA de referencia y exigirlo convertiría el script en inservible. */
const expected = process.env.DEPLOY_COMMIT
if (expected && expected !== manifest.commit) {
  fail(
    `el manifiesto es del commit ${manifest.commit} y se esperaba ${expected}`,
  )
}

console.log(
  `✓ artefacto verificado: ${files.length} archivos, ${artifactSha256.slice(0, 12)}…, commit ${manifest.commit.slice(0, 7)}`,
)
