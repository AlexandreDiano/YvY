"""
Gera os assets de ícone a partir de assets/yvy-logo.png.

Fonte única: o logo que veio do design (1024x1024, fundo creme #FBF3DF).
Rodar de novo sempre que o logo mudar:

    python3 scripts/gen-icons.py

O que sai:
  icon.png                     1024, fundo creme, ícone de loja (iOS não aceita alfa)
  splash-icon.png              1024, glifo transparente, o creme vem do app.json
  favicon.png                   196, fundo creme, aba do navegador
  android-icon-background.png   512, creme chapado, camada de fundo do adaptive icon
  android-icon-foreground.png   512, glifo transparente a 62%, respeita a máscara do Android
  android-icon-monochrome.png   432, silhueta branca, modo monocromático do Android 13+

Versão escura (de assets/yvy-logo-dark.png: letras creme, broto verde, terra
cor de barro, fundo verde-noite #13251A):
  icon-dark.png                1024, glifo transparente, ícone escuro do iOS 18
  splash-icon-dark.png         1024, glifo transparente, splash com o celular no escuro

PWA (servidos pelo site, em public/icons/, ver public/manifest.json):
  icon-192.png, icon-512.png   fundo creme, ícone "any" do manifest
  maskable-512.png             glifo a 60% sobre creme, o Android recorta em círculo
  apple-touch-icon.png          180, fundo creme, "Adicionar à Tela de Início" do iOS
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
CREAM = (251, 243, 223)  # #FBF3DF, fundo do logo original
TOLERANCE = 12  # pixels quase-creme (antialias da borda) contam como fundo

src = Image.open(ASSETS / "yvy-logo.png").convert("RGBA")
if src.size != (1024, 1024):
    src = src.resize((1024, 1024), Image.LANCZOS)


def flatten(img: Image.Image, size: int, bg=CREAM) -> Image.Image:
    """Achata sobre fundo opaco. Ícone de loja não pode ter canal alfa."""
    out = Image.new("RGB", img.size, bg)
    out.paste(img, (0, 0), img)
    return out.resize((size, size), Image.LANCZOS)


def is_background(px, bg=CREAM) -> bool:
    r, g, b, a = px
    return a == 0 or (
        abs(r - bg[0]) <= TOLERANCE
        and abs(g - bg[1]) <= TOLERANCE
        and abs(b - bg[2]) <= TOLERANCE
    )


def cut_background(img: Image.Image, bg=CREAM) -> Image.Image:
    """Tira o fundo, deixando só o glifo (letras + broto + terra)."""
    out = img.copy()
    pixels = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            if is_background(pixels[x, y], bg):
                pixels[x, y] = (0, 0, 0, 0)
    return out


def trim(img: Image.Image) -> Image.Image:
    box = img.getbbox()
    return img.crop(box) if box else img


def centered(glyph: Image.Image, canvas: int, ratio: float) -> Image.Image:
    """Glifo centrado ocupando `ratio` do lado do canvas, resto transparente."""
    target = int(canvas * ratio)
    g = glyph.copy()
    g.thumbnail((target, target), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(g, ((canvas - g.width) // 2, (canvas - g.height) // 2), g)
    return out


glyph = trim(cut_background(src))

flatten(src, 1024).save(ASSETS / "icon.png")
flatten(src, 196).save(ASSETS / "favicon.png")

# Splash: glifo transparente sobre o creme definido no app.json. Assim o
# recorte do logo nunca aparece como quadrado contra o fundo da tela.
centered(glyph, 1024, 0.78).save(ASSETS / "splash-icon.png")

Image.new("RGB", (512, 512), CREAM).save(ASSETS / "android-icon-background.png")

# Adaptive icon: o Android recorta até 1/3 das bordas. 0.62 mantém o glifo
# inteiro dentro do círculo, do squircle e do quadrado.
centered(glyph, 512, 0.62).save(ASSETS / "android-icon-foreground.png")

mono = centered(glyph, 432, 0.62)
white = Image.new("RGBA", mono.size, (255, 255, 255, 255))
white.putalpha(mono.getchannel("A"))
white.save(ASSETS / "android-icon-monochrome.png")

DARK_BG = (19, 37, 26)  # #13251A
dark_src = Image.open(ASSETS / "yvy-logo-dark.png").convert("RGBA").resize((1024, 1024), Image.LANCZOS)
dark_glyph = trim(cut_background(dark_src, DARK_BG))
# iOS 18 desenha o fundo escuro do ícone ele mesmo: glifo sem fundo, mesmo enquadramento do claro.
centered(dark_glyph, 1024, 0.78).save(ASSETS / "icon-dark.png")
centered(dark_glyph, 1024, 0.78).save(ASSETS / "splash-icon-dark.png")

PWA = ROOT / "public" / "icons"
PWA.mkdir(parents=True, exist_ok=True)
flatten(src, 192).save(PWA / "icon-192.png")
flatten(src, 512).save(PWA / "icon-512.png")
flatten(src, 180).save(PWA / "apple-touch-icon.png")
# Maskable: zona segura é o círculo de 80% do lado; 0.60 deixa folga.
maskable = Image.new("RGB", (512, 512), CREAM)
m = centered(glyph, 512, 0.60)
maskable.paste(m, (0, 0), m)
maskable.save(PWA / "maskable-512.png")

print("ícones gerados a partir de assets/yvy-logo.png e assets/yvy-logo-dark.png")
