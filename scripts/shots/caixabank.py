"""Capturas de CaixaBank Spending Tracker para la galería del portafolio.

Reutiliza `chrome_stub()` de su suite visual —congela la fecha y responde a los
mensajes del popup— pero **con un estado inventado**. El suyo, `connected_state()`,
lleva comercios y una referencia de préstamo reales: es realista a propósito
porque son sus pruebas, y cambiárselo se las debilitaría para servir a otro
repositorio. La anonimización vive aquí, junto a las imágenes que protege.

Sustituir la semilla no basta como red: `classification-seed.js` guarda reglas
promovidas del buzón real y puede sacar esos comercios por su cuenta en la
pantalla de reglas. Por eso hay un guardián sobre el texto renderizado, y por
eso esta galería **no captura la pantalla de reglas aprendidas**.

Necesita el servidor estático del proyecto:

    npm run serve:test            # en el repo de CaixaBank → 127.0.0.1:4173
    python scripts/shots/caixabank.py --out .shots/caixabank-spending-tracker
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import Guard, denylist, out_arg, repo_arg, require_port  # noqa: E402

REPO = repo_arg(r"c:\Users\ImadE\Desktop\caixabank-spending-tracker")
OUT = out_arg(".shots/caixabank-spending-tracker")
PORT = 4173
BASE_URL = f"http://127.0.0.1:{PORT}/popup.html"

require_port(PORT, "cd ../caixabank-spending-tracker && npm run serve:test")

sys.path.insert(0, str(REPO / "test"))
import popup_e2e  # noqa: E402

from playwright.async_api import async_playwright  # noqa: E402

# Todo lo que no puede acabar en una imagen publicada. Los comercios de su
# fixture, la aseguradora, la operadora y el pueblo iban escritos aquí, y este
# guion viaja en la copia pública: estaban publicados. Ahora salen de la lista
# de fuera del repositorio, la misma que usa `scripts/export-public.mjs`. Su
# nombre y su correo se quedan: son públicos, y no tiene sentido esconderlos en
# un archivo que existe para no publicar nada.
GUARD = Guard([*denylist(), "@gmail.com", "imad", "elmalki"])


def movement(message_id, concept, amount, balance, category, ts, *, kind="expense"):
    return {
        "messageId": message_id,
        "seq": 0,
        "source": "account",
        "kind": kind,
        "date": "2026-08-01",
        "ts": ts,
        "type": "ABONAMENT" if kind == "income" else "CARREC",
        "concept": concept,
        "account": "000",
        "amount": amount,
        "balance": balance,
        "category": category,
        "excludedFromSpending": False,
        "classificationSource": "automatic",
    }


def demo_state():
    """Mismo esqueleto que el suyo, con comercios inventados."""
    return {
        "movements": [
            movement("m1", "NOMINA EMPRESA DEMO", 1850.00, 2103.42, "ingresos", 1, kind="income"),
            movement("m2", "SUPERMERCADO DEMO", 82.15, 2021.27, "supermercado", 2),
            movement("m3", "CAFETERIA DEMO", 14.60, 2006.67, "restauracion", 3),
            movement("m4", "GASOLINERA DEMO", 61.40, 1945.27, "transporte", 4),
            movement("m5", "PRESTAMO DEMO", 320.00, 1625.27, "hipoteca", 5),
            movement("m6", "SUMINISTROS DEMO", 47.85, 1577.42, "hogar", 6),
        ],
        "meta": {
            "lastSync": "2026-08-01T10:00:00.000Z",
            "syncing": False,
            "lastError": None,
            "lastWarning": None,
            "unrecognized": 0,
        },
        "settings": {
            "includeCardSettlements": False,
            "monthlyBudget": 600,
            "startDate": "2026-01-01",
            "extraQuery": "",
            "savingsKeywords": ["AHORRO"],
            "recurringTransfer": {
                "enabled": True,
                "dayOfMonth": 26,
                "dayTolerance": 2,
                "amount": 250,
            },
        },
        # Vacío a propósito: las reglas aprendidas son justo lo que arrastra
        # nombres del buzón real.
        "overrides": {
            "movements": {},
            "concepts": {},
            "merchants": {},
            "merchantCandidates": {},
        },
        "progress": None,
    }


async def shot(page, name):
    GUARD.check(await page.inner_text("body"), name)
    await page.screenshot(path=str(OUT / f"{name}.png"))
    print(f"  ✓ {name}.png")


async def capture(state, name, after=None, *, connected=True):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 384, "height": 580},
            # Escala 2: 384×2 = 768, justo el máster de la forma «popup».
            device_scale_factor=2,
            color_scheme="dark",
            reduced_motion="reduce",
            locale="es-ES",
        )
        await context.add_init_script(popup_e2e.chrome_stub(state))
        page = await context.new_page()
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_selector(
            "#view-main" if connected else "#view-connect", state="visible"
        )

        if after is not None:
            await after(page)

        await shot(page, name)
        await context.close()
        await browser.close()


async def open_editor(page):
    await page.click("[data-movement-key]")
    await page.wait_for_selector("#movement-dialog", state="visible")
    await page.wait_for_timeout(250)


async def open_settings(page):
    await page.click("#btn-settings")
    await page.wait_for_selector("#view-settings", state="visible")
    await page.wait_for_timeout(250)


async def main():
    disconnected = {**demo_state(), "movements": [], "meta": {"lastSync": None}}

    await capture(demo_state(), "01-mes")
    await capture(demo_state(), "02-editor", open_editor)
    await capture(demo_state(), "03-ajustes", open_settings)
    await capture(disconnected, "04-conexion", connected=False)

    print(f"\n✓ 4 capturas en {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
