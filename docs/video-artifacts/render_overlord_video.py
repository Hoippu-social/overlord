from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent
OUTPUT = OUT_DIR / "overlord-video-card.mp4"

W, H = 1920, 1080
FPS = 24
DURATION = 15.0
TOTAL_FRAMES = int(FPS * DURATION)

BG = (6, 6, 6, 255)
SURFACE = (17, 17, 17, 238)
SURFACE_2 = (24, 24, 27, 238)
LINE = (244, 241, 238, 22)
TEXT = (244, 241, 238, 255)
TEXT_2 = (244, 241, 238, 168)
TEXT_3 = (244, 241, 238, 92)
GREEN = (117, 241, 106, 255)
GREEN_SOFT = (117, 241, 106, 42)
VIOLET = (143, 94, 255, 255)
RED = (244, 63, 94, 255)
WARN = (245, 158, 11, 255)


def asset(*parts: str) -> Path:
    return ROOT.joinpath(*parts)


FONT_DIR = asset("dashboard", "fonts")
FUTURA_BOOK = FONT_DIR / "FuturaCyrillicBook.ttf"
FUTURA_MEDIUM = FONT_DIR / "FuturaCyrillicMedium.ttf"
FUTURA_DEMI = FONT_DIR / "FuturaCyrillicDemi.ttf"
FUTURA_BOLD = FONT_DIR / "FuturaCyrillicBold.ttf"
FUTURA_HEAVY = FONT_DIR / "FuturaCyrillicHeavy.ttf"
AKONY = FONT_DIR / "AKONY.ttf"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


F = {
    "body": lambda s: font(FUTURA_BOOK, s),
    "medium": lambda s: font(FUTURA_MEDIUM, s),
    "demi": lambda s: font(FUTURA_DEMI, s),
    "bold": lambda s: font(FUTURA_BOLD, s),
    "heavy": lambda s: font(FUTURA_HEAVY, s),
    "akony": lambda s: font(AKONY, s),
}


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def smooth(v: float) -> float:
    v = clamp(v)
    return v * v * (3 - 2 * v)


def ease_out(v: float) -> float:
    v = clamp(v)
    return 1 - (1 - v) ** 3


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def rgba(color: tuple[int, int, int, int], alpha: float) -> tuple[int, int, int, int]:
    return color[:3] + (int(color[3] * clamp(alpha)),)


def apply_opacity(img: Image.Image, alpha: float) -> Image.Image:
    if alpha >= 0.999:
        return img
    out = img.copy()
    a = out.getchannel("A").point(lambda p: int(p * clamp(alpha)))
    out.putalpha(a)
    return out


def cover(im: Image.Image, size: tuple[int, int], offset_y: float = 0.5) -> Image.Image:
    im = im.convert("RGBA")
    sw, sh = size
    iw, ih = im.size
    scale = max(sw / iw, sh / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - sw) // 2
    top = int((nh - sh) * clamp(offset_y))
    return resized.crop((left, top, left + sw, top + sh))


