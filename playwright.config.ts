import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./test-results",
  fullyParallel: true,
  workers: 2,
  /**
   * Reintentos sólo en CI, y en local ninguno a propósito.
   *
   * Un runner compartido va a su ritmo y a veces no llega: una navegación que
   * aquí tarda 200 ms allí puede pasarse de los cinco segundos de `expect`. Eso
   * no es un fallo del sitio, y un rojo por lentitud enseña a ignorar los rojos.
   *
   * En local se quedan en cero para que una prueba inestable **se vea** mientras
   * se escribe, en vez de esconderse detrás de un segundo intento. Si algo pasa
   * al tercer intento y no al primero, el reintento lo tapa igual: por eso los
   * tres defectos que había debajo —la carrera de `privacy`, la espera corta de
   * `services` y el `page.url()` sin reintentos de `brief`— se arreglaron en su
   * sitio en vez de dejarlos a esto.
   */
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    /* El loopback IPv6 evita que AdGuard inyecte dos hojas con un nonce distinto
       en las respuestas que ClientRouter descarga al cambiar de idioma. En
       `127.0.0.1` esos estilos ajenos generan falsos errores de la CSP del
       sitio.

       El puerto **4390** y no el 4322: `astro dev` arranca en el 4321 y, si lo
       encuentra ocupado, **prueba el siguiente** —4322, justo el que esta suite
       reservaba—. Con esa sesión viva, `reuseExistingServer` la daba por buena y
       toda la tanda pasaba a medir el servidor de desarrollo en vez de `dist/`:
       sin CSP, sin la hoja incrustada y sin las imágenes procesadas, o sea con
       las pruebas de CSP y las visuales comprobando otra cosa y sin decirlo.
       4390 queda fuera del alcance al que dev va a ir escalando. */
    baseURL: "http://[::1]:4390",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command:
      "npx --no-install vite preview --host ::1 --port 4390 --strictPort",
    url: "http://[::1]:4390",
    /* En local reaprovechar el servidor ahorra el arranque en cada tanda. En CI
       no: si algo ya escucha en el 4390 no es esta vista previa, y la suite
       pasaría a medir lo que sea que esté ahí en vez de `dist/`. */
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
