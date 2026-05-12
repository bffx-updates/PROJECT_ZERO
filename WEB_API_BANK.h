#ifndef WEB_API_BANK_H
#define WEB_API_BANK_H

#include <Arduino.h>

// ── Helpers de meta v2 ────────────────────────────────────────────────
// Limites espelham o webApp (ver design.md): name <=16 chars, bank 0..16383,
// channel 0..16 (0 = MUTE), cores 0..4 (paleta BG_COLORS).
static constexpr long WEB_BANK_MIDI_BANK_MAX = 16383;
static constexpr long WEB_BANK_CHANNEL_MAX = 16;
// IDs validos sao indices em DISPLAY_PALETTE (ver DISPLAY_COLORS.h).
static constexpr long WEB_BANK_COLOR_MAX =
    (long)DISPLAY_PALETTE_COUNT - 1;

// Tamanhos suportados pelas fontes FreeSans/FreeSansBold disponiveis:
// regular tem 12/18/24; bold adiciona 9pt. Snap pro valor valido mais
// proximo, respeitando a flag bold (regular@9pt nao existe -> sobe pra 12).
static inline long web_bank_snap_font_size(long size, bool bold) {
  static const long sizesBold[] = {9, 12, 18, 24};
  static const long sizesRegular[] = {12, 18, 24};
  const long *list = bold ? sizesBold : sizesRegular;
  const size_t count = bold ? 4 : 3;
  long best = list[0];
  long bestDelta = labs(size - best);
  for (size_t i = 1; i < count; i++) {
    long delta = labs(size - list[i]);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = list[i];
    }
  }
  return best;
}

