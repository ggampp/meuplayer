"""Gera favicons web, ícones Electron e launcher Android a partir de img/app-de-tv.png."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "img" / "app-de-tv.png"
PUBLIC = ROOT / "public"
BUILD = ROOT / "build"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"


def resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.LANCZOS)


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def save_ico(img: Image.Image, path: Path, sizes: tuple[int, ...] = (16, 32, 48)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="ICO", sizes=[(size, size) for size in sizes])


def make_tv_banner(img: Image.Image, path: Path, size: tuple[int, int] = (640, 360)) -> None:
    banner = Image.new("RGBA", size, (13, 13, 26, 255))
    max_h = int(size[1] * 0.72)
    max_w = int(size[0] * 0.38)
    icon = img.copy()
    icon.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = (size[0] - icon.width) // 2
    y = (size[1] - icon.height) // 2
    banner.paste(icon, (x, y), icon)
    save_png(banner, path)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Arquivo fonte ausente: {SRC}")

    source = Image.open(SRC).convert("RGBA")

    save_png(resize(source, 16), PUBLIC / "favicon-16x16.png")
    save_png(resize(source, 32), PUBLIC / "favicon-32x32.png")
    save_png(resize(source, 180), PUBLIC / "apple-touch-icon.png")
    save_png(resize(source, 192), PUBLIC / "icon-192.png")
    save_png(resize(source, 512), PUBLIC / "icon-512.png")
    save_ico(source, PUBLIC / "favicon.ico")

    save_png(resize(source, 512), BUILD / "icon.png")
    save_ico(source, BUILD / "icon.ico", sizes=(16, 24, 32, 48, 64, 128, 256))

    for folder, size in {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }.items():
        save_png(resize(source, size), ANDROID_RES / folder / "ic_launcher.png")

    make_tv_banner(source, ANDROID_RES / "drawable-nodpi" / "tv_banner.png")

    print("Icones gerados em public/, build/ e android/app/src/main/res/")


if __name__ == "__main__":
    main()
