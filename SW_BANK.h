#ifndef SW_BANK_H
#define SW_BANK_H

#include <Arduino.h>

static inline void swModeToggle();
static inline const char *swModeName();
static inline void swModeEnterLive();

// Definidas em WEB_SERVER.h (incluido depois). Usadas pelo combo SW2+SW3.
static inline void web_start();
static inline void web_stop();

// Forward-decl: definida mais abaixo neste header, chamada pelos handlers
// de preview/select que aparecem antes dela no codigo.
static inline void swBankSendHeaderMidi(const BankMemoryEntry &entry);

static bool swNanoLiveComboLatched = false;
static bool swNanoComboConsumed = false;
static uint32_t swNanoIgnoreSw12UntilMs = 0;

// Combo SW2+SW3 — liga/desliga WiFi (AP + STA) + WebServer ciclicamente.
// Funciona em qualquer placa, em modo BANK ou LIVE.
static bool swWifiComboLatched = false;
static uint32_t swWifiComboIgnoreUntilMs = 0;

// Sobreposicao do icone de Wi-Fi (3s) apos toggle do combo SW2+SW3.
static bool wifiOverlayActive = false;
static uint32_t wifiOverlayUntilMs = 0;
static constexpr uint32_t WIFI_OVERLAY_DURATION_MS = 3000;

static inline void wifiOverlayShow(bool on) {
  if (draw_wifi_icon) {
    draw_wifi_icon(on);
  }
  wifiOverlayActive = true;
  wifiOverlayUntilMs = millis() + WIFI_OVERLAY_DURATION_MS;
}

// MODO 1 (HIBRIDO) — preview de presets/banks. Entra com long-press do
// switch do preset atual; em preview, taps mudam o slot/bank previewed
// (re-tap no mesmo slot avança o bank); long-press de novo confirma.
static bool bankPreviewActive = false;
static uint8_t bankPreviewLetterIndex = 0;
static uint8_t bankPreviewPresetIndex = 0;
static uint32_t bankPreviewBlinkLastMs = 0;
static bool bankPreviewBlinkOn = true;
static constexpr uint32_t BANK_PREVIEW_BLINK_PERIOD_MS = 280;

static inline char swBankLetter() {
  return (char)('A' + activeBankLetterIndex);
}

// Próximo bank habilitado a partir de current+1, dando a volta. Se nenhum
// outro estiver habilitado, retorna o atual (sem ciclar).
static inline uint8_t swBankNextEnabledLetter(uint8_t current) {
  for (uint8_t step = 1; step <= BANK_LETTER_COUNT; step++) {
    const uint8_t cand = (current + step) % BANK_LETTER_COUNT;
    if (globalBankLetterEnabled[cand]) {
      return cand;
    }
  }
  return current;
}

static inline bool swBankIsNanoBoard() {
  return strcmp(activePins.BOARD_VERSION, "BFMIDI-3 NANO") == 0;
}

static inline uint8_t swBankPresetIndexOrDefault() {
  return activePresetIndex >= 0 ? (uint8_t)activePresetIndex : 0;
}

static inline void swBankRenderCurrent() {
  const uint8_t presetIndex = swBankPresetIndexOrDefault();
  BankMemoryEntry &entry = bankMemoryCurrent();
  char label[BANK_MEMORY_NAME_MAX + 8];
  bankMemoryScreenLabel(entry, "BANK", label, sizeof(label));
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
  draw_bank_screen(label, bgColorId, nameColorId, nameBorderColorId, tagColorId,
                   fontSize, fontBold, nameAlign);
  ledStripShowBank(presetIndex);
}

