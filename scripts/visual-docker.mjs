#!/usr/bin/env node
/**
 * Corre las referencias visuales dentro de la imagen oficial de Playwright.
 *
 * El renderizado de texto depende del sistema: una captura hecha en Windows no
 * coincide con la de una `ubuntu-latest`, ni esa con la del contenedor. Como el
 * CI también usa esta imagen, las referencias versionadas valen en los dos
 * sitios y no hay que mantener dos juegos.
 *
 * `node_modules` va en un volumen con nombre a propósito: los binarios nativos
 * del host (`sharp`, `rollup`) son de Windows y no arrancan en Linux, y montar la
 * carpeta encima los rompería. Se instalan una vez y el volumen los conserva.
 *
 * Uso:
 *   npm run test:visual                             comparar contra las referencias
 *   node scripts/visual-docker.mjs --update-snapshots   regenerarlas
 *
 * La segunda va por `node` y no por `npm run … --`: npm 12 valida los flags que
 * recibe antes de pasarlos y aborta con `EUNKNOWNCONFIG: Unknown cli flag:
 * --update-snapshots`, así que el atajo que había escrito aquí no llegaba nunca
 * a Playwright.
 */
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { version } = require("@playwright/test/package.json")
const image = `mcr.microsoft.com/playwright:v${version}-noble`

const inside = [
  // Instalar solo si el volumen viene vacío: `npm ci` borra `node_modules`
  // entero, así que llamarlo siempre costaría dos minutos por ejecución.
  "[ -x node_modules/.bin/playwright ] || npm ci --no-audit --no-fund",
  "npm run build",
  `npx playwright test tests/browser/visual.spec.ts --project=chromium-desktop --project=chromium-mobile ${process.argv.slice(2).join(" ")}`,
].join(" && ")

const { status, error } = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--ipc=host",
    "-v",
    `${process.cwd()}:/work`,
    "-v",
    "portfolio-node-linux:/work/node_modules",
    "-w",
    "/work",
    "-e",
    "VISUAL=1",
    "-e",
    "CI=1",
    image,
    "bash",
    "-lc",
    inside,
  ],
  { stdio: "inherit" },
)

if (error) {
  console.error(
    `No se pudo lanzar Docker (${error.message}). Hace falta Docker en marcha: la imagen ${image} es la que fija el renderizado.`,
  )
  process.exit(1)
}

process.exit(status ?? 1)
