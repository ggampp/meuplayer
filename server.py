import json
import mimetypes
import os
import re
import sqlite3
import threading
from datetime import date
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from time import time
from urllib.parse import urlencode, urlparse, parse_qs, quote_plus, unquote
from urllib.request import Request, urlopen

def load_env(path):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as file:
        for line in file:
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_env(ENV_PATH)

API_BASE = "https://superflixapi.one"
RDE_API_BASE = "https://reidosembeds.com/api"
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "public")
DB_PATH = os.path.join(os.path.dirname(__file__), "cache.sqlite3")
IMAGE_CACHE_DIR = os.path.join(STATIC_DIR, "cache", "images", "tmdb")

TTL_GUIA_SECONDS = 30 * 60
TTL_TMDB_DETAILS_SECONDS = 7 * 24 * 60 * 60
TTL_TMDB_GENRES_SECONDS = 30 * 24 * 60 * 60
TTL_TMDB_SEARCH_SECONDS = 24 * 60 * 60
TTL_TMDB_SEASON_SECONDS = 3 * 24 * 60 * 60
TTL_TMDB_RELATED_SECONDS = 3 * 24 * 60 * 60
TTL_IMAGE_SECONDS = 30 * 24 * 60 * 60
TTL_LISTA_SECONDS = 6 * 60 * 60
TTL_RDE_SECONDS = 30 * 60

TMDB_CACHE = {}
DB_LOCK = threading.Lock()

ANIMATION_GENRE_ID = 16


def _tmdb_media_type(app_type):
    return "movie" if app_type == "movie" else "tv"


def _media_storage_key(app_type, tmdb_id):
    return f"{_tmdb_media_type(app_type)}:{tmdb_id}"


def _is_animation_tv(meta):
    if not meta:
        return False
    genre_ids = []
    for genre in meta.get("genres") or []:
        if isinstance(genre, dict):
            genre_ids.append(genre.get("id"))
        else:
            genre_ids.append(genre)
    genre_ids.extend(meta.get("genre_ids") or [])
    return ANIMATION_GENRE_ID in genre_ids


def _connect_cache_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
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
    conn.execute(
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
    conn.commit()
    return conn


def _media_metadata_get(media_key):
    with DB_LOCK:
        row = DB_CONN.execute(
            """
            SELECT body FROM media_metadata WHERE media_key = ?
            """,
            (media_key,),
        ).fetchone()
    if not row:
        return None
    return row[0]


def _media_metadata_set(media_key, media_type, tmdb_id, body):
    now = int(time())
    with DB_LOCK:
        DB_CONN.execute(
            """
            INSERT INTO media_metadata (media_key, media_type, tmdb_id, body, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(media_key) DO UPDATE SET
                media_type = excluded.media_type,
                tmdb_id = excluded.tmdb_id,
                body = excluded.body,
                updated_at = excluded.updated_at
            """,
            (media_key, media_type, tmdb_id, body, now),
        )
        DB_CONN.commit()


def _warm_tmdb_images(meta):
    if not isinstance(meta, dict):
        return
    paths = []
    for key in ("poster_path", "backdrop_path"):
        path = meta.get(key)
        if path:
            paths.append(path)
    for size, rel_path in (("w500", paths[0] if paths else None), ("w1280", paths[-1] if len(paths) > 1 else None)):
        if not rel_path:
            continue
        local_path = os.path.join(IMAGE_CACHE_DIR, size, rel_path.lstrip("/"))
        if os.path.exists(local_path):
            continue
        try:
            remote_url = f"{TMDB_IMAGE_BASE}/{size}/{rel_path.lstrip('/')}"
            req = Request(remote_url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=20) as response:
                body = response.read()
                if response.status == 200:
                    os.makedirs(os.path.dirname(local_path), exist_ok=True)
                    tmp_path = f"{local_path}.tmp"
                    with open(tmp_path, "wb") as file:
                        file.write(body)
                    os.replace(tmp_path, local_path)
        except Exception:
            pass


DB_CONN = _connect_cache_db()
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)