def contain(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    im = im.convert("RGBA")
    sw, sh = size
    iw, ih = im.size
    scale = min(sw / iw, sh / ih)
    return im.resize((int(iw * scale), int(ih * scale)), Image.Resampling.LANCZOS)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def make_panel(
    im: Image.Image,
    size: tuple[int, int],
    radius: int = 34,
    crop_offset_y: float = 0.5,
    border: tuple[int, int, int, int] = LINE,
) -> Image.Image:
    body = cover(im, size, crop_offset_y)
    mask = rounded_mask(size, radius)
    pad = 42
    panel = Image.new("RGBA", (size[0] + pad * 2, size[1] + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("L", size, 0)
    ImageDraw.Draw(shadow).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=210)
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    panel.paste((0, 0, 0, 150), (pad, pad + 12), shadow)
    panel.paste(body, (pad, pad), mask)
    d = ImageDraw.Draw(panel)
    d.rounded_rectangle((pad, pad, pad + size[0] - 1, pad + size[1] - 1), radius=radius, outline=border, width=2)
    return panel


def paste_panel(frame: Image.Image, panel: Image.Image, x: int, y: int, alpha: float = 1.0) -> None:
    img = apply_opacity(panel, alpha)
    frame.alpha_composite(img, (x - 42, y - 42))


def radial_glow(base: Image.Image, xy: tuple[int, int], radius: int, color: tuple[int, int, int], alpha: int) -> None:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(radius // 3))
    base.alpha_composite(layer)


def make_base() -> Image.Image:
    base = Image.new("RGBA", (W, H), BG)
    radial_glow(base, (250, 70), 520, GREEN[:3], 34)
    radial_glow(base, (1680, 90), 520, VIOLET[:3], 32)
    radial_glow(base, (1580, 980), 460, GREEN[:3], 18)
    d = ImageDraw.Draw(base)
    for x in range(0, W + 1, 96):
        d.line((x, 0, x, H), fill=(244, 241, 238, 10), width=1)
    for y in range(0, H + 1, 96):
        d.line((0, y, W, y), fill=(244, 241, 238, 8), width=1)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 70))
    base.alpha_composite(overlay)
    return base


def load_image(path: Path, fallback: tuple[int, int] = (1512, 982)) -> Image.Image:
    if path.exists():
        return Image.open(path).convert("RGBA")
    return Image.new("RGBA", fallback, (17, 17, 17, 255))


def find_logo_png() -> Path | None:
    candidates = list(asset("dashboard", "public", "_ds").glob("**/assets/logo-color.png"))
    if candidates:
        return candidates[0]
    direct = asset("dashboard", "public", "logos", "logo-color.png")
    return direct if direct.exists() else None


BASE_BG = make_base()
HUB = load_image(OUT_DIR / "dashboard-hub.png")
STATS = load_image(OUT_DIR / "dashboard-stats.png")
MODERATION = load_image(OUT_DIR / "dashboard-moderation.png")
TICKETS = load_image(OUT_DIR / "dashboard-tickets.png")
LANDING = load_image(asset("docs", "audit-artifacts", "landing-hero-desktop-1512x982.png"))
MODULES = load_image(asset("docs", "audit-artifacts", "finalcheck-modules-desktop-1512x982.png"))

LOGO_PATH = find_logo_png()
LOGO = Image.open(LOGO_PATH).convert("RGBA") if LOGO_PATH else Image.new("RGBA", (128, 128), (117, 241, 106, 255))

HUB_PANEL = make_panel(HUB, (1140, 742), radius=34, crop_offset_y=0.38)
STATS_PANEL = make_panel(STATS, (1130, 735), radius=34, crop_offset_y=0.34)
LANDING_PANEL = make_panel(LANDING, (1120, 730), radius=34, crop_offset_y=0.18)
MODULES_PANEL = make_panel(MODULES, (980, 640), radius=34, crop_offset_y=0.4)

HUB_BG = cover(HUB, (W, H), 0.35).filter(ImageFilter.GaussianBlur(12))
LANDING_BG = cover(LANDING, (W, H), 0.2).filter(ImageFilter.GaussianBlur(8))
MODULES_BG = cover(MODULES, (W, H), 0.35).filter(ImageFilter.GaussianBlur(10))


def draw_text_block(
    d: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    lines: list[str],
    fonts: list[ImageFont.FreeTypeFont] | ImageFont.FreeTypeFont,
    fills: list[tuple[int, int, int, int]] | tuple[int, int, int, int],
    spacing: int = 10,
) -> int:
    x, y = xy
    if not isinstance(fonts, list):
        fonts = [fonts] * len(lines)
    if not isinstance(fills, list):
        fills = [fills] * len(lines)
    for line, fnt, fill in zip(lines, fonts, fills):
        d.text((x, y), line, font=fnt, fill=fill)
        box = d.textbbox((x, y), line, font=fnt)
        y += box[3] - box[1] + spacing
    return y


def wrap_text(d: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        probe = word if not current else f"{current} {word}"
        if d.textbbox((0, 0), probe, font=fnt)[2] <= max_width:
            current = probe
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_pill(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, fill, outline, text_fill, fnt) -> None:
    d.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=fill, outline=outline, width=1)
    tb = d.textbbox((0, 0), text, font=fnt)
    tx = box[0] + (box[2] - box[0] - (tb[2] - tb[0])) // 2
    ty = box[1] + (box[3] - box[1] - (tb[3] - tb[1])) // 2 - 1
    d.text((tx, ty), text, font=fnt, fill=text_fill)


def draw_card(
    d: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    title: str,
    value: str,
    accent: tuple[int, int, int, int] = GREEN,
    sub: str | None = None,
) -> None:
    d.rounded_rectangle(box, radius=28, fill=SURFACE, outline=LINE, width=2)
    x1, y1, x2, _ = box
    d.rounded_rectangle((x1 + 24, y1 + 24, x1 + 74, y1 + 74), radius=16, fill=rgba(accent, 0.14), outline=rgba(accent, 0.26), width=1)
    d.text((x1 + 39, y1 + 32), "•", font=F["heavy"](30), fill=accent)
    d.text((x1 + 94, y1 + 26), title, font=F["bold"](24), fill=TEXT)
    d.text((x1 + 94, y1 + 60), value, font=F["heavy"](42), fill=TEXT)
    if sub:
        d.text((x1 + 94, y1 + 112), sub, font=F["medium"](20), fill=TEXT_2)


def draw_line_chart(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], values: list[int], color=GREEN) -> None:
    x1, y1, x2, y2 = box
    d.rounded_rectangle(box, radius=24, fill=(12, 12, 13, 225), outline=LINE, width=1)
    for i in range(1, 4):
        y = y1 + i * (y2 - y1) // 4
        d.line((x1 + 24, y, x2 - 24, y), fill=(244, 241, 238, 14), width=1)
    mn, mx = min(values), max(values)
    pts = []
    for i, v in enumerate(values):
        x = x1 + 34 + i * ((x2 - x1 - 68) / (len(values) - 1))
        y = y2 - 34 - ((v - mn) / max(mx - mn, 1)) * (y2 - y1 - 82)
        pts.append((x, y))
    for width, alpha in [(10, 26), (5, 72), (3, 255)]:
        d.line(pts, fill=color[:3] + (alpha,), width=width, joint="curve")
    for x, y in pts[-3:]:
        d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=color)


