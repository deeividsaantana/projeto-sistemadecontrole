from __future__ import annotations

import os
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {".git", ".netlify", ".publicar-tudo-tools", "node_modules"}
EXCLUDED_FILES = {".publicar-tudo.local.json", ".env.publicar-tudo.local"}


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python scripts/criar-zip-windows.py CAMINHO_DO_ZIP")
        return 2

    output = Path(sys.argv[1]).resolve()
    temporary = output.with_name(f"{output.stem}.tmp{output.suffix}")
    output.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(
        temporary,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=6,
        allowZip64=True,
    ) as archive:
        for source in sorted(ROOT.rglob("*")):
            relative = source.relative_to(ROOT)
            if any(part in EXCLUDED_DIRS for part in relative.parts):
                continue
            if source.name in EXCLUDED_FILES or not source.is_file():
                continue
            archive.write(source, relative.as_posix())

    with zipfile.ZipFile(temporary, mode="r") as archive:
        invalid = archive.testzip()
        if invalid:
            temporary.unlink(missing_ok=True)
            raise RuntimeError(f"Arquivo inválido dentro do pacote: {invalid}")

    os.replace(temporary, output)
    print(f"ZIP criado e validado: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
