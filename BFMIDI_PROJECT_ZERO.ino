// O display agora é selecionado em runtime conforme a placa carregada
// (ver BOARDS.h::DisplayVariant e display_init()).

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_NeoPixel.h>
#include <LittleFS.h>
#include <stdarg.h>

// Forca o scanner de bibliotecas do arduino-esp32 a adicionar
// libraries/USB/src/ no include path. SEND_MIDI.h depende disso pra
// declarar a classe USBMIDI quando CONFIG_TINYUSB_MIDI_ENABLED vier de
// USB Mode = "USB-OTG (TinyUSB)".
#include <USB.h>
#include <USBMIDI.h>

#if !defined(CONFIG_IDF_TARGET_ESP32S2)
#error "Selecione uma placa ESP32-S2 no Arduino IDE."
#endif

#if defined(ESP32)
#include <esp_heap_caps.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>
#include <esp_system.h>
#endif

#include "ALL_SWITCHES.h"
#include "BOARDS.h"
#include "DISPLAY_CONFIG.h"
#include "DISPLAY_COLORS.h"
#include "GLOBAL_CONFIG.h"

#include "DISPLAY_320.h"
#include "DISPLAY_480.h"

lgfx::LGFX_Device *tft = nullptr;
LGFX_Sprite *canvas = nullptr;
bool canvasReady = false;

// Tabela de dispatch das funções de desenho. Apontada em display_init() para
// dsp320::* ou dsp480::* conforme activePins.DISPLAY_TYPE.
static void (*welcome_screen)() = nullptr;
static void (*draw_bank_screen)(const char *, long, long, long, long, int,
                                bool, int) = nullptr;
static void (*draw_live_screen)(const char *, long, long, long, long, int,
                                bool, int) = nullptr;
static void (*draw_wifi_icon)(bool) = nullptr;

static const char *FS_PARTITION_LABEL = "storage";
static constexpr uint16_t LED_WS2812_COUNT = BOARD_NEOPIXEL_COUNT;
static constexpr uint32_t SWITCH_DEBOUNCE_MS = 35;
static constexpr uint32_t SERIAL_BOOT_DELAY_MS = 800;
static size_t fsTotalBytes = 0;
static size_t fsUsedBytes = 0;

PinoutConfig activePins;
Adafruit_NeoPixel leds;

Button bankButtons[6];
Button liveModeButton;
uint8_t currentSwitchMode = 0;
static uint8_t activeBankLetterIndex = 0;
static int8_t activePresetIndex = -1;

static void sys_log_i(const char *tag, const char *fmt, ...) {
  Serial.printf("I (%lu) %s: ", millis(), tag);

  va_list args;
  va_start(args, fmt);
  Serial.vprintf(fmt, args);
  va_end(args);

  Serial.println();
}

static uint8_t freePercent(size_t freeBytes, size_t totalBytes) {
  if (totalBytes == 0) {
    return 0;
  }
  return (uint8_t)((freeBytes * 100ULL) / totalBytes);
}

#include "BANK_MEMORY.h"
#include "LED_STRIP.h"
#include "NET_WIFI.h"
#include "SEND_MIDI.h"
#include "SW_BANK.h"
#include "SW_LIVE.h"
#include "SW_MODE.h"
#include "WEB_SERVER.h"
#include "USB_CONTROL.h"

static void print_boot_banner() {
  sys_log_i("main", "============ BFMIDI ============");
}

static void board_init() {
  if (!loadBoardPins(activePins, globalBoardName)) {
    sys_log_i("board", "'%s' nao encontrada; usando '%s'",
              globalBoardName, DEFAULT_BOARD_NAME);
    strncpy(globalBoardName, DEFAULT_BOARD_NAME, sizeof(globalBoardName) - 1);
    globalBoardName[sizeof(globalBoardName) - 1] = '\0';
    loadBoardPins(activePins, globalBoardName);
  }

  sys_log_i("board", "%s SW=%d,%d,%d,%d,%d,%d NEO=pin%dx%u",
            activePins.BOARD_VERSION,
            activePins.BTSW1, activePins.BTSW2, activePins.BTSW3,
            activePins.BTSW4, activePins.BTSW5, activePins.BTSW6,
            activePins.PIN_NEOPIXEL, (unsigned)LED_WS2812_COUNT);
}

