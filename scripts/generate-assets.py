#!/usr/bin/env python3
"""Render Arrow Escape app icons, splash and store artwork into ./assets.

Usage:
    python scripts/generate-assets.py

Requires Pillow (pip install pillow). Everything is drawn procedurally at a
supersampled resolution and downscaled, so re-running gives identical output.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
STORE = ASSETS / "store"

SS = 4  # supersampling factor

NAVY = (23, 35, 63)
NAVY_DARK = (14, 22, 42)
NAVY_LIGHT = (36, 54, 94)
BLUE = (21, 155, 239)
BLUE_LIGHT = (90, 190, 250)
HINT = (255, 179, 0)
WHITE = (255, 255, 255)

# The mark lives on a 5x5 board of cells. Paths are lists of cell centers
# (col, row); the last segment's direction is the arrowhead direction.
GRID = 5
HERO_PATH = [(0.6, 3.0), (3.0, 3.0), (3.0, 0.15)]
SIDE_ARROWS = [
    ([(1.0, 0.9), (1.0, 2.0)], BLUE),
    ([(4.0, 4.0), (4.0, 2.2)], BLUE),
    ([(2.0, 4.2), (0.8, 4.2)], BLUE_LIGHT),
]


# ---------------------------------------------------------------------------
# Drawing primitives
# ---------------------------------------------------------------------------

def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_color(c1, c2, t):
    return tuple(int(round(lerp(a, b, t))) for a, b in zip(c1, c2))


def vertical_gradient(size: int, top, bottom) -> Image.Image:
    col = Image.new("RGB", (1, size))
    for y in range(size):
        col.putpixel((0, y), lerp_color(top, bottom, y / max(1, size - 1)))
    return col.resize((size, size))


def radial_glow(size: int, center, radius: float, color, strength: float) -> Image.Image:
    """RGBA soft glow used to lift the center of the background."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    cx, cy = center
    d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=int(255 * strength))
    mask = mask.filter(ImageFilter.GaussianBlur(radius * 0.45))
    layer = Image.new("RGBA", (size, size), color + (0,))
    layer.putalpha(mask)
    return layer


def rounded_triangle(a, b, c, radius: float, steps: int = 10):
    """Polygon points for a triangle with quadratic-rounded corners (matches arrowGraphics.ts)."""
    verts = [a, b, c]
    pts = []
    for i in range(3):
        prev, curr, nxt = verts[(i + 2) % 3], verts[i], verts[(i + 1) % 3]
        tp = (prev[0] - curr[0], prev[1] - curr[1])
        tn = (nxt[0] - curr[0], nxt[1] - curr[1])
        lp = math.hypot(*tp) or 1
        ln = math.hypot(*tn) or 1
        r = min(radius, lp * 0.45, ln * 0.45)
        start = (curr[0] + tp[0] / lp * r, curr[1] + tp[1] / lp * r)
        end = (curr[0] + tn[0] / ln * r, curr[1] + tn[1] / ln * r)
        for s in range(steps + 1):
            t = s / steps
            x = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * curr[0] + t ** 2 * end[0]
            y = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * curr[1] + t ** 2 * end[1]
            pts.append((x, y))
    return pts


def draw_arrow(draw: ImageDraw.ImageDraw, pts, stroke: float, head: float, fill) -> None:
    """Thick polyline body with round joins/tail and a rounded triangular head."""
    (x0, y0), (x1, y1) = pts[-2], pts[-1]
    ang = math.atan2(y1 - y0, x1 - x0)
    pull = head * 0.55
    body = list(pts[:-1]) + [(x1 - math.cos(ang) * pull, y1 - math.sin(ang) * pull)]

    w = int(round(stroke))
    r = stroke / 2
    draw.line(body, fill=fill, width=w)
    for x, y in body:
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)

    left, right = ang + math.pi * 0.82, ang - math.pi * 0.82
    wing_l = (x1 + math.cos(left) * head, y1 + math.sin(left) * head)
    wing_r = (x1 + math.cos(right) * head, y1 + math.sin(right) * head)
    draw.polygon(rounded_triangle((x1, y1), wing_l, wing_r, head * 0.22), fill=fill)


