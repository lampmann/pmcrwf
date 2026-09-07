#!/usr/bin/env python3
"""Regenerates icons/icon-192.png and icons/icon-512.png from icons/icon.svg's shapes.

Run by hand when the icon changes; the PNGs are committed, so nobody needs this to use pmcrwf.
It exists because a web app manifest wants raster icons and this project has no build step and no
image library — so rather than add either, the twenty lines of PNG encoding live here in the open.

    python3 tools/make-icons.py

The shapes are duplicated from icons/icon.svg on purpose. Two files, one drawing, no dependency:
the SVG is what browsers and the favicon use, this is what produces the manifest's PNGs, and if
they ever drift the icons simply look slightly different in two places rather than the build
breaking. Keep them in step by hand.
"""

import os
import struct
import zlib

# --- the drawing, in a 0..1 square ------------------------------------------------------------
# A d20 face: the outer triangle of an icosahedron seen point-up, with the inverted inner triangle
# that every d20 shows. Flat colour, no gradients — it has to read at 16 px in a browser tab.
BG = (0x1a, 0x1a, 0x1f)
INK = (0xe8, 0xe2, 0xd4)
OUTER = [(0.50, 0.09), (0.93, 0.84), (0.07, 0.84)]
# The inner triangle of a d20 face is the medial one: its corners are the midpoints of the outer
# edges, which is what cuts the face into a centre and three corners. Derived, not eyeballed.
INNER = [((OUTER[i][0] + OUTER[(i + 1) % 3][0]) / 2,
          (OUTER[i][1] + OUTER[(i + 1) % 3][1]) / 2) for i in range(3)]

SS = 4  # supersampling factor per axis; 16 samples a pixel is plenty for two triangles


def inside(poly, x, y):
    """Even-odd point-in-polygon."""
    hit = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            hit = not hit
    return hit


def edge_dist(poly, x, y):
    """Distance from (x, y) to the polygon's nearest edge, for stroking the inner triangle."""
    best = 9.9
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)))
        best = min(best, ((x - x0 - t * dx) ** 2 + (y - y0 - t * dy) ** 2) ** 0.5)
    return best


def sample(x, y, stroke):
    """Colour at a point: ink inside the outer triangle, background punched back out along the
    inner triangle's edges so the classic d20 face shows through."""
    if not inside(OUTER, x, y):
        return BG
    if edge_dist(INNER, x, y) < stroke:
        return BG
    return INK


def render(size, scale=1.0):
    """scale < 1 shrinks the drawing about the centre. Used for the maskable icon, which Android
    crops to a circle inscribed in the middle 80% — at full size that would slice the triangle's
    corners off, so the maskable variant draws smaller and lets the background take the crop."""
    stroke = (0.011 + 2.0 / size) / scale  # a hair heavier at small sizes so the inner triangle survives
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = ((px + (sx + 0.5) / SS) / size - 0.5) / scale + 0.5
                    y = ((py + (sy + 0.5) / SS) / size - 0.5) / scale + 0.5
                    c = sample(x, y, stroke)
                    r += c[0]; g += c[1]; b += c[2]
            n = SS * SS
            row += bytes((r // n, g // n, b // n))
        rows.append(bytes(row))
    return rows


def write_png(path, rows):
    size = len(rows)
    raw = b"".join(b"\x00" + r for r in rows)   # filter byte 0 (None) per scanline

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))   # 8-bit truecolour
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
    os.makedirs(out, exist_ok=True)
    for size, scale, name in ((192, 1.0, "icon-192.png"), (512, 1.0, "icon-512.png"),
                              (512, 0.72, "icon-maskable-512.png")):
        path = os.path.join(out, name)
        print("%s  %d bytes" % (path, write_png(path, render(size, scale))))
