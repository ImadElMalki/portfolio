"""Capturas de 100 Cims para la galería del portafolio.

Este proyecto no trae arnés: el script solo captura, y la secuencia de arranque
—Postgres, Spring Boot, carga del CSV, Angular— está en `scripts/shots/README.md`.
Hay que tenerla hecha antes de lanzarlo.

Los datos son abiertos: los 522 cims del reto de la FEEC. No hay nada personal.

    python scripts/shots/cims.py --out .shots/100-cims

Solo existen tres pantallas de verdad. `/dashboard/peaks-details/:id` y
`/dashboard/peaks-done` son plantillas sin terminar y no se capturan.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import Guard, out_arg, require_port, save  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

OUT = out_arg(".shots/100-cims")
API_PORT = 8080
APP_PORT = 4200
BASE_URL = f"http://localhost:{APP_PORT}/dashboard/peaks"

require_port(API_PORT, "cd summits-cims-api-rest && ./mvnw spring-boot:run")
require_port(APP_PORT, "cd catalonia-peaks-app && npm start")

GUARD = Guard(["@gmail.com", "imad", "elmalki"])


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="ca-ES",
            reduced_motion="reduce",
        )
        page = context.new_page()
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_selector("app-peak-card, mat-card", timeout=30_000)
        page.wait_for_timeout(1500)

        # Los iconos de Material vienen de un CDN. Sin red, cada uno se dibuja
        # como su nombre en texto plano y la captura queda inservible.
        if not page.evaluate("document.fonts.check('1em \"Material Icons\"')"):
            sys.exit(
                "Material Icons no ha cargado: hace falta conexión, o cada icono "
                "saldría como texto."
            )

        save(page, OUT / "01-cims.png", GUARD)

        page.get_by_role("button", name="Modo taula").click()
        page.wait_for_selector("table", timeout=15_000)
        page.wait_for_timeout(1000)
        save(page, OUT / "02-taula.png", GUARD)

        page.get_by_role("button", name="Veure com a tarjetes").click()
        page.wait_for_selector("app-peak-card, mat-card", timeout=15_000)
        page.wait_for_timeout(800)
        page.get_by_role("button", name="Detalls").first.click()
        page.wait_for_selector("mat-dialog-container", timeout=15_000)
        page.wait_for_timeout(700)
        save(page, OUT / "03-detall.png", GUARD)

        context.close()
        browser.close()

    print(f"\n✓ 3 capturas en {OUT}")


if __name__ == "__main__":
    main()
