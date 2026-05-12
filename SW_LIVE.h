#ifndef SW_LIVE_H
#define SW_LIVE_H

#include <Arduino.h>

static inline void swLiveRenderCurrent() {
  BankMemoryEntry &entry = bankMemoryCurrent();
  char label[BANK_MEMORY_NAME_MAX + 8];
  bankMemoryScreenLabel(entry, "LIVE", label, sizeof(label));
  const long bgColorId = bankMemoryGetFieldInt(entry.data, "bg_color", 0);
  const long nameColorId =
      bankMemoryGetFieldInt(entry.data, "name_color", 4);
  const long nameBorderColorId =
      bankMemoryGetFieldInt(entry.data, "name_border_color", 0);
  const long tagColorId =
      bankMemoryGetFieldInt(entry.data, "tag_color", 11);
  const int fontSize =
      (int)bankMemoryGetFieldInt(entry.data, "font_size", 18);
  const bool fontBold =
      bankMemoryGetFieldInt(entry.data, "font_bold", 0) != 0;
  const int nameAlign =
      (int)bankMemoryGetFieldInt(entry.data, "name_align", 4);
  draw_live_screen(label, bgColorId, nameColorId, nameBorderColorId, tagColorId,
                   fontSize, fontBold, nameAlign);
  ledStripShowLive();
}

static inline void swLiveBegin() {
  // Logica LIVE pendente — sem inicializacao por enquanto.
}

static inline void swLiveUpdate() {
  swBankUpdateButtonStates();
  swWifiToggleComboUpdate();
  swNanoLiveComboUpdate();
  // Logica dos switches em modo LIVE sera adicionada depois.
}

#endif
