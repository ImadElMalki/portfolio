import type { HitEvent } from "./hitEvents"

/**
 * El emisor del contador.
 *
 * Cuenta la vista al cargar y lo que se hace en ella: abrir un proyecto,
 * preguntar al asistente, descargar el CV y enviar el formulario —la lista está en `hitEvents.ts`—. Lo que se guarda al otro lado
 * son contadores sin ninguna identidad —ver `functions/api/hit.ts`—, así que
 * aquí tampoco hay nada que recordar entre visitas: ni cookie, ni
 * `localStorage`, ni identificador.
 *
 * ## `sendBeacon` y no `fetch`
 *
 * Es una petición que a nadie le importa que llegue: no hay respuesta que leer
 * ni error que atender. `sendBeacon` la encola en el navegador y la manda
 * cuando puede, incluso si la pestaña se cierra a continuación, y no compite
 * con lo que la página esté descargando. Un `fetch` normal sí compite.
 *
 * `fetch` con `keepalive` queda de reserva para donde no exista `sendBeacon`.
 */

/**
 * Cada cosa se cuenta una vez por **página**.
 *
 * Sin esto, abrir siete proyectos serían siete apuntes y la cifra diría cuánto
 * curioseó una persona en vez de a cuánta gente le interesó. La pregunta que
 * se quiere responder es la segunda.
 *
 * Ojo con lo que es «una vez»: lo que ya se contó dura lo que la pestaña, no lo
 * que el documento. Cuando la clave de la vista era sólo `view:web`, ir de la
 * portada a `/servicios/` **no dejaba ni un apunte** —y saber si la landing
 * recibe visitas era justo para lo que se montó esto—. Por eso el camino entra
 * en la clave: una vista por página visitada, y una sola aunque se vuelva a
 * ella.
 *
 * Con `<ClientRouter />` bastaba un `Set` en memoria, porque el documento era
 * el mismo toda la visita. Desde el 02-10-2026 cada página es un documento
 * nuevo, así que el `Set` se guarda en `sessionStorage`: el ámbito de la
 * pestaña, que muere con ella y no sale del navegador. Sin almacenamiento,
 * vuelve a ser sólo memoria y una vuelta atrás que recargue contaría otra vez.
 */
const SENT_KEY = "portfolio-hits"

function readSent(): Set<string> {
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem(SENT_KEY) ?? "[]",
    )
    if (Array.isArray(stored)) {
      return new Set(
        stored.filter((key): key is string => typeof key === "string"),
      )
    }
  } catch {
    // Almacenamiento bloqueado o una entrada corrupta: se empieza de cero.
  }
  return new Set()
}

const sent = readSent()

function remember(key: string): void {
  sent.add(key)
  try {
    window.sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent]))
  } catch {
    // Sin almacenamiento queda en memoria, que es lo que había antes.
  }
}

function post(body: Record<string, string>): void {
  /* `astro dev` no ejecuta `functions/` —eso sólo lo hace `wrangler pages
     dev`—, así que en desarrollo cada carga dejaba un 404 en la consola del
     navegador y un aviso del enrutador en la del servidor. Ruido que además
     puntúa: Lighthouse baja «Best Practices» por un error en consola. Vite
     resuelve la constante al empaquetar, así que esto no viaja a producción. */
  if (!import.meta.env.PROD) return

  const payload = JSON.stringify(body)
  const url = "/api/hit"

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        url,
        new Blob([payload], { type: "application/json" }),
      )
      return
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Contar es lo último que puede romper una página. Si falla, silencio.
  }
}

/**
 * La vista va siempre a `web`. Hubo otras —rápida, Markdown y consola— hasta el
 * 06-10-2026; el campo se queda para que la serie de Analytics Engine siga
 * siendo comparable con lo contado antes.
 */
export function countHit(event: HitEvent): void {
  const key = event === "view" ? `view:${location.pathname}:web` : event
  if (sent.has(key)) return
  remember(key)

  post(
    event === "view"
      ? { event, path: location.pathname, view: "web" }
      : { event },
  )
}

/**
 * Engancha el contador a lo que ya ocurre.
 *
 * No se instrumenta nada por dentro: se escuchan los eventos que el sitio ya
 * emite para otras cosas —`ask-used` es del cliente del asistente,
 * `contact-sent` del formulario— y se miran los clics que ya existen. Así medir no se mete en el camino de
 * ninguna función, y quitar esto entero no rompe ninguna.
 */
export function mountHits(signal: AbortSignal): void {
  countHit("view")

  /* Delegado en `document` y por captura, para no tocar la tarjeta.

     El CV se reconoce por el destino y no por una marca en cada enlace: son el
     botón del hero, el de la barra y la descarga de la consola, y una marca
     olvidada en el siguiente dejaría de contar sin que nada lo dijera. Por
     captura también cuenta el ancla que la consola crea y pulsa por guion. */
  document.addEventListener(
    "click",
    (clickEvent) => {
      if (!(clickEvent.target instanceof Element)) return
      if (clickEvent.target.closest("[data-detail-open]")) countHit("project")
      if (clickEvent.target.closest('a[href$="cv.pdf"]')) countHit("cv-pdf")
    },
    { capture: true, signal },
  )

  document.addEventListener("ask-used", () => countHit("ask"), { signal })
  document.addEventListener("contact-sent", () => countHit("contact-sent"), {
    signal,
  })
}
