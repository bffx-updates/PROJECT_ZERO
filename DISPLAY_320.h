#ifndef DISPLAY_320_H
#define DISPLAY_320_H

extern lgfx::LGFX_Device *tft;
extern LGFX_Sprite *canvas;
extern bool canvasReady;

namespace dsp320 {

static constexpr int SCREEN_W = 320;
static constexpr int SCREEN_H = 240;

// nameAlign: 0..8 mapeado como grid 3x3.
//   col = align % 3 (0=esq, 1=centro, 2=dir)
//   row = align / 3 (0=topo, 1=meio, 2=base)
template <typename G>
static inline void display_draw_centered(G &g, const char *label,
                                         long bgColorId, long nameColorId,
                                         long nameBorderColorId,
                                         long tagColorId, int fontSize,
                                         bool fontBold, int nameAlign) {
  bfmidi_fill_display(g, bgColorId, SCREEN_W, SCREEN_H);
  bfmidi_apply_font(g, fontSize, fontBold);

  const int SCREEN_MARGIN = 12;
  const int padX = 14, padY = 8, radius = 10;
  const int textW = g.textWidth(label);
  const int textH = g.fontHeight();
  const int frameW = textW + padX * 2;
  const int frameH = textH + padY * 2;

  if (nameAlign < 0) nameAlign = 0;
  if (nameAlign > 8) nameAlign = 8;
  const int col = nameAlign % 3;
  const int row = nameAlign / 3;

  int frameX = (col == 0) ? SCREEN_MARGIN
             : (col == 2) ? (SCREEN_W - frameW - SCREEN_MARGIN)
                          : (SCREEN_W - frameW) / 2;
  int frameY = (row == 0) ? SCREEN_MARGIN
             : (row == 2) ? (SCREEN_H - frameH - SCREEN_MARGIN)
                          : (SCREEN_H - frameH) / 2;
  // +5px compensa baseline alto das FreeSans*pt7b quando centralizado vertical.
  if (row == 1) frameY += 5;

  const DisplayColor &tagC = display_color_at(tagColorId);
  if (tagC.type != DISP_TRANSPARENT) {
    const uint16_t tagRgb = display_color_resolve_solid(tagColorId);
    g.fillRoundRect(frameX, frameY, frameW, frameH, radius, tagRgb);
  }

  const DisplayColor &nameC = display_color_at(nameColorId);
  if (nameC.type != DISP_TRANSPARENT) {
    const int textX = frameX + padX;
    const int textY = frameY + padY;
    g.setTextDatum(lgfx::top_left);

    // Outline: 8 passes em 1px na cor da borda quando name_border != TRANSPARENT.
    const DisplayColor &borderC = display_color_at(nameBorderColorId);
    if (borderC.type != DISP_TRANSPARENT) {
      g.setTextColor(display_color_resolve_solid(nameBorderColorId));
      static const int8_t dx[8] = {-1, 1, 0, 0, -1, -1, 1, 1};
      static const int8_t dy[8] = {0, 0, -1, 1, -1, 1, -1, 1};
      for (int i = 0; i < 8; i++) {
        g.drawString(label, textX + dx[i], textY + dy[i]);
      }
    }

    g.setTextColor(display_color_resolve_solid(nameColorId));
    g.drawString(label, textX, textY);
  }
  g.setTextSize(1);
}

static inline void display_present(const char *label, long bgColorId,
                                   long nameColorId, long nameBorderColorId,
                                   long tagColorId, int fontSize, bool fontBold,
                                   int nameAlign) {
  if (canvasReady) {
    display_draw_centered(*canvas, label, bgColorId, nameColorId,
                          nameBorderColorId, tagColorId, fontSize, fontBold,
                          nameAlign);
    canvas->pushSprite(0, 0);
  } else {
    display_draw_centered(*tft, label, bgColorId, nameColorId,
                          nameBorderColorId, tagColorId, fontSize, fontBold,
                          nameAlign);
  }
}

static inline void welcome_screen() {
  // bg=TRANSPARENT, name=Branco(4), border=TRANSPARENT(0), tag=TRANSPARENT(0)
  display_present("SELECT BANK", 0, 4, 0, 0, 24, true, 4);
}

static inline void draw_bank_screen(const char *label, long bgColorId,
                                    long nameColorId, long nameBorderColorId,
                                    long tagColorId, int fontSize, bool fontBold,
                                    int nameAlign) {
  display_present(label && label[0] ? label : "BANK", bgColorId, nameColorId,
                  nameBorderColorId, tagColorId, fontSize, fontBold, nameAlign);
}

static inline void draw_live_screen(const char *label, long bgColorId,
                                    long nameColorId, long nameBorderColorId,
                                    long tagColorId, int fontSize, bool fontBold,
                                    int nameAlign) {
  display_present(label && label[0] ? label : "LIVE", bgColorId, nameColorId,
                  nameBorderColorId, tagColorId, fontSize, fontBold, nameAlign);
}

template <typename G>
static inline void display_draw_wifi_icon(G &g, bool on) {
  const uint16_t bg = 0x0000U;
  const uint16_t color = on ? 0x07E0U : 0xF800U;
  g.fillScreen(bg);

  const int cx = SCREEN_W / 2;
  const int cy = SCREEN_H / 2 + 40;

  // Tres aneis concentricos voltados para cima (mascara a metade de baixo).
  g.fillCircle(cx, cy, 90, color);
  g.fillCircle(cx, cy, 75, bg);
  g.fillCircle(cx, cy, 65, color);
  g.fillCircle(cx, cy, 50, bg);
  g.fillCircle(cx, cy, 38, color);
  g.fillCircle(cx, cy, 23, bg);
  g.fillRect(0, cy, SCREEN_W, SCREEN_H - cy, bg);
  g.fillCircle(cx, cy - 6, 9, color);

  if (!on) {
    for (int t = -2; t <= 2; t++) {
      g.drawLine(cx - 90, cy - 90 + t, cx + 90, cy + 90 + t, color);
    }
  }
}

static inline void draw_wifi_icon(bool on) {
  if (canvasReady) {
    display_draw_wifi_icon(*canvas, on);
    canvas->pushSprite(0, 0);
  } else {
    display_draw_wifi_icon(*tft, on);
  }
}

} // namespace dsp320

#endif
