---
name: motion-animations
description: Animation patterns for this portfolio, with no animation library. Use when adding, changing, or reviewing any animation, transition, hover effect, or scroll-driven reveal in this Astro site. Covers the CSS-first decision rule, the house spring token, the Web Animations API helper, the strict-CSP limits, native page transitions, and mounting with onPageLoad.
---

# Animación en este portfolio

Guía específica de este repositorio. La regla que resume todo: **CSS primero, y
la Web Animations API del navegador sólo donde CSS no llega. Sin librerías.**

Hasta el 02-10-2026 el proyecto usaba `motion/mini`. Hacía dos cosas: convertir
un muelle a una curva `linear()` y llamar a `element.animate()`. La primera se
hizo una vez y quedó como token; la segunda ya la hace el navegador. No vuelvas
a añadir una librería de animación.

## 1. Decide antes de escribir código

| Necesidad                                | Herramienta                        | Por qué                                                                              |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Hover, foco, cambio de estado            | `transition` en CSS                | Cero JS. Es lo que usa todo el sitio.                                                |
| Un muelle en un cambio de estado         | `transition` con `--ease-spring`   | El muelle es una curva `linear()`; ver el punto 2.                                   |
| Revelar al bajar por la página           | `animation-timeline: view()`       | Ya está en `Layout.astro` para `#web-view > section`. Ligado al scroll real, sin JS. |
| Cambio de tema                           | View Transitions                   | Ya está en `ThemeToggle.astro`.                                                      |
| Escalonar la entrada de varios elementos | `revealSequence` (`animations.ts`) | CSS no sabe orquestar N elementos con retardo creciente sin saber cuántos son.       |

**No añadas un `IntersectionObserver` para revelar contenido.** Se probó en
Experiencia y Educación y el contenido se fundía dos veces: la sección llega a
`opacity: 1` por el CSS y sólo entonces empieza la entrada de la tarjeta.
Medido a 1400×800, el segundo fundido iba de `scrollY` 1000 a 1800.

## 2. El muelle de la casa es un token

`--ease-spring` y `--spring-duration` viven en el `:root` de `Layout.astro`:
rigidez 260, amortiguamiento 28, muestreado en 25 puntos de `linear()`, 0,55 s,
un 0,4 % de rebote que no se ve. Una sola fuente para el CSS y para el JS:

```css
.dot {
  /* Propiedades sueltas: sin `linear()`, cae la curva y no la transición. */
  transition-duration: 200ms, var(--spring-duration);
  transition-property: background-color, width;
  transition-timing-function: ease, var(--ease-spring);
}
```

`animations.ts` lee los dos tokens con `getComputedStyle` y comprueba la curva
con `CSS.supports`: `element.animate()` lanzaría con un `linear()` que no
entienda. **Lee los tiempos con `toMilliseconds`, no con `parseFloat`**: el
minificador reescribe `550ms` como `.55s`, y leído sin unidad la entrada duraba
medio milisegundo.

Para otro muelle, genera la curva con la fórmula del oscilador amortiguado y
muestréala hasta que quede a una milésima del reposo; no la escribas a ojo.

## 3. La CSP manda

`astro.config.mjs` emite `style-src 'self' 'sha256-…'` sin `'unsafe-inline'`.
Consecuencias que ya han mordido:

- ✅ **`element.animate()` es compatible**: no escribe en el atributo `style`
  ni inyecta hojas. Tampoco `element.style.prop = …` (CSSOM).
- ❌ **Nada de `style=` en el marcado.** Los colores por elemento van con
  reglas literales y selectores de atributo — ver el mapa `li[data-tech="…"]`
  de `Skills.astro`.
- ❌ **Nada de directivas `transition:*` de Astro** (`transition:animate`,
  `transition:persist`). Hacen que Astro emita un `<style>` _después_ de
  calcular los hash, así que el navegador lo bloquea; y en cuanto existe un
  ámbito de transición, `<ClientRouter />` inyecta otro `<style>` en cada
  navegación que también cae.
