"""Capturas de Riolan Solutions para la galería del portafolio.

Este proyecto no se captura contra su aplicación, porque ya no existe: era un
WordPress con Elementor, el dominio no resuelve y no queda ni base de datos ni
instalación. Lo que se fotografía es la reconstrucción estática que vive en
`RiolanSolutions/site-rebuild`: el HTML que Wayback archivó el 19-12-2024, con
el CSS de Elementor 3.26 y hello-elementor 3.1.1 vendorizados, las fotos de
producción originales y un `page.css` escrito a mano en lugar de los cuatro
`post-*.css` que el archivo no guardó.

    node "…/RiolanSolutions/site-rebuild/serve.mjs"    # → 127.0.0.1:3000
    python scripts/shots/riolan.py --out .shots/riolan-solutions

Forma `browser`: las cinco a 1280×800, proporción 0,625, dentro de la ventana
que exige `scripts/shot-shapes.mjs`. Se captura al doble de densidad y es
`prepare-project-shots.mjs` quien reduce al máster de 1280. Al tamaño justo,
Chromium en Windows dibuja el texto con antialiasing subpíxel y las letras
salen con franjas de color; reducir desde el doble las deja limpias.

Las cinco tomas recorren la página de arriba abajo. Se desplaza por secciones y
se captura el viewport, en vez de recortar una toma larga: así la cabecera fija
sale donde el visitante la veía y cada imagen tiene la misma altura.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import Guard, out_arg, require_port, save  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

OUT = out_arg(".shots/riolan-solutions")
PORT = 3000
BASE_URL = f"http://127.0.0.1:{PORT}"

require_port(PORT, r'node "C:\Users\ImadE\Desktop\RiolanSolutions\site-rebuild\serve.mjs"')

# La página es de un cliente y no lleva datos del propietario del portafolio.
# El teléfono y el horario son los que la empresa publicaba en su web.
GUARD = Guard(["imad", "elmalki", "imadelmalkij", "wp-admin", "wp-login"])

# Nombre, selector de la sección y cuánto se sube desde su borde superior. El
# desplazamiento negativo deja respirar el rótulo; en la galería, además,
# encuadra las filas de fotos en vez de empezar por el titular.
#
# Servicios no usa desplazamiento: se encuadra aparte, más abajo.
SHOTS = [
    ("01-portada", None, 0),
    ("02-nosotros", ".elementor-element-78c759ad", -40),
    ("03-servicios", None, 0),
    ("04-proyectos", ".elementor-element-44248779", -30),
    ("05-contacto", ".elementor-element-638df715", -20),
]

SIN_CABECERA = "03-servicios"

# Servicios es la toma difícil. Del borde superior del rótulo al final de la
# segunda fila de tarjetas hay 801 px y el viewport son 800, así que a tamaño
# natural no entra: o se corta la palabra «Servicios» o se corta la última fila.
#
# Se resuelve con dos ajustes que solo existen mientras se dispara:
#
# - Fuera la cabecera. Es `sticky`, y si no tapa la primera fila de tarjetas.
# - Se aprieta el ritmo vertical de la sección. La separación entre el rótulo,
#   la entradilla y la rejilla baja de 24 a 8 px, y la rejilla pierde su margen
#   superior: 44 px que pasan a ser aire arriba y abajo.
#
# El encuadre se calcula desde el final de la rejilla y no desde el borde de la
# sección, porque quitar la cabecera saca sus 83 px del flujo y desplaza todo.
COMPACTAR_SERVICIOS = """
  .elementor-location-header { display: none }
  .e-con.elementor-element-2ebaa44 { --gap: 8px }
  .e-con.elementor-element-577b106 { margin-top: 0 }
"""

FONDO_SERVICIOS = ".elementor-element-577b106"
MARGEN_FONDO = 20


def main() -> None:
    with sync_playwright() as playwright:
        # `--disable-lcd-text` quita el antialiasing subpíxel; sin él quedan
        # bordes de color en el texto aunque se reduzca luego.
        browser = playwright.chromium.launch(args=["--disable-lcd-text"])
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=2,
            locale="es-ES",
            # Las animaciones de entrada de Elementor son por scroll. La
            # reconstrucción ya las deja visibles, pero pedir movimiento
            # reducido evita capturar una transición a medias.
            reduced_motion="reduce",
        )
        page = context.new_page()

        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_timeout(600)
        page.evaluate("document.fonts && document.fonts.ready")

        # Las 32 fotos de obra se piden de golpe: sin esperarlas, la galería
        # sale a medio pintar.
        page.wait_for_function(
            "[...document.images].every((image) => image.complete)", timeout=30_000
        )

        for name, selector, offset in SHOTS:
            oculta = (
                page.add_style_tag(content=COMPACTAR_SERVICIOS)
                if name == SIN_CABECERA
                else None
            )

            if name == SIN_CABECERA:
                page.evaluate(
                    """([target, margin]) => {
                      const grid = document.querySelector(target)
                      const bottom = grid.getBoundingClientRect().bottom + window.scrollY
                      window.scrollTo(0, bottom + margin - window.innerHeight)
                    }""",
                    [FONDO_SERVICIOS, MARGEN_FONDO],
                )
                page.wait_for_timeout(700)
            elif selector is None:
                page.evaluate("window.scrollTo(0, 0)")
                page.wait_for_timeout(700)
            else:
                # Dos pasadas a propósito: la cabecera fija se compacta al
                # desplazarse y mueve todo lo que hay debajo, así que la primera
                # posición se queda corta. La segunda mide ya con la cabecera
                # en su estado final.
                for _ in range(2):
                    page.evaluate(
                        """([target, offset]) => {
                          const section = document.querySelector(target)
                          const top = section.getBoundingClientRect().top + window.scrollY
                          window.scrollTo(0, Math.max(0, top + offset))
                        }""",
                        [selector, offset],
                    )
                    page.wait_for_timeout(500)

            save(page, OUT / f"{name}.png", GUARD)

            if oculta is not None:
                oculta.evaluate("node => node.remove()")

        context.close()
        browser.close()

    print(f"\n✓ {len(SHOTS)} capturas en {OUT}")


if __name__ == "__main__":
    main()
