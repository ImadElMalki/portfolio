import { describe, expect, it } from "vitest"
import {
  CONTACT_LIMITS,
  isEmail,
  mailtoUrl,
  normalizeContact,
  sanitizeHeader,
  suggestEmail,
  validateContact,
} from "./contact"

const draft = (over: Partial<Parameters<typeof validateContact>[0]> = {}) => ({
  email: "ana@empresa.com",
  subject: "Vacante Angular",
  message: "Hola Imad, tenemos una posición abierta.",
  ...over,
})

describe("sanitizeHeader", () => {
  /* Lo que de verdad importa: sin esto, un salto de línea en el asunto cierra
     esa cabecera y deja añadir un `Bcc:` al correo que envía el servidor. */
  it("aplasta los saltos que permitirían inyectar cabeceras", () => {
    expect(sanitizeHeader("Hola\r\nBcc: victima@ejemplo.com")).toBe(
      "Hola Bcc: victima@ejemplo.com",
    )
    expect(sanitizeHeader("a\nb\tc")).toBe("a b c")
  })

  it("recorta los extremos", () => {
    expect(sanitizeHeader("  hola  ")).toBe("hola")
  })
})

describe("isEmail", () => {
  it("acepta direcciones normales", () => {
    for (const value of ["a@b.co", "ana.lopez+cv@empresa.com"]) {
      expect(isEmail(value), value).toBe(true)
    }
  })

  it("rechaza lo que colaría un segundo destinatario", () => {
    for (const value of [
      "a@b.co, otro@c.co",
      "a@b.co;otro@c.co",
      "<a@b.co>",
      'a"@b.co',
      "sin-arroba",
      "a@b",
      "a@ b.co",
    ]) {
      expect(isEmail(value), value).toBe(false)
    }
  })

  it("rechaza por longitud", () => {
    expect(isEmail(`${"a".repeat(CONTACT_LIMITS.email)}@b.co`)).toBe(false)
    // El tope del RFC 5321 para la parte local, por debajo del de la cabecera.
    expect(isEmail(`${"a".repeat(65)}@b.co`)).toBe(false)
    expect(isEmail(`${"a".repeat(64)}@b.co`)).toBe(true)
  })

  /**
   * Las que pasaban antes y rebotan en el servidor de correo.
   *
   * El patrón anterior era «algo, arroba, algo, punto, algo» y daba por buenas
   * las siete de abajo. Ninguna da un error de formulario: dan un mensaje
   * enviado y una respuesta que no llega nunca.
   */
  it("rechaza lo que el patrón de antes daba por bueno", () => {
    for (const value of [
      ".pedro@gmail.com",
      "pedro.@gmail.com",
      "pedro..ruiz@gmail.com",
      "pedro@-gmail.com",
      "pedro@gmail-.com",
      "pedro@gmail..com",
      "pedro@gmail.c",
      "pedro@gmail.c0m",
    ]) {
      expect(isEmail(value), value).toBe(false)
    }
  })

  /* Un dominio internacionalizado es una dirección corriente en España: el
     navegador lo pasa a punycode al enviar, y rechazarlo aquí sería inventar
     una regla que el correo no tiene. */
  it("acepta acentos y eñes en el dominio", () => {
    expect(isEmail("ana@joyería.es")).toBe(true)
    expect(isEmail("ana@sub.dominio-largo.example")).toBe(true)
  })
})

/**
 * La corrección del dedazo. No es validación: `gmial.com` es un dominio válido
 * y `isEmail` lo acepta, que es lo correcto. Lo que hace esto es avisar.
 */
describe("suggestEmail", () => {
  it("corrige los dominios mal tecleados de siempre", () => {
    expect(suggestEmail("ana@gmial.com")).toBe("ana@gmail.com")
    expect(suggestEmail("ana@hotmial.com")).toBe("ana@hotmail.com")
    expect(suggestEmail("ana@outlok.com")).toBe("ana@outlook.com")
    // Mayúsculas y espacios de sobra no impiden reconocerlo.
    expect(suggestEmail("  Ana@GMAIL.CON  ")).toBe("ana@gmail.com")
  })

  it("no toca un dominio que no está en la lista", () => {
    // Y en particular ninguno corporativo: una distancia de edición genérica
    // «corregiría» dominios legítimos, que es justo lo que no puede pasar.
    for (const value of [
      "ana@gmail.com",
      "ana@empresa.com",
      "ana@gmai1.com",
      "sin-arroba",
    ]) {
      expect(suggestEmail(value), value).toBeNull()
    }
  })
})

describe("validateContact", () => {
  it("acepta un borrador completo", () => {
    expect(validateContact(draft())).toBeNull()
  })

  it("señala el primer campo que falla", () => {
    expect(validateContact(draft({ email: "roto" }))).toBe("email")
    expect(validateContact(draft({ subject: "   " }))).toBe("subject")
    expect(validateContact(draft({ message: "" }))).toBe("message")
  })

  it("rechaza lo que se pasa de largo", () => {
    expect(validateContact(draft({ subject: "a".repeat(200) }))).toBe("subject")
    expect(
      validateContact({
        ...draft(),
        message: "a".repeat(CONTACT_LIMITS.message + 1),
      }),
    ).toBe("message")
  })

  it("valida sobre el valor saneado, no sobre el crudo", () => {
    // Con el salto aplastado el asunto sigue siendo válido.
    expect(validateContact(draft({ subject: "Hola\nmundo" }))).toBeNull()
  })
})

describe("normalizeContact", () => {
  it("sanea las cabeceras y recorta el cuerpo", () => {
    expect(
      normalizeContact({
        email: " ana@empresa.com ",
        subject: "Uno\r\nDos",
        message: "\n  cuerpo  \n",
      }),
    ).toEqual({
      email: "ana@empresa.com",
      subject: "Uno Dos",
      message: "cuerpo",
    })
  })
})

describe("mailtoUrl", () => {
  it("compone el respaldo con asunto y cuerpo codificados", () => {
    const url = new URL(mailtoUrl("imad@ejemplo.com", draft()))

    expect(url.protocol).toBe("mailto:")
    expect(url.pathname).toBe("imad@ejemplo.com")
    expect(url.searchParams.get("subject")).toBe("Vacante Angular")
    expect(url.searchParams.get("body")).toContain("posición abierta")
  })

  /**
   * `searchParams` no sirve para esta comprobación: decodifica `+` como espacio,
   * así que da por buenas las dos formas. Hay que mirar la cadena.
   */
  it("escribe los espacios en %20 y no en +, como pide el RFC 6068", () => {
    const url = mailtoUrl("imad@ejemplo.com", draft())

    expect(url).toContain("subject=Vacante%20Angular")
    expect(url).not.toContain("+")
  })

  it("no confunde un `+` escrito por quien redacta con un espacio", () => {
    const url = mailtoUrl(
      "imad@ejemplo.com",
      draft({ subject: "C++ y Angular" }),
    )

    // `URLSearchParams` lo escapa a `%2B`, que el reemplazo no toca.
    expect(url).toContain("subject=C%2B%2B%20y%20Angular")
    expect(new URL(url).searchParams.get("subject")).toBe("C++ y Angular")
  })
})
