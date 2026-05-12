#ifndef BOARDS_H
#define BOARDS_H

#include <Arduino.h>
#include <string.h>

static constexpr uint16_t BOARD_NEOPIXEL_COUNT = 24;

// Variante do display associada a cada placa.
// O firmware seleciona o driver/layout em runtime conforme este campo,
// dispensando recompilação para trocar de painel.
enum DisplayVariant : uint8_t {
  DISPLAY_320x240 = 0, // ST7789 — usado em BFMIDI-1 e BFMIDI-2
  DISPLAY_480x320 = 1, // ST7796S — usado em BFMIDI-3
};

static constexpr const char *AVAILABLE_BOARDS[] = {
    // BFMIDI-1 / BFMIDI-2 (display 320x240)
    "BFMIDI-1 7S_A1",
    "BFMIDI-1 7S_B1",
    "BFMIDI-1 7S_C1",
    "BFMIDI-1 4S",
    "BFMIDI-2 NANO",
    "BFMIDI-2 MICRO",
    "BFMIDI-2 4S",
    "BFMIDI-2 6S",
    "BFMIDI-2 7S",
    // BFMIDI-3 (display 480x320)
    "BFMIDI-3 NANO",
    "BFMIDI-3 6S",
    "BFMIDI-3 7S",
};
static constexpr uint8_t AVAILABLE_BOARD_COUNT =
    sizeof(AVAILABLE_BOARDS) / sizeof(AVAILABLE_BOARDS[0]);

struct PinoutConfig {
  int BTSW1;
  int BTSW2;
  int BTSW3;
  int BTSW4;
  int BTSW5;
  int BTSW6;
  int LIVE_MODE_PIN;
  int ENCODER_PIN_A;
  int ENCODER_PIN_B;
  int ENCODER_BUTTON_PIN;
  int TAP_FULL;
  int EXP;
  int PIN_NEOPIXEL;
  int PIXELSW1[3];
  int PIXELSW2[3];
  int PIXELSW3[3];
  int PIXELSW4[3];
  int PIXELSW5[3];
  int PIXELSW6[3];
  int PIXELSLIVE[3];
  int PIXEL_EXTRATAP[3];
  DisplayVariant DISPLAY_TYPE;
  const char *BOARD_VERSION;
};

static inline void boardCopyPixels(int target[3], const int source[3]) {
  memcpy(target, source, sizeof(int) * 3);
}

static inline void clearBoardPins(PinoutConfig &activePins) {
  activePins.BTSW1 = -1;
  activePins.BTSW2 = -1;
  activePins.BTSW3 = -1;
  activePins.BTSW4 = -1;
  activePins.BTSW5 = -1;
  activePins.BTSW6 = -1;
  activePins.LIVE_MODE_PIN = -1;
  activePins.ENCODER_PIN_A = -1;
  activePins.ENCODER_PIN_B = -1;
  activePins.ENCODER_BUTTON_PIN = -1;
  activePins.TAP_FULL = -1;
  activePins.EXP = -1;
  activePins.PIN_NEOPIXEL = -1;

  const int emptyPixels[] = {-1, -1, -1};
  boardCopyPixels(activePins.PIXELSW1, emptyPixels);
  boardCopyPixels(activePins.PIXELSW2, emptyPixels);
  boardCopyPixels(activePins.PIXELSW3, emptyPixels);
  boardCopyPixels(activePins.PIXELSW4, emptyPixels);
  boardCopyPixels(activePins.PIXELSW5, emptyPixels);
  boardCopyPixels(activePins.PIXELSW6, emptyPixels);
  boardCopyPixels(activePins.PIXELSLIVE, emptyPixels);
  boardCopyPixels(activePins.PIXEL_EXTRATAP, emptyPixels);
  activePins.DISPLAY_TYPE = DISPLAY_320x240;
  activePins.BOARD_VERSION = "UNKNOWN";
}

