#ifndef WEB_SERVER_H
#define WEB_SERVER_H

#include <Arduino.h>
#include <WebServer.h>

static WebServer webServer(80);
static File webUploadFile;
static char webUploadPath[64] = {0};
static bool webRestartPending = false;
static uint32_t webRestartAtMs = 0;
static bool webServerActive = false;

// Buffer unico para respostas JSON dos handlers HTTP. Alocado em PSRAM no
// web_setup_once() para aliviar a stack da task do WebServer (cada handler
// usava ~1,5 KB local). Como o WebServer e single-thread (handleClient() no
// loop()), nao ha reentrada — todos os endpoints podem compartilhar o mesmo
// buffer.
static constexpr size_t WEB_JSON_BUF_SIZE = 4096;
static char *webJsonBuf = nullptr;

static const char WEB_CONTENT_TYPE_TEXT[] PROGMEM = "text/plain; charset=utf-8";

static inline void web_schedule_restart(const char *reason,
                                        uint32_t delayMs = 1200) {
  webRestartPending = true;
  webRestartAtMs = millis() + delayMs;
  sys_log_i("web", "Restart agendado em %u ms: %s", (unsigned)delayMs,
            reason ? reason : "-");
}

static inline void web_send_cors_headers() {
  webServer.sendHeader("Access-Control-Allow-Origin", "*");
  webServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  webServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

static inline void web_handle_options() {
  web_send_cors_headers();
  webServer.send(204, "text/plain", "");
}

static inline void web_json_escape(char *target, size_t targetSize,
                                   const char *source) {
  if (!target || targetSize == 0) {
    return;
  }

  size_t out = 0;
  target[0] = '\0';
  if (!source) {
    return;
  }

  for (size_t i = 0; source[i] != '\0' && out + 2 < targetSize; i++) {
    if (source[i] == '"' || source[i] == '\\') {
      if (out + 2 >= targetSize) {
        break;
      }
      target[out++] = '\\';
    }
    target[out++] = source[i];
    target[out] = '\0';
  }
}

static inline bool web_serve_file(const char *path, const char *contentType) {
  File file = LittleFS.open(path, "r");
  if (!file) {
    sys_log_i("web", "Arquivo nao encontrado: %s", path);
    webServer.send_P(404, WEB_CONTENT_TYPE_TEXT, PSTR("Arquivo nao encontrado"));
    return false;
  }

  webServer.streamFile(file, contentType);
  file.close();
  return true;
}

static inline void web_send_index() {
  web_serve_file("/index.html", "text/html; charset=utf-8");
}

static inline void web_send_bank() {
  web_serve_file("/bank.html", "text/html; charset=utf-8");
}

static inline void web_send_global() {
  web_serve_file("/global.html", "text/html; charset=utf-8");
}

static inline void web_send_system() {
  web_serve_file("/system.html", "text/html; charset=utf-8");
}

static inline void web_send_css() {
  web_serve_file("/app.css", "text/css; charset=utf-8");
}

static inline void web_send_js() {
  web_serve_file("/app.js", "application/javascript; charset=utf-8");
}

static inline void web_send_upload() {
  web_serve_file("/upload.html", "text/html; charset=utf-8");
}

static inline void web_handle_save() {
  sys_log_i("web", "SAVE solicitado");
  web_send_cors_headers();
  webServer.send_P(200, WEB_CONTENT_TYPE_TEXT, PSTR("OK"));
}

#include "WEB_API_WIFI.h"
#include "WEB_API_BANK.h"
#include "WEB_API_CONFIG.h"
#include "WEB_UPLOAD.h"

static inline void web_register_static_routes() {
  webServer.on("/", HTTP_GET, web_send_index);
  webServer.on("/index.html", HTTP_GET, web_send_index);
  webServer.on("/bank", HTTP_GET, web_send_bank);
  webServer.on("/bank.html", HTTP_GET, web_send_bank);
  webServer.on("/global", HTTP_GET, web_send_global);
  webServer.on("/global.html", HTTP_GET, web_send_global);
  webServer.on("/system", HTTP_GET, web_send_system);
  webServer.on("/system.html", HTTP_GET, web_send_system);
  webServer.on("/app.css", HTTP_GET, web_send_css);
  webServer.on("/app.js", HTTP_GET, web_send_js);
  webServer.on("/save", HTTP_POST, web_handle_save);
  webServer.onNotFound(web_send_index);
}

static inline void web_alloc_json_buf() {
  if (webJsonBuf) {
    return;
  }

#if defined(ESP32)
  webJsonBuf = (char *)heap_caps_malloc(WEB_JSON_BUF_SIZE,
                                        MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (webJsonBuf) {
    sys_log_i("web", "JSON buffer %u bytes em PSRAM",
              (unsigned)WEB_JSON_BUF_SIZE);
    return;
  }
#endif

  webJsonBuf = (char *)malloc(WEB_JSON_BUF_SIZE);
  sys_log_i("web", "JSON buffer %u bytes em heap interno (PSRAM indisponivel)",
            (unsigned)WEB_JSON_BUF_SIZE);
}

// Boot: aloca o buffer JSON em PSRAM e registra todas as rotas. O socket
// HTTP em si só sobe em web_start() (chamado pelo combo SW2+SW3 junto com
// o WiFi).
static inline void web_setup_once() {
  web_alloc_json_buf();
  web_register_static_routes();
  web_register_upload_routes();
  web_register_config_routes();
  web_register_bank_routes();
  web_register_wifi_routes();
}

static inline void web_start() {
  if (webServerActive) {
    return;
  }
  webServer.begin();
  webServerActive = true;
  sys_log_i("web", "HTTP em http://%s/",
            WiFi.softAPIP().toString().c_str());
}

static inline void web_stop() {
  if (!webServerActive) {
    return;
  }
  webServer.close();
  webServerActive = false;
  sys_log_i("web", "HTTP off");
}

static inline void web_update() {
  if (webServerActive) {
    webServer.handleClient();
  }

  if (webRestartPending && (int32_t)(millis() - webRestartAtMs) >= 0) {
    sys_log_i("web", "Reiniciando ESP32-S2 agora");
    delay(50);
    ESP.restart();
  }
}

#endif // WEB_SERVER_H