class Board:
    """Maps board cell coordinates into a square pixel box."""

    def __init__(self, x: float, y: float, size: float):
        self.x, self.y, self.cell = x, y, size / GRID

    def pt(self, c, r):
        return (self.x + (c + 0.5) * self.cell, self.y + (r + 0.5) * self.cell)

    def path(self, cells):
        return [self.pt(c, r) for c, r in cells]

    @classmethod
    def around_hero(cls, canvas: float, cell: float) -> "Board":
        """Board positioned so the hero arrow alone is centered on the canvas."""
        xs = [c for c, _ in HERO_PATH]
        ys = [r for _, r in HERO_PATH]
        cx = ((min(xs) + max(xs)) / 2 + 0.5) * cell
        cy = ((min(ys) + max(ys)) / 2 + 0.5) * cell
        return cls(canvas / 2 - cx, canvas / 2 - cy, cell * GRID)


# ---------------------------------------------------------------------------
# Layers
# ---------------------------------------------------------------------------

def background(size: int) -> Image.Image:
    bg = vertical_gradient(size, NAVY_LIGHT, NAVY_DARK).convert("RGBA")
    bg.alpha_composite(radial_glow(size, (size * 0.55, size * 0.4), size * 0.42, BLUE, 0.35))
    return bg


def draw_dots(img: Image.Image, board: Board, alpha: int = 46) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = board.cell * 0.05
    for c in range(GRID):
        for row in range(GRID):
            x, y = board.pt(c, row)
            d.ellipse((x - r, y - r, x + r, y + r), fill=WHITE + (alpha,))
    img.alpha_composite(layer)


def draw_mark(img: Image.Image, board: Board, mono: bool = False, simple: bool = False) -> None:
    """Side arrows, speed lines and the white hero arrow escaping upward.

    `simple` draws only the hero arrow, for sizes where extra detail turns to noise.
    """
    cell = board.cell
    stroke, head = cell * 0.36, cell * 0.62

    if not mono:
        shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        off = cell * 0.08
        draw_arrow(sd, [(x + off, y + off * 1.6) for x, y in board.path(HERO_PATH)],
                   stroke, head, (0, 0, 0, 120))
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(cell * 0.14)))

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    for cells, color in [] if simple else SIDE_ARROWS:
        fill = WHITE + (255,) if mono else color + (255,)
        draw_arrow(d, board.path(cells), stroke * 0.62, head * 0.66, fill)

    # Speed lines trailing the escaping head.
    hx, hy = board.pt(*HERO_PATH[-1])
    lw = stroke * 0.32
    for dx, top, length in [] if simple else ((-0.62, 0.55, 0.55), (0.62, 0.75, 0.42)):
        x = hx + dx * cell
        y0 = hy + top * cell
        fill = WHITE + ((255 if mono else 150),)
        d.line([(x, y0), (x, y0 + length * cell)], fill=fill, width=int(lw))
        for yy in (y0, y0 + length * cell):
            d.ellipse((x - lw / 2, yy - lw / 2, x + lw / 2, yy + lw / 2), fill=fill)

    draw_arrow(d, board.path(HERO_PATH), stroke, head, WHITE + (255,))

    if not mono:
        # Small hint-colored tail dot, echoing the in-game hint highlight.
        tx, ty = board.pt(*HERO_PATH[0])
        rr = stroke * 0.26
        d.ellipse((tx - rr, ty - rr, tx + rr, ty + rr), fill=HINT + (255,))

    img.alpha_composite(layer)


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

