#ifndef NET_WIFI_H
#define NET_WIFI_H

#include <Arduino.h>
#include <ESPmDNS.h>
#include <WiFi.h>

static constexpr const char *WIFI_AP_SSID = "BFMIDI_WIFI";
static constexpr const char *WIFI_AP_PASSWORD = "bfmidi@editor";
static constexpr const char *WIFI_STA_HOSTNAME = "bfmidi";
static constexpr const char *WIFI_MDNS_NAME = "bfmidi";
static constexpr uint8_t WIFI_AP_CHANNEL = 1;
static constexpr uint8_t WIFI_AP_MAX_CLIENTS = 2;
static constexpr wifi_power_t WIFI_AP_TX_POWER = WIFI_POWER_11dBm;
static constexpr uint8_t WIFI_STA_CONFIG_VERSION = 1;
static const char WIFI_STA_CONFIG_FILE[] = "/wifi_sta.txt";

static const IPAddress WIFI_AP_IP(192, 168, 4, 1);
static const IPAddress WIFI_AP_GATEWAY(192, 168, 4, 1);
static const IPAddress WIFI_AP_SUBNET(255, 255, 255, 0);
static const IPAddress WIFI_AP_DHCP_START(192, 168, 4, 2);
static const IPAddress WIFI_AP_DNS(192, 168, 4, 1);

static char wifiStaSsid[33] = {0};
static char wifiStaPassword[65] = {0};
static bool wifiMdnsStarted = false;
static bool wifiActive = false;

// Auto-off: ao subir o WiFi, se nenhum cliente AP/STA se conectar dentro desse
// tempo, derruba WiFi e WebServer pra economizar bateria/heap.
static constexpr uint32_t WIFI_AUTO_OFF_MS = 90000;
static uint32_t wifiAutoOffDeadlineMs = 0;
static bool wifiAutoOffArmed = false;

// Forward decl: web_stop() vive em WEB_SERVER.h, incluido depois deste header.
static inline void web_stop();
static inline void wifi_stop();

static inline void wifi_mdns_stop() {
  if (!wifiMdnsStarted) {
    return;
  }

  MDNS.end();
  wifiMdnsStarted = false;
}

static inline void wifi_mdns_begin() {
  if (WiFi.status() != WL_CONNECTED) {
    wifi_mdns_stop();
    return;
  }

  wifi_mdns_stop();
  if (MDNS.begin(WIFI_MDNS_NAME)) {
    MDNS.addService("http", "tcp", 80);
    wifiMdnsStarted = true;
    sys_log_i("wifi", "mDNS http://%s.local/", WIFI_MDNS_NAME);
  } else {
    sys_log_i("wifi", "mDNS falhou: %s.local", WIFI_MDNS_NAME);
  }
}

static inline void wifi_sta_clear() {
  wifiStaSsid[0] = '\0';
  wifiStaPassword[0] = '\0';
}

static inline char *wifi_trim(char *text) {
  while (*text == ' ' || *text == '\t' || *text == '\r' || *text == '\n') {
    text++;
  }

  char *end = text + strlen(text);
  while (end > text &&
         (end[-1] == ' ' || end[-1] == '\t' || end[-1] == '\r' ||
          end[-1] == '\n')) {
    end--;
  }
  *end = '\0';
  return text;
}

static inline bool wifi_sta_load() {
  wifi_sta_clear();

  if (!LittleFS.exists(WIFI_STA_CONFIG_FILE)) {
    return false;
  }

  File file = LittleFS.open(WIFI_STA_CONFIG_FILE, "r");
  if (!file) {
    return false;
  }

  char line[112];
  while (file.available()) {
    size_t len = file.readBytesUntil('\n', line, sizeof(line) - 1);
    line[len] = '\0';

    char *entry = wifi_trim(line);
    if (entry[0] == '\0' || entry[0] == '#') {
      continue;
    }

    char *separator = strchr(entry, '=');
    if (!separator) {
      continue;
    }

    *separator = '\0';
    char *key = wifi_trim(entry);
    char *value = wifi_trim(separator + 1);

    if (strcmp(key, "version") == 0) {
      continue;
    } else if (strcmp(key, "ssid") == 0) {
      strncpy(wifiStaSsid, value, sizeof(wifiStaSsid) - 1);
      wifiStaSsid[sizeof(wifiStaSsid) - 1] = '\0';
    } else if (strcmp(key, "password") == 0) {
      strncpy(wifiStaPassword, value, sizeof(wifiStaPassword) - 1);
      wifiStaPassword[sizeof(wifiStaPassword) - 1] = '\0';
    }
  }

  file.close();
  return wifiStaSsid[0] != '\0';
}

