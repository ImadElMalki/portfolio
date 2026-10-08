"""Piezas compartidas por los scripts de captura de la galería.

Cada script de esta carpeta reutiliza el arnés de Playwright del proyecto que
captura —su stub de `chrome.*`, su servidor, su semilla— en vez de reimplementarlo.
Lo que vive aquí es lo propio del portafolio: dónde se escriben los PNG, qué
cadenas no pueden aparecer nunca en una imagen publicada, y cómo avisar de que
falta levantar un servidor.
"""

from __future__ import annotations

import socket
import sys
from pathlib import Path


def repo_arg(default: str) -> Path:
    """Lee `--repo`, con un valor por defecto para el uso habitual."""
    argv = sys.argv
    if "--repo" in argv:
        repo = Path(argv[argv.index("--repo") + 1])
    else:
        repo = Path(default)

    if not repo.is_dir():
        sys.exit(f"No existe el repositorio: {repo}")

    return repo


def out_arg(default: str) -> Path:
    """Lee `--out` y crea el directorio."""
    argv = sys.argv
    out = Path(argv[argv.index("--out") + 1]) if "--out" in argv else Path(default)
    out.mkdir(parents=True, exist_ok=True)
    return out


def require_port(port: int, command: str) -> None:
    """Sale con instrucciones si el servidor que hace falta no está levantado.

    Los scripts no arrancan servidores a propósito: orquestar Node, Vite, Spring
    Boot y Angular desde Python es donde estas cosas se pudren, y el fallo
    silencioso es capturar una página de error creyendo que es la aplicación.

    Se prueban IPv4 e IPv6: `ng serve` se ata a `::1` y no a `127.0.0.1`, así que
    mirar solo una de las dos da un falso negativo.
    """
    for family, _type, _proto, _canon, address in socket.getaddrinfo(
        "localhost", port, proto=socket.IPPROTO_TCP
    ):
        with socket.socket(family, socket.SOCK_STREAM) as probe:
            probe.settimeout(1.0)
            if probe.connect_ex(address) == 0:
                return

    sys.exit(
        f"No hay nada escuchando en localhost:{port}.\n"
        f"Levántalo en otra terminal y vuelve a lanzar esto:\n\n    {command}\n"
    )


class Guard:
    """Comprueba que ninguna captura publique una cadena prohibida.

    Sustituir la semilla de un proyecto solo cubre los datos que conoces. Esta
    aserción, contra el texto que de verdad se renderiza, cubre los que no: una
    lista de reglas aprendidas, un valor por defecto del código, un resto en el
    almacenamiento.
    """

    def __init__(self, forbidden: list[str]) -> None:
        self.forbidden = [value.casefold() for value in forbidden]

    def check(self, text: str, where: str) -> None:
        hits = [value for value in self.forbidden if value in text.casefold()]
        if hits:
            raise SystemExit(
                f"{where}: la captura contiene datos que no deben publicarse: "
                f"{', '.join(hits)}"
            )


def save(page, path: Path, guard: Guard | None = None, **kwargs) -> None:
    """Guarda una captura después de revisar su texto."""
    if guard is not None:
        guard.check(page.inner_text("body"), path.name)

    page.screenshot(path=str(path), **kwargs)
    print(f"  ✓ {path.name}")


def denylist() -> list[str]:
    """Los términos que no pueden salir en una imagen publicada.

    Viven **fuera** del repositorio, en el mismo archivo que usa
    `scripts/export-public.mjs`, y por el mismo motivo: escribirlos aquí sería
    publicarlos. `caixabank.py` los llevaba escritos —comercios, aseguradora,
    operadora y el pueblo, sacados de su propio buzón— y ese guion sí viaja en
    la copia pública.

    Un término por línea; `#` comenta y las vacías se ignoran. Las líneas que
    empiezan por `!` son excepciones del exportador y aquí no pintan nada: se
    descartan.

    Si el archivo no está, el guion se para. Una guarda con la lista vacía no
    protege de nada y además lo hace en silencio, que es lo peor de los dos
    mundos.
    """
    import os

    override = os.environ.get("PUBLIC_DENYLIST")
    path = (
        Path(override)
        if override
        else Path(__file__).resolve().parents[2].parent
        / "portfolio-public-denylist.txt"
    )

    if not path.is_file():
        sys.exit(
            f"No existe la lista de términos vetados: {path}\n"
            "Vive fuera del repositorio a propósito. Créala con una línea por\n"
            "término, o apunta a otra con la variable PUBLIC_DENYLIST.\n"
        )

    terms = [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith(("#", "!"))
    ]

    if not terms:
        sys.exit(f"La lista {path} no tiene ni un término.")

    return terms
