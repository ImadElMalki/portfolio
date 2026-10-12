/**
 * Enlaces de contacto que no son un `mailto:`.
 *
 * Vive aparte de `contact.ts` porque aquel archivo lo comparte la Pages
 * Function y no puede importar nada; esto es sólo de la web.
 */

/**
 * El enlace de WhatsApp.
 *
 * `wa.me` admite **sólo dígitos** en la ruta: con el `+` de E.164, con espacios
 * o con guiones devuelve «número de teléfono no válido» en vez de abrir el
 * chat. Por eso el número se guarda en `cv.json` en E.164 —que es lo legible y
 * lo que valida el esquema— y se limpia aquí, en el único sitio que construye
 * la URL.
 *
 * `api.whatsapp.com/send` hace lo mismo, pero `wa.me` es el corto oficial y no
 * pasa por una pantalla intermedia en escritorio.
 */
export function whatsappUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
