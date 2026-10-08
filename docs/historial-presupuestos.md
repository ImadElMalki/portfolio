# Historial de los presupuestos de la salida

Diario de mediciones que vivía como comentarios en `scripts/check-build.mjs`, junto a cada constante, hasta el 30-09-2026. Se trasladó tal cual al centralizar los techos en `scripts/budgets.mjs` (MAINT-03, TEST-05 de `AUDIT-2026-09-30.md`): los techos vigentes y su porqué están allí; aquí queda cómo se llegó a ellos.

Las cifras son de su fecha. Mientras `inlineStylesheets` valía `"always"` el CSS viajaba dentro del HTML, así que muchas medidas de HTML incluyen la hoja entera. Valió `"never"` del 31-08 al 01-10-2026 y desde entonces vuelve a `"always"`: los techos de ese día y su medida están en `scripts/budgets.mjs`.

## Principio

Presupuestos de la salida. Cada uno lleva su medida y la fecha de la medida:
sin eso no hay forma de saber si el margen que queda es el que se quiso dejar.

### Dos clases de presupuesto, y conviene no confundirlas

`HTML` y `DOM` crecen con el número de proyectos, no con el de capturas: cada
proyecto pone 87 elementos y 11,2 KB entre su tarjeta, su diálogo y su
lightbox, mientras que una captura de más son 5 elementos y 1,2 KB. Son
**disparadores de revisión**: el margen se deja por debajo de esos 87 y esos
11,2 KB para que el aviso salte con el proyecto siguiente y no dentro de tres.

`JS` y `CSS` no son eso. Son techos de lo que descarga el visitante, y ahí un
margen de metros cuadrados no informa de nada — pero uno de catorce bytes
tampoco. En la auditoría del 18-08-2026 el presupuesto de JS estaba a **14
bytes** del límite: cualquier retoque en un script de cliente ponía el CI en
rojo por presupuesto y no por regresión, que es justo dejar de distinguir
señal de ruido. Un `mountPrintableDetails` idempotente —quince bytes— bastó
para pasarse. Estos dos van con ~1 KB y ~2,5 KB de aire respectivamente:
suficiente para un arreglo, insuficiente para una librería nueva.

## HTML de la portada (`HTML_BUDGET_BYTES`, 220 KiB)

Último valor: `220 * 1024`

---

Subió de 222 000 el 18-08-2026 por lo mismo que el CSS: el HTML lleva la hoja
incrustada, y ahí entran los `@font-face` de los cinco pesos estáticos de
Inter, los dos de la mono y la paleta de la hoja impresa.

---

Los cuatro números subieron el 18-08-2026 con la vista consola y el pie del
sitio. Lo que costó cada cosa, medido:

- **JS**: +6,2 KB comprimidos (13 313 → 19 556). Es el intérprete y el
  terminal. El CV **no** entra ahí: se descarga de `/cv.json` al abrir la
  vista, así que no pesa ni en el JS ni en el HTML.
- **CSS**: +4,8 KB (61 731 → 66 527), que se pagan tres veces porque la hoja
  va incrustada en cada idioma.
- **HTML y DOM**: +6,7 KB y +22 elementos. El panel de la consola es una
  cáscara —registro, indicador y campo—; el resto es el pie y el sexto
  control de la barra.

Ojo con el JS: durante el desarrollo llegó a marcar 50 918 bytes. No era el
REPL, era que `t()` colgaba de `cvSchema` (zod, ~30 KB) y de `astro:i18n` a
través de `sections.ts`. Se arregló partiendo el diccionario en `lib/ui.ts` y
los códigos de idioma en `lib/locales.ts`. Si este número se dispara de golpe,
mirar primero qué módulo de servidor se ha colado en el paquete de cliente
—`grep -c zod dist/_astro/PortfolioRuntime*.js` lo canta— antes de subir el
techo.

---

Los cuatro números volvieron a subir el 19-08-2026 con la capa tipográfica de
puntos y el cierre de contacto. Lo que costó cada cosa, medido:

- **HTML y DOM**: +8,3 KB y +20 elementos, casi todo el formulario de
  contacto —tres campos con su etiqueta, la trampa antispam, el botón, la
  región viva y el enlace de respaldo— más sus doce `data-*` de textos
  traducidos, que es como llegan los mensajes de estado al guion sin pagar
  otro diccionario en el paquete de cliente.
- **CSS**: +4,4 KB. El formulario pone ~1,6; el resto es el `@font-face` de
  Doto, los tokens de etiqueta y rejilla de puntos, y las dos densidades de
  `Section`. Se recuperaron ~0,5 KB quitando del banner de servicios el halo
  que respiraba y el filete cónico, que eran dos animaciones perpetuas. (El
  halo volvió el 23-08-2026 con el ciclo a 7 s; el filete cónico no.)
- **JS**: +0,6 KB comprimidos. `contactForm.ts` es sólo el cableado: la
  validación y el `mailto:` salen de `lib/contact.ts`, que ya viajaba en el
  paquete porque los usa la consola.

El aire se mantiene donde estaba: ~4 KB y ~28 elementos para los dos
disparadores de revisión —por debajo de los 11,2 KB y los 87 elementos que
cuesta un proyecto nuevo—, y ~2,5 KB y ~1 KB para los dos techos de descarga.

---

Subió de 241 000 el 19-08-2026 con el rediseño de la portada: los apellidos
en matriz de puntos, el medidor de idiomas, el contacto de un solo campo, el
canal de WhatsApp y el vocabulario de pérdida de señal. De los 5,4 KB
nuevos, 3,6 son CSS —que se cuenta aparte, más abajo— y 1,8 son marcado.

El medidor de idiomas se dibuja con un degradado repetido y no con seis
elementos por fila justo por esto: la primera versión eran treinta nodos y
750 bytes por página que el techo del DOM cazó antes de llegar a rama.

---

Y otros 2,6 KB el 20-08-2026 con la segunda tanda del rediseño: la insignia
de estado con medidor, el chip de fechas como escala, el pie como fila de
metadatos y la trama de la consola. 1,7 son CSS —abajo—; el resto, marcado.