- ❌ **Nada de `<script is:inline>` en un componente.** Astro no calcula el
  hash de ningún `is:inline`. Los del `<head>` de `Layout.astro` corren sólo
  porque van delante del `<meta>` de la CSP, que no se aplica a lo que lo
  precede; uno en el cuerpo queda detrás, y bloqueado. Un `<script>` sin
  `is:inline` lo procesa Astro, sale como módulo externo y lo cubre `'self'`.

`scripts/check-build.mjs` recalcula el hash de cada `<style>` y de cada guion
en línea que la política gobierna, y falla el build si no está declarado en su
directiva. Si lo ves fallar, es esto.

## 4. Se monta con `onPageLoad`, y entre páginas anima el navegador

Desde el 02-10-2026 no hay `<ClientRouter />`: cada navegación es una carga
normal y los módulos corren otra vez solos. `onPageLoad` monta una vez por
documento y da un `AbortSignal` para que el montaje se pueda soltar:

```ts
import { onPageLoad } from "@/lib/pageLifecycle"
import { revealSequence } from "@/lib/animations"

onPageLoad((signal) => {
  revealSequence([...document.querySelectorAll(".algo")]) // se calla sola con movimiento reducido

  // Cualquier listener de window/document va con { signal }.
  window.addEventListener("resize", update, { signal })
  // Y cualquier observador, con su desconexión.
  signal.addEventListener("abort", () => observer.disconnect())
})
```

**El fundido entre páginas es CSS:** `@view-transition { navigation: auto; }`
en `Layout.astro`, dentro de `prefers-reduced-motion: no-preference`. Chrome,
Edge y Safari 18.2+ funden; Firefox navega sin fundido. En una transición
entre documentos las capas `::view-transition-*` las pinta la página **nueva**:
cualquier marca que deba condicionarlas (como `data-signal="locale"` del cambio
de idioma) tiene que llegar a ella, por ejemplo en `sessionStorage` y recogida
por un guion en línea del `<head>` antes del primer pintado.

**Lo que dura más que una página va en almacenamiento**, nunca en memoria del
módulo: acento y encendido de la pestaña, conversación del asistente, lo ya
contado por `hits.ts`. Un `Set` o una variable de módulo mueren con cada
navegación.

## 5. `prefers-reduced-motion` no es opcional

Se comprueba **dentro** de cada animación con `prefersReducedMotion()`, no una
vez al cargar el módulo: la preferencia puede cambiar con la página abierta. En
CSS, la animación se declara dentro de
`@media (prefers-reduced-motion: no-preference)`.

Y no se degrada a «lo mismo pero más rápido»: **no se anima nada**. Importa
especialmente cuando el primer fotograma es `opacity: 0` — nunca pongas ese
estado inicial en el CSS, porque si el JS no llega a ejecutarse el contenido
queda invisible para siempre. Que lo ponga la animación (`fill: "backwards"`)
justo antes de empezar.

## 6. Lo que ya está montado

| Dónde               | Qué                                                                | Cómo                                                                                |
| ------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `PortfolioRuntime`  | Entrada escalonada de ubicación, situación, CTA y puertos del hero | `revealSequence`: fundido de 550 ms, 40 ms entre uno y otro                         |
| `SectionNav.astro`  | El punto activo se estira de 8 a 20 px                             | `transition` con `--ease-spring`; el guion sólo cambia `aria-current`               |
| `ThemeToggle.astro` | El revelado circular del tema sobre `::view-transition-new(root)`  | View Transition en CSS, con su propia curva `linear()` y alternativa en `@supports` |

Deliberadamente **en CSS**: el `translateY(-2px)` de las tarjetas de proyecto,
la apertura de los diálogos, la llegada de la píldora del asistente, el halo de
los chips de año y el color de marca de las habilidades. Todos son transiciones
de estado de un solo elemento, que es exactamente lo que CSS hace mejor y gratis.
