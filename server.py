import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from time import time
from urllib.parse import urlencode, urlparse, parse_qs, quote_plus
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
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "public")
CACHE_TTL_SECONDS = 6 * 60 * 60
TMDB_CACHE = {}


class MeuPlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
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
        if parsed.path == "/api/tmdb/season":
            self._proxy_tmdb_season(parsed.query)
            return
        if parsed.path == "/api/tmdb/related":
            self._proxy_tmdb_related(parsed.query)
            return
        super().do_GET()

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

    def _proxy_tmdb(self, query):
        if not TMDB_API_KEY:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {
                "error": "TMDB_API_KEY não configurada",
                "detail": "Defina a variável de ambiente TMDB_API_KEY",
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        tmdb_id = params.get("id", [""])[0]
        if not tmdb_id:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {"error": "Parâmetro id é obrigatório"}
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"{tmdb_media}:{tmdb_id}:pt-BR"
        cached = TMDB_CACHE.get(cache_key)
        if cached and cached["expires"] > time():
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(cached["body"])
            return

        url = f"{TMDB_BASE}/{tmdb_media}/{tmdb_id}?api_key={TMDB_API_KEY}&language=pt-BR"
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                if response.status == 200:
                    TMDB_CACHE[cache_key] = {
                        "body": body,
                        "expires": time() + CACHE_TTL_SECONDS,
                    }
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
            payload = {"error": "Falha ao acessar o TMDB", "detail": str(exc)}
            self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _proxy_tmdb_genres(self, query):
        if not TMDB_API_KEY:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {
                "error": "TMDB_API_KEY não configurada",
                "detail": "Defina a variável de ambiente TMDB_API_KEY",
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"genres:{tmdb_media}:pt-BR"
        cached = TMDB_CACHE.get(cache_key)
        if cached and cached["expires"] > time():
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(cached["body"])
            return

        url = f"{TMDB_BASE}/genre/{tmdb_media}/list?api_key={TMDB_API_KEY}&language=pt-BR"
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                if response.status == 200:
                    TMDB_CACHE[cache_key] = {
                        "body": body,
                        "expires": time() + CACHE_TTL_SECONDS,
                    }
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
            payload = {"error": "Falha ao acessar o TMDB", "detail": str(exc)}
            self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _proxy_tmdb_search(self, query):
        if not TMDB_API_KEY:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {
                "error": "TMDB_API_KEY não configurada",
                "detail": "Defina a variável de ambiente TMDB_API_KEY",
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        term = params.get("query", [""])[0]
        if not term:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {"error": "Parâmetro query é obrigatório"}
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"search:{tmdb_media}:{term.lower()}:pt-BR"
        cached = TMDB_CACHE.get(cache_key)
        if cached and cached["expires"] > time():
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(cached["body"])
            return

        url = (
            f"{TMDB_BASE}/search/{tmdb_media}"
            f"?api_key={TMDB_API_KEY}&language=pt-BR&query={quote_plus(term)}"
            "&include_adult=false&page=1"
        )
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                if response.status == 200:
                    TMDB_CACHE[cache_key] = {
                        "body": body,
                        "expires": time() + CACHE_TTL_SECONDS,
                    }
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
            payload = {"error": "Falha ao acessar o TMDB", "detail": str(exc)}
            self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _proxy_tmdb_season(self, query):
        if not TMDB_API_KEY:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {
                "error": "TMDB_API_KEY não configurada",
                "detail": "Defina a variável de ambiente TMDB_API_KEY",
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        params = parse_qs(query)
        tmdb_id = params.get("id", [""])[0]
        season_number = params.get("season", [""])[0]
        if not tmdb_id or not season_number:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {"error": "Parâmetros id e season são obrigatórios"}
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        cache_key = f"season:{tmdb_id}:{season_number}:pt-BR"
        cached = TMDB_CACHE.get(cache_key)
        if cached and cached["expires"] > time():
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(cached["body"])
            return

        url = (
            f"{TMDB_BASE}/tv/{tmdb_id}/season/{season_number}"
            f"?api_key={TMDB_API_KEY}&language=pt-BR"
        )
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                if response.status == 200:
                    TMDB_CACHE[cache_key] = {
                        "body": body,
                        "expires": time() + CACHE_TTL_SECONDS,
                    }
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
            payload = {"error": "Falha ao acessar o TMDB", "detail": str(exc)}
            self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _proxy_tmdb_related(self, query):
        if not TMDB_API_KEY:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {
                "error": "TMDB_API_KEY não configurada",
                "detail": "Defina a variável de ambiente TMDB_API_KEY",
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        params = parse_qs(query)
        media_type = params.get("type", ["movie"])[0]
        tmdb_id = params.get("id", [""])[0]
        if not tmdb_id:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {"error": "Parâmetro id é obrigatório"}
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        tmdb_media = "movie" if media_type == "movie" else "tv"
        cache_key = f"related:{tmdb_media}:{tmdb_id}:pt-BR"
        cached = TMDB_CACHE.get(cache_key)
        if cached and cached["expires"] > time():
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(cached["body"])
            return

        url = (
            f"{TMDB_BASE}/{tmdb_media}/{tmdb_id}/recommendations"
            f"?api_key={TMDB_API_KEY}&language=pt-BR&page=1"
        )
        try:
            req = Request(url, headers={"User-Agent": "MeuPlayer/1.0"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                if response.status == 200:
                    TMDB_CACHE[cache_key] = {
                        "body": body,
                        "expires": time() + CACHE_TTL_SECONDS,
                    }
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
            payload = {"error": "Falha ao acessar o TMDB", "detail": str(exc)}
            self.wfile.write(json.dumps(payload).encode("utf-8"))


def run():
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), MeuPlayerHandler)
    print(f"Servidor iniciado em http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