El rótulo de la paleta del pie lo escribe el guion que la sortea, en
`--accent-name`: la alternativa eran diez reglas `:root[data-accent="…"]`,
1,1 KB entre las tres páginas para decir lo que ese guion ya sabía.

---

El DOM sube a 1 482 el 20-08-2026 con el yaz (ⵣ) del icono `Yaz.astro`, que
sale tres veces por página: junto al nombre, en el pie y en el prompt de la
consola. Son seis elementos —un `<svg>` y un `<path>` cada uno— y ni un byte
de más en el techo del HTML, que sigue con 750 de aire.

Seis y no setenta y cinco porque los veinticinco puntos de la retícula van
como un trazo discontinuo (`stroke-dasharray="0 4"` con cabo redondo) y no
como veinticinco `<circle>`. La primera versión sí los ponía uno a uno y este
techo la cazó antes de llegar a rama, igual que había cazado el medidor de
idiomas.

---

Sube a 248 500 el 20-08-2026: 1,2 de los 1,3 KB nuevos son el CSS de la tanda
«Nothing» —desglose en el techo del CSS, más abajo—, que viaja incrustado en
las tres páginas. De marcado sólo entra el yaz del hero, del pie y de la
consola.

---

Los dos techos suben el 20-08-2026 con la sección «Certificaciones»: diez
filas de dos columnas —`<li>` más dos `<span>`— con su lista y su encabezado
son 54 elementos, y en bytes el bloque se paga cuatro veces por página: el
marcado, el Markdown incrustado de la vista de texto, el `hasCredential` del
JSON-LD y el enlace del índice lateral. De ahí que 54 elementos salgan casi 6
KB.

Contenido nuevo, no grasa: las filas no llevan ni tarjeta ni icono, y el aire
que queda bajo el techo es el de siempre —cosa de 1 KB— para que la próxima
tanda que se pase siga cazándose aquí.

---

Los dos techos suben el 20-08-2026 con la segunda tanda «Nothing». Los 49
elementos del DOM van contados:

- 16 corchetes, dos por cada una de las ocho secciones con título.
- 5 el desplegable de certificaciones: `<details>`, `<summary>`, su chevrón
  con el `<path>` y la segunda `<ul>`.
- 14 los medidores de uso de Habilidades, uno por tecnología que aparece en
  algún proyecto. Las otras seis no llevan medidor a propósito: un medidor a
  cero no es «cero», es «no hay dato».
- 4 el conmutador de monocromo con su icono. (Se fue el 23-08-2026.)
- 1 la tira Glyph de la barra.
- Los 9 restantes son el desglose del formulario de contacto al salir a su
  propio componente, que reparte el mismo marcado en un nodo más por bloque.

De los 4,5 KB de HTML buena parte es en realidad CSS: la hoja va incrustada
en cada página, así que el techo de más abajo y éste miden en parte lo mismo.

Nada de esto es contenido nuevo, es interfaz, y por eso el aire que queda
debajo sigue siendo el de siempre —1 KB y seis elementos— para que la próxima
tanda vuelva a cazarse aquí.

---

Y otra vez el 20-08-2026, con la tercera tanda «Nothing». Los 13 elementos:
la matrícula del hero (+1), el rótulo de la barra con su hueco de sección
(+2), y los **dos cursos de DevTalles**, que son diez elementos y no seis
porque cada certificado se paga dos veces en la misma página — una en la fila
de la web y otra en el Markdown incrustado de la vista de texto—.

El resto de la tanda no añade un solo nodo: los corchetes del banner, su tira
Glyph, el piloto del ojo, los pilotos de los chips, el chaflán y las líneas de
barrido del hero son todo pseudoelementos y capas de fondo.

---

Y otra vez el 23-08-2026, con la cuarta tanda «Nothing». Los ~2,4 KB de HTML
son en realidad CSS —la hoja va incrustada— más el `@font-face` de Space
Grotesk, la tipografía del nombre del hero. Lo que ocupa, medido:

- ~0,9 KB las escuadras de instrumento de las tarjetas de proyecto: ocho
  capas de fondo con sus posiciones y sus tamaños, la receta del banner de
  servicios repetida en `Projects.astro`.
- ~0,5 KB la capa de arranque de la tira Glyph con sus dos juegos de
  fotogramas —el encendido en cadena y el espectáculo del pie—.
- ~0,4 KB el interruptor de raíl y perilla del tema, que sustituye al
  intercambio de sol y luna.
- ~0,3 KB los pilotos de las celdas de la barra y el reloj del rótulo.
- ~0,3 KB el barrido de columnas del titular y la respiración del halo del
  banner.
- El anillo de idiomas y los chips de contacto sólo-icono **restan**: los dos
  cambian reglas que ya existían por otras más cortas.

En contra van el botón de imprimir y el conmutador de monocromo enteros, con
sus dos bloques de tokens, sus dos claves i18n por idioma y sus dos iconos. No
llegan a compensarlo.

El DOM sube 3 y no más porque casi todo esto son pseudoelementos y capas de
fondo: los únicos nodos nuevos son el hueco del reloj, el botón del punto y
coma del pie con su SVG… y a cambio se van los dos controles de la barra.

---

Sube el 23-08-2026 al publicar «Sobre mí»: cada portada incorpora el enlace
textual de la barra y el CTA bajo el resumen, además del CSS compartido de
ambos. Medida más alta: 270 365 bytes; queda menos de lo que cuesta una
tarjeta de proyecto para que ese cambio siga disparando una revisión.

---

Suben los dos el 24-08-2026 con la tanda de «el aparato responde»: la paleta
de comandos (Ctrl+K) pone un `<dialog>` con su campo, su lista y su pie —y su
hoja de estilo, que es de donde salen la mayoría de los bytes—, y el resto se
reparte entre el contador de secciones de la barra, el hueco de la secuencia
de arranque, el acuse del portapapeles del hero y la fila de instrumentos del
pie.

