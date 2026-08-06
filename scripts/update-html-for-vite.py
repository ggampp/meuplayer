#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"

REPLACEMENTS = [
    (r'src="/nav\.js(?:\?v=[^"]*)?"', 'type="module" src="/js/nav.js"'),
    (r"src='/nav\.js(?:\?v=[^']*)?'", "type='module' src='/js/nav.js'"),
    (r'src="/player\.js(?:\?v=[^"]*)?"', 'type="module" src="/js/player.js"'),
    (r'src="/provider-modal\.js(?:\?v=[^"]*)?"', 'type="module" src="/js/provider-modal.js"'),
    (r'src="/spatial-nav\.js(?:\?v=[^"]*)?"', 'type="module" src="/js/spatial-nav.js"'),
    (r'src="/rede-buzz-store\.js(?:\?v=[^"]*)?"', 'type="module" src="/js/rede-buzz-store.js"'),
    (r'src="/rede-buzz-ui\.js(?:\?v=[^"]*)?"', 'type="module" src="/js/rede-buzz-ui.js"'),
    (r'src="/app\.js(?:\?v=[^"]*)?"', 'type="module" src="/js/app.js"'),
]

CDN_PATTERNS = [
    re.compile(
        r"\s*<script\s+crossorigin\s+src=\"https://unpkg\.com/react@18/umd/react\.production\.min\.js\"\s*>\s*</script>\s*",
        re.I,
    ),
    re.compile(
        r"\s*<script\s+crossorigin\s+src=\"https://unpkg\.com/react-dom@18/umd/react-dom\.production\.min\.js\"\s*>\s*</script>\s*",
        re.I,
    ),
]


def main() -> None:
    for html in sorted(ROOT.glob("*.html")):
        text = html.read_text(encoding="utf-8")
        orig = text
        for pat, rep in REPLACEMENTS:
            text = re.sub(pat, rep, text)
        for pat in CDN_PATTERNS:
            text = pat.sub("\n", text)
        text = text.replace('type="module" type="module"', 'type="module"')
        if text != orig:
            html.write_text(text, encoding="utf-8")
            print(f"updated {html.name}")
        else:
            print(f"unchanged {html.name}")


if __name__ == "__main__":
    main()
