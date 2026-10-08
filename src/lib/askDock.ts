import { ASK_LIMITS, type AskTurn } from "./ask"
import { anySignal, askStream, type AskFailure } from "./askClient"
import {
  ASK_QUESTION_SET_COUNT,
  getAskSuggestions,
  isAskQuestionSets,
  type AskQuestionSets,
} from "./askQuestionRotation"
import { clearTurns, readTurns, writeTurns } from "./askTranscript"
import type { Locale } from "./locales"
import { t } from "./ui"

/**
 * El asistente, en un panel que se abre encima de la página.
 *
 * Fue el quinto puerto de la fila de contacto —un glifo sin rótulo que
 * convertía la página en un terminal al pulsarlo—, y después una barra de texto
 * dentro del hero. Las dos versiones tenían el mismo defecto por motivos
 * distintos: **vivían en el flujo de la portada**. La barra empujaba el retrato
 * al aparecer y lo volvía a empujar con cada respuesta, porque la caja crecía
 * dentro de una rejilla centrada verticalmente.
 *
 * Un panel no tiene ese problema y no puede volver a tenerlo: no ocupa sitio en
 * el documento, así que la página no se mueve un píxel se pregunte lo que se
 * pregunte. Y de paso el asistente deja de ser una cosa de la portada y pasa a
 * estar en todas las páginas.
 *
 * ## Un `<dialog>` de verdad
 *
 * Con `showModal()`, y no un `<div>` con `position: fixed`. El navegador
 * regala las tres cosas que había que escribir a mano: la trampa de foco, el
 * cierre con Escape y dejar inerte lo que hay detrás. Es lo mismo que hace el
 * diálogo de proyecto.
 *
 * ## El panel se construye al abrirlo
 *
 * Del servidor sale sólo el disparador. Emitir el panel serían ~15 elementos
 * más en **cada** página que casi nadie llega a abrir, y el presupuesto de DOM
 * del build va contado —ver `scripts/check-build.mjs`—.
 *
 * ## Leer el flujo no es de aquí
 *
 * Es de `askClient.ts`: el formato lo decide `functions/api/ask.ts` y el
 * cliente lo traduce a lo que el panel necesita. Aquí queda lo que es del
 * panel: el eco, la respuesta que crece, las sugerencias y el pie.
 *
 * ## Quien pregunta manda sobre la respuesta
 *
 * Tres cosas que el 08-10-2026 no se podían hacer y ahora sí: **parar** la
 * respuesta sin cerrar el panel, **borrar** la conversación —que viaja en cada
 * petición— y **reintentar** lo que se cortó sin reescribir la pregunta. Y una
 * que se hacía sola y no debía: la caja ya no arrastra al final a quien ha
 * subido a releer.
 */

/** Cuatro: aquí no compiten con nada, el panel está vacío al abrirse. */
const SUGGESTION_COUNT = 4

/**
 * Dos tras cada respuesta.
 *
 * Cuatro debajo de algo que acaban de leer no son un empujón, son un menú que
 * compite con la respuesta y con el renglón de escribir.
 */
const FOLLOW_UP_COUNT = 2

/** Cuántas fichas se enlazan bajo una respuesta. Ver `offerProjects`. */
const LINKED_PROJECTS = 2

/**
 * A dónde puede llevar una respuesta: lo que sirve `/ask-actions.json`.
 *
 * Los enlaces no los escribe el modelo. Podría —y escribiría direcciones que no
 * existen—, así que los pone el panel cotejando el nombre que haya salido con
 * esta tabla, que la genera el build desde `cv.json`.
 */
interface AskActions {
  projects: readonly { name: string; url: string }[]
  contact: string
  cv: string
}

function isAskActions(value: unknown): value is AskActions {
  if (!value || typeof value !== "object") return false
  const actions = value as Record<string, unknown>
  return (
    typeof actions.contact === "string" &&
    typeof actions.cv === "string" &&
    Array.isArray(actions.projects) &&
    actions.projects.every(
      (project: unknown) =>
        !!project &&
        typeof (project as AskActions["projects"][number]).name === "string" &&
        typeof (project as AskActions["projects"][number]).url === "string",
    )
  )
}

