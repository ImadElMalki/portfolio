"""Capturas de Amazon Spending Tracker para la galería del portafolio.

Reutiliza el generador de recursos de tienda del propio proyecto: sirve el repo
por HTTP, inyecta su stub completo de `chrome.*` y renderiza `src/popup.html` a
460×600 con escala 2. Nunca toca Gmail ni lanza OAuth, y los datos salen de
`_synthetic_orders()`, veinte pedidos inventados con remitente `@example.invalid`.

Se importa `_capture_popup` en vez de reescribirlo porque además congela la
fecha, espera a las fuentes, desactiva animaciones y falla si queda algún
marcador de traducción sin resolver.

    python scripts/shots/amazon.py --out .shots/amazon-spending-tracker
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import out_arg, repo_arg  # noqa: E402

REPO = repo_arg(r"c:\Users\ImadE\Desktop\amazon-spending-tracker")
OUT = out_arg(".shots/amazon-spending-tracker")

sys.path.insert(0, str(REPO / "tools"))
import generate_store_assets as gsa  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

# El orden es el de la galería: primero el resumen anual, que es el gancho, y al
# final la pantalla de conexión, que explica el modelo de privacidad.
SHOTS = [
    ("01-resumen", {"id": "overview", "theme": "dark", "state": "data"}),
    ("02-comparativa", {"id": "comparison", "theme": "light", "state": "data"}),
    (
        "03-pedidos",
        {"id": "activity", "theme": "dark", "state": "data", "action": "orders"},
    ),
    (
        "04-revision",
        {"id": "review", "theme": "light", "state": "data", "action": "review"},
    ),
    ("05-conexion", {"id": "connect", "theme": "dark", "state": "auth"}),
]

# La ventana emergente tiene alto fijo, así que un escenario corto —la revisión
# manual son dos filas— deja media captura en blanco. Se recorta el fondo
# sobrante, pero nunca por debajo de la proporción mínima que acepta
# `prepare-project-shots.mjs` para la forma «popup».
MIN_RATIO = 1.1
BOTTOM_PADDING = 48


def trim_bottom(image):
    background = image.getpixel((image.width // 2, image.height - 1))
    last_content = 0

    for y in range(image.height - 1, -1, -1):
        row = (image.getpixel((x, y)) for x in range(0, image.width, 8))
        if any(pixel != background for pixel in row):
            last_content = y
            break

    height = max(last_content + BOTTOM_PADDING, round(image.width * MIN_RATIO))

    return image if height >= image.height else image.crop((0, 0, image.width, height))


def main() -> None:
    server, _thread = gsa._start_server()
    host, port = server.server_address[:2]
    base_url = f"http://{host}:{port}"

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                for name, scenario in SHOTS:
                    image = trim_bottom(
                        gsa._capture_popup(browser, base_url, "es", scenario)
                    )
                    path = OUT / f"{name}.png"
                    image.save(path)
                    print(f"  ✓ {path.name} — {image.width}×{image.height}")
            finally:
                browser.close()
    finally:
        server.shutdown()

    print(f"\n✓ {len(SHOTS)} capturas en {OUT}")


if __name__ == "__main__":
    main()
