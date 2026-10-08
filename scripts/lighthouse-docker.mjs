#!/usr/bin/env node
/**
 * Ejecuta Lighthouse en el mismo Chromium Linux limpio que las visuales.
 *
 * Dos modos, mismos umbrales:
 *
 * - **Local**: levanta el contenedor fijado de Playwright y corre dentro. Es el
 *   camino por defecto y el que hace reproducible la medición en Windows, donde
 *   el Chrome del sistema venía contaminado por extensiones.
 * - **`LIGHTHOUSE_IN_CONTAINER=1`**: salta el `docker run` y ejecuta la misma
 *   secuencia directamente. Es lo que usa el job de CI, que **ya** corre dentro
 *   de esa imagen; anidar Docker allí no funcionaría.
 *
 * Se sirve con `wrangler pages dev` y no con `vite preview` a propósito: la
 * vista previa de Vite no comprime, y medir bytes contra ella daba LCP de once
 * segundos que no representaban nada.
 *
 * ## Tres tandas y la mediana
 *
 * Una tanda sola tiene ruido de máquina: el 11-09-2026 tres seguidas dieron
 * 2.164, 2.251 y 2.773 ms de LCP con el mismo `dist/`. El presupuesto se mide
 * contra la tanda **mediana** por LCP (`LIGHTHOUSE_RUNS`, tres por defecto), y
 * de ella se imprime además por qué tarda: el elemento LCP y su desglose, lo
 * que bloquea el pintado y lo que se descarga antes del primer pintado. El TBT
 * y el CLS van por su propia mediana: un pico de CPU en la tanda mediana por
 * LCP no debe suspender un presupuesto que bloquea el despliegue. Y el TBT,
 * además, sólo avisa (ver más abajo).
 *
 * Con `LIGHTHOUSE_REPORT_DIR` se guarda el informe completo de esa tanda y un
 * resumen de todas, para leerlos sin Docker: la CI los sube como artefacto.
 */
import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import { HOME_RUNTIME_BUDGET } from "./budgets.mjs"
import {
  medianByLcp,
  medianOf,
  summarizeReport,
} from "./lighthouse-summary.mjs"

const require = createRequire(import.meta.url)
const { version: playwrightVersion } = require("@playwright/test/package.json")
const image = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`
const lighthouseVersion = "13.4.1"
const inContainer = process.env.LIGHTHOUSE_IN_CONTAINER === "1"
const runs = Math.max(
  1,
  Number.parseInt(process.env.LIGHTHOUSE_RUNS ?? "3", 10) || 3,
)
const reportDirectory = mkdtempSync(join(tmpdir(), "portfolio-lighthouse-"))
const reportName = (run) => `report-${run}.json`
const reportPath = (run) => join(reportDirectory, reportName(run))
/* Dentro del contenedor lanzado por este script, `/report` es el volumen que
   apunta a `reportDirectory`. Ejecutando en CI ya estamos dentro, así que la
   ruta real es la del propio directorio temporal. */
const reportTarget = (run) =>
  inContainer ? reportPath(run) : `/report/${reportName(run)}`

const lighthouseRuns = Array.from(
  { length: runs },
  (_, index) =>
    `npx --yes lighthouse@${lighthouseVersion} http://127.0.0.1:4392/ --output=json --output-path=${reportTarget(index + 1)} --chrome-flags=\"--headless=new --no-sandbox --disable-gpu --disable-extensions --incognito --no-first-run\" --quiet`,
)

const inside = [
  "set -eu",
  "WRANGLER_SEND_METRICS=false CI=1 node node_modules/wrangler/bin/wrangler.js pages dev dist --ip 127.0.0.1 --port 4392 --compatibility-date 2026-08-01 >/tmp/portfolio-preview.log 2>&1 & server_pid=$!",
  "trap 'kill \"$server_pid\" 2>/dev/null || true' EXIT",
  "for attempt in $(seq 1 50); do wget -q -O /dev/null http://127.0.0.1:4392/ && break; sleep 0.2; done",
  "wget -q -O /dev/null http://127.0.0.1:4392/ || { cat /tmp/portfolio-preview.log; exit 1; }",
  "CHROME_PATH=\"$(find /ms-playwright -type f -path '*/chrome-linux*/chrome' -print -quit)\"",
  'test -n "$CHROME_PATH"',
  "export CHROME_PATH",
  ...lighthouseRuns,
].join("; ")