def draw_discord_like(frame: Image.Image, local: float, x: int, y: int, w: int, h: int) -> None:
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((x, y, x + w, y + h), radius=34, fill=(20, 21, 25, 244), outline=(255, 255, 255, 22), width=2)
    d.rounded_rectangle((x + 22, y + 22, x + 92, y + h - 22), radius=24, fill=(12, 13, 16, 255))
    for i, col in enumerate([GREEN, VIOLET, (88, 101, 242, 255), RED, WARN]):
        cy = y + 62 + i * 72
        d.ellipse((x + 39, cy - 23, x + 85, cy + 23), fill=rgba(col, 0.18), outline=rgba(col, 0.32), width=1)
        d.text((x + 55, cy - 15), "•", font=F["heavy"](30), fill=col)

    d.rounded_rectangle((x + 112, y + 22, x + 340, y + h - 22), radius=24, fill=(17, 18, 22, 255))
    d.text((x + 134, y + 52), "NORTH STAR", font=F["bold"](22), fill=TEXT)
    for i, ch in enumerate(["# general", "# mod-log", "# tickets", "# voice-hub", "# roles"]):
        yy = y + 116 + i * 52
        active = i == 1
        d.rounded_rectangle((x + 128, yy - 8, x + 318, yy + 34), radius=14, fill=(255, 255, 255, 18) if active else (0, 0, 0, 0))
        d.text((x + 144, yy), ch, font=F["medium"](20), fill=TEXT if active else TEXT_2)

    chat_x = x + 360
    d.rounded_rectangle((chat_x, y + 22, x + w - 22, y + h - 22), radius=24, fill=(24, 25, 30, 255))
    d.text((chat_x + 30, y + 54), "# mod-log", font=F["bold"](26), fill=TEXT)
    d.line((chat_x, y + 98, x + w - 22, y + 98), fill=(255, 255, 255, 22), width=1)
    messages = [
        (GREEN, "Anti-raid armed", "policy updated by Admin"),
        (WARN, "Ticket queue growing", "7 waiting, SLA risk"),
        (RED, "Invite spam burst", "42 messages in 18 sec"),
        (VIOLET, "Role change", "new permission route"),
    ]
    for i, (col, title, meta) in enumerate(messages):
        yy = y + 134 + i * 104
        pop = smooth((local - 0.4 - i * 0.18) / 0.55)
        dx = int(32 * (1 - pop))
        d.rounded_rectangle((chat_x + 28 + dx, yy, x + w - 58 + dx, yy + 78), radius=20, fill=(18, 18, 22, int(230 * pop)), outline=rgba(col, 0.34 * pop), width=1)
        d.ellipse((chat_x + 50 + dx, yy + 22, chat_x + 84 + dx, yy + 56), fill=rgba(col, 0.24 * pop))
        d.text((chat_x + 104 + dx, yy + 16), title, font=F["bold"](22), fill=rgba(TEXT, pop))
        d.text((chat_x + 104 + dx, yy + 46), meta, font=F["medium"](17), fill=rgba(TEXT_2, pop))

    pay = smooth((local - 1.35) / 0.5)
    if pay > 0:
        bx = chat_x + 90
        by = y + h - 214
        d.rounded_rectangle((bx, by, bx + 500, by + 146), radius=28, fill=(28, 18, 20, int(238 * pay)), outline=rgba(RED, 0.42 * pay), width=2)
        d.text((bx + 30, by + 28), "Upgrade required", font=F["bold"](32), fill=rgba(TEXT, pay))
        d.text((bx + 30, by + 74), "advanced logs locked behind another plan", font=F["medium"](20), fill=rgba(TEXT_2, pay))
        draw_pill(d, (bx + 342, by + 30, bx + 470, by + 82), "$29/mo", rgba(RED, 0.18 * pay), rgba(RED, 0.46 * pay), rgba(RED, pay), F["bold"](20))