static void littlefs_init() {
#if defined(ESP32)
  const esp_partition_t *partition = esp_partition_find_first(
      ESP_PARTITION_TYPE_DATA, (esp_partition_subtype_t)0x83,
      FS_PARTITION_LABEL);

  if (!partition) {
    sys_log_i("littlefs", "Particao '%s' nao encontrada", FS_PARTITION_LABEL);
    fsTotalBytes = 0;
    fsUsedBytes = 0;
    return;
  }
#endif

  if (!LittleFS.begin(false, "/littlefs", 10, FS_PARTITION_LABEL)) {
    sys_log_i("littlefs", "Mount falhou; formatando '%s'", FS_PARTITION_LABEL);
    if (!LittleFS.begin(true, "/littlefs", 10, FS_PARTITION_LABEL)) {
      sys_log_i("littlefs", "Mount falhou apos format");
      fsTotalBytes = 0;
      fsUsedBytes = 0;
      return;
    }
  }

  fsTotalBytes = LittleFS.totalBytes();
  fsUsedBytes = LittleFS.usedBytes();
#if defined(ESP32)
  sys_log_i("littlefs", "%s 0x%06x total=%u usado=%u",
            FS_PARTITION_LABEL, (unsigned)partition->address,
            (unsigned)fsTotalBytes, (unsigned)fsUsedBytes);
#else
  sys_log_i("littlefs", "%s total=%u usado=%u", FS_PARTITION_LABEL,
            (unsigned)fsTotalBytes, (unsigned)fsUsedBytes);
#endif
}

static void global_config_init() {
  if (!globalConfigLoad()) {
    sys_log_i("config", "Falha em %s; usando defaults", GLOBAL_CONFIG_FILE);
    globalConfigResetDefaults();
  }

  sys_log_i("config", "board=%s brilho=%u bank_cor=%u live_cor=%u",
            globalBoardName, (unsigned)globalLedBrightness,
            (unsigned)globalBankLedColorIndex,
            (unsigned)globalLiveLedColorIndex);
}

static void bank_memory_init() {
  if (!bankMemoryLoad()) {
    sys_log_i("bankmem", "Falha em %s; usando defaults", BANK_MEMORY_FILE);
    bankMemoryResetDefaults();
  }

  sys_log_i("bankmem", "%u banks de %s",
            (unsigned)BANK_MEMORY_COUNT, BANK_MEMORY_FILE);
}

static void display_canvas_init(int screenW, int screenH) {
  if (ESP.getFreePsram() == 0) {
    sys_log_i("display", "PSRAM indisponivel; desenho direto no painel");
    canvasReady = false;
    return;
  }

  canvas->setPsram(true);
  canvas->setColorDepth(16);
  if (!canvas->createSprite(screenW, screenH)) {
    sys_log_i("display", "Falha ao alocar canvas %dx%d em PSRAM",
              screenW, screenH);
    canvasReady = false;
    return;
  }

  canvasReady = true;
}

static void display_init() {
  int screenW = 320;
  int screenH = 240;

  if (activePins.DISPLAY_TYPE == DISPLAY_480x320) {
    sys_log_i("display", "480x320 (ST7796S)");
    tft = new LGFX_480();
    welcome_screen = &dsp480::welcome_screen;
    draw_bank_screen = &dsp480::draw_bank_screen;
    draw_live_screen = &dsp480::draw_live_screen;
    draw_wifi_icon = &dsp480::draw_wifi_icon;
    screenW = dsp480::SCREEN_W;
    screenH = dsp480::SCREEN_H;
  } else {
    sys_log_i("display", "320x240 (ST7789)");
    tft = new LGFX_320();
    welcome_screen = &dsp320::welcome_screen;
    draw_bank_screen = &dsp320::draw_bank_screen;
    draw_live_screen = &dsp320::draw_live_screen;
    draw_wifi_icon = &dsp320::draw_wifi_icon;
    screenW = dsp320::SCREEN_W;
    screenH = dsp320::SCREEN_H;
  }

  canvas = new LGFX_Sprite(tft);

  tft->init();
  tft->setRotation(3);
  display_canvas_init(screenW, screenH);
  welcome_screen();
}

