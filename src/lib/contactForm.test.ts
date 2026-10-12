// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mountContactForm } from "./contactForm"

/** Los mismos `data-*` que escribe `Contact.astro`, con textos reconocibles. */
function renderContactForm(): {
  form: HTMLFormElement
  status: HTMLElement
  button: HTMLButtonElement
  fallback: HTMLAnchorElement
  trap: HTMLInputElement
} {
  document.body.innerHTML = `
    <div
      data-contact
      data-contact-url="/api/contact"
      data-email="imad@example.com"
      data-sending="Enviando…"
      data-send="Enviar mensaje"
      data-sent="Enviado."
      data-failed="No se pudo enviar."
      data-rate-limited="Demasiados envíos."
      data-fallback="Abrir en tu correo"
      data-bad-email="Dirección no válida."
      data-bad-subject="Asunto vacío."
      data-bad-message="Mensaje vacío."
    >
      <form data-contact-form novalidate>
        <input name="email" type="email" />
        <input name="subject" type="text" />
        <textarea name="message"></textarea>
        <input data-contact-trap name="company" type="text" />
        <button type="submit" data-contact-send>Enviar mensaje</button>
        <p data-contact-status role="status"></p>
      </form>
      <a class="contact-mailto" href="mailto:imad@example.com">imad@example.com</a>
    </div>
  `

  const form = document.querySelector<HTMLFormElement>("[data-contact-form]")
  const status = document.querySelector<HTMLElement>("[data-contact-status]")
  const button = document.querySelector<HTMLButtonElement>(
    "[data-contact-send]",
  )
  const fallback = document.querySelector<HTMLAnchorElement>(".contact-mailto")
  const trap = document.querySelector<HTMLInputElement>("[data-contact-trap]")
  if (!form || !status || !button || !fallback || !trap) {
    throw new Error("Contact form fixture was not rendered")
  }
  return { form, status, button, fallback, trap }
}

function fill(
  form: HTMLFormElement,
  draft: { email: string; subject: string; message: string },
): void {
  ;(form.elements.namedItem("email") as HTMLInputElement).value = draft.email
  ;(form.elements.namedItem("subject") as HTMLInputElement).value =
    draft.subject
  ;(form.elements.namedItem("message") as HTMLTextAreaElement).value =
    draft.message
}

const VALID = {
  email: "quien@example.com",
  subject: "Una vacante",
  message: "Hola, tengo un proyecto.",
}

/** `submit` y espera a que el manejador `async` termine. */
async function submit(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
  await vi.waitFor(() => undefined)
  await Promise.resolve()
}

