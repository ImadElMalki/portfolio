import type { Localized } from "@/lib/locales"

export interface AskProfileSection {
  title: Localized
  facts: readonly Localized[]
}

export interface AskProfile {
  reviewedAt: string
  sections: readonly AskProfileSection[]
}

/**
 * Versión neutra de `src/data/askProfile.ts` para la copia pública.
 *
 * `scripts/export-public.mjs` la pone en su sitio al exportar. El original
 * lleva la fecha de nacimiento —de ahí sale la edad que el asistente dice— y
 * el relato personal que el modelo cuenta a quien pregunta. Es contenido
 * pensado para ser público, pero publicarlo *aquí* es otra cosa: un
 * repositorio se bifurca y se queda, y una página se cambia.
 *
 * Lo que se conserva es la forma: los mismos tipos, las mismas claves y una
 * sección con un hecho, para que `astro check`, las pruebas y el Worker de
 * `/api/ask` sigan compilando y corriendo en la copia.
 */
export const ASK_BIRTH_DATE = "1990-01-01"

export const ASK_PROFILE = {
  reviewedAt: "2026-10-07",
  sections: [
    {
      title: {
        es: "Perfil",
        ca: "Perfil",
        en: "Profile",
      },
      facts: [
        {
          es: "El expediente real de esta sección no se publica en el repositorio. En el sitio en producción, el asistente responde con los hechos que su autor ha escrito aquí.",
          ca: "L'expedient real d'aquesta secció no es publica al repositori. Al lloc en producció, l'assistent respon amb els fets que el seu autor ha escrit aquí.",
          en: "The real content of this section is not published in the repository. On the live site, the assistant answers with the facts its author wrote here.",
        },
      ],
    },
  ],
} as const satisfies AskProfile
