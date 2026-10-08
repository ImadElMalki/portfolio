import type { ImageMetadata } from "astro"

import inetum from "@/assets/logos/inetum.webp"
import viewnext from "@/assets/logos/viewnext.webp"

/**
 * Versión reducida de `src/lib/companyLogos.ts` para la copia pública.
 *
 * `scripts/export-public.mjs` la pone en su sitio al exportar, y borra de la
 * copia los doce logotipos que aquí no se importan.
 *
 * El original mapea catorce empresas: las dos de la carrera actual y las doce
 * anteriores a programar. Redactar esas doce en `cv.json` no bastaba —el mapa
 * las nombraba igual, y sus imágenes viajaban en `src/assets/logos/`—, así que
 * se van las dos cosas. Quedan Viewnext e Inetum, que es lo que el currículum
 * público cuenta.
 *
 * La forma es la misma: `registries.test.ts` exige que toda empresa con web
 * tenga logotipo y que el mapa no nombre ninguna que no esté en el CV, y las
 * dos que quedan cumplen las dos direcciones.
 */
export type LogoTone = "ink"

export interface CompanyLogo {
  readonly image: ImageMetadata
  readonly tone?: LogoTone
}

const LOGO_BY_COMPANY: Readonly<Record<string, CompanyLogo>> = {
  VIEWNEXT: { image: viewnext },
  INETUM: { image: inetum, tone: "ink" },
}

export function companyLogo(name: string): CompanyLogo | undefined {
  return LOGO_BY_COMPANY[name]
}

export const LOGO_COMPANY_NAMES = Object.keys(LOGO_BY_COMPANY)