def scene_chaos(t: float) -> Image.Image:
    frame = BASE_BG.copy()
    radial_glow(frame, (1460, 320), 420, RED[:3], 28)
    d = ImageDraw.Draw(frame)
    p = ease_out(t / 1.0)
    draw_discord_like(frame, t, int(100 - 70 * (1 - p)), 160, 780, 760)

    x = 990
    y = int(160 + 40 * (1 - p))
    d.text((x, y), "БОЛЬ АДМИНА", font=F["bold"](24), fill=GREEN)
    y += 54
    for line in ["хаос из", "ботов, логов", "и подписок"]:
        d.text((x, y), line, font=F["heavy"](82), fill=TEXT)
        y += 88
    y += 18
    body = "Когда сервер растёт, модерация, тикеты, аналитика и voice начинают жить в разных местах."
    for line in wrap_text(d, body, F["medium"](30), 680):
        d.text((x, y), line, font=F["medium"](30), fill=TEXT_2)
        y += 42

    chips = ["8+ панелей", "логи теряются", "тикеты без SLA", "дорогие планы", "ручные решения"]
    cx, cy = x, 770
    for i, chip in enumerate(chips):
        a = smooth((t - 0.55 - i * 0.12) / 0.45)
        tw = d.textbbox((0, 0), chip, font=F["bold"](22))[2]
        box = (cx, cy, cx + tw + 42, cy + 52)
        draw_pill(d, box, chip, rgba(RED if i in [1, 2, 3] else WARN, 0.14 * a), rgba(RED if i in [1, 2, 3] else WARN, 0.34 * a), rgba(TEXT, a), F["bold"](22))
        cx += tw + 62
        if cx > 1650:
            cx, cy = x, cy + 70
    return frame