// Renderiza o preview (LED pisca no slot previewed, na cor do bank previewed).
// Truque: troca temporariamente activeBankLetterIndex pra ledStripShowBank
// resolver a cor (modo POR LETRA usa activeBankLetterIndex).
static inline void swBankRenderPreview() {
  const uint8_t previewIdx =
      bankMemoryIndex(bankPreviewLetterIndex, bankPreviewPresetIndex);
  BankMemoryEntry &entry = bankMemory[previewIdx];
  char label[BANK_MEMORY_NAME_MAX + 8];
  bankMemoryScreenLabel(entry, "BANK", label, sizeof(label));
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
  draw_bank_screen(label, bgColorId, nameColorId, nameBorderColorId, tagColorId,
                   fontSize, fontBold, nameAlign);

  if (bankPreviewBlinkOn) {
    const uint8_t saved = activeBankLetterIndex;
    activeBankLetterIndex = bankPreviewLetterIndex;
    ledStripShowBank(bankPreviewPresetIndex);
    activeBankLetterIndex = saved;
  } else {
    ledStripClear();
  }
}

static inline void swBankPreviewEnter(uint8_t triggerPresetIndex) {
  bankPreviewActive = true;
  bankPreviewLetterIndex = activeBankLetterIndex;
  bankPreviewPresetIndex = triggerPresetIndex;
  bankPreviewBlinkLastMs = millis();
  bankPreviewBlinkOn = true;
  swBankRenderPreview();
  sys_log_i("bank", "Preview ON (BANK %c%u)",
            (char)('A' + bankPreviewLetterIndex),
            (unsigned)(bankPreviewPresetIndex + 1));
}

static inline void swBankPreviewCommit() {
  bankPreviewActive = false;
  activeBankLetterIndex = bankPreviewLetterIndex;
  activePresetIndex = (int8_t)bankPreviewPresetIndex;
  swBankRenderCurrent();
  swBankSendHeaderMidi(bankMemoryCurrent());
  sys_log_i("bank", "Preview OFF (commit BANK %c%u)", swBankLetter(),
            (unsigned)(swBankPresetIndexOrDefault() + 1));
  bankMemoryLogCurrent();
}

// Em preview, um tap em switch i: se for o slot já previewed, avança o bank
// (cor segue o novo bank); caso contrário, move o slot previewed pra i.
static inline void swBankPreviewHandleTap(uint8_t i) {
  if ((uint8_t)i == bankPreviewPresetIndex) {
    bankPreviewLetterIndex = swBankNextEnabledLetter(bankPreviewLetterIndex);
  } else {
    bankPreviewPresetIndex = i;
  }
  bankPreviewBlinkOn = true;
  bankPreviewBlinkLastMs = millis();
  swBankRenderPreview();
}

static inline void swBankPreviewTick() {
  if (!bankPreviewActive) {
    return;
  }
  const uint32_t now = millis();
  if ((uint32_t)(now - bankPreviewBlinkLastMs) >= BANK_PREVIEW_BLINK_PERIOD_MS) {
    bankPreviewBlinkLastMs = now;
    bankPreviewBlinkOn = !bankPreviewBlinkOn;
    swBankRenderPreview();
  }
}

static inline void swBankSelectPreset(uint8_t presetIndex) {
  if (activePresetIndex == (int8_t)presetIndex) {
    activeBankLetterIndex = swBankNextEnabledLetter(activeBankLetterIndex);
  }

  activePresetIndex = (int8_t)presetIndex;
  swBankRenderCurrent();
  swBankSendHeaderMidi(bankMemoryCurrent());
  sys_log_i("bank", "BANK %c%u selecionado via SW%u", swBankLetter(),
            (unsigned)(presetIndex + 1), (unsigned)(presetIndex + 1));
  bankMemoryLogCurrent();
}

