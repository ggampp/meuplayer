#!/usr/bin/env python3
"""One-shot helper: copy public JS/JSX into src/ as TypeScript modules."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write_app() -> None:
    src = (ROOT / "public" / "app.jsx").read_text(encoding="utf-8")
    header = (
        'import React, { useEffect, useMemo, useState, useRef } from "react";\n'
        'import { createRoot } from "react-dom/client";\n'
        'import { createPortal } from "react-dom";\n\n'
    )
    src = src.replace(
        "const { useEffect, useMemo, useState, useRef } = React;\n\n", header
    )
    src = src.replace("ReactDOM.createPortal", "createPortal")
    src = src.replace(
        'const root = ReactDOM.createRoot(document.getElementById("root"));\n'
        "root.render(<App />);",
        'const rootEl = document.getElementById("root");\n'
        "if (rootEl) {\n"
        "  createRoot(rootEl).render(<App />);\n"
        "}",
    )
    out = ROOT / "src" / "app" / "main.tsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(src, encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} series_ok={'Séries' in src}")


def strip_iife(text: str) -> str:
    text = text.lstrip("\ufeff")
    text = re.sub(r"^\(function\s*\((?:global)?\)\s*\{\s*", "", text)
    text = re.sub(r"\}\)\s*\(\s*window\s*\)\s*;\s*$", "", text)
    text = re.sub(r"\}\)\s*\(\s*\)\s*;\s*$", "", text)
    text = text.replace("global.dispatchEvent", "window.dispatchEvent")
    text = text.replace("global.MeuPlayerRedeBuzzStore", "window.MeuPlayerRedeBuzzStore")
    text = text.replace("global.MeuPlayerRedeBuzzUI", "window.MeuPlayerRedeBuzzUI")
    return text


def write_modules() -> None:
    mapping = {
        "nav.js": "nav.ts",
        "player.js": "player.ts",
        "provider-modal.js": "provider-modal.ts",
        "spatial-nav.js": "spatial-nav.ts",
        "rede-buzz-store.js": "rede-buzz-store.ts",
        "rede-buzz-ui.js": "rede-buzz-ui.ts",
    }
    for src_name, dst_name in mapping.items():
        text = (ROOT / "public" / src_name).read_text(encoding="utf-8")
        text = strip_iife(text)
        # nav/player still wrapped in nested IIFE after first strip
        text = strip_iife(text)
        out = ROOT / "src" / dst_name
        out.write_text(text, encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)} ({len(text)} bytes)")


if __name__ == "__main__":
    write_app()
    write_modules()
