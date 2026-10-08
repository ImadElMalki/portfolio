---
name: cv-pdf
description: How the CV PDFs are generated and verified in this portfolio. Use when touching the print stylesheet, the fonts, scripts/build-cv-pdf.mjs, scripts/check-cv-pdf.mjs, or when a PDF looks wrong (missing text, ghost images, extra page, wrong font, uncoloured markers).
---

# El PDF del CV en este repositorio

Los tres PDF —`public/cv.pdf`, `public/ca/cv.pdf`, `public/en/cv.pdf`— **no son
una maquetación aparte**: son la web impresa. Todo lo que decide cómo salen vive
en el `@media print` de los componentes y en `scripts/build-cv-pdf.mjs`.

Regla que lo resume: **una hoja, las mismas fuentes en cualquier máquina, y nada
que dependa de que algo se ejecute a tiempo.**

## 1. El bucle de trabajo

```bash
npm run build            # el @media print sólo existe en el CSS final
npm run cv:pdf           # genera los tres y los verifica al terminar
pdftoppm -r 100 -png -f 1 -l 1 public/cv.pdf tmp/cv   # y míralo
```

El catalán es el idioma largo: si algo deja de caber en una hoja, se rompe ahí
primero. Comprueba siempre `public/ca/cv.pdf` antes de dar algo por bueno.

Para mirar un trozo concreto en vez de la hoja entera:

```bash
pdftoppm -r 150 -png -f 1 -l 1 -x 40 -y 1180 -W 1100 -H 280 public/cv.pdf tmp/detalle
```

Y para responder preguntas sin abrir nada (poppler está en local, **no** en la
CI): `pdffonts` (qué tipos viajan dentro), `pdftotext -layout` (qué se puede
copiar y en qué orden), `pdfimages -list` (qué imágenes se pintan de verdad),
`pdfinfo` (páginas, tamaño, `Tagged`).

## 2. Las trampas, ya pagadas

| Síntoma                                | Causa                                                                                        | Dónde se arregla                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Texto que está en el PDF pero no se ve | La entrada escalonada (`revealSequence`) anima desde `opacity: 0` y el `pdf()` dispara antes | `@media print` de `Layout.astro` lo fuerza con `!important`, y el script espera a `getAnimations()` |
| Hueco en blanco donde va un marcador   | Las barras de sección son un gradiente, o sea un fondo                                       | `printBackground: true` + `print-color-adjust: exact`                                               |
| Fuentes Type 3 y 400 KB por archivo    | Una fuente **variable**: Chromium no sabe incrustar la instancia                             | `astro.config.mjs`: pesos sueltos servidos por `fontProviders.fontsource()`                         |
| El PDF de la CI no es el de local      | `--font-mono` era una pila del sistema (Consolas vs Liberation Mono)                         | JetBrains Mono servida por Astro                                                                    |
| Cada ejecución sale de otro color      | El acento se sortea en cada carga                                                            | `PINNED_ACCENT` en el script + tokens fijos en el `@media print`                                    |
| Manchas grises que no son de nadie     | `backdrop-filter`/`mask` obligan a rasterizar la capa y acaba como JPEG dentro del PDF       | El neutralizador `*` del bloque de impresión                                                        |
| Una fila pisa a la de al lado          | Una celda de rejilla sin `min-width: 0` la ensancha el contenido                             | El componente que la dibuja                                                                         |

## 3. Lo que vigila `scripts/check-cv-pdf.mjs`

Corre solo al final de `npm run cv:pdf`, también en la CI. Sin dependencias: lee
el archivo. Comprueba una hoja, tamaño A4, cero fuentes Type 3, Inter y
JetBrains Mono incrustadas como TrueType, las **mismas** fuentes en los tres
idiomas, al menos seis enlaces —uno `mailto:`—, que el árbol de estructura
(`/Marked true` + `/StructTreeRoot`) haya llegado de verdad al archivo —es lo que
un ATS necesita para leer el texto en el orden del documento— y el peso entre 20
y 360 KB.

Si añades un perfil o un proyecto con dirección, el mínimo de enlaces sube solo
(es un mínimo). Si cambias de familia tipográfica, actualiza `REQUIRED_FONTS`.

## 4. Al tocar el contenido del CV

`cv.json` cambia → **vuelve a ejecutar `npm run cv:pdf`**. Los PDF se versionan
en `public/` para que el despliegue no necesite un navegador, y nada puede saber
si están al día: `check-build.mjs` sólo comprueba que existan.
