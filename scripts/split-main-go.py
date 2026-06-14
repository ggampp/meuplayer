"""Extrai handlers de main.go para arquivos handlers_*.go e server_core.go."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "main.go"

GROUPS = [
    (
        "server_core.go",
        [
            "corsMiddleware",
            "setupPaths",
            "loadEnvFile",
            "bootstrapTmdbKey",
            "getTmdbApiKey",
            "setTmdbApiKey",
            "maskTmdbKey",
            "setupDatabase",
            "runPeriodicCleanup",
            "sendJSONError",
            "ensureTmdbKey",
            "fetchWithCache",
        ],
    ),
    ("handlers_static.go", ["handleStaticOrSPA"]),
    ("handlers_settings.go", ["handleSettings"]),
    (
        "handlers_superflix.go",
        ["handleLista", "handleCalendario", "handleGuia", "parseGuiaHTML"],
    ),
    (
        "handlers_tmdb.go",
        [
            "handleTmdbDetail",
            "warmTmdbImages",
            "handleTmdbGenres",
            "handleTmdbSearch",
            "handleTmdbDiscover",
            "handleTmdbSeason",
            "handleTmdbRelated",
            "handleTmdbCredits",
            "handleTmdbPerson",
            "handleTmdbPersonCredits",
            "handleMediaMetaBatch",
            "tmdbMetaIsAdult",
            "normalizeText",
            "handleMediaStored",
            "isAnimationTV",
            "handleTmdbImage",
        ],
    ),
    (
        "handlers_rede_buzz.go",
        [
            "filterRedeBuzzPayload",
            "isRdeAdultCategory",
            "handleRedeBuzzChannels",
            "handleRedeBuzzCategories",
            "handleRedeBuzzSearch",
        ],
    ),
    (
        "handlers_remote.go",
        [
            "handleRemoteSessionCreate",
            "handleRemoteEvents",
            "handleRemoteCommand",
            "generateSessionToken",
        ],
    ),
    (
        "handlers_misc.go",
        [
            "handleClientEnv",
            "handleUnifiedChannels",
            "handleCacheStats",
            "handleCacheClear",
        ],
    ),
]


def split_import_and_declarations(text: str) -> tuple[str, str]:
    lines = text.splitlines(keepends=True)
    decl_end = 0
    for idx, line in enumerate(lines):
        if line.startswith("func "):
            decl_end = idx
            break
    return "".join(lines[:decl_end]), "".join(lines[decl_end:])


def extract_functions(body: str) -> dict[str, str]:
    lines = body.splitlines(keepends=True)
    starts: list[tuple[str, int]] = []
    for idx, line in enumerate(lines):
        if line.startswith("func "):
            name = line.split("(")[0].replace("func ", "").strip()
            starts.append((name, idx))
    chunks: dict[str, str] = {}
    for idx, (name, start) in enumerate(starts):
        end = starts[idx + 1][1] if idx + 1 < len(starts) else len(lines)
        chunks[name] = "".join(lines[start:end])
    return chunks


def import_header(declarations: str) -> str:
    match = re.search(r"(?ms)^package main\r?\n\r?\nimport \([^)]*\)\r?\n", declarations)
    if not match:
        raise SystemExit("bloco import não encontrado em main.go")
    return match.group(0) + "\n"


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    declarations, body = split_import_and_declarations(text)
    chunks = extract_functions(body)
    shared = import_header(declarations)

    main_func = chunks.pop("main", "")
    if not main_func:
        raise SystemExit("main() não encontrada")

    for outfile, names in GROUPS:
        content = shared + "".join(chunks.pop(name, "") for name in names)
        (ROOT / outfile).write_text(content, encoding="utf-8")
        print(f"wrote {outfile}")

    if chunks:
        print("warning: funções não agrupadas:", ", ".join(sorted(chunks)))

    SRC.write_text(declarations + main_func, encoding="utf-8")
    print(f"trimmed main.go")


if __name__ == "__main__":
    main()
