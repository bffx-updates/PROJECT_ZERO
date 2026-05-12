#ifndef USB_CONTROL_H
#define USB_CONTROL_H

#include <Arduino.h>

// =============================================================================
// USB_CONTROL.h — canal de controle por USB CDC Serial.
//
// O webApp pode falar com o dispositivo por dois transportes:
//   a) HTTP via WiFi (web server, ja existente).
//   b) USB Serial via Web Serial API (este modulo).
//
// Protocolo de linha simples, espelhando a semantica HTTP:
//   request:  "> METHOD PATH [BODY]"   (terminada com \n)
//   response: "< STATUS JSON-OR-TEXT"  (terminada com \n)
//
// BODY (apenas POST): string url-encoded "key=value&key=value", separada
// do PATH por um espaco. Resposta JSON e em uma unica linha (sem \n
// embedded). Logs do firmware continuam sem prefixo; webApp filtra so
// linhas '<' como respostas.
// =============================================================================

static constexpr size_t USB_CONTROL_LINE_MAX = 2048;
static char usbControlLine[USB_CONTROL_LINE_MAX + 1];
static size_t usbControlLineLen = 0;

// ── Parsing utilitario ──────────────────────────────────────────────────

// URL-decode in place: '+' -> ' ', "%XX" -> byte. Comprime a string.
static inline void usb_url_decode(char *s) {
  if (!s) return;
  char *src = s, *dst = s;
  while (*src) {
    if (*src == '+') {
      *dst++ = ' ';
      src++;
    } else if (*src == '%' && src[1] && src[2]) {
      char hex[3] = {src[1], src[2], '\0'};
      *dst++ = (char)strtol(hex, nullptr, 16);
      src += 3;
    } else {
      *dst++ = *src++;
    }
  }
  *dst = '\0';
}

struct UsbArgs {
  struct Pair {
    const char *key;
    const char *value;
  };
  static constexpr size_t MAX_PAIRS = 32;
  Pair items[MAX_PAIRS];
  size_t count;
};

// Parse "key=value&key=value" into args. Modifica str in-place (insere '\0'
// nos separadores). Aplica URL-decode em chaves e valores.
static inline void usb_args_parse(char *str, UsbArgs &out) {
  out.count = 0;
  if (!str || !*str) return;
  char *p = str;
  while (*p && out.count < UsbArgs::MAX_PAIRS) {
    char *eq = strchr(p, '=');
    if (!eq) break;
    *eq = '\0';
    char *amp = strchr(eq + 1, '&');
    if (amp) *amp = '\0';
    usb_url_decode(p);
    usb_url_decode(eq + 1);
    out.items[out.count].key = p;
    out.items[out.count].value = eq + 1;
    out.count++;
    if (!amp) break;
    p = amp + 1;
  }
}

static inline bool usb_args_has(const UsbArgs &a, const char *key) {
  for (size_t i = 0; i < a.count; i++) {
    if (strcmp(a.items[i].key, key) == 0) return true;
  }
  return false;
}

static inline const char *usb_args_get(const UsbArgs &a, const char *key,
                                       const char *def = "") {
  for (size_t i = 0; i < a.count; i++) {
    if (strcmp(a.items[i].key, key) == 0) return a.items[i].value;
  }
  return def;
}

static inline long usb_args_get_long(const UsbArgs &a, const char *key,
                                     long def = 0) {
  if (!usb_args_has(a, key)) return def;
  return atol(usb_args_get(a, key, ""));
}

// ── Apply meta args (espelha web_bank_apply_meta_args usando UsbArgs) ───
// Mantido aqui em vez de no WEB_API_BANK.h pra nao precisar refatorar o
// HTTP handler. Duplicacao controlada.
static inline bool usb_apply_int_arg(BankMemoryEntry &entry,
                                     const UsbArgs &args, const char *argName,
                                     const char *fieldKey, long lo, long hi) {
  if (!usb_args_has(args, argName)) return false;
  long v = usb_args_get_long(args, argName);
  if (v < lo) v = lo;
  if (v > hi) v = hi;
  return bankMemorySetFieldInt(entry, fieldKey, v);
}