Medida más alta: 282 738 bytes (`index.html`) y 1 610 elementos. Se dejan
~1,8 KB y 10 elementos, otra vez por debajo de lo que cuesta un proyecto —87
elementos y 11,2 KB—, para que la siguiente tarjeta siga disparando la
revisión y no lo haga antes un retoque.

---

Y otra vez el 24-08-2026 con cinco certificados nuevos —Git, Claude Code y los
tres de midu.dev—. Son 15 elementos: cinco filas de tres nodos dentro del
pliegue, sin marcado propio ni CSS nuevo. En bytes cuestan más de lo que
parece porque cada certificado se paga cuatro veces por página: la fila, el
Markdown incrustado de la vista de texto, su `hasCredential` en el JSON-LD y
nada más —el índice lateral ya tenía su enlace—.

Medida más alta: 285 650 bytes (`index.html`) y 1 635 elementos. Se mantiene
el aire de la tanda anterior: ~1 KB y 10 elementos.

---

Y una tercera vez el 24-08-2026, con la capa modal unificada. El DOM no se
mueve —todo son pseudoelementos, y el aviso de «sin resultados» de la paleta
pasó a construirse en el cliente—, así que estos bytes son enteramente la
hoja incrustada de arriba: el techo de HTML sube lo mismo que el de CSS.

Medida más alta: 286 962 bytes (`index.html`) y 1 635 elementos, los mismos
de antes.

---

Y con los controles de la cabecera del diálogo: su hoja de estilo —global,
porque los botones los crea el guion— y los dos rótulos traducidos que la
lista lleva en `data-*` para que el cliente no tenga que traducir. El DOM
sigue clavado en 1 635: los catorce botones no están en el HTML.

Medida más alta: 288 119 bytes (`index.html`).

---

Sube el 25-08-2026 con los proyectos en el JSON-LD: siete nodos
`SoftwareSourceCode` colgando de la misma `Person`, cada uno con su nombre,
su descripción corta y su stack. Son ~370 bytes por proyecto y se pagan en
las tres portadas, porque el grafo va incrustado en cada una.

Es de lo poco que se paga en bytes y **no** se ve: no hay ni un píxel nuevo.
Se acepta porque es justo lo que convierte siete párrafos de texto en siete
cosas con autor y tecnologías para quien indexa, que es de lo que iba el
cambio. Si algún día aprieta, el recorte obvio es `description` —unos 840
bytes por página— que duplica lo que ya se lee en la tarjeta.

El DOM no se mueve: todo va dentro del `<script>` que ya existía.

Medida más alta: 291 831 bytes (`index.html`).

---

Sube el 25-08-2026 con la vista rápida, la cuarta del conmutador. Es lo que
cuesta una vista entera, y está repartido de forma deliberada:

- **CSS ~1,7 KB**: la ficha de estado, los chips medidos, la trayectoria y
  los tres proyectos. Va en la hoja global porque el contenido lo construye
  `briefView.ts`; los rótulos reutilizan `.label-mono` en vez de repetir su
  receta, que es de donde salieron ~600 bytes de vuelta.
- **HTML ~4 KB**: casi todo es esa hoja, que va incrustada. De marcado propio
  sólo hay la cáscara con sus `data-*` y el botón de la barra.
- **DOM +5**: la sección, su hueco y el conmutador con su icono. El contenido
  —unos ochenta nodos— no está aquí: se construye en el navegador desde
  `/cv.json`, que es justo la decisión que evita pagar una cuarta copia del
  currículum en cada una de las tres portadas.

Medidas más altas: 297 080 bytes, 103 483 de CSS y 1 650 elementos.

---

Suben el 25-08-2026 con la tira de empleos anteriores a programar, al pie de
Experiencia. Seis empleos de 2015-2020 —almacén, cocina, atención al cliente—
que la página no tenía en ninguna parte. Lo que costó cada cosa:

- **DOM +16**: la tira entera. Es una fila de dos nodos por empleo dentro de
  un `<details>`, no una ficha de las de arriba: seis fichas completas
  habrían sido ~130 elementos, y pagados dos veces —el panel Markdown se
  interpreta a HTML real en el mismo documento—. Ahí la lista es un `####`
  con seis viñetas.
- **HTML ~2,4 KB**: la mitad es la hoja incrustada de abajo; el resto, el
  marcado de las seis filas en los dos paneles.
- **CSS ~1,9 KB**: las filas con filete, su versión a dos columnas al
  imprimir, y los dos rellenos animados al pasar el puntero —las barras de
  Habilidades y el anillo de Idiomas, con su `@property`—. Sale caro para lo
  que se lee en el archivo porque Astro acota cada selector con su
  `:where([data-astro-cid-…])`, que se paga por regla y no por declaración.

Medidas más altas: 299 525 bytes, 105 425 de CSS y 1 666 elementos.

---

Suben otra vez el 25-08-2026 con el resto del CV de InfoJobs: el Bachillerato
en Educación, el renglón de habilidades que cierra el pliegue de Experiencia,
la provincia en la ubicación y el párrafo de los años previos en Sobre mí.

- **DOM +18**: catorce son el estudio nuevo —la ficha en la web y sus tres
  bloques en el panel Markdown, que se interpreta a HTML real en el mismo
  documento— y el resto, el párrafo de habilidades en los dos paneles.
- **HTML ~1,8 KB**: marcado de lo anterior en las tres portadas. El bloque de
  movilidad de la vista rápida no cuenta aquí: son doce palabras en un
  `data-*` y su DOM lo construye el navegador.

Medidas más altas: 301 348 bytes y 1 684 elementos.

---

Y una vez más el 25-08-2026, con la tira previa corregida contra los CV
viejos: dos empleos más, el país en los cuatro
que fueron en los Países Bajos y el nombre de la empresa convertido en enlace
donde hay web, que son seis de los ocho.

- **DOM +12**: las dos filas nuevas y los seis `<a>`, menos lo que devuelve
  el panel Markdown, donde el enlace ya era parte del texto.
- **HTML ~1,4 KB**: las URLs se pagan dos veces por portada —marcado y panel
  Markdown— y las tres portadas las llevan enteras.