static void apply_auto_start() {
  if (!globalAutoStartEnabled) {
    sys_log_i("autostart", "desativado");
    return;
  }

  uint8_t bank = globalAutoStartBank;
  if (bank >= BANK_LETTER_COUNT) bank = 0;

  uint8_t preset = globalAutoStartPreset;
  if (preset < 1) preset = 1;
  if (preset > BANK_SWITCH_COUNT) preset = BANK_SWITCH_COUNT;

  activeBankLetterIndex = bank;
  activePresetIndex = (int8_t)(preset - 1);

  sys_log_i("autostart", "Bank=%c Preset=%u Modo=%s",
            (char)('A' + bank), (unsigned)preset,
            globalAutoStartMode == AUTO_START_MODE_LIVE ? "LIVE" : "BANK");

  if (globalAutoStartMode == AUTO_START_MODE_LIVE) {
    swModeEnterLive();
  } else {
    swModeEnterBank();
  }

  // Dispara o header MIDI do preset auto-iniciado (USB host pode nao ter
  // enumerado ainda no boot; Serial1 DIN5 sai imediatamente).
  swBankSendHeaderMidi(bankMemoryCurrent());
}

static void print_resources() {
  const size_t heapTotal = ESP.getHeapSize();
  const size_t heapFree = ESP.getFreeHeap();
  const size_t psramTotal = ESP.getPsramSize();
  const size_t psramFree = ESP.getFreePsram();
  const size_t fsFree = fsTotalBytes > fsUsedBytes ? fsTotalBytes - fsUsedBytes : 0;
  const size_t sketchUsed = ESP.getSketchSize();
  size_t sketchTotal = 0;

#if defined(ESP32)
  const esp_partition_t *runningPartition = esp_ota_get_running_partition();
  if (runningPartition) {
    sketchTotal = runningPartition->size;
  }
#endif

  sys_log_i("main", "---------------- RECURSOS ----------------");
  sys_log_i("main", "FLASH codigo: %7u / %8u bytes  ( %2u%%)",
        (unsigned)sketchUsed, (unsigned)sketchTotal,
        freePercent(sketchUsed, sketchTotal));
  sys_log_i("main", "HEAP  livre: %8u / %8u bytes  ( %2u%%)",
        (unsigned)heapFree, (unsigned)heapTotal,
        freePercent(heapFree, heapTotal));
  sys_log_i("main", "PSRAM livre: %8u / %8u bytes  ( %2u%%)",
        (unsigned)psramFree, (unsigned)psramTotal,
        freePercent(psramFree, psramTotal));
  sys_log_i("main", "FS    livre: %8u / %8u bytes  ( %2u%%)",
        (unsigned)fsFree, (unsigned)fsTotalBytes,
        freePercent(fsFree, fsTotalBytes));
  sys_log_i("main", "------------------------------------------");
}

void setup() {
  Serial.begin(115200);
  delay(SERIAL_BOOT_DELAY_MS);
  Serial.println();

  print_boot_banner();
  littlefs_init();
  global_config_init();
  bank_memory_init();
  board_init();
  send_midi_init();
  usb_control_setup();
  wifi_setup_once();
  web_setup_once();
  ledStripBegin();
  display_init();
  swBankBegin();
  swLiveBegin();
  swModeBegin();
  apply_auto_start();
  print_resources();
  // WiFi liga no boot; auto-off em 90s se ninguem conectar (ver NET_WIFI.h).
  wifi_start();
  web_start();
  sys_log_i("main", "Sistema pronto.");
}

void loop() {
  usb_control_update();
  web_update();
  wifi_auto_off_update();
  wifiOverlayTick();
  swModeUpdate();

  if (currentSwitchMode == SWITCH_MODE_LIVE) {
    swLiveUpdate();
  } else {
    swBankUpdate();
  }
}
