#ifndef GLOBAL_CONFIG_H
#define GLOBAL_CONFIG_H

#include <Arduino.h>

struct LedRGBColor {
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

enum LedColorIndex : uint8_t {
  LED_COLOR_VERMELHO = 0,
  LED_COLOR_VERDE = 1,
  LED_COLOR_AZUL = 2,
  LED_COLOR_AMARELO = 3,
  LED_COLOR_ROXO = 4,
  LED_COLOR_CYAN = 5,
  LED_COLOR_BRANCO = 6,
  LED_COLOR_LARANJA = 7,
  LED_COLOR_MAGENTA = 8,
  LED_COLOR_CORAL = 9,
  LED_COLOR_AZUL_CELESTE = 10,
  LED_COLOR_VIOLETA = 11,
  LED_COLOR_ROSA = 12,
  LED_COLOR_MENTA = 13,
  LED_COLOR_PRETO = 14,
  LED_COLOR_COUNT = 15
};

static constexpr LedRGBColor DEFAULT_LED_COLORS[LED_COLOR_COUNT] = {
    {255, 0, 0},     // 0  - VERMELHO
    {0, 255, 0},     // 1  - VERDE
    {0, 0, 255},     // 2  - AZUL
    {255, 255, 0},   // 3  - AMARELO
    {128, 0, 128},   // 4  - ROXO
    {0, 255, 255},   // 5  - CYAN
    {255, 255, 255}, // 6  - BRANCO
    {255, 80, 0},    // 7  - LARANJA
    {255, 0, 128},   // 8  - MAGENTA
    {255, 20, 20},   // 9  - CORAL
    {0, 150, 255},   // 10 - AZUL CELESTE
    {180, 0, 255},   // 11 - VIOLETA
    {255, 100, 200}, // 12 - ROSA
    {50, 255, 100},  // 13 - MENTA
    {0, 0, 0},       // 14 - PRETO / OFF
};

static constexpr uint8_t DEFAULT_BANK_LED_COLOR_INDEX = LED_COLOR_AZUL;
static constexpr uint8_t DEFAULT_LIVE_LED_COLOR_INDEX = LED_COLOR_AZUL;
static constexpr uint8_t BANK_LETTER_COUNT = 5;
static constexpr uint8_t BANK_SWITCH_COUNT = 6;
static constexpr uint8_t LED_COLOR_MODE_LETTERS = 0;
static constexpr uint8_t LED_COLOR_MODE_SWITCHES = 1;
static constexpr uint8_t GLOBAL_CONFIG_VERSION = 1;
static constexpr uint8_t DEFAULT_LED_BRIGHTNESS = 64;
static const char DEFAULT_BOARD_NAME[] = "BFMIDI-3 7S";
static const char GLOBAL_CONFIG_FILE[] = "/global_config.txt";

// AUTO START — preset/modo carregados automaticamente ao ligar a placa.
static constexpr uint8_t AUTO_START_MODE_BANK = 0;
static constexpr uint8_t AUTO_START_MODE_LIVE = 1;

// CHANGE BANKS — comportamento de seleção de presets nos footswitches.
//   Modo 1 (HIBRIDO): tap curto = troca de preset normal; long-press =
//                     entra em "preview" (LED pisca, navega banks sem
//                     efetivar) e long-press de novo confirma.
//   Modo 2 (SINGLE):  tap curto = troca de preset normal; long-press do
//                     switch do preset atual = entra em modo LIVE.
static constexpr uint8_t BANK_CHANGE_MODE_HIBRIDO = 1;
static constexpr uint8_t BANK_CHANGE_MODE_SINGLE = 2;
static constexpr uint8_t DEFAULT_BANK_CHANGE_MODE = BANK_CHANGE_MODE_HIBRIDO;

static LedRGBColor globalLedColors[LED_COLOR_COUNT];
static char globalBoardName[24];
static uint8_t globalLedBrightness = DEFAULT_LED_BRIGHTNESS;
static uint8_t globalBankLedColorIndex = DEFAULT_BANK_LED_COLOR_INDEX;
static uint8_t globalLiveLedColorIndex = DEFAULT_LIVE_LED_COLOR_INDEX;
static uint8_t globalLedColorMode = LED_COLOR_MODE_LETTERS;
static uint8_t globalLetterLedColorIndex[BANK_LETTER_COUNT];
static uint8_t globalSwitchLedColorIndex[BANK_SWITCH_COUNT];
static uint8_t globalAutoStartEnabled = 0;     // 0=desligado, 1=ligado
static uint8_t globalAutoStartBank = 0;        // 0..BANK_LETTER_COUNT-1 (A..E)
static uint8_t globalAutoStartPreset = 1;      // 1-based (1..BANK_SWITCH_COUNT)
static uint8_t globalAutoStartMode = AUTO_START_MODE_BANK;
// PRESET LEVELS — banks ativos (1) são incluídos no ciclo; banks inativos
// (0) são pulados quando o usuario avança pelo próximo bank.
static uint8_t globalBankLetterEnabled[BANK_LETTER_COUNT];
static uint8_t globalBankChangeMode = DEFAULT_BANK_CHANGE_MODE;

static inline char *globalConfigTrim(char *text) {
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

static inline uint8_t globalConfigClampByte(int value) {
  if (value < 0) {
    return 0;
  }
  if (value > 255) {
    return 255;
  }
  return (uint8_t)value;
}

static inline uint8_t globalConfigClampColorIndex(int value) {
  if (value < 0 || value >= LED_COLOR_COUNT) {
    return LED_COLOR_PRETO;
  }
  return (uint8_t)value;
}

static inline bool globalConfigParseColor(const char *value,
                                          LedRGBColor &target) {
  int r = -1;
  int g = -1;
  int b = -1;

  if (sscanf(value, "%d,%d,%d", &r, &g, &b) != 3) {
    return false;
  }

  target.r = globalConfigClampByte(r);
  target.g = globalConfigClampByte(g);
  target.b = globalConfigClampByte(b);
  return true;
}

static inline void globalConfigResetDefaults() {
  for (uint8_t i = 0; i < LED_COLOR_COUNT; i++) {
    globalLedColors[i] = DEFAULT_LED_COLORS[i];
  }

  strncpy(globalBoardName, DEFAULT_BOARD_NAME, sizeof(globalBoardName) - 1);
  globalBoardName[sizeof(globalBoardName) - 1] = '\0';
  globalLedBrightness = DEFAULT_LED_BRIGHTNESS;
  globalBankLedColorIndex = DEFAULT_BANK_LED_COLOR_INDEX;
  globalLiveLedColorIndex = DEFAULT_LIVE_LED_COLOR_INDEX;
  globalLedColorMode = LED_COLOR_MODE_LETTERS;

  for (uint8_t i = 0; i < BANK_LETTER_COUNT; i++) {
    globalLetterLedColorIndex[i] = DEFAULT_BANK_LED_COLOR_INDEX;
  }

  for (uint8_t i = 0; i < BANK_SWITCH_COUNT; i++) {
    globalSwitchLedColorIndex[i] = DEFAULT_BANK_LED_COLOR_INDEX;
  }

  globalAutoStartEnabled = 0;
  globalAutoStartBank = 0;
  globalAutoStartPreset = 1;
  globalAutoStartMode = AUTO_START_MODE_BANK;

  for (uint8_t i = 0; i < BANK_LETTER_COUNT; i++) {
    globalBankLetterEnabled[i] = 1;
  }

  globalBankChangeMode = DEFAULT_BANK_CHANGE_MODE;
}

static inline bool globalConfigSave() {
  File file = LittleFS.open(GLOBAL_CONFIG_FILE, "w");
  if (!file) {
    return false;
  }

  file.printf("version=%u\n", (unsigned)GLOBAL_CONFIG_VERSION);
  file.printf("board=%s\n", globalBoardName);
  file.printf("led_brightness=%u\n", (unsigned)globalLedBrightness);
  file.printf("bank_led_color=%u\n", (unsigned)globalBankLedColorIndex);
  file.printf("live_led_color=%u\n", (unsigned)globalLiveLedColorIndex);
  file.printf("led_color_mode=%u\n", (unsigned)globalLedColorMode);
  file.printf("auto_start_enabled=%u\n", (unsigned)globalAutoStartEnabled);
  file.printf("auto_start_bank=%u\n", (unsigned)globalAutoStartBank);
  file.printf("auto_start_preset=%u\n", (unsigned)globalAutoStartPreset);
  file.printf("auto_start_mode=%u\n", (unsigned)globalAutoStartMode);
  file.printf("bank_change_mode=%u\n", (unsigned)globalBankChangeMode);

  for (uint8_t i = 0; i < BANK_LETTER_COUNT; i++) {
    file.printf("bank_letter_enabled_%u=%u\n", (unsigned)i,
                (unsigned)globalBankLetterEnabled[i]);
  }

  for (uint8_t i = 0; i < BANK_LETTER_COUNT; i++) {
    file.printf("letter_led_%u=%u\n", (unsigned)i,
                (unsigned)globalLetterLedColorIndex[i]);
  }

  for (uint8_t i = 0; i < BANK_SWITCH_COUNT; i++) {
    file.printf("switch_led_%u=%u\n", (unsigned)i,
                (unsigned)globalSwitchLedColorIndex[i]);
  }

  for (uint8_t i = 0; i < LED_COLOR_COUNT; i++) {
    file.printf("color_%u=%u,%u,%u\n", (unsigned)i,
                (unsigned)globalLedColors[i].r,
                (unsigned)globalLedColors[i].g,
                (unsigned)globalLedColors[i].b);
  }

  file.close();
  return true;
}

static inline bool globalConfigLoad() {
  globalConfigResetDefaults();

  if (!LittleFS.exists(GLOBAL_CONFIG_FILE)) {
    return globalConfigSave();
  }

  File file = LittleFS.open(GLOBAL_CONFIG_FILE, "r");
  if (!file) {
    return false;
  }

  char line[96];
  while (file.available()) {
    size_t len = file.readBytesUntil('\n', line, sizeof(line) - 1);
    line[len] = '\0';

    char *entry = globalConfigTrim(line);
    if (entry[0] == '\0' || entry[0] == '#') {
      continue;
    }

    char *separator = strchr(entry, '=');
    if (!separator) {
      continue;
    }

    *separator = '\0';
    char *key = globalConfigTrim(entry);
    char *value = globalConfigTrim(separator + 1);

    if (strcmp(key, "version") == 0) {
      continue;
    } else if (strcmp(key, "board") == 0) {
      strncpy(globalBoardName, value, sizeof(globalBoardName) - 1);
      globalBoardName[sizeof(globalBoardName) - 1] = '\0';
    } else if (strcmp(key, "led_brightness") == 0) {
      globalLedBrightness = globalConfigClampByte(atoi(value));
    } else if (strcmp(key, "bank_led_color") == 0) {
      globalBankLedColorIndex = globalConfigClampColorIndex(atoi(value));
    } else if (strcmp(key, "live_led_color") == 0) {
      globalLiveLedColorIndex = globalConfigClampColorIndex(atoi(value));
    } else if (strcmp(key, "led_color_mode") == 0) {
      globalLedColorMode =
          atoi(value) == LED_COLOR_MODE_SWITCHES ? LED_COLOR_MODE_SWITCHES
                                                 : LED_COLOR_MODE_LETTERS;
    } else if (strcmp(key, "auto_start_enabled") == 0) {
      globalAutoStartEnabled = atoi(value) ? 1 : 0;
    } else if (strcmp(key, "auto_start_bank") == 0) {
      const int b = atoi(value);
      globalAutoStartBank =
          (b < 0 || b >= BANK_LETTER_COUNT) ? 0 : (uint8_t)b;
    } else if (strcmp(key, "auto_start_preset") == 0) {
      const int p = atoi(value);
      if (p < 1) {
        globalAutoStartPreset = 1;
      } else if (p > BANK_SWITCH_COUNT) {
        globalAutoStartPreset = BANK_SWITCH_COUNT;
      } else {
        globalAutoStartPreset = (uint8_t)p;
      }
    } else if (strcmp(key, "auto_start_mode") == 0) {
      globalAutoStartMode = atoi(value) == AUTO_START_MODE_LIVE
                                ? AUTO_START_MODE_LIVE
                                : AUTO_START_MODE_BANK;
    } else if (strcmp(key, "bank_change_mode") == 0) {
      globalBankChangeMode = atoi(value) == BANK_CHANGE_MODE_SINGLE
                                 ? BANK_CHANGE_MODE_SINGLE
                                 : BANK_CHANGE_MODE_HIBRIDO;
    } else if (strncmp(key, "bank_letter_enabled_", 20) == 0) {
      const int idx = atoi(key + 20);
      if (idx >= 0 && idx < BANK_LETTER_COUNT) {
        globalBankLetterEnabled[idx] = atoi(value) ? 1 : 0;
      }
    } else if (strncmp(key, "letter_led_", 11) == 0) {
      const int ledIndex = atoi(key + 11);
      if (ledIndex >= 0 && ledIndex < BANK_LETTER_COUNT) {
        globalLetterLedColorIndex[ledIndex] =
            globalConfigClampColorIndex(atoi(value));
      }
    } else if (strncmp(key, "switch_led_", 11) == 0) {
      const int ledIndex = atoi(key + 11);
      if (ledIndex >= 0 && ledIndex < BANK_SWITCH_COUNT) {
        globalSwitchLedColorIndex[ledIndex] =
            globalConfigClampColorIndex(atoi(value));
      }
    } else if (strncmp(key, "color_", 6) == 0) {
      const int colorIndex = atoi(key + 6);
      if (colorIndex >= 0 && colorIndex < LED_COLOR_COUNT) {
        globalConfigParseColor(value, globalLedColors[colorIndex]);
      }
    }
  }

  file.close();
  return true;
}

static inline LedRGBColor globalLedColor(uint8_t colorIndex) {
  if (colorIndex >= LED_COLOR_COUNT) {
    return globalLedColors[LED_COLOR_PRETO];
  }

  return globalLedColors[colorIndex];
}

#endif // GLOBAL_CONFIG_H
