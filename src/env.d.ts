/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/**
 * `?inline` de Vite: devuelve el archivo como data URI en base64. Lo usan los
 * endpoints que componen imágenes en el build (`/portrait.webp`, `/og.png`),
 * donde ya no existe una ruta de disco que leer.
 */
declare module "*?inline" {
  const dataUri: string
  export default dataUri
}

/** Ver `vite.define` en `astro.config.mjs`. */
declare const __HOME_CONTENT_DATE__: string | null

interface Window {
  theme: {
    setTheme: (theme: "auto" | "dark" | "light") => void
    getTheme: () => "auto" | "dark" | "light"
    getSystemTheme: () => "light" | "dark"
  }
}

interface Document {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => {
    finished: Promise<void>
    ready: Promise<void>
    updateCallbackDone: Promise<void>
    skipTransition: () => void
  }
}