El pliegue sigue contando aunque nazca escondido: `display: none` no quita
nodos del documento, y era justo la idea —el marcado viaja para Googlebot,
como el enlace de «Sobre mí»—.

Medidas más altas: 303 874 bytes y 1 706 elementos.

---

Sube el 25-08-2026 con los enlaces de los cursos: siete de los diecisiete
certificados tienen ficha pública —cuatro de DevTalles y tres de midu.dev— y
el nombre pasa a enlazarla. Los otros diez son formación interna y se quedan
en texto.

Son ~1,9 KB por portada y el DOM no se mueve ni un nodo: `<span class="name">`
pasa a `<a class="name">`, que es el mismo elemento con `href`, `target`,
`rel` y `title`. Se paga dos veces porque las siete URLs viajan también en el
panel Markdown, que va incrustado en el documento, y una tercera —más corta—
en el JSON-LD.

Medidas más altas: 305 805 bytes.

---

Y suben con la vista rápida rehecha. Lo que enseñaba estaba mal —ordenaba las
tecnologías por en cuántos proyectos aparecían, así que Angular, Java y Spring
Boot se quedaban fuera de «lo que más usa» y arriba salían las de los
proyectos de casa— y lo que no enseñaba era la mitad del currículum: ni la
frase de la portada, ni los idiomas, ni la formación, ni el resumen de cada
empleo, ni una sola cifra.

El reparto:

- **CSS ~3,1 KB**: la cabecera con su retrato y sus cuatro cifras, los
  bloques de idiomas y formación, la fila de acciones, el recorte a dos
  líneas de los resúmenes, la variante apilada por debajo de 560 px y el
  estado de error. Es el grueso, y va en la hoja global por lo de siempre:
  el contenido lo construye `briefView.ts` y el CSS acotado de Astro no llega
  a lo que no ha emitido el servidor.
- **HTML ~480 bytes** además de esa hoja: el `<img>` del retrato con sus tres
  densidades y los `data-*` nuevos —`tagline`, la ruta del PDF y los rótulos—.
  El retrato va con los mismos parámetros que el del hero a propósito, así que
  `astro:assets` sirve los ficheros que ya existían y aquí sólo se paga el
  marcado.
- **DOM +3**: la cabecera, el retrato y el hueco donde el guion escribe la
  identidad. El contenido —cerca de cien nodos— sigue sin viajar: se
  construye en el navegador desde `/cv.json`, que es la decisión que evita
  pagar una cuarta copia del currículum en cada una de las tres portadas.

Medidas más altas: 309 394 bytes, 108 532 de CSS y 1 717 elementos.

---

Y suben otra vez con la segunda pasada de la vista rápida, que es de acabado:
iconos en el contacto, color de estado en los proyectos, aire entre fichas,
rótulos en el acento, dos botones con pesos distintos y la ficha del proyecto
a un clic.

Casi todo el salto son **los dos botones**, que pasan a marcado:

- **DOM +11**: la fila, el enlace del PDF con su icono de tres trazos, el
  botón de salida y su flecha. Están en la cáscara y no en el guion porque
  los iconos son componentes `.astro` y no existen en el navegador; un botón
  construido con `createElement` se quedaría en texto pelado.
- **HTML ~1 KB** de marcado además de la hoja: esos dos botones en las tres
  portadas, menos los dos rótulos que salen de `data-labels` al no
  construirse ya en JS.
- **CSS ~770 bytes**: el mapa de `--status` sobre `.brief-project`, la capa
  estirada que abre el diálogo, los dos pesos de botón, los números de
  espaciado y el orden de móvil.

Lo que **no** se paga es lo que más se ve: los cuatro iconos de contacto son
un `cloneNode` de la fila del hero, que ya está en el documento. Ni un byte de
marcado ni una regla de CSS —los nodos clonados conservan el
`data-astro-cid-*`, que es por donde va el CSS acotado de Astro—.

Medidas más altas: 311 141 bytes, 109 303 de CSS y 1 728 elementos.

---

Y suben con el historial laboral cotejado contra la vida laboral de la TGSS:
una ficha de empleo más arriba —la primera etapa en Viewnext, que faltaba— y
cuatro filas más en el plegable de trabajos anteriores.

- **HTML ~4,4 KB**, el doble de lo que ocupa el texto: cada empleo viaja dos
  veces por página, una en la sección y otra en la vista Markdown que
  `MarkdownView.astro` deja escrita al lado.
- **DOM +53**: la ficha nueva —cabecera, chip de fechas y resumen; va sin
  destacados a propósito, porque de aquellos siete meses no hay nada que
  contar que no sea el plan formativo— y tres nodos por fila del plegable:
  el puesto, el enlace y su renglón de metadatos.
- **CSS 0**: ni una regla nueva. Las dos plantillas ya existían y lo único
  que cambia es cuántas veces se repiten.

Medidas más altas: 315 529 bytes y 1 781 elementos.

---

Y se mueven en direcciones contrarias con la trayectoria simplificada y los
logos: se fusionan las dos fichas de Viewnext en una y entran trece `<img>`.

- **DOM −11**: la ficha que se va son ~24 nodos —cabecera, enlace, chip de
  fechas, resumen— y los trece logos suman trece. El único caso hasta ahora
  en que añadir algo visible deja menos DOM del que había.
- **HTML +2,1 KB**: cada `<Image>` escribe su `srcset` de dos densidades, y
  eso pesa más que el `<img>` en sí. Descuenta lo que devuelve la ficha
  fusionada, que viajaba dos veces por página —sección y vista Markdown—.
- **CSS +1,0 KB**: `.company-logo` con su gris, su hover y el patrón de tres
  estados del tema oscuro; ver el desglose en el techo de CSS.

Los ficheros de los logos no entran en ninguna de estas tres cuentas: son
peticiones aparte, 49 KB de origen que Astro reduce a las dos densidades que
se piden.

Medidas más altas: 317 624 bytes y 1 770 elementos.

---

Y otra vez con los logos rehechos: el gris borraba cinco de los trece —a
uno se iba a **cero** tinta— y las marcas iban pegadas al nombre de
la empresa, alineado a la derecha, en ocho x distintas repartidas en 180 px.
Ahora van en color, sin la teja blanca y en columna propia.