ALLOWED_IMAGE_SIZES = {
    "w45",
    "w92",
    "w154",
    "w185",
    "w300",
    "w342",
    "w500",
    "w780",
    "w1280",
    "original",
}

# 1x1 GIF transparente para fallback de capa ausente
PLACEHOLDER_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04"
    b"\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x01D\x00;"
)

CLIENT_DISCONNECT_ERRORS = (
    ConnectionAbortedError,
    ConnectionResetError,
    BrokenPipeError,
)


def _is_client_disconnect(exc):
    if isinstance(exc, CLIENT_DISCONNECT_ERRORS):
        return True
    if isinstance(exc, OSError):
        winerror = getattr(exc, "winerror", None)
        if winerror in (10053, 10054):
            return True
    return False


class MeuPlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except Exception as exc:
            if _is_client_disconnect(exc):
                return
            raise

    def log_message(self, format, *args):
        message = format % args
        if "10053" in message or "10054" in message:
            return
        super().log_message(format, *args)

    def log_error(self, format, *args):
        message = format % args
        if "10053" in message or "10054" in message:
            return
        super().log_error(format, *args)

    def log_exception(self, exc_info):
        if exc_info and exc_info[1] and _is_client_disconnect(exc_info[1]):
            return
        super().log_exception(exc_info)

    def _safe_write(self, body):
        try:
            self.wfile.write(body)
        except Exception as exc:
            if _is_client_disconnect(exc):
                return False
            raise
        return True

    def _safe_end_headers(self):
        try:
            self.end_headers()
        except Exception as exc:
            if _is_client_disconnect(exc):
                return False
            raise
        return True

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/image/tmdb/"):
            self._proxy_tmdb_image(parsed.path)
            return
        route_target = self._resolve_site_route(parsed.path)
        if route_target:
            self.path = route_target
            super().do_GET()
            return
        if parsed.path == "/api/lista":
            self._proxy_lista(parsed.query)
            return
        if parsed.path == "/api/calendario":
            self._proxy_simple(f"{API_BASE}/calendario.php")
            return
        if parsed.path == "/api/tmdb":
            self._proxy_tmdb(parsed.query)
            return
        if parsed.path == "/api/tmdb/genres":
            self._proxy_tmdb_genres(parsed.query)
            return
        if parsed.path == "/api/tmdb/search":
            self._proxy_tmdb_search(parsed.query)
            return
        if parsed.path == "/api/tmdb/discover":
            self._proxy_tmdb_discover(parsed.query)
            return
        if parsed.path == "/api/tmdb/season":
            self._proxy_tmdb_season(parsed.query)
            return
        if parsed.path == "/api/tmdb/related":
            self._proxy_tmdb_related(parsed.query)
            return
        if parsed.path == "/api/guia":
            self._proxy_guia(parsed.query)
            return
        if parsed.path == "/api/media/meta/batch":
            self._api_media_meta_batch(parsed.query)
            return
        if parsed.path == "/api/media/stored":
            self._api_media_stored(parsed.query)
            return
        if parsed.path == "/api/rede-buzz/channels":
            self._proxy_rede_buzz_channels(parsed.query)
            return
        if parsed.path == "/api/rede-buzz/categories":
            self._proxy_rede_buzz_categories()
            return
        if parsed.path == "/api/rede-buzz/search":
            self._proxy_rede_buzz_search(parsed.query)
            return
        super().do_GET()

    def _resolve_site_route(self, path):
        if path in ("", "/"):
            return "/index.html"
        if path in ("/canais", "/canais/"):
            return "/canais.html"
        if path in ("/rede-buzz", "/rede-buzz/"):
            return "/rede-buzz.html"
        route_map = {
            "/filme": "/filme.html",
            "/anime": "/anime.html",
            "/serie": "/serie.html",
        }
        for route_prefix, target_file in route_map.items():
            if path == route_prefix or path == f"{route_prefix}/":
                return target_file
            if path.startswith(f"{route_prefix}/"):
                return target_file
        return None

    def _proxy_lista(self, query):
        params = parse_qs(query)
        if "format" not in params:
            params["format"] = ["json"]
        cache_key = f"lista:{urlencode(sorted(params.items()))}"
        cached = self._cache_get(cache_key)
        if cached:
            self._send_response(
                cached["status"],
                cached["content_type"],
                cached["body"],
                cache_status="HIT",
            )
            return
        url = f"{API_BASE}/lista?{urlencode(params, doseq=True)}"
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                content_type = response.headers.get("Content-Type", "application/json")
                if response.status == 200:
                    self._cache_set(
                        cache_key=cache_key,
                        status=response.status,
                        content_type=content_type,
                        body=body,
                        ttl_seconds=TTL_LISTA_SECONDS,
                    )
                self._send_response(response.status, content_type, body, cache_status="MISS")
        except Exception as exc:
            self._send_json_error(502, "Falha ao acessar a API externa", str(exc))

    def _proxy_simple(self, url):
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                content_type = response.headers.get("Content-Type", "application/json")
                self._send_response(response.status, content_type, body)
        except Exception as exc:
            if not _is_client_disconnect(exc):
                self._send_json_error(502, "Falha ao acessar a API externa", str(exc))

    def _send_json_error(self, status_code, error, detail=None):
        try:
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            if not self._safe_end_headers():
                return
            payload = {"error": error}
            if detail:
                payload["detail"] = detail
            self._safe_write(json.dumps(payload).encode("utf-8"))
        except Exception as exc:
            if not _is_client_disconnect(exc):
                raise

    def _send_response(self, status_code, content_type, body, cache_status=None):
        try:
            self.send_response(status_code)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            if cache_status:
                self.send_header("X-Cache", cache_status)
            if not self._safe_end_headers():
                return
            self._safe_write(body)
        except Exception as exc:
            if not _is_client_disconnect(exc):
                raise

    def _safe_image_cache_path(self, size, image_rel_path):
        decoded = unquote(image_rel_path).lstrip("/")
        if not decoded or ".." in decoded or decoded.startswith("."):
            return None
        if "\\" in decoded:
            return None
        if not any(decoded.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif")):
            return None
        return os.path.join(IMAGE_CACHE_DIR, size, decoded)

    def _proxy_tmdb_image(self, path):
        prefix = "/api/image/tmdb/"
        raw = path[len(prefix):]
        if "/" not in raw:
            self._send_json_error(400, "Formato inválido de imagem")
            return

        size, image_rel_path = raw.split("/", 1)
        if size not in ALLOWED_IMAGE_SIZES:
            self._send_json_error(400, "Tamanho de imagem inválido")
            return

        local_path = self._safe_image_cache_path(size, image_rel_path)
        if not local_path:
            self._send_json_error(400, "Caminho de imagem inválido")
            return

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        now = int(time())
        stale_exists = os.path.exists(local_path)
        if stale_exists:
            age = now - int(os.path.getmtime(local_path))
            if age <= TTL_IMAGE_SECONDS:
                self._serve_local_image(local_path)
                return

        remote_url = f"{TMDB_IMAGE_BASE}/{size}/{unquote(image_rel_path).lstrip('/')}"
        try:
            req = Request(remote_url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=20) as response:
                body = response.read()
                content_type = response.headers.get("Content-Type", "image/jpeg")
                if response.status == 200 and content_type.startswith("image/"):
                    tmp_path = f"{local_path}.tmp"
                    with open(tmp_path, "wb") as file:
                        file.write(body)
                    os.replace(tmp_path, local_path)
                    self._send_image_body(body, content_type, cache_status="MISS")
                    return
        except Exception:
            pass

        if stale_exists:
            self._serve_local_image(local_path, cache_status="STALE")
            return

        self._send_image_placeholder()

    def _send_image_body(self, body, content_type, cache_status="HIT"):
        try:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("X-Cache", cache_status)
            self.send_header("Cache-Control", f"public, max-age={TTL_IMAGE_SECONDS}")
            if not self._safe_end_headers():
                return
            self._safe_write(body)
        except Exception as exc:
            if not _is_client_disconnect(exc):
                raise

    def _send_image_placeholder(self):
        try:
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("X-Cache", "PLACEHOLDER")
            self.send_header("Cache-Control", "public, max-age=3600")
            if not self._safe_end_headers():
                return
            self._safe_write(PLACEHOLDER_GIF)
        except Exception as exc:
            if not _is_client_disconnect(exc):
                raise

    def _serve_local_image(self, local_path, cache_status="HIT"):
        try:
            content_type = mimetypes.guess_type(local_path)[0] or "application/octet-stream"
            with open(local_path, "rb") as file:
                body = file.read()
            self._send_image_body(body, content_type, cache_status=cache_status)
        except OSError:
            self._send_image_placeholder()

    def _cache_get(self, cache_key):
        cached = TMDB_CACHE.get(cache_key)
        now = int(time())
        if cached and cached["expires"] > now:
            payload = dict(cached)
            payload["cache_source"] = "memory"
            return payload

        with DB_LOCK:
            row = DB_CONN.execute(
                """
                SELECT status, content_type, body, expires_at
                FROM api_cache
                WHERE cache_key = ?
                """,
                (cache_key,),
            ).fetchone()

        if not row:
            return None

        status, content_type, body, expires_at = row
        if expires_at <= now:
            with DB_LOCK:
                DB_CONN.execute("DELETE FROM api_cache WHERE cache_key = ?", (cache_key,))
                DB_CONN.commit()
            TMDB_CACHE.pop(cache_key, None)
            return None

        payload = {
            "status": status,
            "content_type": content_type,
            "body": body,
            "expires": expires_at,
            "cache_source": "sqlite",
        }
        TMDB_CACHE[cache_key] = payload
        return payload

    def _cache_set(self, cache_key, status, content_type, body, ttl_seconds):
        now = int(time())
        expires_at = now + ttl_seconds
        payload = {
            "status": status,
            "content_type": content_type,
            "body": body,
            "expires": expires_at,
        }
        TMDB_CACHE[cache_key] = payload
        with DB_LOCK:
            DB_CONN.execute(
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
                (cache_key, status, content_type, body, expires_at, now),
            )
            DB_CONN.commit()

    def _proxy_tmdb_with_cache(self, url, cache_key, ttl_seconds):
        cached = self._cache_get(cache_key)
        if cached:
            self._send_response(
                cached["status"],
                cached["content_type"],
                cached["body"],
                cache_status="HIT",
            )
            return

        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                content_type = response.headers.get("Content-Type", "application/json")
                if response.status == 200:
                    self._cache_set(
                        cache_key=cache_key,
                        status=response.status,
                        content_type=content_type,
                        body=body,
                        ttl_seconds=ttl_seconds,
                    )
                self._send_response(response.status, content_type, body, cache_status="MISS")
        except Exception as exc:
            self._send_json_error(502, "Falha ao acessar o TMDB", str(exc))

    def _ensure_tmdb_key(self):
        if TMDB_API_KEY:
            return True
        self._send_json_error(
            400,
            "TMDB_API_KEY não configurada",
            "Defina a variável de ambiente TMDB_API_KEY",
        )
        return False

    def _fetch_tmdb_detail(self, app_type, tmdb_id):
        tmdb_media = _tmdb_media_type(app_type)
        storage_key = _media_storage_key(app_type, tmdb_id)
        cache_key = f"tmdb:{tmdb_media}:{tmdb_id}:pt-BR"

        stored = _media_metadata_get(storage_key)
        if stored:
            return stored, "application/json", "STORE"

        cached = self._cache_get(cache_key)
        if cached:
            if cached["status"] == 200:
                _media_metadata_set(storage_key, tmdb_media, tmdb_id, cached["body"])
                try:
                    meta = json.loads(cached["body"].decode("utf-8"))
                    _warm_tmdb_images(meta)
                except Exception:
                    pass
            return cached["body"], cached["content_type"], "HIT"

        url = f"{TMDB_BASE}/{tmdb_media}/{tmdb_id}?api_key={TMDB_API_KEY}&language=pt-BR"
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                content_type = response.headers.get("Content-Type", "application/json")
                if response.status == 200:
                    self._cache_set(
                        cache_key=cache_key,
                        status=response.status,
                        content_type=content_type,
                        body=body,
                        ttl_seconds=TTL_TMDB_DETAILS_SECONDS,
                    )
                    _media_metadata_set(storage_key, tmdb_media, tmdb_id, body)
                    try:
                        _warm_tmdb_images(json.loads(body.decode("utf-8")))
                    except Exception:
                        pass
                return body, content_type, "MISS"
        except Exception as exc:
            raise exc

    def _proxy_tmdb(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        tmdb_id = params.get("id", [""])[0]
        if not tmdb_id:
            self._send_json_error(400, "Parâmetro id é obrigatório")
            return

        try:
            body, content_type, cache_status = self._fetch_tmdb_detail(media_type, tmdb_id)
            self._send_response(200, content_type, body, cache_status=cache_status)
        except Exception as exc:
            self._send_json_error(502, "Falha ao acessar o TMDB", str(exc))

    def _api_media_meta_batch(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        raw_ids = params.get("ids", [""])[0]
        ids = [value.strip() for value in raw_ids.split(",") if value.strip()]
        if not ids:
            self._send_json_error(400, "Parâmetro ids é obrigatório")
            return

        items = {}
        for tmdb_id in ids[:80]:
            try:
                body, _, cache_status = self._fetch_tmdb_detail(media_type, tmdb_id)
                meta = json.loads(body.decode("utf-8"))
                meta["_cache"] = cache_status
                items[tmdb_id] = meta
            except Exception:
                items[tmdb_id] = None

        payload = json.dumps({"items": items}, ensure_ascii=False).encode("utf-8")
        self._send_response(200, "application/json; charset=utf-8", payload)

    def _api_media_stored(self, query):
        params = parse_qs(query)
        limit = min(int(params.get("limit", ["200"])[0] or 200), 500)
        with DB_LOCK:
            rows = DB_CONN.execute(
                """
                SELECT media_key, media_type, tmdb_id, body, updated_at
                FROM media_metadata
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        items = []
        for media_key, media_type, tmdb_id, body, updated_at in rows:
            try:
                meta = json.loads(body.decode("utf-8"))
            except Exception:
                continue
            app_type = "movie" if media_type == "movie" else "serie"
            if media_type == "tv" and _is_animation_tv(meta):
                app_type = "anime"
            items.append({
                "id": tmdb_id,
                "type": app_type,
                "media_key": media_key,
                "updated_at": updated_at,
                "meta": meta,
            })

        payload = json.dumps({"items": items}, ensure_ascii=False).encode("utf-8")
        self._send_response(200, "application/json; charset=utf-8", payload)

    def _proxy_tmdb_genres(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"genres:{tmdb_media}:pt-BR"
        url = f"{TMDB_BASE}/genre/{tmdb_media}/list?api_key={TMDB_API_KEY}&language=pt-BR"
        self._proxy_tmdb_with_cache(url, cache_key, TTL_TMDB_GENRES_SECONDS)

    def _proxy_tmdb_search(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        term = params.get("query", [""])[0]
        if not term:
            self._send_json_error(400, "Parâmetro query é obrigatório")
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"search:{tmdb_media}:{term.lower()}:pt-BR"
        url = (
            f"{TMDB_BASE}/search/{tmdb_media}"
            f"?api_key={TMDB_API_KEY}&language=pt-BR&query={quote_plus(term)}"
            "&include_adult=false&page=1"
        )
        self._proxy_tmdb_with_cache(url, cache_key, TTL_TMDB_SEARCH_SECONDS)

    def _proxy_tmdb_discover(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        genre_id = params.get("genre", [""])[0].strip()
        page = params.get("page", ["1"])[0]
        original_language = params.get("original_language", [""])[0].strip().lower()
        if not genre_id and not original_language:
            self._send_json_error(
                400,
                "Informe genre e/ou original_language",
            )
            return
        if original_language and not re.match(r"^[a-z]{2}$", original_language):
            self._send_json_error(400, "Parâmetro original_language inválido")
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        sort_by = "primary_release_date.desc" if tmdb_media == "movie" else "first_air_date.desc"
        cache_key = f"discover:{tmdb_media}:{sort_by}:{page}:pt-BR"
        if genre_id:
            cache_key += f":genre:{genre_id}"
        if original_language:
            cache_key += f":lang:{original_language}"
        today = date.today().isoformat()
        date_filter = f"&primary_release_date.lte={today}" if tmdb_media == "movie" else f"&first_air_date.lte={today}"
        lang_filter = (
            f"&with_original_language={quote_plus(original_language)}"
            if original_language
            else ""
        )
        genre_filter = (
            f"&with_genres={quote_plus(genre_id)}"
            if genre_id
            else ""
        )
        url = (
            f"{TMDB_BASE}/discover/{tmdb_media}"
            f"?api_key={TMDB_API_KEY}"
            f"&language=pt-BR"
            f"{genre_filter}"
            f"&include_adult=false"
            f"&sort_by={sort_by}"
            f"{date_filter}"
            f"{lang_filter}"
            f"&page={quote_plus(page)}"
        )
        self._proxy_tmdb_with_cache(url, cache_key, TTL_TMDB_SEARCH_SECONDS)

    def _proxy_tmdb_season(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        tmdb_id = params.get("id", [""])[0]
        season_number = params.get("season", [""])[0]
        if not tmdb_id or not season_number:
            self._send_json_error(400, "Parâmetros id e season são obrigatórios")
            return

        cache_key = f"season:{tmdb_id}:{season_number}:pt-BR"
        url = (
            f"{TMDB_BASE}/tv/{tmdb_id}/season/{season_number}"
            f"?api_key={TMDB_API_KEY}&language=pt-BR"
        )
        self._proxy_tmdb_with_cache(url, cache_key, TTL_TMDB_SEASON_SECONDS)

    def _proxy_tmdb_related(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        tmdb_id = params.get("id", [""])[0]
        if not tmdb_id:
            self._send_json_error(400, "Parâmetro id é obrigatório")
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"related:{tmdb_media}:{tmdb_id}:pt-BR"
        url = (
            f"{TMDB_BASE}/{tmdb_media}/{tmdb_id}/recommendations"
            f"?api_key={TMDB_API_KEY}&language=pt-BR&page=1"
        )
        self._proxy_tmdb_with_cache(url, cache_key, TTL_TMDB_RELATED_SECONDS)


    def _proxy_rede_buzz_remote(self, url, cache_key):
        cached = self._cache_get(cache_key)
        if cached:
            self._send_response(
                cached["status"],
                cached["content_type"],
                cached["body"],
                cache_status="HIT",
            )
            return
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=20) as response:
                body = response.read()
                content_type = response.headers.get(
                    "Content-Type", "application/json; charset=utf-8"
                )
                if response.status == 200:
                    self._cache_set(
                        cache_key=cache_key,
                        status=response.status,
                        content_type=content_type,
                        body=body,
                        ttl_seconds=TTL_RDE_SECONDS,
                    )
                self._send_response(response.status, content_type, body, cache_status="MISS")
        except Exception as exc:
            self._send_json_error(502, "Falha ao acessar Rei dos Embeds", str(exc))

    def _proxy_rede_buzz_channels(self, query):
        params = parse_qs(query)
        category = params.get("category", [""])[0].strip()
        if category:
            url = (
                f"{RDE_API_BASE}/channels"
                f"?category={quote_plus(category)}"
            )
            cache_key = f"rde:channels:cat:{category.lower()}"
        else:
            url = f"{RDE_API_BASE}/channels"
            cache_key = "rde:channels:all"
        self._proxy_rede_buzz_remote(url, cache_key)

    def _proxy_rede_buzz_categories(self):
        url = f"{RDE_API_BASE}/channels/categories"
        self._proxy_rede_buzz_remote(url, "rde:categories")

    def _proxy_rede_buzz_search(self, query):
        params = parse_qs(query)
        term = params.get("q", [""])[0].strip()
        if not term:
            self._send_json_error(400, "Parâmetro q é obrigatório")
            return
        url = f"{RDE_API_BASE}/pesquisa?q={quote_plus(term)}"
        cache_key = f"rde:search:{term.lower()}"
        self._proxy_rede_buzz_remote(url, cache_key)

    def _parse_guia_html(self, html_bytes):
        class _Collector(HTMLParser):
            def __init__(self):
                super().__init__()
                self.chunks = []
                self._skip = 0

            def handle_starttag(self, tag, attrs):
                if tag in ("script", "style", "noscript", "head"):
                    self._skip += 1

            def handle_endtag(self, tag):
                if tag in ("script", "style", "noscript", "head"):
                    self._skip = max(0, self._skip - 1)

            def handle_data(self, data):
                if self._skip:
                    return
                s = data.strip()
                if s:
                    self.chunks.append(s)

        try:
            html = html_bytes.decode("utf-8", errors="replace")
            collector = _Collector()
            collector.feed(html)

            time_re = re.compile(r"^\d{1,2}:\d{2}$")
            schedule = []
            chunks = collector.chunks
            i = 0

            while i < len(chunks):
                if time_re.match(chunks[i]):
                    entry = {"time": chunks[i], "title": None, "genre": None}
                    j = i + 1
                    if j < len(chunks) and not time_re.match(chunks[j]):
                        entry["title"] = chunks[j]
                        j += 1
                        if j < len(chunks) and "/" in chunks[j] and not time_re.match(chunks[j]):
                            entry["genre"] = chunks[j]
                            j += 1
                    if entry["title"]:
                        schedule.append(entry)
                    i = j
                else:
                    i += 1

            return schedule
        except Exception:
            return []

    def _proxy_guia(self, query):
        params = parse_qs(query)
        canal = params.get("canal", [""])[0].strip().upper()
        if not canal or not re.match(r"^[A-Z0-9]{1,10}$", canal):
            self._send_json_error(400, "Parâmetro canal inválido ou ausente")
            return

        cache_key = f"guia:{canal}:{date.today().isoformat()}"
        cached = self._cache_get(cache_key)
        if cached:
            self._send_response(cached["status"], cached["content_type"], cached["body"], cache_status="HIT")
            return

        url = f"https://meuguia.tv/programacao/canal/{canal}"
        try:
            req = Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "pt-BR,pt;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            })
            with urlopen(req, timeout=15) as response:
                html_bytes = response.read()
        except Exception as exc:
            self._send_json_error(502, "Falha ao acessar o guia", str(exc))
            return

        schedule = self._parse_guia_html(html_bytes)
        body = json.dumps(schedule, ensure_ascii=False).encode("utf-8")
        self._cache_set(cache_key, 200, "application/json; charset=utf-8", body, TTL_GUIA_SECONDS)
        self._send_response(200, "application/json; charset=utf-8", body, cache_status="MISS")


def run():
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), MeuPlayerHandler)
    print(f"Servidor iniciado em http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