// Helper: envia o valor logico de PC seguindo encoding Boss/Strymon-style.
// Pra valores 0..127, manda PC direto. Pra valores >127, divide em
// Bank LSB (CC#32) + PC: bank = value/128, pc = value%128. CC#0 (Bank MSB)
// fica reservado a valores >16383 (raro). Quando o OutputProfile chegar,
// essa logica vira opcional/configuravel por canal.
static inline void swBankSendPcLogical(uint8_t channel, long value) {
  if (value < 0) value = 0;
  if (value > 16383) value = 16383;

  if (value > 127) {
    const uint8_t bankMsb = (uint8_t)((value >> 14) & 0x7F);  // 0..127
    const uint8_t bankLsb = (uint8_t)((value >> 7) & 0x7F);   // 0..127
    const uint8_t pcByte  = (uint8_t)(value & 0x7F);          // 0..127
    if (bankMsb != 0) send_midi_cc(channel, 0, bankMsb);   // CC#0 Bank MSB
    send_midi_cc(channel, 32, bankLsb);                    // CC#32 Bank LSB
    send_midi_pc(channel, pcByte);
  } else {
    send_midi_pc(channel, (uint8_t)value);
  }
}

// Dispara as mensagens MIDI do header do preset (PC principal + 4 PCs extras
// + 2 CCs extras), nessa ordem. Encoding interino: Boss/Strymon-style
// (Bank LSB + PC para valores >127). Quando o OutputProfile chegar,
// essa funcao consultara por canal qual a sequencia real de bytes
// (BANK_FULL, CC_PAIR, sysex, etc.).
static inline void swBankSendHeaderMidi(const BankMemoryEntry &entry) {
  // PC principal
  const long mainCh = bankMemoryGetFieldInt(entry.data, "channel", 1);
  if (mainCh > 0 && mainCh <= 16) {
    const long pc = bankMemoryGetFieldInt(entry.data, "bank", 0);
    swBankSendPcLogical((uint8_t)mainCh, pc);
  }

  // extra_pcs = "ch:pg,ch:pg,ch:pg,ch:pg" (ch == 0 = slot desativado)
  char pcsBuf[64];
  bankMemoryGetField(entry.data, "extra_pcs", pcsBuf, sizeof(pcsBuf), "");
  if (pcsBuf[0]) {
    char *cursor = pcsBuf;
    for (int i = 0; i < 4; i++) {
      char *comma = strchr(cursor, ',');
      if (comma) {
        *comma = '\0';
      }
      char *colon = strchr(cursor, ':');
      if (colon) {
        *colon = '\0';
        const int ch = atoi(cursor);
        const int pg = atoi(colon + 1);
        if (ch > 0 && ch <= 16) {
          swBankSendPcLogical((uint8_t)ch, pg);
        }
      }
      if (!comma) break;
      cursor = comma + 1;
    }
  }

  // extra_ccs = "ch:ctl:val,ch:ctl:val" (ch == 0 = slot desativado)
  char ccsBuf[48];
  bankMemoryGetField(entry.data, "extra_ccs", ccsBuf, sizeof(ccsBuf), "");
  if (ccsBuf[0]) {
    char *cursor = ccsBuf;
    for (int i = 0; i < 2; i++) {
      char *comma = strchr(cursor, ',');
      if (comma) {
        *comma = '\0';
      }
      char *c1 = strchr(cursor, ':');
      if (c1) {
        *c1 = '\0';
        char *c2 = strchr(c1 + 1, ':');
        if (c2) {
          *c2 = '\0';
          const int ch = atoi(cursor);
          const int ctl = atoi(c1 + 1);
          const int val = atoi(c2 + 1);
          if (ch > 0 && ch <= 16) {
            send_midi_cc((uint8_t)ch, (uint8_t)(ctl & 0x7F),
                         (uint8_t)(val & 0x7F));
          }
        }
      }
      if (!comma) break;
      cursor = comma + 1;
    }
  }
}

static inline void swBankSet(uint8_t bankLetterIndex, uint8_t presetIndex) {
  if (bankLetterIndex >= 5) {
    bankLetterIndex = 0;
  }
  if (presetIndex >= 6) {
    presetIndex = 0;
  }

  activeBankLetterIndex = bankLetterIndex;
  activePresetIndex = (int8_t)presetIndex;
  swBankRenderCurrent();
  swBankSendHeaderMidi(bankMemoryCurrent());
  sys_log_i("bank", "BANK %c%u selecionado via web",
            swBankLetter(), (unsigned)(presetIndex + 1));
  bankMemoryLogCurrent();
}

