#!/usr/bin/env node
/**
 * Construye y corre las pruebas que cubren la landing de servicios.
 *
 * Ya no enciende ninguna bandera: la página se publica desde el 20-08-2026 y
 * entra en cualquier build. El atajo se queda porque sigue haciendo algo útil
 * —construir y pasarle sólo sus dos specs, sin la suite entera de navegador—.
 */
import { spawnSync } from "node:child_process"

const env = { ...process.env }

/**
 * Cada paso es una sola cadena, no un comando con lista de argumentos: en
 * Windows `npm` y `npx` son .cmd y Node 24 se niega a ejecutarlos sin shell
 * (`EINVAL`), mientras que pasar `args` *con* shell está deprecado por no
 * escaparlos. Una cadena sin partes variables cumple las dos cosas.
 */
const steps = [
  "npm run build",
  "npx playwright test tests/browser/services.spec.ts tests/browser/accessibility.spec.ts",
]

for (const step of steps) {
  console.log(`\n▶ ${step}\n`)
  const { status, error } = spawnSync(step, {
    env,
    stdio: "inherit",
    shell: true,
  })

  if (error) throw error
  if (status !== 0) process.exit(status ?? 1)
}

console.log("\n✓ la landing de servicios pasa sus pruebas")
