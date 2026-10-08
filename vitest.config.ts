import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/**
 * Las pruebas cubren `src/lib`, que es donde vive la lógica que comparten la
 * vista web, la vista Markdown y los endpoints. Los componentes `.astro` los
 * valida `astro check` y su salida `scripts/check-build.mjs`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "astro:i18n": fileURLToPath(
        new URL("./src/test/astroI18n.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "functions/**/*.test.ts"],
    environment: "node",
  },
})
