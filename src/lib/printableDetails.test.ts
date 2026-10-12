// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mountPrintableDetails } from "./printableDetails"

/** Dos empleos plegados y uno que el visitante dejó abierto. */
function renderExperience(): void {
  document.body.innerHTML = `
    <details class="job-details"><summary>Uno</summary><p>a</p></details>
    <details class="job-details" open><summary>Dos</summary><p>b</p></details>
    <details class="job-details"><summary>Tres</summary><p>c</p></details>
  `
}

const openState = (): boolean[] =>
  Array.from(
    document.querySelectorAll<HTMLDetailsElement>("details.job-details"),
  ).map((details) => details.open)

const print = (event: "beforeprint" | "afterprint"): void => {
  window.dispatchEvent(new Event(event))
}

describe("mountPrintableDetails", () => {
  let controller: AbortController

  beforeEach(() => {
    renderExperience()
    controller = new AbortController()
    mountPrintableDetails(controller.signal)
  })

  /* Las escuchas van en `window`, que sobrevive al caso: sin esto el montaje de
     cada prueba se sumaría al de las anteriores. */
  afterEach(() => controller.abort())

  it("abre lo plegado para imprimir y lo devuelve a su sitio después", () => {
    expect(openState()).toEqual([false, true, false])

    print("beforeprint")
    expect(openState()).toEqual([true, true, true])

    print("afterprint")
    expect(openState()).toEqual([false, true, false])
  })

  it("no pierde el estado si `beforeprint` llega dos veces seguidas", () => {
    print("beforeprint")
    /* Reabrir la vista previa vuelve a disparar `beforeprint` sin que haya
       pasado un `afterprint`: para entonces está todo abierto. */
    print("beforeprint")
    expect(openState()).toEqual([true, true, true])

    print("afterprint")
    expect(openState()).toEqual([false, true, false])
  })

  it("devuelve los desplegables a su sitio al desmontar", () => {
    print("beforeprint")
    expect(openState()).toEqual([true, true, true])

    controller.abort()
    expect(openState()).toEqual([false, true, false])
  })

  it("deja de escuchar tras el aborto", () => {
    controller.abort()

    print("beforeprint")
    expect(openState()).toEqual([false, true, false])
  })
})
