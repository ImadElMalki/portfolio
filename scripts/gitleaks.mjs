#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const IMAGE =
  "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--network=none",
    "-v",
    `${root}:/repo:ro`,
    "-w",
    "/repo",
    IMAGE,
    "git",
    "--redact",
    "--verbose",
    "/repo",
  ],
  { stdio: "inherit", shell: false },
)

if (result.error) {
  console.error(`No se pudo ejecutar Docker/Gitleaks: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
