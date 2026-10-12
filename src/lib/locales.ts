/**
 * Los códigos de idioma, sueltos y sin dependencias.
 *
 * Vivían en `cvSchema.ts`, que abre con `import { z } from "astro/zod"`. Da
 * igual que sólo se quiera la constante: importar un valor de ese módulo trae
 * zod entero al paquete, y zod son ~37 KB comprimidos. La consola necesita
 * `t()`, `t()` necesita `LOCALE_CODES` y por esa cadena el JS de la página
 * pasaba de 13,3 KB a 50,9.
 *
 * Aquí no puede entrar nada que no sea una constante o un tipo. `cvSchema` lo
 * reexporta, así que el resto del proyecto no nota el cambio.
 */
export const LOCALE_CODES = ["es", "ca", "en"] as const

export type Locale = (typeof LOCALE_CODES)[number]

export type Localized<T = string> = Record<Locale, T>