static inline long web_bank_clamp_long(long value, long lo, long hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

static inline bool web_bank_apply_int_arg(BankMemoryEntry &entry,
                                          const char *argName,
                                          const char *fieldKey, long lo,
                                          long hi) {
  if (!webServer.hasArg(argName)) {
    return false;
  }
  long v = webServer.arg(argName).toInt();
  v = web_bank_clamp_long(v, lo, hi);
  return bankMemorySetFieldInt(entry, fieldKey, v);
}

// Aplica os campos enviados via args (POST form ou query string) a um slot.
// Retorna true se algum campo foi alterado.
static inline bool web_bank_apply_meta_args(BankMemoryEntry &entry) {
  bool changed = false;

  if (webServer.hasArg("name")) {
    String name = webServer.arg("name");
    if (name.length() > (int)BANK_MEMORY_NAME_MAX) {
      name = name.substring(0, BANK_MEMORY_NAME_MAX);
    }
    char buf[BANK_MEMORY_NAME_MAX + 1];
    strncpy(buf, name.c_str(), sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    bankMemorySanitizeValue(buf);
    if (bankMemorySetField(entry, "name", buf)) {
      changed = true;
    }
  }

  if (web_bank_apply_int_arg(entry, "midi_bank", "bank", 0,
                             WEB_BANK_MIDI_BANK_MAX)) {
    changed = true;
  }
  if (web_bank_apply_int_arg(entry, "channel", "channel", 0,
                             WEB_BANK_CHANNEL_MAX)) {
    changed = true;
  }
  if (web_bank_apply_int_arg(entry, "name_color", "name_color", 0,
                             WEB_BANK_COLOR_MAX)) {
    changed = true;
  }
  if (web_bank_apply_int_arg(entry, "name_border_color", "name_border_color", 0,
                             WEB_BANK_COLOR_MAX)) {
    changed = true;
  }
  if (web_bank_apply_int_arg(entry, "bg_color", "bg_color", 0,
                             WEB_BANK_COLOR_MAX)) {
    changed = true;
  }
  if (web_bank_apply_int_arg(entry, "back_layers_color", "back_layers_color", 0,
                             WEB_BANK_COLOR_MAX)) {
    changed = true;
  }
  if (web_bank_apply_int_arg(entry, "tag_color", "tag_color", 0,
                             WEB_BANK_COLOR_MAX)) {
    changed = true;
  }

  // name_align: 0..8 (3x3 grid; col = id%3, row = id/3).
  if (web_bank_apply_int_arg(entry, "name_align", "name_align", 0, 8)) {
    changed = true;
  }

  // extra_pcs e extra_ccs: strings compactas, parsing/validacao do webApp.
  // Apenas sanitiza (sem '=' nem '|') e limita o tamanho.
  // NOTA: valores aqui sao LOGICOS (ver BANK_MEMORY.h). A traducao para
  // bytes MIDI reais (RAW PC, Bank MSB+LSB+PC, par de CCs, etc.) acontece
  // no modulo de envio MIDI usando OutputProfile.channels[ch], nao aqui.
  if (webServer.hasArg("extra_pcs")) {
    String v = webServer.arg("extra_pcs");
    if (v.length() > 48) v = v.substring(0, 48);
    char buf[64];
    strncpy(buf, v.c_str(), sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    bankMemorySanitizeValue(buf);
    if (bankMemorySetField(entry, "extra_pcs", buf)) changed = true;
  }
  if (webServer.hasArg("extra_ccs")) {
    String v = webServer.arg("extra_ccs");
    if (v.length() > 32) v = v.substring(0, 32);
    char buf[48];
    strncpy(buf, v.c_str(), sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    bankMemorySanitizeValue(buf);
    if (bankMemorySetField(entry, "extra_ccs", buf)) changed = true;
  }

  // font_size + font_bold: aplicar com snap pro combo valido. Le o bold
  // novo (se enviado) ou o atual salvo, e usa pra snap-tar o size.
  const bool hasFontBold = webServer.hasArg("font_bold");
  const bool hasFontSize = webServer.hasArg("font_size");
  if (hasFontBold || hasFontSize) {
    const bool boldNew = hasFontBold
        ? (webServer.arg("font_bold").toInt() != 0)
        : (bankMemoryGetFieldInt(entry.data, "font_bold", 0) != 0);
    long sizeNew = hasFontSize
        ? webServer.arg("font_size").toInt()
        : bankMemoryGetFieldInt(entry.data, "font_size", 18);
    sizeNew = web_bank_snap_font_size(sizeNew, boldNew);

    if (bankMemorySetFieldInt(entry, "font_bold", boldNew ? 1 : 0)) {
      changed = true;
    }
    if (bankMemorySetFieldInt(entry, "font_size", sizeNew)) {
      changed = true;
    }
  }

  return changed;
}

// Serializa o objeto meta de um slot em JSON. Retorna o numero de bytes
// escritos (excluindo o '\0'); 0 em caso de erro.
static inline size_t web_bank_meta_json(const BankMemoryEntry &entry,
                                        char *out, size_t outSize) {
  if (!out || outSize == 0) {
    return 0;
  }

  char nameRaw[BANK_MEMORY_NAME_MAX + 1];
  bankMemoryGetField(entry.data, "name", nameRaw, sizeof(nameRaw), "");

  char nameDisplay[BANK_MEMORY_NAME_MAX + 1];
  bankMemoryDisplayName(entry, nameDisplay, sizeof(nameDisplay));

  char nameRawEsc[BANK_MEMORY_NAME_MAX * 2 + 4];
  web_json_escape(nameRawEsc, sizeof(nameRawEsc), nameRaw);

  char nameEsc[BANK_MEMORY_NAME_MAX * 2 + 4];
  web_json_escape(nameEsc, sizeof(nameEsc), nameDisplay);

  const long midiBank =
      web_bank_clamp_long(bankMemoryGetFieldInt(entry.data, "bank", 0), 0,
                          WEB_BANK_MIDI_BANK_MAX);
  const long channel = web_bank_clamp_long(
      bankMemoryGetFieldInt(entry.data, "channel", 1), 0, WEB_BANK_CHANNEL_MAX);
  const long nameColor =
      web_bank_clamp_long(bankMemoryGetFieldInt(entry.data, "name_color", 1), 0,
                          WEB_BANK_COLOR_MAX);
  const long nameBorderColor = web_bank_clamp_long(
      bankMemoryGetFieldInt(entry.data, "name_border_color", 0), 0,
      WEB_BANK_COLOR_MAX);
  const long bgColor =
      web_bank_clamp_long(bankMemoryGetFieldInt(entry.data, "bg_color", 0), 0,
                          WEB_BANK_COLOR_MAX);
  const long backLayersColor = web_bank_clamp_long(
      bankMemoryGetFieldInt(entry.data, "back_layers_color", 0), 0,
      WEB_BANK_COLOR_MAX);
  const long tagColor =
      web_bank_clamp_long(bankMemoryGetFieldInt(entry.data, "tag_color", 2), 0,
                          WEB_BANK_COLOR_MAX);
  const long enabled = bankMemoryGetFieldInt(entry.data, "enabled", 1) != 0;
  const bool fontBold =
      bankMemoryGetFieldInt(entry.data, "font_bold", 0) != 0;
  const long fontSize = web_bank_snap_font_size(
      bankMemoryGetFieldInt(entry.data, "font_size", 18), fontBold);
  const long nameAlign = web_bank_clamp_long(
      bankMemoryGetFieldInt(entry.data, "name_align", 4), 0, 8);

  char extraPcs[64];
  bankMemoryGetField(entry.data, "extra_pcs", extraPcs, sizeof(extraPcs),
                     "0:0,0:0,0:0,0:0");
  char extraCcs[48];
  bankMemoryGetField(entry.data, "extra_ccs", extraCcs, sizeof(extraCcs),
                     "0:0:0,0:0:0");
  char extraPcsEsc[128];
  web_json_escape(extraPcsEsc, sizeof(extraPcsEsc), extraPcs);
  char extraCcsEsc[96];
  web_json_escape(extraCcsEsc, sizeof(extraCcsEsc), extraCcs);

  const int written = snprintf(
      out, outSize,
      "{\"name\":\"%s\",\"name_raw\":\"%s\",\"midi_bank\":%ld,"
      "\"channel\":%ld,\"name_color\":%ld,\"name_border_color\":%ld,"
      "\"bg_color\":%ld,"
      "\"back_layers_color\":%ld,\"tag_color\":%ld,\"enabled\":%ld,"
      "\"font_size\":%ld,\"font_bold\":%d,\"name_align\":%ld,"
      "\"extra_pcs\":\"%s\",\"extra_ccs\":\"%s\"}",
      nameEsc, nameRawEsc, midiBank, channel, nameColor, nameBorderColor,
      bgColor, backLayersColor, tagColor, enabled, fontSize, fontBold ? 1 : 0,
      nameAlign, extraPcsEsc, extraCcsEsc);
  if (written < 0 || (size_t)written >= outSize) {
    return 0;
  }
  return (size_t)written;
}

// ── Handlers ──────────────────────────────────────────────────────────
static inline void web_send_bank_current() {
  web_send_cors_headers();

  if (webServer.hasArg("bank")) {
    String bank = webServer.arg("bank");
    bank.trim();
    bank.toUpperCase();

    uint8_t bankLetterIndex = 0;
    uint8_t presetIndex = 0;
    if (bankMemoryParseTag(bank.c_str(), bankLetterIndex, presetIndex)) {
      swBankSet(bankLetterIndex, presetIndex);
    }
  } else if (webServer.hasArg("bank_letter") &&
             webServer.hasArg("preset_number")) {
    int bankLetterIndex = webServer.arg("bank_letter").toInt();
    int presetNumber = webServer.arg("preset_number").toInt();
    if (bankLetterIndex >= 0 && presetNumber >= 1) {
      swBankSet((uint8_t)bankLetterIndex, (uint8_t)(presetNumber - 1));
    }
  }

  BankMemoryEntry &entry = bankMemoryCurrent();
  char dataEscaped[BANK_MEMORY_DATA_SIZE * 2];
  web_json_escape(dataEscaped, sizeof(dataEscaped), entry.data);

  char metaJson[384];
  web_bank_meta_json(entry, metaJson, sizeof(metaJson));

  snprintf(webJsonBuf, WEB_JSON_BUF_SIZE,
           "{\"bank\":\"%s\",\"bank_letter\":\"%c\","
           "\"bank_letter_index\":%u,\"preset_number\":%u,"
           "\"switch_index\":%u,\"data\":\"%s\",\"meta\":%s}",
           entry.tag, swBankLetter(), (unsigned)activeBankLetterIndex,
           (unsigned)(swBankPresetIndexOrDefault() + 1),
           (unsigned)swBankPresetIndexOrDefault(), dataEscaped, metaJson);
  webServer.send(200, "application/json; charset=utf-8", webJsonBuf);
}

// /bank/preset?bank=A2 (GET ou POST). GET retorna a meta do slot; POST aplica
// os args presentes (name, midi_bank, channel, name_color, bg_color,
// back_layers_color, tag_color), persiste no LittleFS e devolve a meta
// atualizada. Nao altera o preset ativo — para isso use /bank/current.
static inline void web_send_bank_preset() {
  web_send_cors_headers();

  if (!webServer.hasArg("bank")) {
    webServer.send(400, "application/json; charset=utf-8",
                   "{\"error\":\"missing bank\"}");
    return;
  }

  String bank = webServer.arg("bank");
  bank.trim();
  bank.toUpperCase();

  uint8_t letterIndex = 0;
  uint8_t presetIndex = 0;
  if (!bankMemoryParseTag(bank.c_str(), letterIndex, presetIndex)) {
    webServer.send(400, "application/json; charset=utf-8",
                   "{\"error\":\"invalid bank\"}");
    return;
  }

  BankMemoryEntry &entry =
      bankMemory[bankMemoryIndex(letterIndex, presetIndex)];

  bool persisted = true;
  bool changed = false;
  if (webServer.method() == HTTP_POST) {
    changed = web_bank_apply_meta_args(entry);
    if (changed) {
      persisted = bankMemorySave();
      sys_log_i("bankmem", "preset %s atualizado: %s", entry.tag, entry.data);

      // Se o preset editado e o ativo, re-renderiza pra refletir nome/cores/fonte.
      if (letterIndex == activeBankLetterIndex &&
          (int8_t)presetIndex == activePresetIndex) {
        if (currentSwitchMode == SWITCH_MODE_LIVE) {
          swLiveRenderCurrent();
        } else {
          swBankRenderCurrent();
        }
      }
    }
  }

  char dataEscaped[BANK_MEMORY_DATA_SIZE * 2];
  web_json_escape(dataEscaped, sizeof(dataEscaped), entry.data);

  char metaJson[384];
  web_bank_meta_json(entry, metaJson, sizeof(metaJson));

  snprintf(webJsonBuf, WEB_JSON_BUF_SIZE,
           "{\"bank\":\"%s\",\"bank_letter\":\"%c\","
           "\"bank_letter_index\":%u,\"preset_number\":%u,"
           "\"data\":\"%s\",\"meta\":%s,\"changed\":%s,\"persisted\":%s}",
           entry.tag, entry.tag[0], (unsigned)letterIndex,
           (unsigned)(presetIndex + 1), dataEscaped, metaJson,
           changed ? "true" : "false", persisted ? "true" : "false");
  webServer.send(200, "application/json; charset=utf-8", webJsonBuf);
}

static inline void web_register_bank_routes() {
  webServer.on("/bank/current", HTTP_GET, web_send_bank_current);
  webServer.on("/bank/current", HTTP_POST, web_send_bank_current);
  webServer.on("/bank/current", HTTP_OPTIONS, web_handle_options);

  webServer.on("/bank/preset", HTTP_GET, web_send_bank_preset);
  webServer.on("/bank/preset", HTTP_POST, web_send_bank_preset);
  webServer.on("/bank/preset", HTTP_OPTIONS, web_handle_options);
}

#endif // WEB_API_BANK_H
