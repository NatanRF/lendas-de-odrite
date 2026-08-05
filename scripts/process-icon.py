"""
Processa um ícone gerado (silhueta preta sobre fundo branco) em um ícone
branco com fundo transparente, no padrão usado pelo Foundry (icons/svg/*).

Uso: python process-icon.py <entrada> <saida> [tamanho]
"""
import sys
from collections import deque

from PIL import Image
import numpy as np


def process_icon(path_in, path_out, size=256, threshold=235):
    img = Image.open(path_in).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    is_white = (r > threshold) & (g > threshold) & (b > threshold)

    # flood fill a partir das bordas para achar o fundo branco conectado
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

    # alpha = 0 onde era fundo branco; caso contrário usa o quão "escuro" o
    # pixel é como alpha (suaviza bordas anti-aliased) e pinta tudo de branco
    darkness = 255 - np.array(Image.fromarray(arr[:, :, :3]).convert("L"))
    alpha = np.where(visited, 0, np.clip(darkness * 1.6, 0, 255)).astype("uint8")

    out_arr = np.zeros((h, w, 4), dtype="uint8")
    out_arr[:, :, 0] = 255
    out_arr[:, :, 1] = 255
    out_arr[:, :, 2] = 255
    out_arr[:, :, 3] = alpha

    out = Image.fromarray(out_arr, "RGBA")
    bbox = out.getbbox()
    if bbox:
        # adiciona uma margem pequena
        pad = int(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 0.08)
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        out = out.crop(bbox)

    # centraliza em um canvas quadrado
    side = max(out.width, out.height)
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    canvas.paste(out, ((side - out.width) // 2, (side - out.height) // 2), out)
    canvas = canvas.resize((size, size), Image.LANCZOS)
    canvas.save(path_out, optimize=True)
    print(f"{path_out}: {canvas.size}")


if __name__ == "__main__":
    entrada, saida = sys.argv[1], sys.argv[2]
    tamanho = int(sys.argv[3]) if len(sys.argv) > 3 else 256
    process_icon(entrada, saida, tamanho)
