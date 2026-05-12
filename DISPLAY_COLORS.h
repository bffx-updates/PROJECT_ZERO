#ifndef DISPLAY_COLORS_H
#define DISPLAY_COLORS_H

#include <Arduino.h>

// =============================================================================
// DISPLAY_COLORS.h — paleta unica compartilhada entre firmware e webApp.
// IDs sao indices nesse array; a ordem precisa bater EXATAMENTE com o mirror
// em webApp/app.jsx (DISPLAY_PALETTE). Adicionar/remover entradas exige
// atualizar os dois lados ou os presets salvos vao apontar pra cor errada.
//
// Fase 1: somente o tipo, hex e direcao sao persistidos. O renderer atual
// pinta tudo como SOLID (usando o hex base). Gradientes/transparente reais
// chegam na Fase 2 (ver bankMemoryColorRgb565).
// =============================================================================

typedef enum {
  DISP_SOLID = 0,
  DISP_GRADIENT_1,
  DISP_GRADIENT_2,
  DISP_CUSTOM_BLACK,
  DISP_MISC_GRADIENT,
  DISP_TRANSPARENT,
  DISP_BACK_IMAGE,  // reservado para Fase 3; sem entradas no momento.
} DisplayColorType;

typedef enum {
  DISP_DIR_NONE = 0,
  DISP_DIR_H,       // gradient horizontal (esquerda -> direita)
  DISP_DIR_V,       // gradient vertical (topo -> base)
  DISP_DIR_D,       // gradient diagonal
  DISP_DIR_RADIAL,  // highlight radial (G2 / glossy)
} DisplayGradientDir;

typedef struct {
  const char *name;
  uint32_t hex;       // SOLID/G1/G2/CUSTOM: cor base. MISC: stop inicial.
  uint32_t hex_mid;   // MISC: stop do meio. Demais tipos: 0 (nao usado).
  uint32_t hex_end;   // MISC: stop final. Demais tipos: 0 (nao usado).
  uint8_t type;       // DisplayColorType
  uint8_t direction;  // DisplayGradientDir
} DisplayColor;

// Lista das 32 cores base reutilizadas pelos blocos SOLID/G1/G2/CUSTOM.
#define DISPLAY_BASE_COLORS(X, TYPE_PREFIX) \
  X(TYPE_PREFIX "Preto",          0x000000) \
  X(TYPE_PREFIX "Cinza Escuro",   0x555555) \
  X(TYPE_PREFIX "Cinza Claro",    0xAAAAAA) \
  X(TYPE_PREFIX "Branco",         0xFFFFFF) \
  X(TYPE_PREFIX "Oliva Escuro",   0x666600) \
  X(TYPE_PREFIX "Oliva",          0xAAAA00) \
  X(TYPE_PREFIX "Amarelo",        0xFFFF00) \
  X(TYPE_PREFIX "Amarelo Claro",  0xFFFF88) \
  X(TYPE_PREFIX "Marrom",         0x8B4513) \
  X(TYPE_PREFIX "Ocre",           0xD2691E) \
  X(TYPE_PREFIX "Laranja",        0xFF8C00) \
  X(TYPE_PREFIX "Pessego",        0xFFDAB9) \
  X(TYPE_PREFIX "Bordo",          0x800000) \
  X(TYPE_PREFIX "Vermelho Escuro",0xCC0000) \
  X(TYPE_PREFIX "Vermelho",       0xFF0000) \
  X(TYPE_PREFIX "Salmao",         0xFA8072) \
  X(TYPE_PREFIX "Purpura",        0x800080) \
  X(TYPE_PREFIX "Magenta Escura", 0xCC00CC) \
  X(TYPE_PREFIX "Magenta",        0xFF00FF) \
  X(TYPE_PREFIX "Rosa Claro",     0xFFB6C1) \
  X(TYPE_PREFIX "Indigo",         0x4B0082) \
  X(TYPE_PREFIX "Roxo",           0x8A2BE2) \
  X(TYPE_PREFIX "Violeta",        0x9932CC) \
  X(TYPE_PREFIX "Lilas",          0xDDA0DD) \
  X(TYPE_PREFIX "Azul Marinho",   0x000080) \
  X(TYPE_PREFIX "Azul Escuro",    0x0000CC) \
  X(TYPE_PREFIX "Azul",           0x0000FF) \
  X(TYPE_PREFIX "Azul Claro",     0x87CEFA) \
  X(TYPE_PREFIX "Verde Escuro",   0x006400) \
  X(TYPE_PREFIX "Verde Medio",    0x00A000) \
  X(TYPE_PREFIX "Verde",          0x00FF00) \
  X(TYPE_PREFIX "Verde Claro",    0x98FB98)