- **DOM +12**: un `<span class="prior-logo">` por fila, que existe también en
  la que no tiene logo —si no, esa fila se comería la columna—.
- **HTML +589 B**: esos doce `<span>` menos lo que devuelven los `<img>` al
  salir de dentro del enlace.
- **CSS −103 B**: entra la columna y el filtro de los tres logos de tinta
  oscura, y se van el gris, la transición y las dos reglas de `hover`.

Y suben un pelín más al aparecer la web de Planas: la única fila que se
quedaba en texto pasa a enlazar y gana logo, así que son catorce y no trece.

Medidas más altas: 318 628 bytes y 1 785 elementos.

---

Y sube el 27-08-2026 con el quinto puerto de la fila de contacto, el que
abre `ask`: un `<button>` con su icono y su texto de lectura. Son tres
elementos y ~970 bytes en las tres portadas —el grueso es el SVG en línea,
que va literal en el marcado como los otros cuatro—.

El techo sube para dejar el aire de antes y no la punta de 400 bytes en la
que se quedaba: esto es un disparador de revisión, y con 400 saltaría por
cualquier retoque en vez de por el proyecto siguiente.

Medida: 319 600 bytes.

---

Y sube el 28-08-2026 al cambiar ese puerto por la barra de pregunta.
El glifo sin rótulo entre cuatro enlaces que llevan a una persona se leía
como una red social más, y al pulsarlo la portada entera se convertía en un
terminal; ahora es un campo de texto que se explica solo y responde debajo.

Son ~4,7 KB por portada, y **la mayor parte no es marcado**: ~3,3 KB son las
reglas de la barra, que viajan aquí dentro porque `inlineStylesheets` mete la
hoja entera en cada página —ver el techo de CSS, que las cuenta aparte—. El
marcado en sí son ~1,4 KB: se va un `<button>` con dos `<span>` y entran la
caja, el formulario, el glifo, el campo y la región de respuesta.

Los textos **no** viajan en `data-*`, que fue el primer intento y costaba
otros 460 bytes por portada: `ui.ts` ya está en el paquete que se descarga de
entrada —lo mete `briefView` a través de `cvFormat`—, así que el guion llama a
`t()` y en el marcado quedan sólo el idioma y las dos direcciones.

Lo que la barra pinta al responder —el eco, la respuesta, el pie, las
sugerencias— tampoco cuenta aquí: se construye en el navegador, como la vista
rápida y la lista de la paleta.

Medida: 324 335 bytes.

---

El HTML lleva el CSS dentro: `inlineStylesheets: "always"`, ver
`astro.config.mjs`. Así que este número se mueve con el de abajo.

## DOM de la portada (`DOM_BUDGET_ELEMENTS`, 1 100)

Último valor: `1_100`

---

Subía cinco el 25-08-2026, y sólo cinco: la vista rápida se construye en el
navegador, así que de sus ~80 nodos no viaja ninguno. Ver el desglose arriba.

---

Y tres más el 27-08-2026: el botón de `ask` y sus dos `<span>`. Las cuatro
sugerencias que ofrece al abrirse no cuentan aquí — se construyen en el
navegador, como la vista rápida.

---

El 28-08-2026 esos tres se van y entran diez: la barra de pregunta del hero
—la caja, el formulario, el glifo, el campo, la región de respuesta y las
cuatro etiquetas del SVG del icono, que se cuentan una a una—. Ver la nota
del presupuesto de HTML.

Siete netos, que caben en el aire que había pero dejan el techo a cinco. La
próxima cosa que toque el marcado de la portada tendrá que subir este número,
y ése es justo el aviso que este presupuesto existe para dar.

---

Sube diez y no más. El panel flotante no cuesta nada aquí —su disparador
son los mismos nueve elementos que costaba la barra del hero que sustituye, y
el panel entero lo construye `askDock.ts` al abrirlo—; lo que suma son el
conmutador de modo de la consola y los tres `<link>` de icono que necesita el
rastreador de favicons de Google. Ver `Layout.astro`.

## JS total con gzip (`JS_GZIP_BUDGET_BYTES`, 42 500)

Último valor: `42_500` — medido 41 448 · 31-08-2026

---

Subió de 20 480 el 19-08-2026 con el comando `mail`: el autómata de
redacción, el envío y la validación compartida con el endpoint suman 1,5 KB
comprimidos.

---

Y de 22 784 a 23 400 el 20-08-2026, con dos cosas distintas dentro:
`monoToggle.ts` —unos 300 bytes en el chunk de la barra— y la publicación de
la landing de servicios, que estrena su propio punto de montaje (127 bytes).

El 23-08-2026 `monoToggle.ts` y `printButton.ts` desaparecen enteros y en su
sitio entran dos añadidos pequeños en el chunk de la barra —el reloj del
rótulo y el interruptor de la tira Glyph del pie—, así que el neto baja. El
techo se queda donde está: bajarlo hasta rozar la medida nueva es volver a
medir en metros cuadrados un margen de catorce bytes, que es justo lo que dice
el comentario de arriba que no hay que hacer.

Lo que más se nota no es ninguno de los dos, es un reparto: `contactForm.ts`
pasa a tener **dos** entradas —la portada y servicios— y Rollup lo saca a un
chunk compartido de 946 bytes en vez de incrustarlo en el de la portada. Los
bytes son casi los mismos; la portada se lleva una petición más.

Conviene recordar qué mide este techo: **todo** lo que hay en `dist/_astro`,
no lo que descarga una visita. Ninguna página carga los 23 KB —los 127 bytes
de servicios no los ve quien está en la portada— así que a partir de aquí el
número es una cota superior, no la cuenta del cable.

---

Y de 23 400 a 26 200 el 24-08-2026. Este techo es de los que sí miden lo que
descarga alguien, así que conviene decir en qué se va:

- ~1,6 KB la paleta de comandos: la lista, el filtrado sin acentos, el
  recorrido con las flechas y el diálogo. Es lo único de la tanda que se
  parece a una función nueva, y aun así reutiliza el despachador de efectos
  en vez de reimplementar tema, idioma y descarga —de ahí que no cueste el
  doble—.