describe("formulario de contacto", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("no llama al servidor si el borrador no pasa la validación compartida", async () => {
    const { form, status } = renderContactForm()
    mountContactForm(new AbortController().signal)

    fill(form, { ...VALID, email: "esto-no-es-un-correo" })
    await submit(form)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(status.textContent).toBe("Dirección no válida.")
    expect(status.dataset.state).toBe("error")
  })

  it("lleva el foco al campo que falla", async () => {
    const { form } = renderContactForm()
    mountContactForm(new AbortController().signal)

    fill(form, { ...VALID, subject: "   " })
    await submit(form)

    expect(document.activeElement).toBe(form.elements.namedItem("subject"))
  })

  it("abre el formulario antes de enfocar un campo que estaba plegado", async () => {
    // Correo y asunto arrancan en `display: none` y sólo salen al escribir el
    // mensaje. Sin este atributo, el foco iría a un campo que no se pinta y
    // quien envía sin correo se quedaría con un aviso y ningún sitio donde
    // arreglarlo.
    const { form } = renderContactForm()
    mountContactForm(new AbortController().signal)

    fill(form, { ...VALID, email: "esto-no-es-un-correo" })
    await submit(form)

    expect(form.dataset.expanded).toBe("")
  })

  it("vuelve al estado mínimo tras un envío correcto", async () => {
    const { form } = renderContactForm()
    mountContactForm(new AbortController().signal)
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    fill(form, { ...VALID, email: "roto" })
    await submit(form)
    expect(form.dataset.expanded).toBe("")

    fill(form, VALID)
    await submit(form)

    expect(form.dataset.expanded).toBeUndefined()
  })

  it("envía el borrador saneado junto al campo trampa", async () => {
    const { form, trap } = renderContactForm()
    mountContactForm(new AbortController().signal)
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    fill(form, { ...VALID, subject: "  Una   vacante  " })
    trap.value = ""
    await submit(form)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    if (!call) throw new Error("fetch was not called")
    const [url, init] = call
    expect(url).toBe("/api/contact")
    expect(init.method).toBe("POST")
    // `normalizeContact` colapsa los espacios: lo que viaja ya es apto para ir
    // en una cabecera de correo.
    expect(JSON.parse(init.body)).toEqual({
      email: VALID.email,
      subject: "Una vacante",
      message: VALID.message,
      company: "",
    })
  })

  it("confirma el envío y vacía el formulario", async () => {
    const { form, status, button } = renderContactForm()
    mountContactForm(new AbortController().signal)
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    fill(form, VALID)
    await submit(form)

    expect(status.textContent).toBe("Enviado.")
    expect(status.dataset.state).toBe("sent")
    expect((form.elements.namedItem("email") as HTMLInputElement).value).toBe(
      "",
    )
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe("Enviar mensaje")
  })

  /* El contador escucha este evento (`hits.ts`); el formulario no sabe que
     existe. Es una de las dos conversiones de la portada. */
  it("avisa con `contact-sent` tras un envío correcto", async () => {
    const { form } = renderContactForm()
    mountContactForm(new AbortController().signal)
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const sent = vi.fn()
    document.addEventListener("contact-sent", sent)

    fill(form, VALID)
    await submit(form)

    document.removeEventListener("contact-sent", sent)
    expect(sent).toHaveBeenCalledTimes(1)
  })

  it("no avisa de un envío que ha fallado", async () => {
    const { form } = renderContactForm()
    mountContactForm(new AbortController().signal)
    fetchMock.mockResolvedValue({ ok: false, status: 503 })
    const sent = vi.fn()
    document.addEventListener("contact-sent", sent)

    fill(form, VALID)
    await submit(form)

    document.removeEventListener("contact-sent", sent)
    expect(sent).not.toHaveBeenCalled()
  })

  it("distingue el límite de envíos de un fallo cualquiera", async () => {
    const { form, status, fallback } = renderContactForm()
    mountContactForm(new AbortController().signal)
    fetchMock.mockResolvedValue({ ok: false, status: 429 })

    fill(form, VALID)
    await submit(form)

    expect(status.textContent).toBe("Demasiados envíos.")
    // Reintentar más tarde sí funciona, así que el respaldo no se toca.
    expect(fallback.href).toBe("mailto:imad@example.com")
  })

  it("carga el respaldo `mailto:` con lo ya escrito cuando el envío falla", async () => {
    const { form, status, fallback } = renderContactForm()
    mountContactForm(new AbortController().signal)
    // 503: es lo que responde el endpoint mientras no esté configurado.
    fetchMock.mockResolvedValue({ ok: false, status: 503 })

    fill(form, VALID)
    await submit(form)

    expect(status.textContent).toBe("No se pudo enviar.")
    expect(fallback.textContent).toBe("Abrir en tu correo")

    /* Se lee con `searchParams`, igual que `contact.test.ts`: `mailtoUrl` monta
       la consulta con `URLSearchParams`, que codifica los espacios como `+`. */
    const url = new URL(fallback.href)
    expect(url.pathname).toBe("imad@example.com")
    expect(url.searchParams.get("subject")).toBe(VALID.subject)
    expect(url.searchParams.get("body")).toBe(VALID.message)
  })

  it("trata la red caída igual que un fallo del servidor", async () => {
    const { form, status, button } = renderContactForm()
    mountContactForm(new AbortController().signal)
    fetchMock.mockRejectedValue(new Error("offline"))

    fill(form, VALID)
    await submit(form)

    expect(status.textContent).toBe("No se pudo enviar.")
    expect(button.disabled).toBe(false)
  })

  it("no escribe el resultado sobre una página que ya se ha ido", async () => {
    const { form, status } = renderContactForm()
    const controller = new AbortController()
    mountContactForm(controller.signal)
    fetchMock.mockImplementation(async () => {
      controller.abort()
      return { ok: true, status: 200 }
    })

    fill(form, VALID)
    await submit(form)

    // Se quedó en «enviando…»: el montaje nuevo pinta el estado que toque.
    expect(status.textContent).toBe("Enviando…")
  })
})