static inline bool wifi_sta_save(const char *ssid, const char *password) {
  strncpy(wifiStaSsid, ssid ? ssid : "", sizeof(wifiStaSsid) - 1);
  wifiStaSsid[sizeof(wifiStaSsid) - 1] = '\0';
  strncpy(wifiStaPassword, password ? password : "",
          sizeof(wifiStaPassword) - 1);
  wifiStaPassword[sizeof(wifiStaPassword) - 1] = '\0';

  File file = LittleFS.open(WIFI_STA_CONFIG_FILE, "w");
  if (!file) {
    return false;
  }

  file.printf("version=%u\n", (unsigned)WIFI_STA_CONFIG_VERSION);
  file.printf("ssid=%s\n", wifiStaSsid);
  file.printf("password=%s\n", wifiStaPassword);
  file.close();
  return true;
}

static inline wl_status_t wifi_sta_connect(uint32_t timeoutMs = 10000) {
  if (wifiStaSsid[0] == '\0') {
    return WL_NO_SSID_AVAIL;
  }

  if (WiFi.getMode() != WIFI_AP_STA) {
    WiFi.mode(WIFI_AP_STA);
  }

  WiFi.setHostname(WIFI_STA_HOSTNAME);
  WiFi.begin(wifiStaSsid, wifiStaPassword);

  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(100);
  }

  wl_status_t status = WiFi.status();
  if (status == WL_CONNECTED) {
    sys_log_i("wifi", "STA %s ip=%s rssi=%d", wifiStaSsid,
              WiFi.localIP().toString().c_str(), WiFi.RSSI());
    wifi_mdns_begin();
  } else {
    sys_log_i("wifi", "STA %s falhou (status=%d)", wifiStaSsid, (int)status);
    wifi_mdns_stop();
  }
  return status;
}

// Boot: carrega credenciais STA salvas e deixa o radio desligado. O usuario
// liga/desliga o WiFi via combo SW2+SW3 (ver SW_BANK.h).
static inline void wifi_setup_once() {
  WiFi.persistent(false);
  WiFi.useStaticBuffers(false);
  WiFi.setHostname(WIFI_STA_HOSTNAME);
  wifi_sta_load();
  WiFi.mode(WIFI_OFF);
  wifiActive = false;
  wifiAutoOffArmed = false;
  sys_log_i("wifi", "off (carrega creds STA, sera ligado no boot)");
}

static inline void wifi_start() {
  if (wifiActive) {
    return;
  }

  // Diagnostico: medir consumo de heap/PSRAM do stack WiFi.
  const size_t heapBefore = ESP.getFreeHeap();
  const size_t psramBefore = ESP.getFreePsram();

  const bool hasStaCreds = wifiStaSsid[0] != '\0';
  WiFi.mode(hasStaCreds ? WIFI_AP_STA : WIFI_AP);
  WiFi.setSleep(false);

  WiFi.softAPConfig(WIFI_AP_IP, WIFI_AP_GATEWAY, WIFI_AP_SUBNET,
                    WIFI_AP_DHCP_START, WIFI_AP_DNS);
  const bool apOk = WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD,
                                WIFI_AP_CHANNEL, 0, WIFI_AP_MAX_CLIENTS);
  WiFi.setTxPower(WIFI_AP_TX_POWER);

  sys_log_i("wifi", "AP %s ip=%s%s", WIFI_AP_SSID,
            WiFi.softAPIP().toString().c_str(),
            apOk ? "" : " (FALHOU)");

  if (hasStaCreds) {
    wifi_sta_connect(8000);
  }

  const long heapDelta = (long)heapBefore - (long)ESP.getFreeHeap();
  const long psramDelta = (long)psramBefore - (long)ESP.getFreePsram();
  sys_log_i("wifi", "delta heap=%ld psram=%ld", heapDelta, psramDelta);

  wifiActive = true;
  wifiAutoOffArmed = true;
  wifiAutoOffDeadlineMs = millis() + WIFI_AUTO_OFF_MS;
  sys_log_i("wifi", "auto-off em %us se ninguem conectar",
            (unsigned)(WIFI_AUTO_OFF_MS / 1000));
}

// Verifica se chegou a hora de desligar WiFi+Web por inatividade.
// Cliente AP conectado ou STA associada ao roteador cancelam o auto-off
// permanentemente (ate o proximo wifi_start).
static inline void wifi_auto_off_update() {
  if (!wifiActive || !wifiAutoOffArmed) {
    return;
  }

  if (WiFi.softAPgetStationNum() > 0 || WiFi.status() == WL_CONNECTED) {
    wifiAutoOffArmed = false;
    sys_log_i("wifi", "cliente conectado, auto-off cancelado");
    return;
  }

  if ((int32_t)(millis() - wifiAutoOffDeadlineMs) >= 0) {
    sys_log_i("wifi", "auto-off: sem cliente em %us, desligando",
              (unsigned)(WIFI_AUTO_OFF_MS / 1000));
    web_stop();
    wifi_stop();
  }
}

static inline void wifi_stop() {
  if (!wifiActive) {
    return;
  }

  wifi_mdns_stop();
  WiFi.softAPdisconnect(true);
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_OFF);
  wifiActive = false;
  wifiAutoOffArmed = false;
  sys_log_i("wifi", "off");
}

#endif
