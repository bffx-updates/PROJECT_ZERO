#!/usr/bin/env python3
"""
Converte PNGs RGBA em icons/source/ para um header C++ com arrays de
mascara alpha 8-bit consumido pelo firmware (ICONS_RENDER.h).

Pra cada PNG:
  - Extrai o canal alpha (RGB e ignorado — a cor sera aplicada no render).
  - Gera duas versoes:
      * LG = original (pensado pro display 480x320 da BFMIDI-3)
      * SM = downscale 2/3 via Lanczos (pro display 320x240 da BFMIDI-1/2)
  - Cospe os bytes do alpha como `static const uint8_t ICON_<NAME>_LG[]`
    e `..._SM[]`, mais uma tabela `g_icons[]` com metadados de cada um.

Nome do icone vem do basename sem extensao, lowercase:
  ICO1.png  -> "ico1"
  amp.png   -> "amp"

Uso:
  py tools/build_icons.py

Saida:
  icons/build/ICONS_DATA.h
"""
from pathlib import Path
from PIL import Image
import sys

SRC_DIR = Path(__file__).parent.parent / "icons" / "source"
OUT_DIR = Path(__file__).parent.parent / "icons" / "build"
OUT_FILE = OUT_DIR / "ICONS_DATA.h"

# Fator de downscale do tamanho LG (display grande) pro SM (display pequeno).
# 2/3 = 0.6667. Os displays sao 480/320 = 1.5x, entao 1/1.5 = 0.6667. Lanczos
# preserva bem o antialiasing do alpha mesmo nessa razao nao-inteira.
SM_RATIO = 2.0 / 3.0


def sanitize_name(stem: str) -> str:
    # ICO1 -> ico1. Substitui qualquer char nao alfanum por underscore.
    s = stem.lower()
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch)
        else:
            out.append("_")
    # Garante que comeca com letra (identificador C valido).
    if not out or not out[0].isalpha():
        out.insert(0, "i")
    return "".join(out)


def alpha_bytes(im: Image.Image) -> bytes:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    return im.getchannel("A").tobytes()


def emit_array(name: str, data: bytes) -> str:
    # 16 bytes por linha, hex 2-digit. PROGMEM nao precisa em ESP32 (tudo
    # que e const fica em flash naturalmente), mas o codigo eh agnostico.
    lines = [f"static const uint8_t {name}[{len(data)}] = {{"]
    for i in range(0, len(data), 16):
        chunk = data[i : i + 16]
        hexes = ", ".join(f"0x{b:02X}" for b in chunk)
        lines.append("  " + hexes + ("," if i + 16 < len(data) else ""))
    lines.append("};")
    return "\n".join(lines)


def main() -> int:
    src_files = sorted(SRC_DIR.glob("*.png"))
    if not src_files:
        print(f"ERRO: nenhum PNG em {SRC_DIR}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    entries = []  # list of (sanitized_name, w_lg, h_lg, w_sm, h_sm, total_bytes)
    arrays_text = []

    total_bytes = 0
    for f in src_files:
        name = sanitize_name(f.stem)
        im = Image.open(f)
        # LG = tamanho original.
        w_lg, h_lg = im.size
        lg_alpha = alpha_bytes(im)
        # SM = downscale 2/3 com Lanczos preservando alpha.
        w_sm = max(1, round(w_lg * SM_RATIO))
        h_sm = max(1, round(h_lg * SM_RATIO))
        im_sm = im.resize((w_sm, h_sm), Image.LANCZOS)
        sm_alpha = alpha_bytes(im_sm)

        arrays_text.append(emit_array(f"ICON_{name.upper()}_LG", lg_alpha))
        arrays_text.append(emit_array(f"ICON_{name.upper()}_SM", sm_alpha))
        entries.append((name, w_lg, h_lg, w_sm, h_sm, len(lg_alpha) + len(sm_alpha)))
        total_bytes += len(lg_alpha) + len(sm_alpha)

    # Tabela g_icons[] com metadados. Ordem = ordem dos src_files (alfabetica).
    # IconEntry deve casar com o struct definido em ICONS_RENDER.h.
    table_lines = ["static const IconEntry g_icons[] = {"]
    for name, w_lg, h_lg, w_sm, h_sm, _ in entries:
        upper = name.upper()
        table_lines.append(
            f'  {{ "{name}", {w_lg}, {h_lg}, ICON_{upper}_LG, '
            f'{w_sm}, {h_sm}, ICON_{upper}_SM }},'
        )
    table_lines.append("};")
    table_lines.append(
        f"static const uint16_t g_icons_count = "
        f"sizeof(g_icons) / sizeof(g_icons[0]);"
    )

    header = f"""// AUTO-GERADO por tools/build_icons.py — NAO EDITE A MAO.
// Fonte: icons/source/*.png (canal alpha extraido, RGB descartado).
// Pra regenerar: `py tools/build_icons.py`
//
// Total: {len(entries)} icones, {total_bytes} bytes (~{total_bytes // 1024} KB).
// Cada icone tem 2 tamanhos pre-renderizados:
//   _LG = original (display 480x320, BFMIDI-3)
//   _SM = downscale 2/3 via Lanczos (display 320x240, BFMIDI-1/2)
//
// A cor nao esta nos dados — ela e parametro do render (ver ICONS_RENDER.h).

#ifndef ICONS_DATA_H
#define ICONS_DATA_H

#include <stdint.h>

struct IconEntry {{
  const char    *name;
  uint8_t        w_lg;
  uint8_t        h_lg;
  const uint8_t *data_lg;
  uint8_t        w_sm;
  uint8_t        h_sm;
  const uint8_t *data_sm;
}};

"""
    footer = "\n#endif  // ICONS_DATA_H\n"

    text = header + "\n\n".join(arrays_text) + "\n\n" + "\n".join(table_lines) + footer
    OUT_FILE.write_text(text, encoding="utf-8")

    print(f"OK: {len(entries)} icones, {total_bytes} bytes ({total_bytes // 1024} KB)")
    print(f"     LG = {entries[0][1]}x{entries[0][2]}, SM = {entries[0][3]}x{entries[0][4]}")
    print(f"     -> {OUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
