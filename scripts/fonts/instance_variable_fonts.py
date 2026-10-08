"""Las fuentes de pantalla: un archivo variable por familia, recortado.

Las páginas de pantalla cargaban siete archivos estáticos: Inter en 400, 500,
600, 700 y 800 (~118 KiB) y JetBrains Mono en 400 y 700 (~43 KiB). La CI de
Lighthouse los contaba enteros antes del primer pintado (PERF-03). Aquí salen
dos archivos variables con la misma tipografía, recortados a los pesos que pide
el CSS:

- Inter de 400 a 800, con el tamaño óptico fijado en 14, el de los estáticos.
  Sin fijarlo, el navegador lo ajusta al cuerpo de letra
  (`font-optical-sizing: auto`) y los titulares cambiarían de dibujo. 36 KiB.
- JetBrains Mono de 400 a 700. No tiene eje de tamaño óptico. 30 KiB.

El CV en PDF no los usa: `cv.astro` sigue con los estáticos, porque Chromium
convierte las instancias de una fuente variable en fuentes Type 3 al imprimir
(ver `astro.config.mjs`).

La salida es estable: cada origen va fijado por versión y comprobado por hash, y
la marca de tiempo de la tabla `head` no se reescribe. Volver a ejecutarlo da
los mismos bytes.

Uso, con fontTools y brotli instalados:

    python scripts/fonts/instance_variable_fonts.py
"""

from __future__ import annotations

import hashlib
import io
import sys
import urllib.request
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS_DIR = Path(__file__).resolve().parents[2] / "src" / "assets" / "fonts"
CDN = "https://cdn.jsdelivr.net/npm"

FONTS = [
    {
        "source": f"{CDN}/@fontsource-variable/inter@5.3.0"
        "/files/inter-latin-opsz-normal.woff2",
        "sha256": "2c295d99e26dcf357d4d01bcf270fd6924b600c9a13dd8c363ef114f4c6976fa",
        "axes": {"opsz": 14, "wght": (400, 800)},
        "output": "inter-latin-400-800.woff2",
    },
    {
        "source": f"{CDN}/@fontsource-variable/jetbrains-mono@5.3.0"
        "/files/jetbrains-mono-latin-wght-normal.woff2",
        "sha256": "18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e",
        "axes": {"wght": (400, 700)},
        "output": "jetbrains-mono-latin-400-700.woff2",
    },
]


def instance(font: dict) -> Path:
    with urllib.request.urlopen(font["source"]) as response:
        data = response.read()

    digest = hashlib.sha256(data).hexdigest()
    if digest != font["sha256"]:
        sys.exit(f"{font['output']}: el origen ya no es el que se recortó ({digest})")

    variable = TTFont(io.BytesIO(data), recalcTimestamp=False)
    result = instancer.instantiateVariableFont(variable, font["axes"])
    result.flavor = "woff2"
    result.recalcTimestamp = False

    output = FONTS_DIR / font["output"]
    output.parent.mkdir(parents=True, exist_ok=True)
    result.save(output)
    return output


def main() -> None:
    for font in FONTS:
        output = instance(font)
        print(f"{output.name}: {output.stat().st_size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