try {
  const { status, error } = inContainer
    ? spawnSync("bash", ["-lc", inside], { stdio: "inherit" })
    : spawnSync(
        "docker",
        [
          "run",
          "--rm",
          "--ipc=host",
          "-v",
          `${process.cwd()}:/work`,
          "-v",
          "portfolio-node-linux:/work/node_modules",
          "-v",
          `${reportDirectory}:/report`,
          "-w",
          "/work",
          image,
          "bash",
          "-lc",
          inside,
        ],
        { stdio: "inherit" },
      )

  if (error) throw error
  if (status !== 0) throw new Error(`Lighthouse terminó con código ${status}`)

  const summaries = Array.from({ length: runs }, (_, index) => ({
    run: index + 1,
    ...summarizeReport(JSON.parse(readFileSync(reportPath(index + 1), "utf8"))),
  }))
  const result = medianByLcp(summaries)

  console.log("\nTandas (la mediana por LCP es la que cuenta):")
  console.table(
    summaries.map(
      ({
        run,
        performance,
        fcpMs,
        lcpMs,
        speedIndexMs,
        tbtMs,
        cls,
        requests,
        transferKiB,
      }) => ({
        run,
        performance,
        fcpMs,
        lcpMs,
        speedIndexMs,
        tbtMs,
        cls: Math.round(cls * 1000) / 1000,
        requests,
        transferKiB,
      }),
    ),
  )
  console.log(JSON.stringify(result, null, 2))

  const outputDirectory = process.env.LIGHTHOUSE_REPORT_DIR
  if (outputDirectory) {
    mkdirSync(outputDirectory, { recursive: true })
    copyFileSync(reportPath(result.run), join(outputDirectory, "median.json"))
    writeFileSync(
      join(outputDirectory, "summary.json"),
      `${JSON.stringify({ median: result.run, runs: summaries }, null, 2)}\n`,
    )
  }

  const budget = HOME_RUNTIME_BUDGET
  const transferBudgetKiB = budget.transferBytes / 1024
  /* El LCP, las peticiones y los bytes salen de la tanda mediana; el TBT y el
     CLS, de su propia mediana, que un pico de CPU en una tanda no mueve (ver
     `medianOf`). */
  const tbtMs = medianOf(summaries, (summary) => summary.tbtMs)
  const cls = medianOf(summaries, (summary) => summary.cls)

  /* El TBT avisa y no bloquea. Lighthouse lo simula multiplicando por cuatro
     cada tarea observada, así que hereda el ruido de la CPU del runner: con el
     mismo `dist/`, el 01-10-2026 dio 244/35/0 ms en una ejecución y
     158/204/531 en la siguiente. Con un runner lento entero ni la mediana lo
     salva, y un techo que falla por la máquina enseña a ignorar el rojo. */
  if (tbtMs > budget.tbtMs) {
    const message = `TBT ${tbtMs} ms > ${budget.tbtMs} ms (mediana de las tandas; aviso, no bloquea)`
    console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : message)
  }

  const failures = [
    [
      result.lcpMs > budget.lcpMs,
      `LCP ${result.lcpMs} ms > ${budget.lcpMs} ms`,
    ],
    [cls > budget.cls, `CLS ${cls} > ${budget.cls}`],
    [
      result.requests > budget.requests,
      `peticiones ${result.requests} > ${budget.requests}`,
    ],
    [
      result.transferKiB > transferBudgetKiB,
      `transferencia ${result.transferKiB} KiB > ${transferBudgetKiB} KiB`,
    ],
    [result.accessibility < 100, `accesibilidad ${result.accessibility} < 100`],
    [
      result.bestPracticeFailures.some((id) => id !== "is-on-https"),
      `auditorías de buenas prácticas: ${result.bestPracticeFailures.join(", ")}`,
    ],
    [result.seo < 100, `SEO ${result.seo} < 100`],
  ].filter(([failed]) => failed)

  if (failures.length > 0) {
    throw new Error(failures.map(([, message]) => message).join("; "))
  }
} finally {
  rmSync(reportDirectory, { recursive: true, force: true })
}