// SOLID/G1/G2/CUSTOM derivam stops da cor base no render — hex_mid/hex_end ficam 0.
// G2 e DIAGONAL (top-esquerda claro -> base no meio -> bottom-direita escuro).
// CUSTOM e VERTICAL com preto fixo nos extremos: top=preto / mid=base / bottom=preto.
#define DISP_SOLID_ENTRY(NAME, HEX)  { NAME, HEX, 0, 0, DISP_SOLID,         DISP_DIR_NONE },
#define DISP_G1_ENTRY(NAME, HEX)     { NAME, HEX, 0, 0, DISP_GRADIENT_1,    DISP_DIR_V    },
#define DISP_G2_ENTRY(NAME, HEX)     { NAME, HEX, 0, 0, DISP_GRADIENT_2,    DISP_DIR_D    },
#define DISP_CUSTOM_ENTRY(NAME, HEX) { NAME, HEX, 0, 0, DISP_CUSTOM_BLACK,  DISP_DIR_V    },

static const DisplayColor DISPLAY_PALETTE[] = {
  // -- TRANSPARENCIA -------------------------------------------------------
  { "Sem Cor", 0x000000, 0, 0, DISP_TRANSPARENT, DISP_DIR_NONE },

  // -- SOLID COLORS (32) ---------------------------------------------------
  DISPLAY_BASE_COLORS(DISP_SOLID_ENTRY, "")

  // -- GRADIENT 1: fade vertical (topo claro -> base escura) (32) ---------
  DISPLAY_BASE_COLORS(DISP_G1_ENTRY, "G1 ")

  // -- GRADIENT 2: highlight radial / glossy (32) --------------------------
  DISPLAY_BASE_COLORS(DISP_G2_ENTRY, "G2 ")

  // -- CUSTOM: banda horizontal metalica (32) ------------------------------
  DISPLAY_BASE_COLORS(DISP_CUSTOM_ENTRY, "Custom ")

  // -- MISC GRADIENTS: 3 stops fixos + direcao (24) ------------------------
  // formato: { name, stop0, stop1, stop2, type, direction }
  { "Sunset Horizontal",        0xFF2D55, 0xFFB347, 0xFF6A00, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Fire Diagonal",            0xFFD200, 0xFF6A00, 0xB30000, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Ember Horizontal",         0xFF8C00, 0xFF3D00, 0x6E0E0E, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Lava Vertical",            0xFFD000, 0xFF3C00, 0x800000, DISP_MISC_GRADIENT, DISP_DIR_V },
  { "Berry Diagonal",           0xFF85B3, 0xFF2D74, 0x800040, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Flamingo Horizontal",      0xFFB6C1, 0xFF6E96, 0xC0426E, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Candy Diagonal",           0xFFB3D9, 0xFF50B4, 0x7A1F5E, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Por do Sol Vertical",      0xFFB347, 0xFF7832, 0xB33A00, DISP_MISC_GRADIENT, DISP_DIR_V },
  { "Gold Vertical",            0xFFEB99, 0xFFC247, 0xB8860B, DISP_MISC_GRADIENT, DISP_DIR_V },
  { "Cobre Horizontal",         0xE8A77A, 0xC87832, 0x6B3410, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Steel Vertical",           0xD7DAE0, 0xA5B0C4, 0x4F5562, DISP_MISC_GRADIENT, DISP_DIR_V },
  { "Noite Vertical",           0x4B5BAF, 0x191970, 0x000033, DISP_MISC_GRADIENT, DISP_DIR_V },
  { "Lima Horizontal",          0xDEFF80, 0xA0FF00, 0x5C9900, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Toxic Horizontal",         0xB3FF80, 0x76FF03, 0x2E7D00, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Aurora Vertical",          0xA8FFD8, 0x44FFB0, 0x00805F, DISP_MISC_GRADIENT, DISP_DIR_V },
  { "Floresta Horizontal",      0x4FE077, 0x00B43C, 0x003D14, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Neon Diagonal",            0xB3FFE0, 0x00FFB4, 0x008866, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Aqua Diagonal",            0x99EEFF, 0x00D8FF, 0x007A99, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Ice Diagonal",             0xC8F7FF, 0x78F0FF, 0x0099AA, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Ocean Horizontal",         0x99DAFF, 0x00B4FF, 0x003C99, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Sky Diagonal",             0xBBDFFF, 0x62BEFF, 0x0E5499, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Oceano Profundo Diagonal", 0x4683C5, 0x0050A0, 0x002550, DISP_MISC_GRADIENT, DISP_DIR_D },
  { "Grape Horizontal",         0xD9B3FF, 0x9B4DFF, 0x4A1E80, DISP_MISC_GRADIENT, DISP_DIR_H },
  { "Ametista Diagonal",        0xC599FF, 0x823CFF, 0x3A0F80, DISP_MISC_GRADIENT, DISP_DIR_D },
};

static constexpr size_t DISPLAY_PALETTE_COUNT =
    sizeof(DISPLAY_PALETTE) / sizeof(DISPLAY_PALETTE[0]);

// Conversao RGB888 -> RGB565 (5-6-5).
static inline uint16_t display_rgb888_to_565(uint32_t rgb) {
  const uint8_t r = (uint8_t)((rgb >> 16) & 0xFF);
  const uint8_t g = (uint8_t)((rgb >> 8) & 0xFF);
  const uint8_t b = (uint8_t)(rgb & 0xFF);
  return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

static inline bool display_color_valid(long id) {
  return id >= 0 && (size_t)id < DISPLAY_PALETTE_COUNT;
}

// Retorna a entry. Fora de range cai num SOLID preto pra nao quebrar render.
static inline const DisplayColor &display_color_at(long id) {
  static const DisplayColor fallback = {
      "Fallback", 0x000000, DISP_SOLID, DISP_DIR_NONE};
  if (!display_color_valid(id)) {
    return fallback;
  }
  return DISPLAY_PALETTE[id];
}

// Resolve um ID pra RGB565 plano: usado pelo foreground (texto/tag) que
// hoje so aceita SOLID/TRANSPARENT, e como fallback do fill. Gradientes
// caem na cor base; TRANSPARENT vira preto.
static inline uint16_t display_color_resolve_solid(long id) {
  const DisplayColor &c = display_color_at(id);
  if (c.type == DISP_TRANSPARENT) {
    return 0x0000U;
  }
  return display_rgb888_to_565(c.hex);
}

// Pinta o retangulo [0..W) x [0..H) do target LGFX g segundo o tipo/direcao
// do color id. Caminho unico 3-stop (stop0 -> stop1 no meio -> stop2) com
// matematica inteira (sem FPU no ESP32-S2).
//
// Stops por tipo:
//   G1 (vertical):              light(base) -> base -> dark(base)
//   G2 (diagonal cima->baixo):  light(base) -> base -> dark(base)
//   CUSTOM_BLACK (vertical):    preto       -> base -> preto
//   MISC (V/H/D):               hex / hex_mid / hex_end (3 explicitos)
//
// light = base +35% rumo ao branco; dark = base *55% (-45% rumo ao preto).
template <typename G>
static inline void bfmidi_fill_display(G &g, long colorId, int W, int H) {
  const DisplayColor &c = display_color_at(colorId);

  // Casos planos.
  if (c.type == DISP_SOLID || c.type == DISP_TRANSPARENT ||
      c.type == DISP_BACK_IMAGE) {
    g.fillRect(0, 0, W, H, display_color_resolve_solid(colorId));
    return;
  }

  // Resolve os 3 stops e direcao.
  uint32_t stop0 = c.hex, stop1 = c.hex, stop2 = c.hex;
  uint8_t dir = c.direction;

  if (c.type == DISP_GRADIENT_1 || c.type == DISP_GRADIENT_2) {
    const uint32_t r = (c.hex >> 16) & 0xFF;
    const uint32_t g_ = (c.hex >> 8) & 0xFF;
    const uint32_t b = c.hex & 0xFF;
    const uint32_t rL = r + (255 - r) * 35 / 100;
    const uint32_t gL = g_ + (255 - g_) * 35 / 100;
    const uint32_t bL = b + (255 - b) * 35 / 100;
    const uint32_t rD = r * 55 / 100;
    const uint32_t gD = g_ * 55 / 100;
    const uint32_t bD = b * 55 / 100;
    stop0 = (rL << 16) | (gL << 8) | bL;
    stop1 = c.hex;
    stop2 = (rD << 16) | (gD << 8) | bD;
    // G1 sempre vertical; G2 sempre diagonal.
    dir = (c.type == DISP_GRADIENT_2) ? DISP_DIR_D : DISP_DIR_V;
  } else if (c.type == DISP_CUSTOM_BLACK) {
    stop0 = 0x000000;
    stop1 = c.hex;
    stop2 = 0x000000;
    dir = DISP_DIR_V;
  } else if (c.type == DISP_MISC_GRADIENT) {
    stop0 = c.hex;
    stop1 = c.hex_mid;
    stop2 = c.hex_end;
    // direction usa o que vem do struct (V/H/D).
  } else {
    g.fillRect(0, 0, W, H, display_color_resolve_solid(colorId));
    return;
  }

  const int s0r = (int)((stop0 >> 16) & 0xFF);
  const int s0g = (int)((stop0 >> 8) & 0xFF);
  const int s0b = (int)(stop0 & 0xFF);
  const int s1r = (int)((stop1 >> 16) & 0xFF);
  const int s1g = (int)((stop1 >> 8) & 0xFF);
  const int s1b = (int)(stop1 & 0xFF);
  const int s2r = (int)((stop2 >> 16) & 0xFF);
  const int s2g = (int)((stop2 >> 8) & 0xFF);
  const int s2b = (int)(stop2 & 0xFF);

  // Bayer 4x4 (range 0..15). Aplica ditherinhg ordenado antes da truncacao
  // 565 pra mascarar banding em gradientes suaves. Cada canal ganha um
  // offset proporcional ao LSB que vai cair na quantizacao:
  //   R/B (5 bits, step=8) -> +(bayer >> 1) = 0..7
  //   G   (6 bits, step=4) -> +(bayer >> 2) = 0..3
  static const uint8_t BAYER_4X4[16] = {
       0,  8,  2, 10,
      12,  4, 14,  6,
       3, 11,  1,  9,
      15,  7, 13,  5,
  };

  // interpRGB(t256) -> componentes em 0..255 (sem dither, sem truncar).
  auto interp = [&](int t256, int &rr, int &gg_, int &bb) {
    if (t256 < 128) {
      const int u = t256 * 2;
      rr  = s0r + ((s1r - s0r) * u) / 256;
      gg_ = s0g + ((s1g - s0g) * u) / 256;
      bb  = s0b + ((s1b - s0b) * u) / 256;
    } else {
      const int u = (t256 - 128) * 2;
      rr  = s1r + ((s2r - s1r) * u) / 256;
      gg_ = s1g + ((s2g - s1g) * u) / 256;
      bb  = s1b + ((s2b - s1b) * u) / 256;
    }
  };

  // pack(rr, gg_, bb, x, y) -> RGB565 com dither aplicado.
  auto pack = [&](int rr, int gg_, int bb, int x, int y) -> uint16_t {
    const int d = BAYER_4X4[((y & 3) << 2) | (x & 3)];
    int r = rr + (d >> 1);
    int g_ = gg_ + (d >> 2);
    int b = bb + (d >> 1);
    if (r > 255) r = 255;
    if (g_ > 255) g_ = 255;
    if (b > 255) b = 255;
    return (uint16_t)(((r & 0xF8) << 8) | ((g_ & 0xFC) << 3) | (b >> 3));
  };

  if (dir == DISP_DIR_V) {
    const int denom = (H > 1) ? (H - 1) : 1;
    for (int y = 0; y < H; y++) {
      int rr, gg_, bb;
      interp((y * 255) / denom, rr, gg_, bb);
      // Mesma cor base na linha; dither varia por x.
      for (int x = 0; x < W; x++) {
        g.drawPixel(x, y, pack(rr, gg_, bb, x, y));
      }
    }
    return;
  }
  if (dir == DISP_DIR_H) {
    const int denom = (W > 1) ? (W - 1) : 1;
    // Pre-computa rr/gg/bb por coluna pra evitar repetir interp por linha.
    // Em vez de cachear o array todo (W pode ser 480, 3 ints = 5.6 KB),
    // usamos cache curto e refazemos quando necessario.
    for (int y = 0; y < H; y++) {
      for (int x = 0; x < W; x++) {
        int rr, gg_, bb;
        interp((x * 255) / denom, rr, gg_, bb);
        g.drawPixel(x, y, pack(rr, gg_, bb, x, y));
      }
    }
    return;
  }
  if (dir == DISP_DIR_D) {
    const int denom = (W + H > 2) ? (W + H - 2) : 1;
    for (int y = 0; y < H; y++) {
      for (int x = 0; x < W; x++) {
        int rr, gg_, bb;
        interp(((x + y) * 255) / denom, rr, gg_, bb);
        g.drawPixel(x, y, pack(rr, gg_, bb, x, y));
      }
    }
    return;
  }

  // Fallback.
  g.fillRect(0, 0, W, H, display_color_resolve_solid(colorId));
}

#endif  // DISPLAY_COLORS_H
