"""Renders dist/screenshot-popup.png at exactly 1280x800 for the Chrome Web Store.

Drawn directly rather than screen-captured: the store requires exact dimensions, and a
browser pane won't reliably give them.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 800
F = "C:/Windows/Fonts/"

def font(name, size):
    return ImageFont.truetype(F + name, size)

reg, bold, mono = "segoeui.ttf", "segoeuib.ttf", "consola.ttf"

NAVY, NAVY2 = (35, 47, 62), (55, 71, 90)
WHITE, MUTED, YELLOW = (255, 255, 255), (207, 216, 227), (255, 216, 20)
INK, GREY, LINE = (17, 17, 17), (118, 118, 118), (238, 238, 238)
RED, ORANGE, FAINT = (177, 39, 4), (196, 85, 0), (153, 153, 153)

img = Image.new("RGB", (W, H), NAVY)
d = ImageDraw.Draw(img)

# diagonal gradient
for y in range(H):
    for_x = y / H
    d.line([(0, y), (W, y)],
           fill=tuple(int(NAVY[i] + (NAVY2[i] - NAVY[i]) * for_x) for i in range(3)))

# ---- left column ----
x0 = 96
d.text((x0, 300), "Never miss an Amazon", font=font(bold, 40), fill=WHITE)
d.text((x0, 350), "return deadline.", font=font(bold, 40), fill=WHITE)
d.text((x0, 424), "Checks your returns in the background", font=font(reg, 17), fill=MUTED)
d.text((x0, 450), "and warns you", font=font(reg, 17), fill=MUTED)
w = d.textlength("and warns you ", font=font(reg, 17))
d.text((x0 + w, 450), "before", font=font(bold, 17), fill=YELLOW)
w2 = w + d.textlength("before ", font=font(bold, 17))
d.text((x0 + w2, 450), "the drop-off", font=font(reg, 17), fill=MUTED)
d.text((x0, 476), "window closes.", font=font(reg, 17), fill=MUTED)
d.text((x0, 524), "No account. No password.", font=font(reg, 17), fill=MUTED)
d.text((x0, 550), "Nothing leaves your browser.", font=font(reg, 17), fill=MUTED)

# ---- popup card ----
cx, cy, cw = 700, 168, 470
# Sample data -- deliberately generic. This image is published, so it must not
# expose anyone's real purchase history.
rows = [
    ("12d over", RED, "Inline Duct Fan, 6 Inch, with Variable", "Speed Controller", "by Aug 28  ·  D7kQm2xVRRMA"),
    ("2d left", ORANGE, "AC Manifold Gauge Set, 3-Way, with", "3 ft Hoses", "by Sep 11  ·  D3pLw8nCRRMA"),
    ("6d left", GREY, "Sun Shade Cloth, 10x12 ft, 85% Block", "Mesh Tarp with Grommets", "by Sep 15  ·  Dq5Rt1yBRRMA"),
    ("14d left", GREY, "Trailer Hitch Ball, 2-Inch Diameter,", "3,500 lb Capacity", "by Sep 23  ·  Dm9Zc4hJRRMA"),
    ("19d left", GREY, "USB-C Wall Charger, 65W, 3-Port", "Foldable Plug", "by Sep 28  ·  Dv2Nb6sKRRMA"),
]
ch = 96 + len(rows) * 74 + 74

d.rounded_rectangle([cx + 6, cy + 10, cx + cw + 6, cy + ch + 10], 18, fill=(24, 33, 45))
d.rounded_rectangle([cx, cy, cx + cw, cy + ch], 18, fill=WHITE)

px = cx + 26
d.text((px, cy + 26), "Amazon returns", font=font(bold, 17), fill=INK)
d.text((px, cy + 50), "Checked 12m ago", font=font(reg, 12), fill=GREY)

y = cy + 84
for i, (badge, colour, l1, l2, sub) in enumerate(rows):
    if i:
        d.line([(px, y - 8), (cx + cw - 26, y - 8)], fill=LINE)
    d.text((px, y + 2), badge, font=font(bold, 13), fill=colour)
    d.text((px + 78, y), l1, font=font(reg, 14), fill=INK)
    d.text((px + 78, y + 20), l2, font=font(reg, 14), fill=INK)
    d.text((px + 78, y + 42), sub, font=font(mono, 11), fill=FAINT)
    y += 74

d.line([(px, y - 8), (cx + cw - 26, y - 8)], fill=LINE)
by = y + 8
for label, fill_c, tc in (("Check now", YELLOW, INK), ("Open on Amazon", WHITE, INK), ("Settings", WHITE, INK)):
    tw = d.textlength(label, font=font(bold, 13))
    d.rounded_rectangle([px, by, px + tw + 26, by + 34], 8, fill=fill_c, outline=(213, 217, 217))
    d.text((px + 13, by + 9), label, font=font(bold, 13), fill=tc)
    px += tw + 34

out = pathlib.Path(__file__).parent / "dist" / "screenshot-popup.png"
out.parent.mkdir(exist_ok=True)
img.save(out)
print(f"wrote {out}  {img.size[0]}x{img.size[1]}  {out.stat().st_size:,} bytes")