- ~0,5 KB entre `commandPalette` y `consoleEffects`, que es el precio de
  partir el cierre de la consola en un módulo compartido: Rollup deja de
  poder incrustar el `switch` y lo saca.
- ~0,7 KB el resto de la tanda junta, en el chunk de la barra: la secuencia
  de arranque, el tiempo de encendido del pie, el contador de secciones, el
  acuse del portapapeles y `glyph.ts`, que son doce líneas.

Queda ~0,9 KB de aire: suficiente para un arreglo, insuficiente para una
librería, que es donde este techo quiere estar.

---

Sube el 24-08-2026 con la tanda de los modales. Todo lo nuevo es guion de
`Projects.astro`, y son tres cosas que antes no existían: el detalle como
dirección —empujar el hash al abrir, reconciliar en `popstate`/`hashchange`,
reemplazar al cerrar—, el gesto de arrastre del visor, y los botones de
anterior/siguiente entre proyectos, que se construyen en cliente justo para
no gastar catorce nodos de DOM por portada. Ese reparto es deliberado: lo que
aquí cuesta ~1 KB comprimido, en marcado costaba más y encima tres veces.

Y en la misma tanda, la paleta deja de ser sólo de la portada: el diálogo lo
pinta ahora el `Layout` en todas las páginas y su montaje se muda a
`UtilityBarRuntime`, que también va en todas. Eso mueve código de un chunk a
otro más que añadirlo; lo nuevo de verdad son dos cosas pequeñas — el
disparador visible de la barra y el filtro que oculta las vistas donde no
están montadas—. Las landings absorben el diálogo sin tocar sus propios
techos de HTML, CSS ni DOM, que es lo que había que comprobar antes de
moverlo.

Medida: 27 081 bytes.

---

Y sube otra vez con el comando `ask`: el modo conversación de la consola. Es
el lector del flujo SSE —los trozos de red no respetan los límites de los
eventos, así que hay que reensamblar por línea—, la memoria de la
conversación y el pintado incremental sobre una sola línea que crece.

El expediente y las instrucciones del modelo **no** están aquí: viven en el
Worker, que no se descarga. Del lado del navegador `ask.ts` sólo aporta los
límites y la validación, que son los mismos que aplica el servidor.

Medida: 28 124 bytes.

---

Y con la consola en la 404, el 25-08-2026: un punto de montaje propio —esa
página no tiene `PortfolioRuntime`, que arrastraría el conmutador de vistas,
el formulario y el retrato— y la salida de `web` cuando no hay vista web a la
que volver. El intérprete no se duplica: es el mismo chunk que ya cargaba la
portada.

Medida: 28 826 bytes.

---

Y con el zoom del visor, el mismo día: ampliar con rueda sobre el punto del
cursor, arrastrar para recorrer, doble clic, teclado (+ − 0 y flechas) y el
rail que salta a una captura concreta. Lo que más cuesta no es ampliar, es
que conviva: el arrastre ya era el gesto de pasar de captura, así que hay que
repartirlo según haya zoom o no.

Medida: 29 569 bytes.

---

Y con la vista rápida, que es donde se paga el reparto: su contenido se
construye en el navegador —de ahí que el DOM del build suba sólo cinco
nodos—, así que el precio está aquí y no en el marcado. Son el constructor
de la ficha, el recuento de tecnologías sobre los proyectos y la descarga
perezosa del CV, que sólo ocurre si alguien entra en la vista.

Medida: 30 870 bytes; se dejan ~500 bytes.

---

Sube el 25-08-2026 con los empleos y las habilidades anteriores a programar:
`cat experience` los pinta, y el intérprete de la consola es cliente. Son
~550 bytes comprimidos entre las dos tandas —el bloque guardado, el ayudante
de años y los rótulos nuevos— y el techo se queda con el mismo aire que
tenía, no rozando la medida.

Medida: 31 416 bytes.

---

Sube con la vista rápida rehecha, y aquí es donde se paga lo que no está en
el marcado: los derivadores —meses trabajados, orden por nivel, horas de
curso—, los cuatro bloques nuevos y el estado de error con su reintento. Son
~1,1 KB comprimidos, y sólo los descarga quien entra en la vista.

Medida: 32 494 bytes.

---

Y ~300 bytes más con la segunda pasada: el clon de la fila de contacto con su
atadura de copiado, el disparador que abre la ficha del proyecto y el orden
por `featured`. Descuenta lo que se va —los dos botones ya no se construyen
aquí—, así que el neto es pequeño.

Medida: 32 796 bytes.

---

Sube el 27-08-2026 con `ask` abierto al resto del sitio: el módulo del botón
del héroe, el puente `ask-request` del runtime, la entrada de la paleta, el
aviso de respuesta cortada y —lo que más pesa— las cuatro preguntas sugeridas
y los tres rótulos nuevos, en tres idiomas cada uno. Son ~780 bytes
comprimidos, y el techo recupera el kilobyte de aire de la política en vez de
quedarse a 226 bytes, que es donde ya se sabe que el CI deja de distinguir
señal de ruido.

Medida: 33 574 bytes.

---

Sube 5,7 KB el 28-08-2026 — y **esta cifra deja de ser la que importa**.

Este número suma todos los ficheros de `dist/_astro`, se descarguen o no. Ese
día la consola pasó a cargarse en diferido: `consoleRuntime` y
`portfolioConsole` ya no entran por importación estática en el punto de
montaje del portfolio, sino con un `import()` la primera vez que alguien
entra en la vista `cmd` o pregunta desde fuera. Son **7,9 KB comprimidos**
—21,4 sin comprimir, todo el terminal en un trozo— que dejan de descargarse
en todas las páginas y en los tres idiomas para quien no abre la consola, que
es casi todo el mundo. Aquí ese ahorro no se ve: el trozo sigue existiendo.

