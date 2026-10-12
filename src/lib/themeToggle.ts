import { pulseGlyph } from "./glyph"

const FALLBACK_DURATION = 180

type Theme = "dark" | "light"
type ViewTransition = ReturnType<NonNullable<Document["startViewTransition"]>>

/**
 * Sitúa el centro del revelado en el botón, en porcentajes.
 *
 * En píxeles no vale: Chrome Android resuelve la `clip-path` del pseudoelemento
 * de la transición en píxeles de dispositivo, así que con un dpr de 4 el círculo
 * salía a un cuarto de tamaño y pegado a la esquina contraria —medido en un
 * CPH2653: `circle(139.8px at 317px 37.4px)` se dibujaba centrado en (79, 9)—.
 * Lo que se veía era un asomo de animación y el tema entero apareciendo de golpe
 * al retirarse el pseudoelemento. Los porcentajes resuelven contra la caja del
 * pseudo y son inmunes al dpr. El radio va fijo en el CSS.
 */
function setRevealGeometry(button: HTMLButtonElement): void {
  const root = document.documentElement
  const { left, top, width, height } = button.getBoundingClientRect()
  const x = ((left + width / 2) / root.clientWidth) * 100
  const y = ((top + height / 2) / root.clientHeight) * 100

  root.style.setProperty("--theme-reveal-x", `${x}%`)
  root.style.setProperty("--theme-reveal-y", `${y}%`)
}

/** Monta el cambio de tema, seguro también en navegadores móviles. */
export function mountThemeToggle(signal: AbortSignal): void {
  const button = document.querySelector<HTMLButtonElement>(
    "[data-theme-toggle]",
  )
  if (!button || typeof window.theme === "undefined" || signal.aborted) return

  const root = document.documentElement
  const startViewTransition = document.startViewTransition?.bind(document)
  let activeTransition: ViewTransition | undefined
  let fallbackAnimation: Animation | undefined
  let mounted = true

  const syncButtonState = (): void => {
    const isDark = root.dataset.theme === "dark"
    const actionLabel = isDark
      ? button.dataset.labelLight
      : button.dataset.labelDark

    button.setAttribute("aria-pressed", String(isDark))
    if (actionLabel) {
      button.setAttribute("aria-label", actionLabel)
      button.setAttribute("title", actionLabel)
    }
  }

  const fadeInDocument = async (): Promise<void> => {
    if (!mounted || signal.aborted) return
    fallbackAnimation = root.animate(
      { opacity: [0.72, 1] },
      { duration: FALLBACK_DURATION, easing: "ease-out" },
    )
    try {
      await fallbackAnimation.finished
    } catch {
      // Cancelar una animación al desmontar rechaza `finished` por diseño.
    } finally {
      fallbackAnimation = undefined
    }
  }

  const changeTheme = async (): Promise<void> => {
    if (button.disabled || signal.aborted) return

    const nextTheme: Theme = root.dataset.theme === "dark" ? "light" : "dark"
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    let themeApplied = false
    const updateTheme = (): void => {
      if (themeApplied || !mounted || signal.aborted) return
      themeApplied = true
      window.theme.setTheme(nextTheme)
    }

    button.disabled = true

    try {
      if (reduceMotion) {
        updateTheme()
        syncButtonState()
        return
      }

      if (typeof startViewTransition !== "function") {
        updateTheme()
        await fadeInDocument()
        return
      }

      setRevealGeometry(button)
      root.classList.add("theme-transitioning")

      try {
        const transition = startViewTransition(updateTheme)
        activeTransition = transition

        try {
          await transition.ready
        } catch {
          updateTheme()
          await fadeInDocument()
          return
        }

        await transition.finished
      } catch {
        updateTheme()
        await fadeInDocument()
      }
    } finally {
      activeTransition = undefined
      root.classList.remove("theme-transitioning")
      /**
       * Y la tira Glyph acusa el cambio, ya terminado el revelado.
       *
       * Fuera del callback de `startViewTransition`, y por dos motivos. El
       * primero es que ahí no se vería: mientras dura la transición el documento
       * está tapado por las instantáneas, así que una animación que arranque
       * dentro se pierde entera. El segundo es que `pulseGlyph` fuerza un
       * reflujo —`void offsetWidth`, que es lo que reinicia la animación— y
       * hacerlo mientras el navegador toma las capturas dejaba `finished` sin
       * resolver en WebKit: el botón se quedaba deshabilitado para siempre.
       *
       * `themeApplied` es la guardia: si el gesto se abortó a mitad, no hay nada
       * que acusar. Y va aquí y no en un oyente de `theme-changed` porque ese
       * evento lo dispara también el arranque de la página y cada cambio de la
       * preferencia del sistema.
       */
      if (themeApplied) pulseGlyph("pulse")
      syncButtonState()
      button.disabled = false
    }
  }

  const handleClick = (): void => {
    void changeTheme()
  }

  const handleThemeChanged = (): void => syncButtonState()
  button.addEventListener("click", handleClick, { signal })
  document.addEventListener("theme-changed", handleThemeChanged, { signal })
  signal.addEventListener(
    "abort",
    () => {
      mounted = false
      try {
        activeTransition?.skipTransition()
      } catch {
        // El navegador puede haber terminado la transición en el mismo frame.
      }
      fallbackAnimation?.cancel()
      activeTransition = undefined
      fallbackAnimation = undefined
      root.classList.remove("theme-transitioning")
      button.disabled = false
    },
    { once: true },
  )

  syncButtonState()
}
