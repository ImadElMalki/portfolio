/**
 * Copiar al portapapeles, con la comprobación que hace falta.
 *
 * `navigator.clipboard` no está siempre: falta en contextos sin HTTPS, algunos
 * navegadores lo dejan fuera y el permiso se puede denegar. Por eso esto
 * devuelve un booleano en vez de lanzar: quien llama tiene que poder ofrecer su
 * propia reserva —seleccionar el texto, dejar que un `mailto:` siga su camino—,
 * y eso son decisiones suyas, no de un ayudante de tres líneas.
 *
 * El `?.` sobre `writeText` no sobra: hay entornos que exponen `clipboard` sin
 * el método, y llamarlo a ciegas tira un `TypeError` en vez de un rechazo.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