Que ese trozo quedara suelto costó cortar dos cordones que no se veían, y los
dos entraban por la puerta de al lado: la vista rápida importaba
`flattenLocalized` del intérprete —ahora en `consoleCv.ts`— y la paleta de
comandos importaba `LANGS` —ahora en `consoleEffects.ts`—. Cada uno de esos
dos nombres se llevaba el intérprete entero a un paquete que sí se descarga
siempre, y con ellos puestos el `import()` no ahorraba un solo byte.

Lo que sí se ve es lo que se ha añadido, y es real: la barra de pregunta de
la portada con su cliente de flujo, el cargador, y en la consola el `grep`,
el `tree`, `pwd`, `pdf`, `history`, las tres salidas de vista, la edición de
línea, Ctrl+C y el historial que sobrevive a la navegación.

Lo que de verdad se descarga al abrir la portada lo vigila
`tests/browser/navigation.spec.ts`, que comprueba que ese trozo no se pide
hasta que hace falta. Si algún día alguien vuelve a importar la consola de
forma estática —o a tirar de un nombre suelto como los dos de arriba—, ese
test cae; éste no se enteraría.

Medida: 39 300 bytes.

## CSS en línea de la portada (`CSS_BUDGET_BYTES`, 120 000)

Último valor: `120_000` — medido 119 055 · 28-08-2026

---

El CSS con su propio número, y no escondido dentro del total del HTML.

`inlineStylesheets: "always"` mete la hoja entera en cada una de las tres
páginas, así que es la parte que crece más rápido y la que más se repite: hoy
son 53,9 KB de los 212 del HTML. Medido aparte, un aviso dice «creció el CSS»
en vez de «creció la página», que es lo que hay que arreglar.

Subió de 54 000 a 56 000 con el banner de servicios y el desplegable de cada
empleo. De los 2,3 KB nuevos, 1,4 son del banner, y esos se pagan aunque la
bandera `SERVICES` esté apagada: Astro empaqueta el CSS de un componente
porque `Hero.astro` lo importa, no porque llegue a pintarse.

Se intentó cobrar esos 1,4 KB con un `import()` dinámico y **no sirve**: en
SSG el CSS se recoge del grafo de módulos, que incluye las importaciones
dinámicas, así que la hoja viajó igual (55 160 → 55 161 bytes) y encima el
chunk de más subió el JS por encima de su presupuesto. Cuando la landing salga
de detrás de la bandera —o se quite— este número vuelve a moverse solo; hasta
entonces son deuda de la bandera y no hay atajo.

---

Los chips de tecnología del diálogo pasaron a llevar el color de su marca, y
eso mueve los dos números de arriba y el de abajo:

- **CSS**: el mapa de marcas son 1,9 KB (33 reglas, dos versiones por tema) y
  los efectos del banner otros 2,9. Se recuperaron 572 bytes por página
  deduplicando la insignia de estado, que estaba entera en `Projects.astro` y
  en `ProjectDetail.astro`.
- **HTML**: un atributo `data-tech` por chip, unos 1,1 KB por página. El
  techo sube a 222 000 para que siga cumpliendo lo que dice el comentario de
  arriba —avisar con el proyecto siguiente, que son 11,2 KB— en vez de saltar
  por el chip siguiente: con el anterior quedaban 762 bytes de aire.

---

Subió de 59 000 el 18-08-2026 al hacer determinista el PDF: Inter pasó de una
fuente variable a cinco pesos estáticos y la mono dejó de ser la del sistema
(+3,4 KB de `@font-face`), y la hoja impresa ganó su propia paleta (+1,7 KB).
En el cable son 11,6 KB comprimidos.

---

Subió de 73 500 el 19-08-2026 con el rediseño de la portada. Los 3,6 KB se
reparten así: ~1,1 KB el vocabulario de pérdida de señal —tres `@keyframes`
compartidos por el hero, el retrato, el cambio de tema y el de idioma—, ~1 KB
el medidor de idiomas con sus siete niveles, y el resto el contacto de un
solo campo, la trama de puntos del cierre y los apellidos en Doto.

Se recortó lo que se podía antes de subir el techo: `signal-drop` y
`signal-flash` eran el mismo movimiento con y sin opacidad y quedó uno solo,
y los tres fotogramas sobrantes de cada curva se fueron con ellos.

---

Y otros 1,7 KB el 20-08-2026: la insignia de estado pasó de píldora rellena a
etiqueta con medidor de tres segmentos, el chip de fechas ganó su recorrido
de puntos, el pie pasó de una frase centrada a una fila de metadatos con su
regla, y la consola estrenó la trama de fondo.

---

Y otros 1,2 KB el 20-08-2026 con la tanda de estilo «Nothing»: la paleta roja
—undécima del sorteo, ocho medidas de contraste—, la tira de puntos que se
enciende en el canto de las tarjetas, las cifras en matriz de puntos
(`DateRange`, ordinal de sección, el código del 404) y el separador de la
consola.

Aquí hay una cuenta que **no** salió: unificar en `--dot-fine` las seis copias
del degradado de puntos se hizo por consistencia, no por bytes. Escrita, la
forma con token ahorra ~8 caracteres por uso y la definición cuesta ~110, así
que con seis usos sale a la par o ligeramente peor. Lo que gana es que la
textura de puntos del sitio esté declarada una vez: antes había tres radios
distintos —1/1,1 y 1,1/1,2— para el mismo motivo.

---

Y otros 1,7 KB el 20-08-2026 con la segunda tanda «Nothing». El desglose:
~0,5 KB la tira Glyph de la barra —dos degradados repetidos de catorce
bloques, su `@keyframes` de recorte y el `@supports` que la envuelve—, ~0,4 KB
el marcador de sección que se enciende punto a punto —la capa de acento, su
`@keyframes` y el segundo `@supports`—, ~0,4 KB el desplegable de
`.job-details` al pasar al bloque global, ~0,2 KB los corchetes del
encabezado con su token de cuerpo, y ~0,2 KB los distintivos de estado del
formulario y el chasquido de `--tick` repartido por cinco componentes.

