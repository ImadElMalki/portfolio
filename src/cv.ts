import { getEntry } from "astro:content"
import type { CvData } from "@/lib/cvSchema"

/**
 * Sólo los tipos. Los esquemas de Zod y `LOCALE_CODES` también se reexportaban
 * desde aquí y nadie llegaba a ellos por esta puerta: `content.config.ts`,
 * `i18n.ts` y las pruebas van a `@/lib/cvSchema` directamente. Dos caminos al
 * mismo símbolo sólo sirven para que la mitad del repo use uno y la otra mitad
 * el otro.
 */
export type {
  CefrLevel,
  CvData,
  Locale,
  Localized,
  ProjectLinkKind,
  ProjectStatus,
} from "@/lib/cvSchema"

/** Única frontera de lectura del CV validado por Content Layer. */
export async function getCv(): Promise<CvData> {
  const entry = await getEntry("portfolio", "cv")

  if (!entry) {
    throw new Error('Content entry "portfolio/cv" was not loaded')
  }

  return entry.data
}
