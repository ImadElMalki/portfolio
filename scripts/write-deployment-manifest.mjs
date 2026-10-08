#!/usr/bin/env node
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"

const DIST = "dist"
const OUTPUT = join(DIST, "deployment-manifest.json")

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

const commit =
  process.env.DEPLOY_COMMIT ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const files = (await filesUnder(DIST))
  .filter((path) => path !== OUTPUT)
  .sort((a, b) => a.localeCompare(b))
const artifactHash = createHash("sha256")
for (const path of files) {
  artifactHash.update(relative(DIST, path).replaceAll("\\", "/"))
  artifactHash.update("\0")
  artifactHash.update(await readFile(path))
}

await writeFile(
  OUTPUT,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      commit,
      artifactSha256: artifactHash.digest("hex"),
      files: files.length,
    },
    null,
    2,
  )}\n`,
)
console.log(`manifiesto de despliegue → ${OUTPUT}`)
