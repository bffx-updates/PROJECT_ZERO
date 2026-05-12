#ifndef WEB_API_WIFI_H
#define WEB_API_WIFI_H

#include <Arduino.h>

// Builders reutilizaveis pelos transportes HTTP e USB.
static inline void web_build_wifi_status_json(char *out, size_t outSize) {
  char ssidEscaped[72];
  const char *statusSsid =
      wifiStaSsid[0] != '\0' ? wifiStaSsid : WiFi.SSID().c_str();
  web_json_escape(ssidEscaped, sizeof(ssidEscaped), statusSsid);

  snprintf(out, outSize,
           "{\"ap_ssid\":\"%s\",\"ap_ip\":\"%s\",\"sta_connected\":%s,"
           "\"sta_ssid\":\"%s\",\"sta_ip\":\"%s\",\"rssi\":%d,"
           "\"status_code\":%d,\"saved\":%s}",
           WIFI_AP_SSID, WiFi.softAPIP().toString().c_str(),
           WiFi.status() == WL_CONNECTED ? "true" : "false", ssidEscaped,
           WiFi.localIP().toString().c_str(), WiFi.RSSI(),
           (int)WiFi.status(), wifiStaSsid[0] != '\0' ? "true" : "false");
}

static inline void web_build_wifi_scan_json(char *out, size_t outSize) {
  int networkCount = WiFi.scanNetworks(false, true);
  if (networkCount < 0) networkCount = 0;
  if (networkCount > 20) networkCount = 20;

  int offset = snprintf(out, outSize, "{\"networks\":[");
  for (int i = 0; i < networkCount && offset > 0 && offset < (int)outSize;
       i++) {
    char ssidEscaped[72];
    web_json_escape(ssidEscaped, sizeof(ssidEscaped), WiFi.SSID(i).c_str());
    offset += snprintf(out + offset, outSize - offset,
                       "%s{\"ssid\":\"%s\",\"rssi\":%d,\"secure\":%s}",
                       i == 0 ? "" : ",", ssidEscaped, WiFi.RSSI(i),
                       WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "false"
                                                                : "true");
  }
  if (offset > 0 && offset < (int)outSize) {
    snprintf(out + offset, outSize - offset, "]}");
  }
  WiFi.scanDelete();
}

static inline void web_send_wifi_status() {
  web_send_cors_headers();
  web_build_wifi_status_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  webServer.send(200, "application/json; charset=utf-8", webJsonBuf);
}

static inline void web_send_wifi_scan() {
  web_send_cors_headers();
  sys_log_i("wifi", "Scan solicitado pelo webApp");
  web_build_wifi_scan_json(webJsonBuf, WEB_JSON_BUF_SIZE);
  webServer.send(200, "application/json; charset=utf-8", webJsonBuf);
}

static inline void web_handle_wifi_connect() {
  web_send_cors_headers();

  if (!webServer.hasArg("ssid")) {
    webServer.send_P(400, WEB_CONTENT_TYPE_TEXT, PSTR("SSID REQUIRED"));
    return;
  }

  String ssid = webServer.arg("ssid");
  String password = webServer.hasArg("password") ? webServer.arg("password")
                                                 : String("");
  ssid.trim();

  if (ssid.length() == 0 || ssid.length() > 32 || password.length() > 64) {
    webServer.send_P(400, WEB_CONTENT_TYPE_TEXT, PSTR("INVALID WIFI DATA"));
    return;
  }

  if (!wifi_sta_save(ssid.c_str(), password.c_str())) {
    webServer.send_P(500, WEB_CONTENT_TYPE_TEXT, PSTR("SAVE ERROR"));
    return;
  }

  wl_status_t status = wifi_sta_connect(12000);
  web_send_wifi_status();
  web_schedule_restart("wifi_sta_config");
  sys_log_i("wifi", "STA connect request finalizado: status=%d",
            (int)status);
}

static inline void web_handle_wifi_disconnect() {
  web_send_cors_headers();
  wifi_sta_clear();
  LittleFS.remove(WIFI_STA_CONFIG_FILE);
  wifi_mdns_stop();
  WiFi.disconnect(false, true);
  WiFi.mode(WIFI_AP);
  sys_log_i("wifi", "STA desconectado, credenciais removidas, modo AP-only");
  web_send_wifi_status();
}

static inline void web_register_wifi_routes() {
  webServer.on("/wifi/status", HTTP_GET, web_send_wifi_status);
  webServer.on("/wifi/status", HTTP_OPTIONS, web_handle_options);
  webServer.on("/wifi/scan", HTTP_GET, web_send_wifi_scan);
  webServer.on("/wifi/scan", HTTP_OPTIONS, web_handle_options);
  webServer.on("/wifi/connect", HTTP_POST, web_handle_wifi_connect);
  webServer.on("/wifi/connect", HTTP_OPTIONS, web_handle_options);
  webServer.on("/wifi/disconnect", HTTP_POST, web_handle_wifi_disconnect);
  webServer.on("/wifi/disconnect", HTTP_OPTIONS, web_handle_options);
}

#endif // WEB_API_WIFI_H
