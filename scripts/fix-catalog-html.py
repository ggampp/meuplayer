#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"

TEMPLATE = """<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MeuPlayer · {title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,144,400;1,144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
    />
    <link rel="stylesheet" href="/tokens.css" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <script type="module" src="/js/nav.js"></script>
    <div id="root"></div>
    <script>
      window.MEUPLAYER_ROUTE = "{route}";
    </script>
    <script type="module" src="/js/app.js"></script>
    <script type="module" src="/js/spatial-nav.js"></script>
  </body>
</html>
"""

PAGES = {
    "filme.html": ("Filmes", "movie"),
    "serie.html": ("Séries", "serie"),
    "anime.html": ("Animes", "anime"),
    "dorama.html": ("Doramas", "dorama"),
}


def main() -> None:
    for name, (title, route) in PAGES.items():
        path = ROOT / name
        path.write_text(TEMPLATE.format(title=title, route=route), encoding="utf-8")
        print(f"wrote {name}")

    # index without route
    index = """<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MeuPlayer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,144,400;1,144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
    />
    <link rel="stylesheet" href="/tokens.css" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <script type="module" src="/js/nav.js"></script>
    <div id="root"></div>
    <script type="module" src="/js/app.js"></script>
    <script type="module" src="/js/spatial-nav.js"></script>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js?v=hub3')
            .then((reg) => reg.update().catch(() => {}))
            .catch(() => {});
        });
      }
    </script>
  </body>
</html>
"""
    (ROOT / "index.html").write_text(index, encoding="utf-8")
    print("wrote index.html")

    netflix = """<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MeuPlayer · Fileiras</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,144,400;1,144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
    />
    <link rel="stylesheet" href="/tokens.css" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <script type="module" src="/js/nav.js"></script>
    <div id="root"></div>
    <script>
      window.MEUPLAYER_LAYOUT = "netflix";
    </script>
    <script type="module" src="/js/app.js"></script>
    <script type="module" src="/js/spatial-nav.js"></script>
  </body>
</html>
"""
    (ROOT / "netflix.html").write_text(netflix, encoding="utf-8")
    print("wrote netflix.html")

    # Rede buzz init must be inside module (deferred order)
    for path, mode in [
        (ROOT / "rede-buzz.html", "all"),
        (ROOT / "rede-buzz-favoritos.html", "favorites"),
    ]:
        text = path.read_text(encoding="utf-8")
        # replace trailing scripts
        import re

        text = re.sub(
            r'<script type="module" src="/js/rede-buzz-store\.js"></script>\s*'
            r'<script type="module" src="/js/rede-buzz-ui\.js"></script>\s*'
            r"<script>[\s\S]*?</script>\s*</body>",
            f"""<script type="module">
      import "/js/rede-buzz-store.js";
      import "/js/rede-buzz-ui.js";
      const isElectron = !!(window.__MEUPLAYER_ENV && window.__MEUPLAYER_ENV.isElectron);
      if (!isElectron && "{mode}" === "all") {{
        const banner = document.createElement("div");
        banner.style.cssText = "background:var(--color-accent-soft);color:var(--color-ink);padding:6px 12px;border-radius:6px;font-size:0.8rem;margin:8px 0;border:1px solid var(--color-rule-2);";
        banner.textContent = "Usando no navegador. A experiência completa de canais é melhor no app desktop.";
        const header = document.querySelector(".workbench__header");
        if (header) header.after(banner);
      }}
      window.MeuPlayerRedeBuzzUI?.init({{ mode: "{mode}" }});
    </script>
  </body>""",
            text,
            count=1,
        )
        path.write_text(text, encoding="utf-8")
        print(f"fixed {path.name}")


if __name__ == "__main__":
    main()
