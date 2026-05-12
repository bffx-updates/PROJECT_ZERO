#ifndef WEB_API_CONFIG_H
#define WEB_API_CONFIG_H

#include <Arduino.h>

// Builder reutilizavel: gera a resposta JSON de /config/global no buffer
// fornecido. Usada tanto pelo handler HTTP (web_send_global_config) quanto
// pelo handler USB (USB_CONTROL.h) — mesma estrutura, mesma fonte de dados.
static inline void web_build_global_config_json(char *json, size_t jsonSize) {
  int offset = snprintf(
      json, jsonSize,
      "{\"version\":1,\"board\":\"%s\",\"led_brightness\":%u,"
      "\"bank_led_color\":%u,\"live_led_color\":%u,"
      "\"led_color_mode\":%u,"
      "\"auto_start_enabled\":%u,\"auto_start_bank\":%u,"
      "\"auto_start_preset\":%u,\"auto_start_mode\":%u,"
      "\"bank_change_mode\":%u,"
      "\"boards\":[",
      globalBoardName, (unsigned)globalLedBrightness,
      (unsigned)globalBankLedColorIndex, (unsigned)globalLiveLedColorIndex,
      (unsigned)globalLedColorMode,
      (unsigned)globalAutoStartEnabled, (unsigned)globalAutoStartBank,
      (unsigned)globalAutoStartPreset, (unsigned)globalAutoStartMode,
      (unsigned)globalBankChangeMode);

  for (uint8_t i = 0; i < AVAILABLE_BOARD_COUNT && offset > 0 &&
                      offset < (int)jsonSize;
       i++) {
    offset += snprintf(json + offset, jsonSize - offset, "%s\"%s\"",
                       i == 0 ? "" : ",", AVAILABLE_BOARDS[i]);
  }

  if (offset > 0 && offset < (int)jsonSize) {
    offset += snprintf(json + offset, jsonSize - offset, "],\"colors\":[");
  }

  for (uint8_t i = 0; i < LED_COLOR_COUNT && offset > 0 &&
                      offset < (int)jsonSize;
       i++) {
    offset += snprintf(json + offset, jsonSize - offset,
                       "%s[%u,%u,%u]", i == 0 ? "" : ",",
                       (unsigned)globalLedColors[i].r,
                       (unsigned)globalLedColors[i].g,
                       (unsigned)globalLedColors[i].b);
  }

  if (offset > 0 && offset < (int)jsonSize) {
    offset += snprintf(json + offset, jsonSize - offset,
                       "],\"bank_letter_enabled\":[");
  }

  for (uint8_t i = 0; i < BANK_LETTER_COUNT && offset > 0 &&
                      offset < (int)jsonSize;
       i++) {
    offset += snprintf(json + offset, jsonSize - offset, "%s%u",
                       i == 0 ? "" : ",",
                       (unsigned)globalBankLetterEnabled[i]);
  }

  if (offset > 0 && offset < (int)jsonSize) {
    offset += snprintf(json + offset, jsonSize - offset,
                       "],\"letter_led_colors\":[");
  }

  for (uint8_t i = 0; i < BANK_LETTER_COUNT && offset > 0 &&
                      offset < (int)jsonSize;
       i++) {
    offset += snprintf(json + offset, jsonSize - offset, "%s%u",
                       i == 0 ? "" : ",",
                       (unsigned)globalLetterLedColorIndex[i]);
  }

  if (offset > 0 && offset < (int)jsonSize) {
    offset += snprintf(json + offset, jsonSize - offset,
                       "],\"switch_led_colors\":[");
  }

  for (uint8_t i = 0; i < BANK_SWITCH_COUNT && offset > 0 &&
                      offset < (int)jsonSize;
       i++) {
    offset += snprintf(json + offset, jsonSize - offset, "%s%u",
                       i == 0 ? "" : ",",
                       (unsigned)globalSwitchLedColorIndex[i]);
  }

  if (offset > 0 && offset < (int)jsonSize) {
    snprintf(json + offset, jsonSize - offset, "]}");
  }
}

static inline void web_send_global_config() {
  web_send_cors_headers();
  web_build_global_config_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  webServer.send(200, "application/json; charset=utf-8", webJsonBuf);
}