def finish(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


def make_full_icon(size: int, board_frac: float = 0.78) -> Image.Image:
    S = size * SS
    img = background(S)
    bsize = S * board_frac
    board = Board((S - bsize) / 2, (S - bsize) / 2, bsize)
    draw_dots(img, board)
    draw_mark(img, board)
    return finish(img, size)


def rounded_mask(size: int, radius_frac: float) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=size * radius_frac, fill=255)
    return m


def make_small_icon(size: int) -> Image.Image:
    S = size * SS
    img = background(S)
    draw_mark(img, Board.around_hero(S, S * 0.22), simple=True)
    return finish(img, size)


def adaptive_board(S: int) -> Board:
    # Android masks to the central 66/108 circle; the board's outer arrows
    # sit near its corners, so it must fit well inside that circle.
    bsize = S * 0.46
    return Board((S - bsize) / 2, (S - bsize) / 2, bsize)


def make_adaptive_background(size: int) -> Image.Image:
    S = size * SS
    img = background(S)
    draw_dots(img, adaptive_board(S))
    return finish(img, size)


def make_adaptive_foreground(size: int, mono: bool = False) -> Image.Image:
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw_mark(img, adaptive_board(S), mono=mono)
    return finish(img, size)


def make_splash(size: int) -> Image.Image:
    """Rounded icon tile on a transparent canvas, shown centered on the splash background."""
    S = size * SS
    tile = make_full_icon(size).resize((S, S), Image.LANCZOS)
    tile.putalpha(rounded_mask(S, 0.225))

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    inset = S * 0.06
    ImageDraw.Draw(shadow).rounded_rectangle(
        (inset, inset + S * 0.02, S - inset, S - inset + S * 0.02),
        radius=S * 0.2, fill=NAVY + (90,),
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(S * 0.025)))

    inner = int(S - inset * 2)
    canvas.alpha_composite(tile.resize((inner, inner), Image.LANCZOS), (int(inset), int(inset)))
    return finish(canvas, size)


def make_feature_graphic(w: int = 1024, h: int = 500) -> Image.Image:
    W, H = w * SS, h * SS
    bg = vertical_gradient(W, NAVY_LIGHT, NAVY_DARK).resize((W, H)).convert("RGBA")
    bg.alpha_composite(radial_glow(W, (W * 0.5, W * 0.25), W * 0.3, BLUE, 0.3).resize((W, H)))

    bsize = H * 0.82
    board = Board(W - bsize - H * 0.16, (H - bsize) / 2, bsize)
    draw_dots(bg, board)
    draw_mark(bg, board)

    d = ImageDraw.Draw(bg)
    x = H * 0.18
    title = load_font(["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"], int(H * 0.17))
    tagline = load_font(["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"], int(H * 0.07))
    d.text((x, H * 0.25), "Arrow", font=title, fill=WHITE)
    d.text((x, H * 0.43), "Escape", font=title, fill=BLUE_LIGHT)
    d.text((x, H * 0.66), "Slide every arrow off the board", font=tagline, fill=WHITE + (190,))
    return bg.resize((w, h), Image.LANCZOS).convert("RGB")


def load_font(names, px: int):
    for name in names:
        try:
            return ImageFont.truetype(name, px)
        except OSError:
            continue
    return ImageFont.load_default(px)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(f"  {path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}")


def main() -> None:
    print("Generating Arrow Escape assets:")
    icon = make_full_icon(1024)
    save(icon.convert("RGB"), ASSETS / "icon.png")
    save(make_splash(1024), ASSETS / "splash-icon.png")
    save(make_adaptive_foreground(1024), ASSETS / "android-icon-foreground.png")
    save(make_adaptive_background(1024), ASSETS / "android-icon-background.png")
    save(make_adaptive_foreground(1024, mono=True), ASSETS / "android-icon-monochrome.png")
    save(make_small_icon(48), ASSETS / "favicon.png")

    save(icon.resize((512, 512), Image.LANCZOS).convert("RGB"), STORE / "play-store-icon-512.png")
    save(make_feature_graphic(), STORE / "feature-graphic-1024x500.png")


if __name__ == "__main__":
    main()
