"""Capturas de la plataforma Strava/Garmin para la galería del portafolio.

El servidor de desarrollo es el propio Worker (Vite + el plugin de Cloudflare),
así que la API es real y la base D1 local ya trae un conjunto sintético: 318
actividades con identificadores correlativos, sin objeto de atleta y sin ningún
token guardado. No hace falta cuenta de Strava, ni clave de Gemini, ni de
Cloudflare.

    npm run dev                   # en el repo de Strava → 127.0.0.1:5173
    python scripts/shots/strava.py --out .shots/plataforma-strava-garmin

Tres cuidados:

- `ADMIN_TOKEN` se lee de `.dev.vars` en tiempo de ejecución. Nunca se escribe
  aquí ni se imprime.
- Se inicia sesión **una sola vez** por ejecución: el límite son 5 fallos por IP
  cada 15 minutos, y un bucle de login convierte una errata en un bloqueo.
- Solo se visitan las vistas de la lista blanca. Los paneles de ajustes y de
  OAuth quedan fuera porque podrían reflejar secretos reales de `.dev.vars`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import Guard, out_arg, repo_arg, require_port, save  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

REPO = repo_arg(r"c:\Users\ImadE\Desktop\strava-activity-process-bot")
OUT = out_arg(".shots/plataforma-strava-garmin")
PORT = 5173
BASE_URL = f"http://127.0.0.1:{PORT}"

require_port(PORT, "cd ../strava-activity-process-bot && npm run dev")

GUARD = Guard(["@gmail.com", "imad", "elmalki", "client_secret", "AIza"])

# Vistas permitidas. Nada de ajustes ni de OAuth.
# El tercer valor desplaza el contenido antes de capturar, para las vistas cuya
# parte interesante queda por debajo del pliegue.
SHOTS = [
    ("01-panel", "#dashboard", "?tab=resumen", 0),
    ("02-rendimiento", "#dashboard", "?tab=rendimiento", 0),
    ("03-carga", "#dashboard", "?tab=carga", 0),
    ("04-plan", "#plan", "", 620),
    ("05-operaciones", "#activity", "", 0),
]

# El aviso de «Strava sin conectar» se queda. Sale porque este arranque local no
# tiene token, y quitarlo del DOM exigía adivinar qué contenedor es suyo: el
# primer intento se llevó por delante media vista. Es información cierta sobre
# el estado del bot, así que se captura tal cual.


def admin_token() -> str:
    text = (REPO / ".dev.vars").read_text(encoding="utf8")
    match = re.search(r"^ADMIN_TOKEN\s*=\s*\"?([^\"\r\n]+)\"?", text, re.MULTILINE)
    if not match:
        sys.exit("No encuentro ADMIN_TOKEN en .dev.vars")
    return match.group(1).strip()


def main() -> None:
    token = admin_token()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="es-ES",
            reduced_motion="reduce",
        )
        # El tema se lee antes del primer pintado: sembrarlo evita capturar el
        # claro por accidente y fija el acento.
        context.add_init_script(
            "localStorage.setItem('theme-mode','dark');"
            "localStorage.setItem('theme-accent','indigo')"
        )
        page = context.new_page()

        # La portada pública no lleva ni un dato del atleta: se captura sin sesión.
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_timeout(800)
        page.evaluate("document.fonts && document.fonts.ready")
        save(page, OUT / "00-portada.png", GUARD)

        # Una sola sesión por ejecución.
        page.goto(f"{BASE_URL}/#login", wait_until="networkidle")
        page.get_by_label("Contraseña").fill(token)
        page.get_by_role("button", name="Entrar").click()
        page.wait_for_selector("nav, [role='navigation']", timeout=20_000)
        page.wait_for_timeout(1200)

        for name, view, query, scroll in SHOTS:
            # Las rutas van por hash: un `goto` sobre el mismo documento puede no
            # repintar, así que se cambia la ubicación y se espera a la vista.
            page.evaluate(
                "target => { location.href = target }", f"{BASE_URL}/{query}{view}"
            )
            page.wait_for_timeout(2000)

            if scroll:
                # El contenedor que desplaza no siempre es la ventana: se busca
                # el que de verdad tenga recorrido.
                page.evaluate(
                    """offset => {
                      const scroller = [...document.querySelectorAll('main, main *')]
                        .find((node) => node.scrollHeight > node.clientHeight + offset)
                      if (scroller) scroller.scrollTop = offset
                      else window.scrollTo(0, offset)
                    }""",
                    scroll,
                )
                page.wait_for_timeout(600)

            page.evaluate("document.fonts && document.fonts.ready")
            save(page, OUT / f"{name}.png", GUARD)

        context.close()
        browser.close()

    print(f"\n✓ {len(SHOTS) + 1} capturas en {OUT}")


if __name__ == "__main__":
    main()