def scene_solution(t: float) -> Image.Image:
    frame = BASE_BG.copy()
    bg = apply_opacity(HUB_BG, 0.26)
    frame.alpha_composite(bg)
    frame.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 110)))
    d = ImageDraw.Draw(frame)
    p = ease_out(t / 1.0)

    icon = contain(LOGO, (82, 82))
    frame.alpha_composite(icon, (118, 104))
    d.text((224, 126), "OVERLORD", font=F["akony"](42), fill=TEXT)
    d.text((226, 174), "COMMAND CENTER", font=F["bold"](18), fill=TEXT_3)

    x, y = 118, int(260 + 32 * (1 - p))
    d.text((x, y - 58), "ALL-IN-1", font=F["bold"](28), fill=GREEN)
    for line in ["один контур", "для всего", "Discord сервера"]:
        d.text((x, y), line, font=F["heavy"](84), fill=TEXT)
        y += 90
    y += 18
    desc = "Модерация, аналитика, тикеты, voice, music, audit и роли собираются в одну рабочую поверхность."
    for line in wrap_text(d, desc, F["medium"](30), 680):
        d.text((x, y), line, font=F["medium"](30), fill=TEXT_2)
        y += 42

    features = [
        ("Moderation", "anti-raid + sanctions", GREEN),
        ("Analytics", "activity + voice trends", VIOLET),
        ("Tickets", "routing + transcripts", WARN),
        ("AI review", "signals without noise", GREEN),
        ("Voice/Music", "rooms + player", VIOLET),
        ("Audit", "trace every decision", GREEN),
    ]
    start_x, start_y = 920, 220
    for i, (title, sub, col) in enumerate(features):
        row, col_i = divmod(i, 2)
        a = smooth((t - 0.5 - i * 0.09) / 0.5)
        bx = start_x + col_i * 410 + int(38 * (1 - a))
        by = start_y + row * 182
        draw_card(d, (bx, by, bx + 360, by + 136), title, "ONLINE", col, sub)

    # Operational route.
    rx, ry = 935, 820
    for i, label in enumerate(["сигнал", "контекст", "действие"]):
        xx = rx + i * 250
        d.ellipse((xx, ry, xx + 58, ry + 58), fill=rgba(GREEN, 0.18), outline=rgba(GREEN, 0.46), width=2)
        d.text((xx + 18, ry + 14), str(i + 1), font=F["bold"](26), fill=GREEN)
        d.text((xx + 76, ry + 12), label, font=F["bold"](27), fill=TEXT)
        if i < 2:
            d.line((xx + 158, ry + 30, xx + 232, ry + 30), fill=rgba(GREEN, 0.48), width=3)
    return frame