/**
 * Para cotejar un nombre con un texto escrito por un modelo.
 *
 * Minúsculas y sin diacríticos: «Asistente Strava/Garmin» tiene que encontrarse
 * aunque la respuesta lo escriba de otra forma. Lo que no se hace es aflojar
 * más: aquí una coincidencia de menos no se nota —no sale la ficha— y una de
 * más manda a quien lee a un proyecto del que nadie ha hablado.
 */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/** La clave de la rotación de sugerencias, que dura lo que la pestaña. */
const ROTATION_KEY = "portfolio:ask-suggestion-set"

/** Por debajo de esto se avisa de cuántas preguntas quedan. Ver `askRemaining`. */
const REMAINING_WARN_AT = 5

/**
 * Margen para considerar que la vista sigue pegada al final de la conversación.
 *
 * Hasta el 08-10-2026 cada trozo de respuesta hacía `scrollTop = scrollHeight`
 * sin preguntar: subir a releer el párrafo anterior mientras el modelo escribía
 * era imposible, la caja te devolvía abajo al siguiente trozo. Ahora se sigue
 * sólo a quien ya estaba abajo, y a quien no, se le avisa con una píldora.
 *
 * Cuarenta y ocho píxeles son algo menos de dos renglones de la mono a 0,8 rem:
 * suficiente para que un medio renglón de desplazamiento no cuente como
 * «se ha ido a leer otra cosa».
 */
const STICK_SLACK_PX = 48

/**
 * Qué fallos admiten reintento.
 *
 * El cupo por conexión y el techo diario, no: volver a pulsar no va a cambiar
 * nada hasta que pase la ventana, y ofrecer un botón que se sabe que falla es
 * peor que no ofrecer ninguno. Un corte del flujo o un 503 del proveedor sí.
 */
const RETRIABLE: readonly AskFailure[] = ["askFailed", "askUnavailable"]

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function anchor(
  className: string,
  href: string,
  text: string,
): HTMLAnchorElement {
  const node = document.createElement("a")
  node.className = className
  node.href = href
  node.textContent = text
  return node
}

