"""Capturas de Race Spending Tracker para la galería del portafolio.

Reutiliza dos piezas del proyecto: `popup_server()`, que sirve el repo por HTTP
en un puerto libre, y `bootstrap()`, su stub de `chrome.*` —con un
`chrome.storage.local` de verdad, con `onChanged`— que además congela la fecha.
No se carga la extensión ni se toca Gmail.

El estado se declara aquí y no se importa: el suyo vive dentro de `main()`, y de
todos modos qué carreras enseña la galería es una decisión del portafolio. Son
carreras públicas y remitentes `example.test`.

Los 32 PNG que el proyecto ya tiene comiteados no sirven: están tomados a escala
1, o sea 420 px de ancho, por debajo del máster de 768 que pide la forma
«popup». Aquí se recapturan a escala 2.

    python scripts/shots/race_spending.py --out .shots/race-spending-tracker
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import Guard, out_arg, repo_arg, save  # noqa: E402

REPO = repo_arg(r"c:\Users\ImadE\Desktop\race-spending-tracker")
OUT = out_arg(".shots/race-spending-tracker")

sys.path.insert(0, str(REPO / "tools"))
import verify_popup as vp  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

# Ni rastro del buzón real: el guardián falla si algo de esto llega a una imagen.
GUARD = Guard(["@gmail.com", "imad", "elmalki"])

RACES = [
    {
        "id": "event:mitja-bcn",
        "aliases": ["demo|2026"],
        "name": "Mitja Marató Barcelona",
        "displayName": "Mitja Marató Internacional de Barcelona",
        "raceDate": "2026-10-18",
        "registeredAt": "2026-06-10",
        "amount": 24.5,
        "amountSource": "body",
        "platform": "sportmaniacs",
        "distance": "21K",
        "messageIds": ["msg-a"],
    },
    {
        "id": "event:behobia",
        "aliases": [],
        "name": "Behobia San Sebastián",
        "displayName": "Behobia · San Sebastián",
        "raceDate": "2027-02-14",
        "registeredAt": "2026-04-12",
        "amount": 52,
        "amountSource": "receipt",
        "platform": "rockthesport",
        "distance": "20K",
        "messageIds": ["msg-b"],
    },
    {
        "id": "event:nassos",
        "aliases": [],
        "name": "Cursa dels Nassos",
        "displayName": "Cursa dels Nassos · Barcelona",
        "raceDate": "2026-03-15",
        "registeredAt": "2026-01-12",
        "amount": 18.75,
        "amountSource": "manual",
        "platform": "championchip",
        "distance": "10K",
        "messageIds": ["msg-c"],
    },
    {
        "id": "event:montseny",
        "aliases": [],
        "name": "Trail del Montseny",
        "displayName": "Trail del Montseny",
        "raceDate": "2025-12-07",
        "registeredAt": "2025-08-18",
        "amount": 64,
        "amountSource": "body",
        "platform": "otros",
        "distance": "42K",
        "messageIds": ["msg-d"],
    },
]

STATE = {
    "races": RACES,
    "settings": {
        "since": "2025-01-01",
        "extraQuery": "",
        "readPdfAttachments": True,
        "readReceipts": True,
        "badgeMode": "spend",
        "year": 2026,
        "budgetsByYear": {"2026": 120},
    },
    "lastSync": 1785750000000,
    "reviewQueue": [
        {
            "messageId": "review-a",
            "subject": "Confirmación de inscripción pendiente de revisión",
            "sender": "no-reply@example.test",
            "senderName": "Plataforma Demo",
            "emailDate": "2026-08-01",
            "provider": "otros",
            "kind": "ambiguous",
            "reason": "generic-insufficient-evidence",
            "candidate": {"name": "Carrera candidata", "raceDate": "", "amount": None},
        }
    ],
    "syncSummary": {
        "candidates": 8,
        "created": 2,
        "updated": 1,
        "discarded": 4,
        "pending": 1,
        "errors": 0,
    },
    "status": {"state": "idle"},
}

TABS = [
    ("01-proximas", "Próximas"),
    ("02-historial", "Historial"),
    ("03-gasto", "Gasto"),
    ("04-revisar", "Revisar"),
]


def main() -> None:
    with vp.popup_server() as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            context = browser.new_context(
                viewport={"width": vp.POPUP_WIDTH, "height": vp.POPUP_HEIGHT},
                # Escala 2: a 1 el ancho se queda por debajo del máster.
                device_scale_factor=2,
                locale="es-ES",
                reduced_motion="reduce",
            )
            context.add_init_script(script=vp.bootstrap(STATE))
            page = context.new_page()
            page.goto(base_url, wait_until="domcontentloaded")
            page.evaluate("document.fonts && document.fonts.ready")

            for name, label in TABS:
                page.get_by_role("tab", name=label).click()
                page.wait_for_timeout(250)
                save(page, OUT / f"{name}.png", GUARD)

            page.click("#settingsBtn")
            page.wait_for_timeout(350)
            save(page, OUT / "05-ajustes.png", GUARD)

            context.close()
            browser.close()

    print(f"\n✓ {len(TABS) + 1} capturas en {OUT}")


if __name__ == "__main__":
    main()
