/**
 * Versión neutra de `src/data/protectedTerms.ts` para la copia pública.
 *
 * `scripts/export-public.mjs` la pone en su sitio al exportar. La lista real
 * no se publica: nombrar lo que se protege es el fallo contra el que protege
 * la prueba que la usa. Estos términos no aparecen en el prompt tampoco, así
 * que `ask.test.ts` sigue comprobando lo mismo —que las reglas no nombran lo
 * que hay en la lista—, sólo que con una lista distinta.
 */
export const PROTECTED_TERM_PATTERNS: readonly RegExp[] = [
  /\bxyzzy\b/i,
  /\bplugh\b/i,
]

export const PRIVATE_TEXTS: readonly string[] = ["xyzzy", "plugh"]
