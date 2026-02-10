import json
import mimetypes
import os
import sqlite3
import threading
from datetime import date
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
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "public")
DB_PATH = os.path.join(os.path.dirname(__file__), "cache.sqlite3")
IMAGE_CACHE_DIR = os.path.join(STATIC_DIR, "cache", "images", "tmdb")

TTL_TMDB_DETAILS_SECONDS = 7 * 24 * 60 * 60
TTL_TMDB_GENRES_SECONDS = 30 * 24 * 60 * 60
TTL_TMDB_SEARCH_SECONDS = 24 * 60 * 60
TTL_TMDB_SEASON_SECONDS = 3 * 24 * 60 * 60
TTL_TMDB_RELATED_SECONDS = 3 * 24 * 60 * 60
TTL_IMAGE_SECONDS = 30 * 24 * 60 * 60

TMDB_CACHE = {}
DB_LOCK = threading.Lock()


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
    conn.commit()
    return conn


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


class MeuPlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

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
        super().do_GET()

    def _resolve_site_route(self, path):
        if path in ("", "/"):
            return "/index.html"
        if path in ("/canais", "/canais/"):
            return "/canais.html"

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
        url = f"{API_BASE}/lista?{urlencode(params, doseq=True)}"
        self._proxy_simple(url)

    def _proxy_simple(self, url):
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                self.send_response(response.status)
                content_type = response.headers.get("Content-Type", "application/json")
                self.send_header("Content-Type", content_type)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
        except Exception as exc:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {"error": "Falha ao acessar a API externa", "detail": str(exc)}
            self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _send_json_error(self, status_code, error, detail=None):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        payload = {"error": error}
        if detail:
            payload["detail"] = detail
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _send_response(self, status_code, content_type, body, cache_status=None):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        if cache_status:
            self.send_header("X-Cache", cache_status)
        self.end_headers()
        self.wfile.write(body)

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
                self.send_response(response.status)
                self.send_header("Content-Type", content_type)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("X-Cache", "MISS")
                self.send_header("Cache-Control", f"public, max-age={TTL_IMAGE_SECONDS}")
                self.end_headers()
                self.wfile.write(body)
        except Exception:
            if stale_exists:
                self._serve_local_image(local_path)
                return
            self._send_json_error(502, "Falha ao acessar imagem do TMDB")

    def _serve_local_image(self, local_path):
        content_type = mimetypes.guess_type(local_path)[0] or "application/octet-stream"
        with open(local_path, "rb") as file:
            body = file.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Cache", "HIT")
        self.send_header("Cache-Control", f"public, max-age={TTL_IMAGE_SECONDS}")
        self.end_headers()
        self.wfile.write(body)

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

    def _proxy_tmdb(self, query):
        if not self._ensure_tmdb_key():
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        tmdb_id = params.get("id", [""])[0]
        if not tmdb_id:
            self._send_json_error(400, "Parâmetro id é obrigatório")
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"tmdb:{tmdb_media}:{tmdb_id}:pt-BR"
        url = f"{TMDB_BASE}/{tmdb_media}/{tmdb_id}?api_key={TMDB_API_KEY}&language=pt-BR"
        self._proxy_tmdb_with_cache(url, cache_key, TTL_TMDB_DETAILS_SECONDS)

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
        genre_id = params.get("genre", [""])[0]
        page = params.get("page", ["1"])[0]
        if not genre_id:
            self._send_json_error(400, "Parâmetro genre é obrigatório")
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        sort_by = "primary_release_date.desc" if tmdb_media == "movie" else "first_air_date.desc"
        cache_key = f"discover:{tmdb_media}:{genre_id}:{sort_by}:{page}:pt-BR"
        today = date.today().isoformat()
        date_filter = f"&primary_release_date.lte={today}" if tmdb_media == "movie" else f"&first_air_date.lte={today}"
        url = (
            f"{TMDB_BASE}/discover/{tmdb_media}"
            f"?api_key={TMDB_API_KEY}"
            f"&language=pt-BR"
            f"&with_genres={quote_plus(genre_id)}"
            f"&include_adult=false"
            f"&sort_by={sort_by}"
            f"{date_filter}"
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


def run():
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), MeuPlayerHandler)
    print(f"Servidor iniciado em http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