export function mountAskDock(signal: AbortSignal): void {
  const root = document.querySelector<HTMLElement>("[data-ask-dock]")
  if (!root) return

  const trigger = root.querySelector<HTMLButtonElement>(
    "[data-ask-dock-trigger]",
  )
  if (!trigger) return

  const locale = (root.dataset.locale ?? "es") as Locale
  const askUrl = root.dataset.askUrl ?? "/api/ask"
  const questionsUrl =
    root.dataset.askQuestionsUrl ?? `/ask-questions/${locale}.json`
  const actionsUrl = root.dataset.askActionsUrl ?? "/ask-actions.json"

  const say = (key: Parameters<typeof t>[1]): string => t(locale, key)

  /**
   * La memoria de la conversación.
   *
   * Se lee de `sessionStorage` al montar y se escribe tras cada turno: el
   * endpoint no guarda estado, así que el historial viaja en cada petición, y
   * guardarlo aquí es lo que hace que navegar a otra página no lo borre. Ver
   * `askTranscript.ts`.
   */
  const turns: AskTurn[] = readTurns()
  let inFlight: AbortController | null = null
  /** Lo ha parado quien pregunta, no la página al irse. Se reinicia por turno. */
  let stopped = false
  /**
   * Cuenta de conversaciones y turnos empezados.
   *
   * La usa el final de `ask` para saber si sigue siendo el turno vigente: parar
   * y pulsar «Nueva» deja una petición resolviéndose, y sin esto su epílogo
   * volvía a colgar el pie de una conversación que ya se había borrado.
   */
  let generation = 0
  /** La vista está pegada al final de la conversación. Ver `STICK_SLACK_PX`. */
  let stick = true
  /** El banco de preguntas y la tabla de enlaces, pedidos una vez cada uno. */
  let bank: AskQuestionSets | null = null
  let actions: AskActions | null = null

  // --- El panel, construido al abrirlo por primera vez -----------------------

  let panel: HTMLDialogElement | null = null
  let answer: HTMLElement | null = null
  let input: HTMLInputElement | null = null
  let foot: HTMLElement | null = null
  let exits: HTMLElement | null = null
  let send: HTMLButtonElement | null = null
  let restart: HTMLButtonElement | null = null
  let jump: HTMLButtonElement | null = null

  const build = (): void => {
    if (panel) return

    const dialog = document.createElement("dialog")
    dialog.className = "ask-dock-panel"

    const head = element("header", "ask-dock-head")
    const title = element("h2", "ask-dock-title", say("askPanelTitle"))
    /* El diálogo se nombra por su título en vez de con un `aria-label`
       repetido: el título ya está en pantalla y las dos cosas dirían lo mismo. */
    title.id = "ask-dock-title"
    dialog.setAttribute("aria-labelledby", title.id)

    const close = element("button", "ask-dock-x")
    close.type = "button"
    close.setAttribute("aria-label", say("askPanelDismiss"))
    /* El aspa es de adorno: el nombre accesible lo pone el `aria-label`, y sin
       esto un lector de pantalla leería «multiplicación» encima del rótulo. */
    close.append(element("span", "ask-dock-x-glyph", "×"))
    close.firstElementChild?.setAttribute("aria-hidden", "true")
    close.addEventListener("click", () => dialog.close(), { signal })

    /* Empezar de cero. Oculto mientras no haya nada que borrar: ver
       `showRestart`. El rótulo se escribe entero —es una palabra— y el nombre
       accesible dice lo que hace, que «Nueva» a secas no dice. */
    const again = element("button", "ask-dock-new", say("askNew"))
    again.type = "button"
    again.setAttribute("aria-label", say("askNewHint"))
    again.hidden = true
    again.addEventListener("click", () => clear(), { signal })

    const tools = element("div", "ask-dock-tools")
    tools.append(again, close)
    head.append(title, tools)

    /* `aria-live="polite"` con la respuesta **fuera** del árbol mientras crece:
       el texto llega a trozos y reescribir un nodo vivo docenas de veces hace
       que un lector de pantalla lo relea entero con cada uno. Al terminar se
       sustituye por uno nuevo, que es una adición y se anuncia una vez. */
    const region = element("div", "ask-dock-answer")
    region.setAttribute("role", "status")
    region.setAttribute("aria-live", "polite")

    /* Quién manda en el desplazamiento. Mientras la respuesta crece, la caja
       sigue al final sólo si quien lee ya estaba allí; en cuanto sube, deja de
       seguirle y el aviso pasa a la píldora. `passive`: aquí no se cancela
       nada y este oyente corre en cada fotograma de desplazamiento. */
    region.addEventListener(
      "scroll",
      () => {
        stick =
          region.scrollHeight - region.scrollTop - region.clientHeight <
          STICK_SLACK_PX
        if (stick && jump) jump.hidden = true
      },
      { signal, passive: true },
    )

    const form = element("form", "ask-dock-field")
    const field = document.createElement("input")
    field.className = "ask-dock-input"
    field.type = "text"
    field.autocomplete = "off"
    field.spellcheck = false
    field.setAttribute("autocapitalize", "sentences")
    field.setAttribute("enterkeyhint", "go")
    field.setAttribute("aria-label", say("askOpen"))
    field.placeholder = say("askOpenHint")

    /**
     * El botón del renglón: pregunta, y para mientras hay algo en vuelo.
     *
     * `type="button"` y no `submit`. Como `submit`, pulsar Intro en el campo
     * pasaría por aquí también, y entonces escribir la siguiente pregunta y
     * darle a Intro cortaría la respuesta que se estaba leyendo. Así Intro
     * pregunta siempre —lo recoge el `submit` del formulario— y parar es un
     * gesto aparte, que es como se lee en pantalla.
     *
     * Hasta el 08-10-2026 no había forma de parar salvo cerrar el panel, y un
     * segundo envío mientras llegaba la respuesta se descartaba **en silencio**.
     */
    const action = element("button", "ask-dock-send")
    action.type = "button"
    action.setAttribute("aria-label", say("askSend"))
    const actionGlyph = element("span", "ask-dock-send-glyph", "→")
    actionGlyph.setAttribute("aria-hidden", "true")
    action.append(actionGlyph)
    action.addEventListener(
      "click",
      () => {
        if (inFlight) stop()
        else void ask(field.value)
      },
      { signal },
    )

    form.append(field, action)

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault()
        void ask(field.value)
      },
      { signal },
    )

    /**
     * «Sigue escribiendo abajo», para quien ha subido a releer.
     *
     * Hija del diálogo y no de la caja de respuesta: dentro de un contenedor con
     * desplazamiento propio, algo posicionado se va con el contenido —es justo
     * lo que no puede pasar aquí—. El diálogo está posicionado por su `inset`,
     * así que esto se ancla a él y se queda quieto sobre el renglón.
     */
    const toEnd = element("button", "ask-dock-jump")
    toEnd.type = "button"
    toEnd.setAttribute("aria-label", say("askJumpHint"))
    const jumpGlyph = element("span", "ask-dock-jump-glyph", "↓")
    jumpGlyph.setAttribute("aria-hidden", "true")
    toEnd.append(
      jumpGlyph,
      element("span", "ask-dock-jump-text", say("askJump")),
    )
    toEnd.hidden = true
    toEnd.addEventListener(
      "click",
      () => {
        stick = true
        scrollToEnd()
        input?.focus()
      },
      { signal },
    )

    const ways = element("div", "ask-dock-exits")
    ways.hidden = true

    dialog.append(head, region, ways, form, toEnd)

    /* Escape lo cierra solo —es un diálogo modal—, pero hay que enterarse para
       devolver el foco y soltar la petición en vuelo. */
    dialog.addEventListener(
      "close",
      () => {
        inFlight?.abort()
        inFlight = null
        /* El botón vuelve a «preguntar»: al reabrir no hay nada en vuelo que
           parar, y un botón de parada en un panel quieto es una mentira. */
        setBusy(false)
        trigger.setAttribute("aria-expanded", "false")
        trigger.focus()
      },
      { signal },
    )

    panel = dialog
    answer = region
    exits = ways
    input = field
    send = action
    restart = again
    jump = toEnd
    root.append(dialog)
    fillExits()
  }

  // --- Sugerencias -----------------------------------------------------------

  let rotation = 0
  try {
    const stored = Number.parseInt(
      window.sessionStorage.getItem(ROTATION_KEY) ?? "",
      10,
    )
    if (Number.isSafeInteger(stored) && stored >= 0) {
      rotation = stored % ASK_QUESTION_SET_COUNT
    }
  } catch {
    /* Hay navegadores que bloquean sessionStorage: la rotación sigue viva en
       memoria mientras dure este montaje. */
  }

  const advanceRotation = (): void => {
    rotation = (rotation + 1) % ASK_QUESTION_SET_COUNT
    try {
      window.sessionStorage.setItem(ROTATION_KEY, String(rotation))
    } catch {
      // La copia en memoria ya avanzó.
    }
  }

  const clearSuggestions = (): void => {
    panel?.querySelector(".ask-dock-suggestions")?.remove()
  }

  /**
   * Las sugerencias: cuatro al abrir el panel vacío, dos después de cada
   * respuesta.
   *
   * Se piden al banco estático —144 cadenas que no tienen por qué viajar en el
   * paquete inicial— y si no llega, no se pinta ninguna: son un empujón, no
   * parte del control, y un panel sin ellas sigue funcionando entero. El banco
   * se guarda tras la primera petición: antes bastaba para abrir, ahora se
   * consulta tras cada turno y pedirlo cada vez sería pedir lo mismo ocho veces.
   *
   * Quién decide que toca enseñarlas es quien llama: al abrir, sólo con la
   * conversación vacía; después de responder, siempre. Aquí sólo se pintan.
   */
  const showSuggestions = async (count: number): Promise<void> => {
    if (!panel) return
    try {
      if (!bank) {
        const response = await fetch(questionsUrl, {
          headers: { accept: "application/json" },
          signal,
        })
        if (!response.ok) return
        const value: unknown = await response.json()
        if (!isAskQuestionSets(value)) return
        bank = value
      }
      if (signal.aborted || inFlight || !panel) return

      const list = element("div", "chip-mono-row ask-dock-suggestions")
      for (const question of getAskSuggestions(bank, rotation).slice(
        0,
        count,
      )) {
        const button = element(
          "button",
          "chip-mono ask-dock-suggestion",
          question,
        )
        button.type = "button"
        button.addEventListener(
          "click",
          () => {
            if (input) input.value = question
            void ask(question)
          },
          { signal },
        )
        list.append(button)
      }
      advanceRotation()
      /* Fuera la tanda anterior: tras una respuesta las de antes ya no vienen a
         cuento, y dos filas de píldoras bajo el renglón son un menú. */
      clearSuggestions()
      panel.append(list)
    } catch {
      // Sin sugerencias se pregunta igual.
    }
  }

  // --- El pie ----------------------------------------------------------------

  /**
   * Siempre el último hijo de la respuesta.
   *
   * Se crea una vez y se reengancha al final tras cada turno, en vez de uno por
   * respuesta: es de la conversación entera, no de una pregunta.
   */
  const ensureFoot = (): void => {
    if (!answer) return
    if (!foot) {
      foot = element("footer", "ask-dock-foot")
      /* Aquí había también «Seguir en la consola», que llevaba la conversación
         al terminal. Se fue con la consola el 06-10-2026. */
      foot.append(element("span", "ask-dock-hint", say("askPanelClose")))
    }
    answer.append(foot)
  }

  /**
   * Las dos salidas del panel: escribirle y bajarse el CV.
   *
   * Fila propia entre la respuesta y el renglón, y no dentro de la
   * conversación. Repetidas bajo cada respuesta serían ruido; al final del
   * registro no existen hasta que se pregunta algo —el pie se crea con el
   * primer turno—, y quien abre el panel, lee dos respuestas y decide escribir
   * no tiene por qué buscar dónde. Están desde que se abre y no se mueven.
   *
   * Vacía hasta que llega la tabla, que es una petición: por eso nace `hidden`
   * en vez de ocupar sitio con dos huecos. El `cv-pdf` del contador se cuenta
   * solo —es un oyente delegado sobre `a[href$="cv.pdf"]`, ver `hits.ts`—.
   */
  const fillExits = (): void => {
    if (!exits || !actions || exits.childElementCount > 0) return
    exits.append(
      anchor("ask-dock-cta", actions.contact, say("contactHeading")),
      anchor("ask-dock-cta", actions.cv, say("heroDownloadCv")),
    )
    exits.hidden = false
  }

  /**
   * La tabla de enlaces, pedida una vez por montaje.
   *
   * Aparte del banco de preguntas y no en el mismo fichero: aquél es texto
   * redactado que se versiona, y esto lo genera el build desde `cv.json`. Si no
   * llega, no hay enlaces y el panel sigue entero.
   */
  const loadActions = async (): Promise<void> => {
    if (actions) return
    try {
      const response = await fetch(actionsUrl, {
        headers: { accept: "application/json" },
        signal,
      })
      if (!response.ok) return
      const value: unknown = await response.json()
      if (!isAskActions(value)) return
      actions = value
      fillExits()
    } catch {
      // Sin tabla se pregunta igual, sólo que sin enlaces.
    }
  }

  /**
   * La ficha de lo que la respuesta haya nombrado.
   *
   * El prompt le pide al modelo texto plano y que nombre cada proyecto como
   * figura en el expediente; eso es lo que hace esto aprovechable: se cotejan
   * los nombres y se enlaza lo que coincide, sin pedirle al modelo que escriba
   * direcciones —que se las inventaría—. Dos como mucho: una respuesta que
   * nombra cuatro proyectos no es una respuesta sobre un proyecto.
   */
  const offerProjects = async (
    text: string,
    turn: HTMLElement,
  ): Promise<void> => {
    /* La tabla puede no haber llegado todavía: se pide al abrir el panel y la
       primera respuesta puede ganarle la carrera. Sin esta espera, la primera
       pregunta de cada visita era justo la que se quedaba sin enlaces. */
    await loadActions()
    if (!actions) return
    const haystack = fold(text)
    const found = actions.projects
      .filter((project) => haystack.includes(fold(project.name)))
      .slice(0, LINKED_PROJECTS)
    if (found.length === 0) return

    const row = element("div", "chip-mono-row ask-dock-links")
    for (const project of found) {
      const chip = anchor("chip-mono ask-dock-link", project.url, project.name)
      chip.setAttribute(
        "aria-label",
        say("askOpenProject").replace("{n}", project.name),
      )
      row.append(chip)
    }
    turn.append(row)
  }

  // --- Estado del panel ------------------------------------------------------

  const scrollToEnd = (): void => {
    if (answer) answer.scrollTop = answer.scrollHeight
    if (jump) jump.hidden = true
  }

  /**
   * Hay algo en vuelo, y se nota.
   *
   * El botón del renglón cambia de oficio y de nombre accesible, y la caja de
   * respuesta queda `aria-busy`: mientras crece, el nodo vivo está fuera del
   * árbol de accesibilidad y no hay nada que anunciar todavía. Al soltarlo, el
   * texto ya está puesto y se anuncia una vez. Ver la nota de `build`.
   */
  const setBusy = (busy: boolean): void => {
    answer?.setAttribute("aria-busy", busy ? "true" : "false")
    if (!send) return
    send.classList.toggle("ask-dock-send--stop", busy)
    send.setAttribute("aria-label", say(busy ? "askStop" : "askSend"))
    const glyph = send.firstElementChild
    if (glyph) glyph.textContent = busy ? "■" : "→"
  }

  /** Parar es de quien pregunta; irse de la página también aborta, pero calla. */
  const stop = (): void => {
    stopped = true
    inFlight?.abort()
  }

  /** «Nueva» sólo aparece cuando hay conversación que borrar. */
  const showRestart = (): void => {
    if (restart) restart.hidden = turns.length === 0
  }

  /**
   * Empezar de cero.
   *
   * Borra las tres copias de la conversación —la de memoria, la de
   * `sessionStorage` y la pintada—, porque cualquiera que quedara la devolvería:
   * el historial viaja en cada petición, así que una conversación «borrada» a
   * medias es una que el modelo sigue leyendo y quien pregunta ya no ve.
   *
   * Y vuelven las sugerencias, que es lo que hay en un panel sin preguntas.
   */
  const clear = (): void => {
    stop()
    inFlight = null
    generation += 1
    turns.length = 0
    clearTurns()
    foot = null
    stick = true
    answer?.replaceChildren()
    setBusy(false)
    showRestart()
    if (jump) jump.hidden = true
    void showSuggestions(SUGGESTION_COUNT)
    input?.focus()
  }

  /**
   * La salida de un fallo, donde volver a intentarlo puede funcionar.
   *
   * Hasta el 08-10-2026 un corte dejaba el turno muerto: el mensaje decía
   * «vuelve a intentarlo» y para hacerlo había que reescribir la pregunta.
   */
  const offerRetry = (
    kind: AskFailure,
    turn: HTMLElement,
    question: string,
  ): void => {
    if (!RETRIABLE.includes(kind)) return
    const row = element("div", "chip-mono-row ask-dock-again")
    const button = element("button", "chip-mono", say("askRetry"))
    button.type = "button"
    button.addEventListener(
      "click",
      () => {
        row.remove()
        void ask(question)
      },
      { signal },
    )
    row.append(button)
    turn.append(row)
  }

  // --- Preguntar -------------------------------------------------------------

  /** Sólo al acercarse al techo: un contador siempre visible sería un medidor. */
  const noteRemaining = (remaining: number, turn: HTMLElement): void => {
    if (remaining > REMAINING_WARN_AT) return
    const text =
      remaining === 1
        ? say("askRemainingOne")
        : say("askRemaining").replace("{n}", String(remaining))
    turn.append(element("p", "ask-dock-line ask-dock-line--note", text))
  }

  const ask = async (raw: string): Promise<void> => {
    const question = raw.trim()
    if (!question || inFlight || !answer || !input) return

    const mine = (generation += 1)
    stopped = false
    clearSuggestions()

    const turn = element("div", "ask-dock-turn")
    turn.append(element("p", "ask-dock-line ask-dock-line--question", question))
    /**
     * El nodo que crece va fuera del árbol de accesibilidad, y al terminar se
     * **sustituye** por uno nuevo con el texto entero.
     *
     * La caja es una región `aria-live`, y reescribir un mismo nodo con cada
     * trozo hace que un lector de pantalla pueda releer la respuesta completa
     * docenas de veces. Sustituirlo es una adición nueva a la región: se
     * anuncia una vez y queda legible al recorrer la página, que es lo que no
     * conseguía ni dejarlo oculto ni añadir una copia al lado.
     */
    let body = element(
      "p",
      "ask-dock-line ask-dock-line--live",
      say("askThinking"),
    )
    body.setAttribute("aria-hidden", "true")
    turn.append(body)
    answer.append(turn)
    ensureFoot()
    /* Preguntar siempre lleva al final: es lo que acaba de escribir quien
       pregunta, y no hay nada por encima que pueda estar leyendo. */
    stick = true
    scrollToEnd()

    /** Cambia el nodo vivo por uno nuevo, que es lo que se anuncia. */
    const settle = (message: string, failed: boolean): void => {
      const final = element(
        "p",
        failed ? "ask-dock-line ask-dock-line--err" : "ask-dock-line",
        message,
      )
      body.replaceWith(final)
      body = final
    }

    if (question.length > ASK_LIMITS.question) {
      settle(say("askTooLong"), true)
      return
    }

    input.value = ""
    inFlight = new AbortController()
    setBusy(true)
    let received = false

    await askStream(
      {
        url: askUrl,
        locale,
        question,
        history: turns,
        /* Desde dónde se pregunta: en una ficha, «esto» es ese proyecto. El
           endpoint la acepta o la tira entera —ver `pickPath`—. */
        path: window.location.pathname,
        signal: anySignal([signal, inFlight.signal]),
      },
      {
        onText: (_delta, full) => {
          received = true
          body.textContent = full
          if (stick) scrollToEnd()
          else if (jump) jump.hidden = false
        },
        onDone: (full, { truncated }) => {
          settle(full, false)
          turns.push(
            { role: "user", content: question },
            { role: "assistant", content: full },
          )
          /* A `sessionStorage` en cuanto se cierra el turno, y no al cerrar el
             panel: quien navega a otra página a mitad de la tercera respuesta
             tiene que llegar con las dos primeras. */
          writeTurns(turns)
          void offerProjects(full, turn)
          if (truncated) {
            turn.append(element("p", "ask-dock-line", say("askTruncated")))
          }
        },
        onError: (kind) => {
          const message = say(kind)
          /* Con algo escrito el aviso va aparte: lo que llegó vale, sólo que se
             cortó. Sin nada escrito, sustituye al «pensando…», que si no se
             quedaría pensando para siempre. */
          if (received) {
            turn.append(
              element("p", "ask-dock-line ask-dock-line--err", message),
            )
            offerRetry(kind, turn, question)
            return
          }
          settle(message, true)
          offerRetry(kind, turn, question)
        },
        onLimit: (remaining) => noteRemaining(remaining, turn),
      },
    )

    /* Parar y pulsar «Nueva» deja esta llamada resolviéndose sobre una
       conversación que ya no existe: sin esto, su epílogo colgaba el pie de un
       panel recién vaciado y anulaba el controlador del turno siguiente. */
    if (mine !== generation) return

    inFlight = null
    setBusy(false)

    if (stopped) {
      /* Lo que llegó se queda, y sin el cursor: la línea viva lo tiene y una
         respuesta detenida no está llegando. Sin nada escrito no hay nada que
         conservar, y el «pensando…» se iría congelado para siempre. */
      if (received) settle(body.textContent ?? "", false)
      else body.remove()
      turn.append(
        element("p", "ask-dock-line ask-dock-line--note", say("askStopped")),
      )
    }

    // El pie vuelve al final: el turno recién escrito lo ha dejado por encima.
    ensureFoot()
    showRestart()
    /* Dos por dónde seguir, que es lo que se pregunta quien acaba de leer una
       respuesta y no sabe qué más puede preguntar aquí. */
    void showSuggestions(FOLLOW_UP_COUNT)
    if (stick) scrollToEnd()
  }

  // --- Abrir y cerrar --------------------------------------------------------

  /**
   * Reproduce la conversación guardada.
   *
   * Sólo la primera vez que se construye el panel: a partir de ahí los turnos
   * ya están pintados. Sin esto, volver a la portada desde «Sobre mí» abriría
   * un panel en blanco sobre una conversación que sí sigue viajando en cada
   * petición — el modelo tendría contexto que quien pregunta no ve.
   */
  const replay = (): void => {
    if (!answer || turns.length === 0) return
    for (let index = 0; index < turns.length; index += 1) {
      const entry = turns[index]!
      if (entry.role !== "user") continue
      const block = element("div", "ask-dock-turn")
      block.append(
        element("p", "ask-dock-line ask-dock-line--question", entry.content),
      )
      const reply = turns[index + 1]
      if (reply?.role === "assistant") {
        block.append(element("p", "ask-dock-line", reply.content))
      }
      answer.append(block)
    }
    ensureFoot()
  }

  let replayed = false

  const open = (): void => {
    build()
    if (!panel) return
    if (!replayed) {
      replayed = true
      replay()
      void loadActions()
      if (turns.length === 0) void showSuggestions(SUGGESTION_COUNT)
    }
    showRestart()
    trigger.setAttribute("aria-expanded", "true")
    panel.showModal()
    /* Al final de la conversación y no al principio: lo último que se dijo es
       lo que da sentido a la siguiente pregunta. */
    stick = true
    scrollToEnd()
    input?.focus()
  }

  trigger.addEventListener("click", open, { signal })
}
