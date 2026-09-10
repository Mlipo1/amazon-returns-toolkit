"""Generates icon128.png with no image libraries -- just zlib + struct."""
import zlib, struct, pathlib

S = 128
YELLOW = (255, 216, 20, 255)
DARK = (35, 47, 62, 255)
TAPE = (255, 216, 20, 255)
CLEAR = (0, 0, 0, 0)
R = 22  # corner radius


def rounded(x, y):
    for cx, cy in ((R, R), (S - 1 - R, R), (R, S - 1 - R), (S - 1 - R, S - 1 - R)):
        if (x < R and y < R) or (x > S - 1 - R and y < R) \
           or (x < R and y > S - 1 - R) or (x > S - 1 - R and y > S - 1 - R):
            if (x - cx) ** 2 + (y - cy) ** 2 > R * R and \
               abs(x - cx) <= R + 1 and abs(y - cy) <= R + 1:
                return False
    return True


def px(x, y):
    if not rounded(x, y):
        return CLEAR
    # lid: slightly wider than the body, with a short tape notch at centre
    if 20 <= x <= 107 and 38 <= y <= 58:
        if 58 <= x <= 69 and 38 <= y <= 46:
            return TAPE
        return DARK
    # body, separated from the lid by a yellow seam at y == 59..61
    if 27 <= x <= 100 and 62 <= y <= 106:
        return DARK
    return YELLOW


raw = bytearray()
for y in range(S):
    raw.append(0)
    for x in range(S):
        raw.extend(px(x, y))


def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
       + chunk(b"IEND", b""))

out = pathlib.Path(__file__).parent / "icon128.png"
out.write_bytes(png)
print("wrote", out, len(png), "bytes")
