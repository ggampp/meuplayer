#!/usr/bin/env python3
"""Copia api_cache e media_metadata do SQLite para PostgreSQL.

Uso:
  set CACHE_DATABASE_URL=postgresql://user:pass@host:5432/meuplayer
  python scripts/migrate-cache-sqlite-to-postgres.py

  python scripts/migrate-cache-sqlite-to-postgres.py --sqlite path/to/cache.sqlite3
"""

import argparse
import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

env_path = os.path.join(ROOT, ".env")
if os.path.isfile(env_path):
    with open(env_path, "r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

from cache_db import PostgresCacheDatabase, resolve_cache_database_url  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Migra cache SQLite → PostgreSQL")
    parser.add_argument(
        "--sqlite",
        default=os.path.join(ROOT, "cache.sqlite3"),
        help="Caminho do cache.sqlite3 de origem",
    )
    args = parser.parse_args()

    kind, target = resolve_cache_database_url()
    if kind != "postgres":
        print(
            "Defina CACHE_DATABASE_URL=postgresql://… no ambiente ou .env",
            file=sys.stderr,
        )
        sys.exit(1)

    if not os.path.isfile(args.sqlite):
        print(f"SQLite não encontrado: {args.sqlite}", file=sys.stderr)
        sys.exit(1)

    src = sqlite3.connect(args.sqlite)
    dst = PostgresCacheDatabase(target)

    api_rows = src.execute(
        "SELECT cache_key, status, content_type, body, expires_at, updated_at FROM api_cache"
    ).fetchall()
    meta_rows = src.execute(
        "SELECT media_key, media_type, tmdb_id, body, updated_at FROM media_metadata"
    ).fetchall()

    for row in api_rows:
        dst.api_cache_set(*row)

    for row in meta_rows:
        dst.media_metadata_set(*row)

    print(f"Migrados {len(api_rows)} registros de api_cache")
    print(f"Migrados {len(meta_rows)} registros de media_metadata")


if __name__ == "__main__":
    main()
