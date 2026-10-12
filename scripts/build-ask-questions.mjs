import { writeFile } from "node:fs/promises"
import { ASK_QUESTION_SETS } from "../src/data/askQuestions.ts"

/**
 * Escribe el banco de preguntas por idioma en `public/ask-questions/`.
 *
 * ## Por qué existe
 *
 * El banco vive una sola vez, en `src/data/askQuestions.ts`, porque es donde se
 * escribe y se revisa: los tres idiomas de cada pregunta juntos, que es la única
 * forma de ver si dicen lo mismo. Lo que el navegador descarga son 144 cadenas
 * que no tienen por qué viajar en el paquete inicial, así que se sirven como
 * tres archivos estáticos.
 *
 * Esas tres copias estuvieron mantenidas a mano, y la única red era una prueba
 * que las comparaba con el original. Aguantó mientras nadie tocó el banco;
 * cambiar veinte preguntas en tres idiomas por cuatro sitios es exactamente
 * donde eso se rompe. Ahora la prueba sigue estando —`askQuestions.test.ts`—
 * pero comprueba otra cosa: que alguien ejecutó esto.
 *
 * ## Por qué puede importar un `.ts` sin compilar nada
 *
 * Node 24 borra los tipos al cargar. `askQuestions.ts` no tiene más TypeScript
 * que un `import type` y un `satisfies`, y los dos desaparecen ahí mismo — el
 * alias `@/` del `import type` no llega a resolverse nunca, que es lo que
 * permite ejecutarlo fuera del build de Astro.
 *
 * Uso: `npm run ask:questions`. Los archivos se versionan.
 */

const OUT = new URL("../public/ask-questions/", import.meta.url)

const LOCALES = ["es", "ca", "en"]

for (const locale of LOCALES) {
  const sets = ASK_QUESTION_SETS.map((set) => set[locale])
  /* Con salto final: es lo que deja prettier en el resto de JSON del repo, y sin
     él `format:check` marca los tres archivos en cada regeneración. */
  await writeFile(
    new URL(`${locale}.json`, OUT),
    `${JSON.stringify(sets, null, 2)}\n`,
  )
  console.log(`${locale}.json · ${sets.length} grupos de ${sets[0].length}`)
}