static inline bool usb_apply_meta_args(BankMemoryEntry &entry,
                                       const UsbArgs &args) {
  bool changed = false;

  if (usb_args_has(args, "name")) {
    char buf[BANK_MEMORY_NAME_MAX + 1];
    strncpy(buf, usb_args_get(args, "name"), sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    bankMemorySanitizeValue(buf);
    if (bankMemorySetField(entry, "name", buf)) changed = true;
  }

  if (usb_apply_int_arg(entry, args, "midi_bank", "bank", 0,
                        WEB_BANK_MIDI_BANK_MAX)) changed = true;
  if (usb_apply_int_arg(entry, args, "channel", "channel", 0,
                        WEB_BANK_CHANNEL_MAX)) changed = true;
  if (usb_apply_int_arg(entry, args, "name_color", "name_color", 0,
                        WEB_BANK_COLOR_MAX)) changed = true;
  if (usb_apply_int_arg(entry, args, "name_border_color", "name_border_color",
                        0, WEB_BANK_COLOR_MAX)) changed = true;
  if (usb_apply_int_arg(entry, args, "bg_color", "bg_color", 0,
                        WEB_BANK_COLOR_MAX)) changed = true;
  if (usb_apply_int_arg(entry, args, "back_layers_color", "back_layers_color",
                        0, WEB_BANK_COLOR_MAX)) changed = true;
  if (usb_apply_int_arg(entry, args, "tag_color", "tag_color", 0,
                        WEB_BANK_COLOR_MAX)) changed = true;
  if (usb_apply_int_arg(entry, args, "name_align", "name_align", 0, 8))
    changed = true;

  const bool hasFontBold = usb_args_has(args, "font_bold");
  const bool hasFontSize = usb_args_has(args, "font_size");
  if (hasFontBold || hasFontSize) {
    const bool boldNew =
        hasFontBold ? (usb_args_get_long(args, "font_bold", 0) != 0)
                    : (bankMemoryGetFieldInt(entry.data, "font_bold", 0) != 0);
    long sizeNew = hasFontSize ? usb_args_get_long(args, "font_size", 18)
                               : bankMemoryGetFieldInt(entry.data, "font_size",
                                                        18);
    sizeNew = web_bank_snap_font_size(sizeNew, boldNew);
    if (bankMemorySetFieldInt(entry, "font_bold", boldNew ? 1 : 0))
      changed = true;
    if (bankMemorySetFieldInt(entry, "font_size", sizeNew)) changed = true;
  }

  if (usb_args_has(args, "extra_pcs")) {
    char buf[64];
    strncpy(buf, usb_args_get(args, "extra_pcs"), sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    bankMemorySanitizeValue(buf);
    if (bankMemorySetField(entry, "extra_pcs", buf)) changed = true;
  }
  if (usb_args_has(args, "extra_ccs")) {
    char buf[48];
    strncpy(buf, usb_args_get(args, "extra_ccs"), sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    bankMemorySanitizeValue(buf);
    if (bankMemorySetField(entry, "extra_ccs", buf)) changed = true;
  }

  return changed;
}

// ── Emit response helpers ────────────────────────────────────────────────
static inline void usb_send_response(int status, const char *body) {
  Serial.print("< ");
  Serial.print(status);
  Serial.print(' ');
  if (body) Serial.print(body);
  Serial.print('\n');
}

// ── Handlers ────────────────────────────────────────────────────────────

// Compoe a resposta de GET /bank/current no buffer webJsonBuf (PSRAM).
static inline void usb_handle_bank_current(const UsbArgs &qargs,
                                           bool acceptSwitch) {
  // Se "bank=A1" presente, troca o preset ativo.
  if (acceptSwitch && usb_args_has(qargs, "bank")) {
    String b = usb_args_get(qargs, "bank");
    b.trim();
    b.toUpperCase();
    uint8_t li = 0, pi = 0;
    if (bankMemoryParseTag(b.c_str(), li, pi)) {
      swBankSet(li, pi);
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
  usb_send_response(200, webJsonBuf);
}

// /bank/preset?bank=A2 (GET ou POST). GET retorna meta; POST aplica args.
static inline void usb_handle_bank_preset(const UsbArgs &qargs,
                                          const UsbArgs &bodyArgs,
                                          bool isPost) {
  if (!usb_args_has(qargs, "bank")) {
    usb_send_response(400, "{\"error\":\"missing bank\"}");
    return;
  }
  String bank = usb_args_get(qargs, "bank");
  bank.trim();
  bank.toUpperCase();

  uint8_t letterIndex = 0, presetIndex = 0;
  if (!bankMemoryParseTag(bank.c_str(), letterIndex, presetIndex)) {
    usb_send_response(400, "{\"error\":\"invalid bank\"}");
    return;
  }

  BankMemoryEntry &entry =
      bankMemory[bankMemoryIndex(letterIndex, presetIndex)];
  bool persisted = true;
  bool changed = false;
  if (isPost) {
    changed = usb_apply_meta_args(entry, bodyArgs);
    if (changed) {
      persisted = bankMemorySave();
      sys_log_i("bankmem", "preset %s atualizado (usb): %s", entry.tag,
                entry.data);
      // Se o preset editado e o ativo, re-renderiza pra refletir mudancas.
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
  usb_send_response(200, webJsonBuf);
}

// GET /config/global → reusa o mesmo builder JSON do handler HTTP.
static inline void usb_handle_config_global_get() {
  web_build_global_config_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  usb_send_response(200, webJsonBuf);
}

// POST /config/global ... → aplica args, salva, atualiza runtime.
static inline void usb_handle_config_global_post(const UsbArgs &bodyArgs) {
  bool boardChanged = false;
  for (size_t i = 0; i < bodyArgs.count; i++) {
    web_apply_global_field(bodyArgs.items[i].key, bodyArgs.items[i].value,
                           boardChanged);
  }
  if (!globalConfigSave()) {
    usb_send_response(500, "{\"error\":\"save failed\"}");
    return;
  }
  sys_log_i("usbctrl", "global config salva (usb)");
  usb_send_response(200, "{\"status\":\"OK\"}");
  web_apply_runtime_config(boardChanged);
  if (boardChanged) {
    web_schedule_restart("board_changed");
  }
}

// POST /save → no-op compat (igual ao handler HTTP, que so loga e retorna OK).
static inline void usb_handle_save() {
  sys_log_i("usbctrl", "SAVE solicitado (usb)");
  usb_send_response(200, "{\"status\":\"OK\"}");
}

static inline void usb_handle_wifi_status() {
  web_build_wifi_status_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  usb_send_response(200, webJsonBuf);
}

static inline void usb_handle_wifi_scan() {
  sys_log_i("usbctrl", "Scan WiFi solicitado (usb)");
  web_build_wifi_scan_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  usb_send_response(200, webJsonBuf);
}

static inline void usb_handle_wifi_connect(const UsbArgs &bodyArgs) {
  if (!usb_args_has(bodyArgs, "ssid")) {
    usb_send_response(400, "{\"error\":\"ssid required\"}");
    return;
  }
  String ssid = usb_args_get(bodyArgs, "ssid");
  String password =
      usb_args_has(bodyArgs, "password") ? usb_args_get(bodyArgs, "password") : "";
  ssid.trim();
  if (ssid.length() == 0 || ssid.length() > 32 || password.length() > 64) {
    usb_send_response(400, "{\"error\":\"invalid wifi data\"}");
    return;
  }
  if (!wifi_sta_save(ssid.c_str(), password.c_str())) {
    usb_send_response(500, "{\"error\":\"save failed\"}");
    return;
  }
  wl_status_t status = wifi_sta_connect(12000);
  web_build_wifi_status_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  usb_send_response(200, webJsonBuf);
  sys_log_i("usbctrl", "STA connect finalizado: status=%d", (int)status);
  web_schedule_restart("wifi_sta_config");
}

static inline void usb_handle_wifi_disconnect() {
  wifi_sta_clear();
  LittleFS.remove(WIFI_STA_CONFIG_FILE);
  wifi_mdns_stop();
  WiFi.disconnect(false, true);
  WiFi.mode(WIFI_AP);
  sys_log_i("usbctrl", "STA desconectado via USB");
  web_build_wifi_status_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  usb_send_response(200, webJsonBuf);
}

// ── Dispatcher ──────────────────────────────────────────────────────────
// Linha (sem prefixo "> "): "METHOD PATH" ou "METHOD PATH BODY".
//   METHOD: GET | POST
//   PATH:   /bank/current ou /bank/current?bank=A1
//   BODY:   key=value&key=value (so em POST)
static inline void usb_control_handle_line(char *line) {
  if (!line || line[0] == '\0') return;

  // Comandos simples primeiro.
  if (strcmp(line, "PING") == 0) {
    usb_send_response(200, "PONG");
    return;
  }
  if (strcmp(line, "GET /version") == 0) {
    usb_send_response(200,
                      "{\"firmware\":\"BFMIDI Project Zero\",\"proto\":1}");
    return;
  }

  // Parse METHOD
  char *space1 = strchr(line, ' ');
  if (!space1) {
    usb_send_response(400, "{\"error\":\"bad request\"}");
    return;
  }
  *space1 = '\0';
  const char *method = line;
  char *rest = space1 + 1;

  // Parse PATH e separa body se houver.
  char *space2 = strchr(rest, ' ');
  char *body = nullptr;
  if (space2) {
    *space2 = '\0';
    body = space2 + 1;
  }
  char *path = rest;

  // Separa query string do path.
  char *query = nullptr;
  char *qmark = strchr(path, '?');
  if (qmark) {
    *qmark = '\0';
    query = qmark + 1;
  }

  UsbArgs queryArgs;
  usb_args_parse(query, queryArgs);
  UsbArgs bodyArgs;
  usb_args_parse(body, bodyArgs);

  const bool isGet = strcmp(method, "GET") == 0;
  const bool isPost = strcmp(method, "POST") == 0;

  if ((isGet || isPost) && strcmp(path, "/bank/current") == 0) {
    // POST /bank/current?bank=A1 troca preset; GET ?bank=A1 tambem aceita.
    usb_handle_bank_current(queryArgs, /*acceptSwitch=*/true);
    return;
  }
  if ((isGet || isPost) && strcmp(path, "/bank/preset") == 0) {
    usb_handle_bank_preset(queryArgs, bodyArgs, isPost);
    return;
  }
  if (isGet && strcmp(path, "/config/global") == 0) {
    usb_handle_config_global_get();
    return;
  }
  if (isPost && strcmp(path, "/config/global") == 0) {
    usb_handle_config_global_post(bodyArgs);
    return;
  }
  if (isPost && strcmp(path, "/save") == 0) {
    usb_handle_save();
    return;
  }
  if (isGet && strcmp(path, "/wifi/status") == 0) {
    usb_handle_wifi_status();
    return;
  }
  if (isGet && strcmp(path, "/wifi/scan") == 0) {
    usb_handle_wifi_scan();
    return;
  }
  if (isPost && strcmp(path, "/wifi/connect") == 0) {
    usb_handle_wifi_connect(bodyArgs);
    return;
  }
  if (isPost && strcmp(path, "/wifi/disconnect") == 0) {
    usb_handle_wifi_disconnect();
    return;
  }

  usb_send_response(404, "{\"error\":\"unknown path\"}");
}

// ── Loop integration ────────────────────────────────────────────────────
static inline void usb_control_setup() {
  usbControlLineLen = 0;
  sys_log_i("usbctrl",
            "ready — comandos: > METHOD PATH [BODY]\\n (ex: > PING)");
}

static inline void usb_control_update() {
  while (Serial.available() > 0) {
    const int b = Serial.read();
    if (b < 0) break;
    if (b == '\n' || b == '\r') {
      if (usbControlLineLen > 0) {
        usbControlLine[usbControlLineLen] = '\0';
        char *cmd = usbControlLine;
        if (cmd[0] == '>') {
          cmd++;
          while (*cmd == ' ') cmd++;
        }
        usb_control_handle_line(cmd);
        usbControlLineLen = 0;
      }
      continue;
    }
    if (usbControlLineLen >= USB_CONTROL_LINE_MAX) {
      usbControlLineLen = 0;
      usb_send_response(413, "{\"error\":\"line too long\"}");
      continue;
    }
    usbControlLine[usbControlLineLen++] = (char)b;
  }
}

#endif  // USB_CONTROL_H
