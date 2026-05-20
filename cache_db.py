"""Cache persistente: SQLite (padrão) ou PostgreSQL via CACHE_DATABASE_URL."""

import os
import sqlite3
import threading
from time import time


class CacheDatabase:
    backend = "unknown"

    def api_cache_get(self, cache_key):
        raise NotImplementedError

    def api_cache_delete(self, cache_key):
        raise NotImplementedError

    def api_cache_set(
        self, cache_key, status, content_type, body, expires_at, updated_at
    ):
        raise NotImplementedError

    def media_metadata_get(self, media_key):
        raise NotImplementedError

    def media_metadata_set(self, media_key, media_type, tmdb_id, body, updated_at):
        raise NotImplementedError

    def media_metadata_list(self, limit):
        raise NotImplementedError


class SqliteCacheDatabase(CacheDatabase):
    backend = "sqlite"

    def __init__(self, db_path):
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._init_schema()
        self._conn.commit()

    def _init_schema(self):
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_cache (
                cache_key TEXT PRIMARY KEY,
                status INTEGER NOT NULL,
                content_type TEXT NOT NULL,
                body BLOB NOT NULL,
                expires_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS media_metadata (
                media_key TEXT PRIMARY KEY,
                media_type TEXT NOT NULL,
                tmdb_id TEXT NOT NULL,
                body BLOB NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )

    def api_cache_get(self, cache_key):
        return self._conn.execute(
            """
            SELECT status, content_type, body, expires_at
            FROM api_cache
            WHERE cache_key = ?
            """,
            (cache_key,),
        ).fetchone()

    def api_cache_delete(self, cache_key):
        self._conn.execute("DELETE FROM api_cache WHERE cache_key = ?", (cache_key,))
        self._conn.commit()

    def api_cache_set(
        self, cache_key, status, content_type, body, expires_at, updated_at
    ):
        self._conn.execute(
            """
            INSERT INTO api_cache (cache_key, status, content_type, body, expires_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                status = excluded.status,
                content_type = excluded.content_type,
                body = excluded.body,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
            """,
            (cache_key, status, content_type, body, expires_at, updated_at),
        )
        self._conn.commit()

    def media_metadata_get(self, media_key):
        row = self._conn.execute(
            "SELECT body FROM media_metadata WHERE media_key = ?",
            (media_key,),
        ).fetchone()
        return row[0] if row else None

    def media_metadata_set(self, media_key, media_type, tmdb_id, body, updated_at):
        self._conn.execute(
            """
            INSERT INTO media_metadata (media_key, media_type, tmdb_id, body, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(media_key) DO UPDATE SET
                media_type = excluded.media_type,
                tmdb_id = excluded.tmdb_id,
                body = excluded.body,
                updated_at = excluded.updated_at
            """,
            (media_key, media_type, tmdb_id, body, updated_at),
        )
        self._conn.commit()

    def media_metadata_list(self, limit):
        return self._conn.execute(
            """
            SELECT media_key, media_type, tmdb_id, body, updated_at
            FROM media_metadata
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()


class PostgresCacheDatabase(CacheDatabase):
    backend = "postgres"

    def __init__(self, database_url):
        try:
            import psycopg2
        except ImportError as exc:
            raise RuntimeError(
                "PostgreSQL configurado em CACHE_DATABASE_URL, mas psycopg2 não está instalado. "
                "Execute: pip install psycopg2-binary"
            ) from exc

        self._psycopg2 = psycopg2
        self._conn = psycopg2.connect(database_url)
        self._conn.autocommit = False
        self._init_schema()
        self._conn.commit()

    def _init_schema(self):
        with self._conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS api_cache (
                    cache_key TEXT PRIMARY KEY,
                    status INTEGER NOT NULL,
                    content_type TEXT NOT NULL,
                    body BYTEA NOT NULL,
                    expires_at BIGINT NOT NULL,
                    updated_at BIGINT NOT NULL
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS media_metadata (
                    media_key TEXT PRIMARY KEY,
                    media_type TEXT NOT NULL,
                    tmdb_id TEXT NOT NULL,
                    body BYTEA NOT NULL,
                    updated_at BIGINT NOT NULL
                )
                """
            )

    def api_cache_get(self, cache_key):
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT status, content_type, body, expires_at
                FROM api_cache
                WHERE cache_key = %s
                """,
                (cache_key,),
            )
            return cur.fetchone()

    def api_cache_delete(self, cache_key):
        with self._conn.cursor() as cur:
            cur.execute("DELETE FROM api_cache WHERE cache_key = %s", (cache_key,))
        self._conn.commit()

    def api_cache_set(
        self, cache_key, status, content_type, body, expires_at, updated_at
    ):
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api_cache (
                    cache_key, status, content_type, body, expires_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (cache_key) DO UPDATE SET
                    status = EXCLUDED.status,
                    content_type = EXCLUDED.content_type,
                    body = EXCLUDED.body,
                    expires_at = EXCLUDED.expires_at,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    cache_key,
                    status,
                    content_type,
                    self._psycopg2.Binary(body) if body is not None else None,
                    expires_at,
                    updated_at,
                ),
            )
        self._conn.commit()

    def media_metadata_get(self, media_key):
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT body FROM media_metadata WHERE media_key = %s",
                (media_key,),
            )
            row = cur.fetchone()
        return row[0] if row else None

    def media_metadata_set(self, media_key, media_type, tmdb_id, body, updated_at):
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO media_metadata (media_key, media_type, tmdb_id, body, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (media_key) DO UPDATE SET
                    media_type = EXCLUDED.media_type,
                    tmdb_id = EXCLUDED.tmdb_id,
                    body = EXCLUDED.body,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    media_key,
                    media_type,
                    tmdb_id,
                    self._psycopg2.Binary(body) if body is not None else None,
                    updated_at,
                ),
            )
        self._conn.commit()

    def media_metadata_list(self, limit):
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT media_key, media_type, tmdb_id, body, updated_at
                FROM media_metadata
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            return cur.fetchall()


def resolve_cache_database_url(explicit_url=None, sqlite_path=None):
    url = (explicit_url or os.environ.get("CACHE_DATABASE_URL") or "").strip()
    if not url:
        return ("sqlite", sqlite_path)
    lowered = url.lower()
    if lowered in ("sqlite", "sqlite3", "file"):
        return ("sqlite", sqlite_path)
    if lowered.startswith(("postgres://", "postgresql://")):
        return ("postgres", url)
    raise ValueError(
        "CACHE_DATABASE_URL inválida. Use postgresql://… ou deixe vazio para SQLite."
    )


def create_cache_database(sqlite_path):
    kind, target = resolve_cache_database_url(sqlite_path=sqlite_path)
    if kind == "sqlite":
        return SqliteCacheDatabase(target)
    return PostgresCacheDatabase(target)
