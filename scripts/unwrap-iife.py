#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def unwrap_iife(text: str) -> str:
    text = text.lstrip("\ufeff").strip()
    patterns = [
        (r"^\(function\s*\(\)\s*\{", r"\}\)\s*\(\)\s*;\s*$"),
        (r"^\(function\s*\(global\)\s*\{", r"\}\)\s*\(\s*window\s*\)\s*;\s*$"),
    ]
    for start_re, end_re in patterns:
        if re.search(start_re, text) and re.search(end_re, text):
            text = re.sub(start_re, "", text, count=1)
            text = re.sub(end_re, "", text, count=1)
            lines = text.splitlines()
            indents = [len(line) - len(line.lstrip(" ")) for line in lines if line.strip()]
            if indents:
                m = min(indents)
                if m >= 2:
                    lines = [line[m:] if line.startswith(" " * m) else line for line in lines]
            text = "\n".join(lines).strip() + "\n"
            text = text.replace("global.dispatchEvent", "window.dispatchEvent")
            text = text.replace("global.MeuPlayerRedeBuzzStore", "window.MeuPlayerRedeBuzzStore")
            text = text.replace("global.MeuPlayerRedeBuzzUI", "window.MeuPlayerRedeBuzzUI")
            text = text.replace("global.location", "window.location")
            return text
    return text if text.endswith("\n") else text + "\n"


def main() -> None:
    mapping = {
        "nav.js": "nav.ts",
        "player.js": "player.ts",
        "provider-modal.js": "provider-modal.ts",
        "spatial-nav.js": "spatial-nav.ts",
        "rede-buzz-store.js": "rede-buzz-store.ts",
        "rede-buzz-ui.js": "rede-buzz-ui.ts",
    }
    for src_name, dst_name in mapping.items():
        raw = (ROOT / "public" / src_name).read_text(encoding="utf-8")
        out = unwrap_iife(raw)
        if dst_name == "nav.ts":
            out = out.replace(
                "script.src = '/provider-modal.js';",
                "script.type = 'module';\n    script.src = '/js/provider-modal.js';",
            )
            out = out.replace(
                'script.src = "/provider-modal.js";',
                "script.type = 'module';\n    script.src = '/js/provider-modal.js';",
            )
        path = ROOT / "src" / dst_name
        path.write_text(out, encoding="utf-8")
        print(
            f"{dst_name}: braces {{ {out.count('{')} }} {out.count('}')}  bytes={len(out)}"
        )


if __name__ == "__main__":
    main()