static inline bool loadBoardPins(PinoutConfig &activePins,
                                 const char *boardName) {
  clearBoardPins(activePins);

  // ==========================================================================
  // BFMIDI-1 / BFMIDI-2 boards (display 320x240)
  // ==========================================================================
  if (strcmp(boardName, "BFMIDI-1 7S_B1") == 0) {
    activePins.BTSW1 = 9;
    activePins.BTSW2 = 11;
    activePins.BTSW3 = 12;
    activePins.BTSW4 = 7;
    activePins.BTSW5 = 4;
    activePins.BTSW6 = 2;
    activePins.LIVE_MODE_PIN = 5;
    activePins.ENCODER_PIN_A = 33;
    activePins.ENCODER_PIN_B = 34;
    activePins.ENCODER_BUTTON_PIN = 18;
    activePins.TAP_FULL = 6;
    activePins.PIN_NEOPIXEL = 3;

    const int psw1[] = {6, 7, 8};
    const int psw2[] = {9, 10, 11};
    const int psw3[] = {12, 13, 14};
    const int psw4[] = {3, 4, 5};
    const int psw5[] = {18, 19, 20};
    const int psw6[] = {15, 16, 17};
    const int pslive[] = {0, 1, 2};
    const int psextra[] = {21, 22, 23};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-1 7S_B1";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-1 7S_C1") == 0) {
    activePins.BTSW1 = 7;
    activePins.BTSW2 = 9;
    activePins.BTSW3 = 12;
    activePins.BTSW4 = 5;
    activePins.BTSW5 = 11;
    activePins.BTSW6 = 15;
    activePins.LIVE_MODE_PIN = 3;
    activePins.ENCODER_PIN_A = 34;
    activePins.ENCODER_PIN_B = 33;
    activePins.ENCODER_BUTTON_PIN = 18;
    activePins.TAP_FULL = 16;
    activePins.PIN_NEOPIXEL = 2;

    const int psw1[] = {6, 7, 8};
    const int psw2[] = {9, 10, 11};
    const int psw3[] = {15, 16, 17};
    const int psw4[] = {3, 4, 5};
    const int psw5[] = {12, 13, 14};
    const int psw6[] = {18, 19, 20};
    const int pslive[] = {0, 1, 2};
    const int psextra[] = {21, 22, 23};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-1 7S_C1";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-1 7S_A1") == 0) {
    activePins.BTSW1 = 9;
    activePins.BTSW2 = 7;
    activePins.BTSW3 = 5;
    activePins.BTSW4 = 11;
    activePins.BTSW5 = 2;
    activePins.BTSW6 = 4;
    activePins.LIVE_MODE_PIN = 12;
    activePins.ENCODER_PIN_A = 18;
    activePins.ENCODER_PIN_B = 16;
    activePins.ENCODER_BUTTON_PIN = 33;
    activePins.TAP_FULL = 3;
    activePins.PIN_NEOPIXEL = 14;

    const int psw1[] = {6, 7, 8};
    const int psw2[] = {9, 10, 11};
    const int psw3[] = {12, 13, 14};
    const int psw4[] = {3, 4, 5};
    const int psw5[] = {18, 19, 20};
    const int psw6[] = {15, 16, 17};
    const int pslive[] = {0, 1, 2};
    const int psextra[] = {21, 22, 23};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-1 7S_A1";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-1 4S") == 0) {
    activePins.BTSW1 = 12;
    activePins.BTSW2 = 3;
    activePins.BTSW3 = 7;
    activePins.BTSW4 = 11;
    activePins.BTSW5 = -1;
    activePins.BTSW6 = -1;
    activePins.LIVE_MODE_PIN = 5;
    activePins.ENCODER_PIN_A = 18;
    activePins.ENCODER_PIN_B = 33;
    activePins.ENCODER_BUTTON_PIN = 16;
    activePins.TAP_FULL = 9;
    activePins.PIN_NEOPIXEL = 14;

    const int psw1[] = {0, 1, 2};
    const int psw2[] = {3, 4, 5};
    const int psw3[] = {6, 7, 8};
    const int psw4[] = {9, 10, 11};
    const int psw5[] = {21, 22, 23};
    const int psw6[] = {18, 19, 20};
    const int pslive[] = {15, 16, 17};
    const int psextra[] = {12, 13, 14};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-1 4S";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-2 6S") == 0) {
    activePins.BTSW1 = 11;
    activePins.BTSW2 = 9;
    activePins.BTSW3 = 7;
    activePins.BTSW4 = 8;
    activePins.BTSW5 = 6;
    activePins.BTSW6 = 4;
    activePins.LIVE_MODE_PIN = 12;
    activePins.ENCODER_PIN_A = 21;
    activePins.ENCODER_PIN_B = 34;
    activePins.ENCODER_BUTTON_PIN = 17;
    activePins.TAP_FULL = 5;
    activePins.PIN_NEOPIXEL = 14;

    const int psw1[] = {3, 4, 5};
    const int psw2[] = {6, 7, 8};
    const int psw3[] = {9, 10, 11};
    const int psw4[] = {12, 13, 14};
    const int psw5[] = {15, 16, 17};
    const int psw6[] = {18, 19, 20};
    const int pslive[] = {0, 1, 2};
    const int psextra[] = {21, 22, 23};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-2 6S";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-2 4S") == 0) {
    activePins.BTSW1 = 7;
    activePins.BTSW2 = 9;
    activePins.BTSW3 = 3;
    activePins.BTSW4 = 5;
    activePins.BTSW5 = -1;
    activePins.BTSW6 = -1;
    activePins.LIVE_MODE_PIN = 12;
    activePins.ENCODER_PIN_A = 18;
    activePins.ENCODER_PIN_B = 33;
    activePins.ENCODER_BUTTON_PIN = 16;
    activePins.TAP_FULL = 4;
    activePins.PIN_NEOPIXEL = 14;

    const int psw1[] = {3, 4, 5};
    const int psw2[] = {6, 7, 8};
    const int psw3[] = {9, 10, 11};
    const int psw4[] = {12, 13, 14};
    const int psw5[] = {15, 16, 17};
    const int psw6[] = {18, 19, 20};
    const int pslive[] = {0, 1, 2};
    const int psextra[] = {21, 22, 23};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-2 4S";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-2 7S") == 0) {
    activePins.BTSW1 = 4;
    activePins.BTSW2 = 7;
    activePins.BTSW3 = 6;
    activePins.BTSW4 = 5;
    activePins.BTSW5 = 8;
    activePins.BTSW6 = 9;
    activePins.LIVE_MODE_PIN = 12;
    activePins.ENCODER_PIN_A = 21;
    activePins.ENCODER_PIN_B = 17;
    activePins.ENCODER_BUTTON_PIN = 34;
    activePins.TAP_FULL = 16;
    activePins.PIN_NEOPIXEL = 14;

    const int psw1[] = {3, 4, 5};
    const int psw2[] = {6, 7, 8};
    const int psw3[] = {9, 10, 11};
    const int psw4[] = {12, 13, 14};
    const int psw5[] = {15, 16, 17};
    const int psw6[] = {18, 19, 20};
    const int pslive[] = {0, 1, 2};
    const int psextra[] = {21, 22, 23};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-2 7S";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-2 NANO") == 0) {
    activePins.BTSW1 = 11;
    activePins.BTSW2 = 9;
    activePins.BTSW3 = 7;
    activePins.BTSW4 = 8;
    activePins.BTSW5 = 6;
    activePins.BTSW6 = 4;
    activePins.LIVE_MODE_PIN = -1;
    activePins.ENCODER_PIN_A = -1;
    activePins.ENCODER_PIN_B = -1;
    activePins.ENCODER_BUTTON_PIN = -1;
    activePins.TAP_FULL = -1;
    activePins.PIN_NEOPIXEL = 14; // Pino não especificado, usando um padrão.

    const int psw1[] = {0, 1, 2};
    const int psw2[] = {3, 4, 5};
    const int psw3[] = {6, 7, 8};
    const int psw4[] = {9, 10, 11};
    const int psw5[] = {12, 13, 14};
    const int psw6[] = {15, 16, 17};
    const int pslive[] = {-1, -1, -1};
    const int psextra[] = {-1, -1, -1};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-2 NANO";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-2 MICRO") == 0) {
    activePins.BTSW1 = 11;
    activePins.BTSW2 = 9;
    activePins.BTSW3 = 7;
    activePins.BTSW4 = 8;
    activePins.BTSW5 = 6;
    activePins.BTSW6 = 4;
    activePins.LIVE_MODE_PIN = -1;
    activePins.ENCODER_PIN_A = -1;
    activePins.ENCODER_PIN_B = -1;
    activePins.ENCODER_BUTTON_PIN = -1;
    activePins.TAP_FULL = -1;
    activePins.PIN_NEOPIXEL = 14; // Pino não especificado, usando um padrão.

    const int psw1[] = {0, 1, 2};
    const int psw2[] = {3, 4, 5};
    const int psw3[] = {6, 7, 8};
    const int psw4[] = {9, 10, 11};
    const int psw5[] = {12, 13, 14};
    const int psw6[] = {15, 16, 17};
    const int pslive[] = {-1, -1, -1};
    const int psextra[] = {-1, -1, -1};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_320x240;
    activePins.BOARD_VERSION = "BFMIDI-2 MICRO";
    return true;
  }

  // ==========================================================================
  // BFMIDI-3 boards (display 480x320)
  // ==========================================================================
  if (strcmp(boardName, "BFMIDI-3 NANO") == 0) {
    activePins.BTSW1 = 5;
    activePins.BTSW2 = 7;
    activePins.BTSW3 = 33;
    activePins.BTSW4 = 9;
    activePins.BTSW5 = 11;
    activePins.BTSW6 = 18;
    activePins.LIVE_MODE_PIN = -1;
    activePins.ENCODER_PIN_A = -1;
    activePins.ENCODER_PIN_B = -1;
    activePins.ENCODER_BUTTON_PIN = -1;
    activePins.TAP_FULL = -1;
    activePins.EXP = -1;
    activePins.PIN_NEOPIXEL = 14;

    const int psw1[] = {3, 4, 5};
    const int psw2[] = {6, 7, 8};
    const int psw3[] = {9, 10, 11};
    const int psw4[] = {0, 1, 2};
    const int psw5[] = {15, 16, 17};
    const int psw6[] = {12, 13, 14};
    const int pslive[] = {-1, -1, -1};
    const int psextra[] = {-1, -1, -1};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_480x320;
    activePins.BOARD_VERSION = "BFMIDI-3 NANO";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-3 6S") == 0) {
    activePins.BTSW1 = 5;
    activePins.BTSW2 = 7;
    activePins.BTSW3 = 33;
    activePins.BTSW4 = 9;
    activePins.BTSW5 = 11;
    activePins.BTSW6 = 18;
    activePins.LIVE_MODE_PIN = -1;
    activePins.ENCODER_PIN_A = -1;
    activePins.ENCODER_PIN_B = -1;
    activePins.ENCODER_BUTTON_PIN = -1;
    activePins.TAP_FULL = -1;
    activePins.EXP = 15;
    activePins.PIN_NEOPIXEL = 14;

    const int psw1[] = {3, 4, 5};
    const int psw2[] = {6, 7, 8};
    const int psw3[] = {9, 10, 11};
    const int psw4[] = {0, 1, 2};
    const int psw5[] = {15, 16, 17};
    const int psw6[] = {12, 13, 14};
    const int pslive[] = {-1, -1, -1};
    const int psextra[] = {-1, -1, -1};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_480x320;
    activePins.BOARD_VERSION = "BFMIDI-3 6S";
    return true;
  }

  if (strcmp(boardName, "BFMIDI-3 7S") == 0) {
    activePins.BTSW1 = 5;
    activePins.BTSW2 = 7;
    activePins.BTSW3 = 33;
    activePins.BTSW4 = 9;
    activePins.BTSW5 = 11;
    activePins.BTSW6 = 18;
    activePins.LIVE_MODE_PIN = 12;
    activePins.ENCODER_PIN_A = -1;
    activePins.ENCODER_PIN_B = -1;
    activePins.ENCODER_BUTTON_PIN = -1;
    activePins.TAP_FULL = 16;
    activePins.EXP = -1;
    activePins.PIN_NEOPIXEL = 14;

    const int psw4[] = {3, 4, 5};
    const int psw5[] = {6, 7, 8};
    const int psw6[] = {9, 10, 11};
    const int psw1[] = {12, 13, 14};
    const int psw2[] = {15, 16, 17};
    const int psw3[] = {18, 19, 20};
    const int pslive[] = {0, 1, 2};
    const int psextra[] = {21, 22, 23};

    boardCopyPixels(activePins.PIXELSW1, psw1);
    boardCopyPixels(activePins.PIXELSW2, psw2);
    boardCopyPixels(activePins.PIXELSW3, psw3);
    boardCopyPixels(activePins.PIXELSW4, psw4);
    boardCopyPixels(activePins.PIXELSW5, psw5);
    boardCopyPixels(activePins.PIXELSW6, psw6);
    boardCopyPixels(activePins.PIXELSLIVE, pslive);
    boardCopyPixels(activePins.PIXEL_EXTRATAP, psextra);
    activePins.DISPLAY_TYPE = DISPLAY_480x320;
    activePins.BOARD_VERSION = "BFMIDI-3 7S";
    return true;
  }

  return false;
}

#endif