static inline void swBankBegin() {
  const int pins[] = {activePins.BTSW1, activePins.BTSW2, activePins.BTSW3,
                      activePins.BTSW4, activePins.BTSW5, activePins.BTSW6};

  for (uint8_t i = 0; i < 6; i++) {
    bankButtons[i].pin = pins[i];
    bankButtons[i].mode = BUTTON_MOMENTARY;
    bankButtons[i].debounceMs = SWITCH_DEBOUNCE_MS;
    beginButton(bankButtons[i]);
  }
  sys_log_i("bank", "test pins ok");
}

static inline void swBankUpdateButtonStates() {
  for (uint8_t i = 0; i < 6; i++) {
    updateButton(bankButtons[i]);
  }
}

static inline void swWifiComboToggle() {
  if (wifiActive) {
    web_stop();
    wifi_stop();
  } else {
    wifi_start();
    web_start();
  }
  wifiOverlayShow(wifiActive);
}

// Detecta SW2+SW3 simultaneos, latcha ate ambos serem soltos (igual ao combo
// NANO), suprime os eventos individuais para nao trocar preset por engano.
static inline bool swWifiToggleComboUpdate() {
  // SW2 = bankButtons[1], SW3 = bankButtons[2].
  if (bankButtons[1].pin < 0 || bankButtons[2].pin < 0) {
    return false;
  }

  const bool sw2Down = bankButtons[1].physicalState == LOW;
  const bool sw3Down = bankButtons[2].physicalState == LOW;

  if (sw2Down && sw3Down) {
    clearButtonEvents(bankButtons[1]);
    clearButtonEvents(bankButtons[2]);

    if (!swWifiComboLatched) {
      swWifiComboLatched = true;
      swWifiComboIgnoreUntilMs = millis() + 500;
      // Cancela preview pendente — combo tem prioridade.
      if (bankPreviewActive) {
        bankPreviewActive = false;
        swBankRenderCurrent();
      }
      swWifiComboToggle();
      sys_log_i("wifi", "SW2+SW3: %s", wifiActive ? "ON" : "OFF");
    }
    return true;
  }

  if (bankButtons[1].physicalState == HIGH &&
      bankButtons[2].physicalState == HIGH) {
    swWifiComboLatched = false;
  }
  return false;
}

static inline void swNanoLiveComboResetIfReleased() {
  if (bankButtons[0].physicalState == HIGH &&
      bankButtons[1].physicalState == HIGH) {
    swNanoLiveComboLatched = false;
    swNanoComboConsumed = false;
  }
}

static inline bool swNanoLiveComboUpdate() {
  if (!swBankIsNanoBoard()) {
    return false;
  }

  const bool sw1Down = bankButtons[0].physicalState == LOW;
  const bool sw2Down = bankButtons[1].physicalState == LOW;

  if (sw1Down && sw2Down) {
    clearButtonEvents(bankButtons[0]);
    clearButtonEvents(bankButtons[1]);
    swNanoComboConsumed = true;

    if (!swNanoLiveComboLatched) {
      swNanoLiveComboLatched = true;
      swNanoIgnoreSw12UntilMs = millis() + 500;
      // Cancela qualquer preview pendente — combo tem prioridade.
      if (bankPreviewActive) {
        bankPreviewActive = false;
        swBankRenderCurrent();
      }
      swModeToggle();
      sys_log_i("mode", "BFMIDI-3 NANO combo SW1+SW2: %s", swModeName());
    }
    return true;
  }

  swNanoLiveComboResetIfReleased();
  return false;
}

// Tap normal (modo BANK padrão): troca de preset. Usado como ação de
// release-tap em ambos os modos novos, pra deixar long-press distinguível.
static inline void swBankHandleTap(uint8_t i) {
  swBankSelectPreset(i);
}

