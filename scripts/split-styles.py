"""Divide public/styles.css em partials em public/css/."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "styles.css"
OUT_DIR = ROOT / "public" / "css"

SECTIONS = [
    ("base.css", "/* —— Marquee Hero"),
    ("hero.css", "/* —— Buttons"),
    ("buttons.css", "/* —— Catalog header"),
    ("catalog.css", "/* —— Filter drawer"),
    ("filters.css", "/* —— Browse rows"),
    ("browse.css", "/* —— MediaCard"),
    ("cards.css", "/* —— Long Document detail"),
    ("detail.css", "/* —— Cast scroll"),
    ("cast.css", "/* —— Person detail"),
    ("person.css", "/* —— Modal player"),
    ("modal.css", "/* —— Workbench"),
    ("workbench.css", "/* —— About fallback"),
    ("about.css", "/* —— Settings"),
    ("settings.css", "/* —— Responsive"),
    ("responsive.css", "/* —— Netflix layout"),
    ("netflix.css", None),
]


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    markers = []
    for line_no, line in enumerate(lines):
        if line.startswith("/* ——"):
            markers.append((line_no, line.strip()))

    chunks: list[tuple[str, str]] = []
    header_end = markers[0][0] if markers else len(lines)
    chunks.append(("base.css", "".join(lines[:header_end])))

    for idx, (filename, next_marker) in enumerate(SECTIONS[1:], start=0):
        start = markers[idx][0]
        if next_marker:
            end = next((m[0] for m in markers if m[1].startswith(next_marker)), len(lines))
        else:
            end = len(lines)
        chunks.append((filename, "".join(lines[start:end])))

    imports = []
    for filename, content in chunks:
        path = OUT_DIR / filename
        path.write_text(content, encoding="utf-8")
        imports.append(f'@import url("/css/{filename}");')
        print(f"wrote {path.name} ({len(content.splitlines())} lines)")

    aggregator = (
        "/* MeuPlayer styles — agregador. Partials em public/css/ */\n\n"
        + "\n".join(imports)
        + "\n"
    )
    SRC.write_text(aggregator, encoding="utf-8")
    print(f"updated {SRC.name} ({len(imports)} imports)")


if __name__ == "__main__":
    main()