def scene_product(t: float) -> Image.Image:
    frame = BASE_BG.copy()
    frame.alpha_composite(apply_opacity(MODULES_BG, 0.18))
    frame.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 80)))
    d = ImageDraw.Draw(frame)

    p = ease_out(t / 0.9)
    switch = smooth((t - 2.0) / 0.65)
    paste_panel(frame, HUB_PANEL, int(670 - 46 * (1 - p)), 160, 1 - 0.55 * switch)
    paste_panel(frame, STATS_PANEL, int(705 + 34 * (1 - p)), 180, 0.18 + 0.82 * switch)

    d.text((112, 118), "DASHBOARD В ДЕЛЕ", font=F["bold"](26), fill=GREEN)
    y = 178
    for line in ["видишь сигнал", "понимаешь", "контекст", "действуешь"]:
        d.text((112, y), line, font=F["heavy"](74), fill=TEXT)
        y += 78
    d.text((116, y + 12), "Без переключения между десятком сервисов.", font=F["medium"](28), fill=TEXT_2)

    cards = [
        ("AI moderation", "toxicity, scam, raids", GREEN),
        ("Live analytics", "messages, voice, members", VIOLET),
        ("Tickets", "SLA, routing, transcripts", WARN),
        ("Audit memory", "who changed what", GREEN),
    ]
    cy = 690
    for i, (title, sub, col) in enumerate(cards):
        a = smooth((t - 0.5 - i * 0.12) / 0.45)
        bx = 112 + (i % 2) * 355
        by = cy + (i // 2) * 142
        draw_card(d, (bx, by + int(24 * (1 - a)), bx + 318, by + 108 + int(24 * (1 - a))), title, "READY", col, sub)

    # Dashboard overlay cards on the screenshots.
    overlay_x = 1080
    overlay_y = 700
    d.rounded_rectangle((overlay_x, overlay_y, overlay_x + 650, overlay_y + 220), radius=30, fill=(8, 9, 9, 226), outline=rgba(GREEN, 0.24), width=2)
    d.text((overlay_x + 34, overlay_y + 30), "ONE CONTROL SURFACE", font=F["bold"](22), fill=GREEN)
    d.text((overlay_x + 34, overlay_y + 72), "moderation • analytics • tickets • voice", font=F["heavy"](36), fill=TEXT)
    draw_line_chart(d, (overlay_x + 34, overlay_y + 128, overlay_x + 616, overlay_y + 190), [8, 14, 11, 22, 18, 31, 28], GREEN)

    scan_x = int(690 + (t % 2.4) / 2.4 * 1080)
    d.line((scan_x, 150, scan_x, 890), fill=rgba(GREEN, 0.32), width=3)
    return frame


def scene_cta(t: float) -> Image.Image:
    frame = BASE_BG.copy()
    frame.alpha_composite(apply_opacity(LANDING_BG, 0.38))
    frame.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 138)))
    d = ImageDraw.Draw(frame)
    p = ease_out(t / 0.8)

    icon = contain(LOGO, (108, 108))
    frame.alpha_composite(icon, (906, 108))
    d.text((W // 2, 240), "OVERLORD", font=F["akony"](92), fill=TEXT, anchor="mm")
    d.text((W // 2, 310), "COMMAND CENTER", font=F["bold"](24), fill=TEXT_3, anchor="mm")

    y = int(392 + 36 * (1 - p))
    d.text((W // 2, y), "NEXT-GEN ALL-IN-1", font=F["heavy"](78), fill=TEXT, anchor="mm")
    d.text((W // 2, y + 88), "для малых и крупных Discord серверов", font=F["bold"](42), fill=TEXT_2, anchor="mm")

    pills = [
        ("Инструмент временно бесплатный", GREEN, 430),
        ("AGPL-3.0 license", VIOLET, 320),
        ("без дорогущих подписок", WARN, 350),
    ]
    total = sum(width for _, _, width in pills) + 32 * (len(pills) - 1)
    x = (W - total) // 2
    for i, (label, col, width) in enumerate(pills):
        a = smooth((t - 0.8 - i * 0.12) / 0.5)
        draw_pill(d, (x, 606 + int(20 * (1 - a)), x + width, 670 + int(20 * (1 - a))), label, rgba(col, 0.16 * a), rgba(col, 0.45 * a), rgba(TEXT, a), F["bold"](24))
        x += width + 32

    d.rounded_rectangle((590, 760, 1330, 848), radius=44, fill=rgba(GREEN, 0.95), outline=rgba(GREEN, 1), width=1)
    d.text((960, 804), "меньше ручной рутины, больше контроля", font=F["bold"](30), fill=(7, 17, 10, 255), anchor="mm")
    d.text((960, 936), "Moderation / Analytics / Tickets / Voice / Music / Audit / Roles", font=F["bold"](23), fill=TEXT_2, anchor="mm")
    return frame


SCENES = [
    (0.0, 3.4, scene_chaos),
    (3.1, 6.4, scene_solution),
    (6.1, 11.1, scene_product),
    (10.8, 15.0, scene_cta),
]


def visibility(t: float, start: float, end: float, fade: float = 0.42) -> float:
    return smooth((t - start) / fade) * smooth((end - t) / fade)


def render_frame(t: float) -> Image.Image:
    out = Image.new("RGBA", (W, H), BG)
    for start, end, fn in SCENES:
        alpha = visibility(t, start, end)
        if alpha <= 0:
            continue
        scene = fn(t - start)
        out.alpha_composite(apply_opacity(scene, alpha))
    return out.convert("RGB")


def ffmpeg_path() -> str:
    env_path = os.environ.get("FFMPEG_PATH")
    if env_path and Path(env_path).exists():
        return env_path
    bundled = asset("tmp", "video-tools", "node_modules", "ffmpeg-static", "ffmpeg.exe")
    if bundled.exists():
        return str(bundled)
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg not found. Install ffmpeg or run npm install --prefix tmp/video-tools ffmpeg-static.")


def render_video() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_path(),
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-s",
        f"{W}x{H}",
        "-pix_fmt",
        "rgb24",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(OUTPUT),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for index in range(TOTAL_FRAMES):
        t = index / FPS
        frame = render_frame(t)
        proc.stdin.write(frame.tobytes())
        if index % FPS == 0:
            print(f"rendered {index // FPS:02d}s / {int(DURATION)}s", flush=True)
    proc.stdin.close()
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg exited with code {code}")
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    try:
        render_video()
    except KeyboardInterrupt:
        sys.exit(130)