// Aplica um par (key, value) na config global. Usado por iteracao tanto
// pelo handler HTTP quanto pelo USB. Atualiza boardChanged out-param.
// Retorna true se a chave foi reconhecida.
static inline bool web_apply_global_field(const char *key, const char *value,
                                          bool &boardChanged) {
  if (strcmp(key, "board") == 0) {
    boardChanged = strcmp(globalBoardName, value) != 0;
    strncpy(globalBoardName, value, sizeof(globalBoardName) - 1);
    globalBoardName[sizeof(globalBoardName) - 1] = '\0';
    return true;
  }
  if (strcmp(key, "led_brightness") == 0) {
    globalLedBrightness = globalConfigClampByte(atoi(value));
    return true;
  }
  if (strcmp(key, "bank_led_color") == 0) {
    globalBankLedColorIndex = globalConfigClampColorIndex(atoi(value));
    return true;
  }
  if (strcmp(key, "live_led_color") == 0) {
    globalLiveLedColorIndex = globalConfigClampColorIndex(atoi(value));
    return true;
  }
  if (strcmp(key, "led_color_mode") == 0) {
    globalLedColorMode = atoi(value) == LED_COLOR_MODE_SWITCHES
                             ? LED_COLOR_MODE_SWITCHES
                             : LED_COLOR_MODE_LETTERS;
    return true;
  }
  if (strcmp(key, "auto_start_enabled") == 0) {
    globalAutoStartEnabled = atoi(value) ? 1 : 0;
    return true;
  }
  if (strcmp(key, "auto_start_bank") == 0) {
    int b = atoi(value);
    if (b < 0) b = 0;
    if (b >= BANK_LETTER_COUNT) b = BANK_LETTER_COUNT - 1;
    globalAutoStartBank = (uint8_t)b;
    return true;
  }
  if (strcmp(key, "auto_start_preset") == 0) {
    int p = atoi(value);
    if (p < 1) p = 1;
    if (p > BANK_SWITCH_COUNT) p = BANK_SWITCH_COUNT;
    globalAutoStartPreset = (uint8_t)p;
    return true;
  }
  if (strcmp(key, "auto_start_mode") == 0) {
    globalAutoStartMode = atoi(value) == AUTO_START_MODE_LIVE
                              ? AUTO_START_MODE_LIVE
                              : AUTO_START_MODE_BANK;
    return true;
  }
  if (strcmp(key, "bank_change_mode") == 0) {
    globalBankChangeMode = atoi(value) == BANK_CHANGE_MODE_SINGLE
                               ? BANK_CHANGE_MODE_SINGLE
                               : BANK_CHANGE_MODE_HIBRIDO;
    return true;
  }
  if (strncmp(key, "bank_letter_enabled_", 20) == 0) {
    int i = atoi(key + 20);
    if (i >= 0 && i < BANK_LETTER_COUNT) {
      globalBankLetterEnabled[i] = atoi(value) ? 1 : 0;
      return true;
    }
  }
  if (strncmp(key, "letter_led_", 11) == 0) {
    int i = atoi(key + 11);
    if (i >= 0 && i < BANK_LETTER_COUNT) {
      globalLetterLedColorIndex[i] = globalConfigClampColorIndex(atoi(value));
      return true;
    }
  }
  if (strncmp(key, "switch_led_", 11) == 0) {
    int i = atoi(key + 11);
    if (i >= 0 && i < BANK_SWITCH_COUNT) {
      globalSwitchLedColorIndex[i] = globalConfigClampColorIndex(atoi(value));
      return true;
    }
  }
  if (strncmp(key, "color_", 6) == 0) {
    int i = atoi(key + 6);
    if (i >= 0 && i < LED_COLOR_COUNT) {
      globalConfigParseColor(value, globalLedColors[i]);
      return true;
    }
  }
  return false;
}

static inline void web_apply_runtime_config(bool boardChanged) {
  sys_log_i("web", "Aplicando config runtime: brightness=%u bank_color=%u live_color=%u",
            (unsigned)globalLedBrightness, (unsigned)globalBankLedColorIndex,
            (unsigned)globalLiveLedColorIndex);

  leds.setBrightness(globalLedBrightness);

  if (currentSwitchMode == SWITCH_MODE_LIVE) {
    swLiveRenderCurrent();
  } else {
    swBankRenderCurrent();
  }

  if (boardChanged) {
    sys_log_i("web", "Board alterada para '%s'; pinagem sera aplicada no proximo boot",
              globalBoardName);
  }
}

static inline void web_handle_global_config_save() {
  bool boardChanged = false;

  // Itera todos os args do request e aplica via helper compartilhado.
  for (int i = 0; i < webServer.args(); i++) {
    web_apply_global_field(webServer.argName(i).c_str(),
                           webServer.arg(i).c_str(), boardChanged);
  }

  if (!globalConfigSave()) {
    sys_log_i("web", "Falha ao salvar %s", GLOBAL_CONFIG_FILE);
    web_send_cors_headers();
    webServer.send_P(500, WEB_CONTENT_TYPE_TEXT, PSTR("SAVE ERROR"));
    return;
  }

  // Resposta primeiro — o handler precisa retornar rapido para nao estourar
  // o timeout do cliente (especialmente com WiFi STA fraco). O render do
  // display + LEDs vem depois, mas dentro do mesmo handleClient() porque o
  // WebServer so flusha o TCP quando o handler retorna; ainda assim, manter
  // esta ordem evita travar os bytes de "OK" atras do redraw.
  sys_log_i("web", "Global config salva em %s", GLOBAL_CONFIG_FILE);
  web_send_cors_headers();
  webServer.send_P(200, WEB_CONTENT_TYPE_TEXT, PSTR("OK"));
  web_apply_runtime_config(boardChanged);

  if (boardChanged) {
    web_schedule_restart("board_changed");
  }
}

static inline void web_register_config_routes() {
  webServer.on("/config/global", HTTP_GET, web_send_global_config);
  webServer.on("/config/global", HTTP_POST, web_handle_global_config_save);
  webServer.on("/config/global", HTTP_OPTIONS, web_handle_options);
}

#endif // WEB_API_CONFIG_H