Lo del desplegable no es gasto nuevo: esas reglas ya estaban, en el `<style>`
acotado de `Experience.astro`. Al compartirlas con las certificaciones tenían
que salir de allí —una clase de componente no cruza de archivo en Astro— y en
el bloque global se pagan igual una vez por página. La alternativa era
copiarlas en el segundo componente, que son los mismos bytes y además dos
sitios donde tocar el chevrón.

---

Y otros 4,4 KB el 20-08-2026 con la tercera tanda. El grueso son dos piezas
caras de escribir y baratas de pintar:

- ~1,3 KB los corchetes de instrumento del banner de servicios: ocho capas de
  degradado con su posición y su tamaño, una por brazo. La alternativa eran
  cuatro `<span aria-hidden>` en una plantilla que se incrusta en las tres
  portadas, o sea marcado en vez de hoja.
- ~0,9 KB la tira Glyph del mismo banner, con su máscara, su `@keyframes` y
  las dos salidas por preferencias del sistema.
- ~0,8 KB los chips de contacto: el piloto, la etiqueta mono y los estados.
  Aquí en realidad se **borró** más de lo que se añadió —los cuatro bloques
  de color de marca con su receta de neón escrita a mano—, pero los pilotos y
  sus transiciones pesan más que los cuatro `--brand` que se fueron.
- ~0,7 KB las líneas de barrido del hero, con la deriva y las tres salidas.
- ~0,7 KB el rótulo de la barra, el chaflán y el contorno del nombre.

Se descontó lo que se pudo: el degradado de velo de la barra y su token
`--gloss-veil` se han ido enteros.

---

Subió de 84 600 el 23-08-2026 por lo mismo que el HTML, que en esta hoja son
el mismo byte contado dos veces: la hoja va incrustada en las tres páginas. El
desglose está arriba, en el comentario del techo de HTML.

---

Sube el 23-08-2026 con el enlace global de «Sobre mí» y el CTA de la portada.
La hoja compartida mide 89 212 bytes; se mantiene ~1 KB de margen.

---

Sube de 92 600 el 24-08-2026, y aquí está la mayor parte del coste de la
tanda: la paleta de comandos es sobre todo hoja de estilo —el panel, el campo,
los grupos, la celda activa con su piloto, el backdrop y la entrada con
`@starting-style`—, y como la hoja va incrustada, esos ~3 KB se pagan tres
veces en el total de HTML de arriba.

El resto son migajas repartidas: el contador y el hueco de arranque de la
barra, el acuse del hero, la franja de instrumentos del pie y el estado nuevo
de la tira Glyph.

Medida: 97 553 bytes; se mantiene ~1,4 KB de margen.

---

Sube el 24-08-2026 con la unificación de la capa modal. El grueso **no** es
CSS nuevo sino el precio de dejar de duplicarlo: las escuadras de instrumento
vivían con ámbito dentro de `Projects.astro` y ahora las comparten la
tarjeta, el diálogo de detalle y la paleta, así que el dibujo se escribe una
vez pero su selector se escribe con los tres nombres cada vez que aparece.
Borrar la copia de la tarjeta devolvió ~440 bytes; las listas de selectores
se comen buena parte.

Lo que sí es nuevo cabe en cuatro líneas: los tres velos por token
—`--modal-veil*`, que arreglan un backdrop casi negro en tema claro—, el
radio único de los paneles, la tira de puntos de la cabecera del diálogo y el
`::backdrop` del visor animado, que antes entraba y salía de golpe.

Medida: 99 033 bytes; se mantiene ~1 KB de margen, el mismo aire que las dos
tandas anteriores.

---

Sube el 25-08-2026 con el rail de miniaturas del visor: la tira, la miniatura
con su estado activo y el marco en modo ampliado. Va en la hoja global porque
los nodos los crea el guion —siete botones por galería que no tienen por qué
viajar en el HTML—, así que se paga una vez en CSS en lugar de siete veces en
marcado.

Medida: 100 937 bytes.

---

Y con la vista rápida: ver el desglose junto al techo de HTML.

---

Y otra vez con la vista rápida rehecha, que es de donde sale casi todo el
salto: las reglas `.brief-*` pasan de ~2,8 KB a 5,9. Mismo desglose.

---

Y con los logos de las empresas, que son ~1 KB de reglas para trece imágenes.
Casi la mitad es el tema oscuro: bajar la opacidad de las tejas blancas exige
el patrón de tres estados —`@media (prefers-color-scheme: dark)` con
`:root:not([data-theme="light"])`, y otra vez `:root[data-theme="dark"]`—
porque `light-dark()`, que es como va el resto de la paleta, sólo admite
colores y esto es una opacidad.

Medida: 110 326 bytes.

---

Y baja un poco al rehacerlos: el gris, su transición y las dos reglas de
`hover` se fueron con la teja, y lo que entra —la columna y el filtro de los
tres logos de tinta oscura— pesa algo menos que lo que sale.

Medida: 110 223 bytes.

---

Y ~250 bytes con el puerto de `ask`: no hay reglas nuevas —el botón entra en
las que ya tenían los cuatro enlaces, que pasan de `.contact-list a` a
`.contact-list :is(a, button)`— pero ese ensanche se paga en cada uno de los
diecinueve selectores, más el `cursor` y el `font` que hay que deshacerle a un
botón.

Medida: 110 472 bytes.

---

Sube el 28-08-2026 con la barra de pregunta de la portada y las teclas
rápidas de la consola en móvil.

La barra trae su caja, la línea de escritura con su foco y su glifo, la
región de respuesta —superficie, filete, trama de puntos, alto acotado con
desplazamiento propio— y las dos voces de dentro, más las sugerencias y el
pie con el puente a la consola. Son ~3,3 KB, casi todo en la región: es una
segunda ventana de terminal, más pequeña, dentro del hero.

Descuenta los ~250 bytes que devuelve el ensanche que ya no hace falta: los
diecinueve selectores de la fila de contacto vuelven de
`.contact-list :is(a, button)` a `.contact-list a`, y se van el `cursor` y el
`font` que había que deshacerle a un botón. Los cuatro puertos que quedan son
enlaces otra vez, como al principio.

Medida: 114 593 bytes.