// HIBRIDO:
//   - Fora de preview: long-press só entra em preview se for no switch
//     do preset atual; outros long-press são ignorados (não viram tap).
//   - Em preview: long-press (em qualquer switch) confirma e sai; taps
//     mudam o slot/bank previewed.
static inline void swBankUpdateButtonHibrido(uint8_t i) {
  Button &btn = bankButtons[i];

  if (wasLongPressed(btn)) {
    if (bankPreviewActive) {
      swBankPreviewCommit();
    } else if ((int8_t)i == activePresetIndex) {
      swBankPreviewEnter(i);
    }
    // Caso contrário: long-press ignorado. Limpa pra release não virar tap.
    clearButtonEvents(btn);
    return;
  }

  wasPressed(btn);
  if (wasReleased(btn) && !btn.longPressFired) {
    if (bankPreviewActive) {
      swBankPreviewHandleTap(i);
    } else {
      swBankHandleTap(i);
    }
  }
}

// SINGLE: tap normal troca preset; long-press do switch do preset atual
// entra em modo LIVE.
static inline void swBankUpdateButtonSingle(uint8_t i) {
  Button &btn = bankButtons[i];

  if (wasLongPressed(btn)) {
    if ((int8_t)i == activePresetIndex) {
      swModeEnterLive();
    }
    clearButtonEvents(btn);
    return;
  }

  wasPressed(btn);
  if (wasReleased(btn) && !btn.longPressFired) {
    swBankHandleTap(i);
  }
}

static inline void swBankUpdate() {
  swBankUpdateButtonStates();

  if (swWifiToggleComboUpdate()) {
    return;
  }
  if (swNanoLiveComboUpdate()) {
    return;
  }

  // Durante a sobreposicao do icone Wi-Fi, congela inputs para nao repintar.
  if (wifiOverlayActive) {
    for (uint8_t i = 0; i < 6; i++) {
      clearButtonEvents(bankButtons[i]);
    }
    return;
  }

  swBankPreviewTick();

  const bool nano = swBankIsNanoBoard();
  const uint8_t mode = globalBankChangeMode == BANK_CHANGE_MODE_SINGLE
                           ? BANK_CHANGE_MODE_SINGLE
                           : BANK_CHANGE_MODE_HIBRIDO;

  for (uint8_t i = 0; i < 6; i++) {
    // SW2/SW3 — janela de ignore apos combo wifi (descarta release/longpress
    // residuais para nao trocar preset por engano).
    if ((i == 1 || i == 2) &&
        (int32_t)(millis() - swWifiComboIgnoreUntilMs) < 0) {
      wasPressed(bankButtons[i]);
      wasLongPressed(bankButtons[i]);
      wasReleased(bankButtons[i]);
      clearButtonEvents(bankButtons[i]);
      continue;
    }

    if (nano && i < 2) {
      // NANO SW1/SW2 — janela de ignore após combo: descarta tudo.
      if ((int32_t)(millis() - swNanoIgnoreSw12UntilMs) < 0) {
        wasPressed(bankButtons[i]);
        wasLongPressed(bankButtons[i]);
        wasReleased(bankButtons[i]);
        clearButtonEvents(bankButtons[i]);
        continue;
      }
      // Se combo acabou de consumir, ignora release/longpress acumulados.
      if (swNanoComboConsumed) {
        wasReleased(bankButtons[i]);
        wasLongPressed(bankButtons[i]);
        wasPressed(bankButtons[i]);
        continue;
      }
      // Caso contrário: SW1/SW2 sozinhos seguem o modo selecionado
      // (long-press funciona normal). Combo SW1+SW2 ainda é tratado em
      // swNanoLiveComboUpdate antes de chegar aqui.
    }

    if (mode == BANK_CHANGE_MODE_SINGLE) {
      swBankUpdateButtonSingle(i);
    } else {
      swBankUpdateButtonHibrido(i);
    }
  }
}

#endif
