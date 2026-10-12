/**
 * Reglas del mensaje de contacto, compartidas por los dos extremos.
 *
 * Las importa la consola (navegador) y `functions/api/contact.ts` (el endpoint
 * de Pages). Que sea el mismo archivo no es comodidad: si el cliente y el
 * servidor validasen distinto, el servidor tendría que rechazar mensajes que el
 * cliente da por buenos, y eso solo se descubre en producción.
 *
 * Aquí no puede entrar **ninguna** importación: el bundle de la Function lo
 * arma Wrangler por su cuenta y no conoce los alias `@/` de este proyecto.
 */

export const CONTACT_LIMITS = {
  email: 160,
  subject: 120,
  message: 4000,
} as const

export interface ContactDraft {
  email: string
  subject: string
  message: string
}

/** Qué campo está mal. `null` es que el borrador se puede enviar. */
export type ContactProblem = "email" | "subject" | "message"

/**
 * Deja un valor apto para ir en una cabecera de correo.
 *
 * Un salto de línea dentro del asunto o del `Reply-To` cierra esa cabecera y
 * abre otra: es la inyección de cabeceras de toda la vida, y con ella se puede
 * añadir un `Bcc:` al mensaje que envía el servidor. Se colapsan a espacio en
 * vez de recortarse para que el texto siga leyéndose.
 */
export function sanitizeHeader(value: string): string {
  // `\s` cubre el retorno de carro, el salto de línea y los separadores
  // Unicode U+2028/U+2029, que son los que rompen una cabecera; de paso
  // colapsa tabuladores y espacios repetidos.
  return value.replace(/\s+/g, " ").trim()
}

/**
 * Validación de dirección: estructural, no RFC 5322.
 *
 * Sigue sin intentar implementar aquel documento —nadie acierta ese regex— pero
 * ya no se conforma con «algo, arroba, algo, punto, algo». Ese patrón daba por
 * buenas `.pedro@gmail.com`, `pedro..ruiz@gmail.com`, `pedro@-gmail.com` y
 * `pedro@gmail..com`, y todas ellas rebotan en el servidor de correo **después**
 * del envío: quien escribe se queda con un «mensaje enviado» y sin respuesta
 * nunca, que es el peor modo de fallar que tiene este formulario.
 *
 * Lo que comprueba, por partes:
 *
 * - **Una sola arroba**, y las dos mitades no vacías.
 * - **La parte local**, hasta 64 caracteres (el límite del RFC 5321): sin punto
 *   al principio ni al final y sin dos seguidos. El juego de caracteres se
 *   queda como estaba, o sea todo menos espacios y los cinco que rompen una
 *   cabecera de correo: coma, punto y coma, ángulos y comilla doble. Ésa es la
 *   defensa contra colar un segundo destinatario y no se toca.
 * - **El dominio**, hasta 255: etiquetas de 1 a 63 alfanuméricas con guiones
 *   por dentro pero nunca en los cantos, al menos dos etiquetas, y una última
 *   —el dominio de primer nivel— de dos letras o más. Se aceptan letras
 *   Unicode: los dominios internacionalizados existen y el navegador ya los
 *   convierte a punycode al enviar.
 * - **El tope de longitud** de siempre.
 */
const EMAIL_LOCAL = /^[^\s@,;<>".][^\s@,;<>"]*$/
const EMAIL_LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u
const EMAIL_TLD = /^\p{L}{2,}$/u

export function isEmail(value: string): boolean {
  if (value.length > CONTACT_LIMITS.email) return false

  const at = value.indexOf("@")
  if (at < 1 || at !== value.lastIndexOf("@")) return false

  const local = value.slice(0, at)
  const domain = value.slice(at + 1)

  if (local.length > 64 || !EMAIL_LOCAL.test(local)) return false
  if (local.endsWith(".") || local.includes("..")) return false

  if (domain.length > 255) return false
  const labels = domain.split(".")
  if (labels.length < 2) return false
  if (!labels.every((label) => label.length <= 63 && EMAIL_LABEL.test(label))) {
    return false
  }

  return EMAIL_TLD.test(labels[labels.length - 1] ?? "")
}

/**
 * Dominios mal tecleados que se corrigen solos.
 *
 * No es validación: `pedro@gmial.com` es una dirección perfectamente válida y
 * `isEmail` la da por buena, como debe. Pero es casi seguro un dedazo, y el
 * coste de equivocarse aquí no es un error de formulario —es una respuesta que
 * no llega nunca—. El formulario enseña la corrección y quien escribe decide.
 *
 * La lista es corta a propósito: sólo los proveedores que de verdad aparecen en
 * un formulario de contacto español, y sólo erratas de una tecla. Una distancia
 * de edición genérica «corregiría» dominios corporativos legítimos, que es
 * exactamente lo que no puede pasar.
 */
const EMAIL_TYPOS: Readonly<Record<string, string>> = {
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotnail.com": "hotmail.com",
  "otmail.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "putlook.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
}

/** La dirección corregida, o `null` si no hay nada que sugerir. */
export function suggestEmail(value: string): string | null {
  const address = sanitizeHeader(value).toLowerCase()
  const at = address.lastIndexOf("@")
  if (at < 1) return null

  const fixed = EMAIL_TYPOS[address.slice(at + 1)]
  if (!fixed) return null

  const suggestion = `${address.slice(0, at)}@${fixed}`
  return isEmail(suggestion) ? suggestion : null
}

/** Primer problema del borrador, en el orden en que se piden los campos. */
export function validateContact(draft: ContactDraft): ContactProblem | null {
  if (!isEmail(sanitizeHeader(draft.email))) return "email"

  const subject = sanitizeHeader(draft.subject)
  if (!subject || subject.length > CONTACT_LIMITS.subject) return "subject"

  const message = draft.message.trim()
  if (!message || message.length > CONTACT_LIMITS.message) return "message"

  return null
}

/** El borrador ya saneado, listo para construir el correo. */
export function normalizeContact(draft: ContactDraft): ContactDraft {
  return {
    email: sanitizeHeader(draft.email),
    subject: sanitizeHeader(draft.subject),
    message: draft.message.trim(),
  }
}

/**
 * El `mailto:` de respaldo.
 *
 * Se usa cuando el endpoint no contesta —o cuando no está configurado—, para
 * que la vía de contacto no dependa de que el servidor esté en pie.
 */
export function mailtoUrl(to: string, draft: ContactDraft): string {
  const { subject, message } = normalizeContact(draft)
  const query = new URLSearchParams({ subject, body: message })

  /**
   * Los espacios van en `%20`, no en `+`.
   *
   * `URLSearchParams` serializa como un formulario HTML
   * (`application/x-www-form-urlencoded`), donde `+` **es** un espacio. Pero un
   * `mailto:` no es un formulario: el RFC 6068 manda codificación por
   * porcentaje, y ahí el `+` es un signo más literal. Gmail y Outlook web
   * perdonan y lo leen como espacio; Thunderbird y Mail de Apple no, y abren el
   * borrador con «Vacante+Angular» en el asunto.
   *
   * Se sustituye después de serializar y no antes: `URLSearchParams` es quien
   * escapa el resto (`&`, `=`, acentos), y hacerlo a mano invitaría a romper la
   * consulta con un asunto que llevara un `&`. `+` sólo puede aparecer en la
   * salida como espacio codificado —un `+` escrito por quien redacta sale como
   * `%2B`—, así que el reemplazo global es seguro.
   */
  return `mailto:${to}?${query.toString().replace(/\+/g, "%20")}`
}
