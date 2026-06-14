"""Remove unused imports from Go files until go build succeeds."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT_RE = re.compile(r'^"([^"]+)" imported and not used$')


def main() -> None:
    for _ in range(200):
        proc = subprocess.run(
            ["go", "build", "."],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if proc.returncode == 0:
            print("go build OK")
            return

        removals: list[tuple[Path, str]] = []
        for line in proc.stderr.splitlines():
            file_match = re.match(r"^\.[\\/]?([^:]+):\d+:\d+: (.+)", line)
            if not file_match:
                continue
            target_file, message = file_match.groups()
            imp = IMPORT_RE.match(message)
            if imp:
                removals.append((ROOT / target_file, imp.group(1)))

        if not removals:
            print(proc.stderr)
            raise SystemExit(1)

        for path, pkg in removals:
            text = path.read_text(encoding="utf-8")
            new_text = text.replace(f'\t"{pkg}"\n', "")
            path.write_text(new_text, encoding="utf-8")
            print(f"removed unused {pkg} from {path.name}")


if __name__ == "__main__":
    main()
