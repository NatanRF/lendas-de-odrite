"""
Remove fundo branco de um PNG usando preenchimento (flood fill) a partir das
bordas, preservando áreas claras internas (como o interior de uma faixa).
Recorta ao conteúdo e opcionalmente redimensiona.

Uso: python remove-bg.py <entrada> <saida> [largura_max] [threshold]
"""
import sys
from collections import deque

from PIL import Image
import numpy as np


def remove_bg_floodfill(path_in, path_out, max_width=1200, threshold=240):
    img = Image.open(path_in).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    is_white = (r > threshold) & (g > threshold) & (b > threshold)

    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    def seed(y, x):
        if is_white[y, x] and not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_white[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    arr[:, :, 3] = np.where(visited, 0, 255).astype("uint8")
    out = Image.fromarray(arr, "RGBA")

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    if out.width > max_width:
        ratio = max_width / out.width
        out = out.resize((max_width, int(out.height * ratio)), Image.LANCZOS)
    out.save(path_out, optimize=True)
    print(f"{path_out}: {out.size}")


if __name__ == "__main__":
    entrada, saida = sys.argv[1], sys.argv[2]
    largura_max = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
    threshold = int(sys.argv[4]) if len(sys.argv) > 4 else 240
    remove_bg_floodfill(entrada, saida, largura_max, threshold)
