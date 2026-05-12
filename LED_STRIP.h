#ifndef LED_STRIP_H
#define LED_STRIP_H

#include <Arduino.h>
#include <new>

static inline uint32_t ledStripColorFromIndex(uint8_t colorIndex) {
  LedRGBColor color = globalLedColor(colorIndex);
  return leds.Color(color.r, color.g, color.b);
}

static inline void ledStripClear() {
  leds.clear();
  leds.show();
}

static inline void ledStripFill(uint32_t color) {
  for (uint16_t i = 0; i < LED_WS2812_COUNT; i++) {
    leds.setPixelColor(i, color);
  }
  leds.show();
}

static inline void ledStripSetPixels(const int pixels[3], uint32_t color) {
  if (!pixels) {
    return;
  }

  for (uint8_t i = 0; i < 3; i++) {
    if (pixels[i] >= 0 && pixels[i] < LED_WS2812_COUNT) {
      leds.setPixelColor((uint16_t)pixels[i], color);
    }
  }
}

static inline void ledStripBootTest() {
  ledStripFill(leds.Color(255, 0, 0));
  delay(120);
  ledStripFill(leds.Color(0, 255, 0));
  delay(120);
  ledStripFill(leds.Color(0, 0, 255));
  delay(120);
  ledStripClear();
}

static inline void ledStripBegin() {
  if (activePins.PIN_NEOPIXEL < 0) {
    sys_log_i("leds", "desabilitado: PIN_NEOPIXEL=-1");
    return;
  }

  new (&leds) Adafruit_NeoPixel(LED_WS2812_COUNT, activePins.PIN_NEOPIXEL,
                                NEO_GRB + NEO_KHZ800);
  leds.begin();
  leds.setBrightness(globalLedBrightness);
  ledStripClear();
  ledStripBootTest();
  sys_log_i("leds", "test ok");
}

static inline void ledStripShowBank(uint8_t switchIndex) {
  leds.clear();

  const int *pixels = nullptr;
  switch (switchIndex) {
  case 0:
    pixels = activePins.PIXELSW1;
    break;
  case 1:
    pixels = activePins.PIXELSW2;
    break;
  case 2:
    pixels = activePins.PIXELSW3;
    break;
  case 3:
    pixels = activePins.PIXELSW4;
    break;
  case 4:
    pixels = activePins.PIXELSW5;
    break;
  case 5:
    pixels = activePins.PIXELSW6;
    break;
  default:
    break;
  }

  uint8_t colorIndex = DEFAULT_BANK_LED_COLOR_INDEX;
  if (globalLedColorMode == LED_COLOR_MODE_SWITCHES) {
    const uint8_t safeSwitchIndex =
        switchIndex < BANK_SWITCH_COUNT ? switchIndex : 0;
    colorIndex = globalSwitchLedColorIndex[safeSwitchIndex];
  } else {
    const uint8_t letterIndex =
        activeBankLetterIndex < BANK_LETTER_COUNT ? activeBankLetterIndex : 0;
    colorIndex = globalLetterLedColorIndex[letterIndex];
  }

  ledStripSetPixels(pixels, ledStripColorFromIndex(colorIndex));
  leds.show();
}

static inline void ledStripShowLive() {
  leds.clear();
  ledStripSetPixels(activePins.PIXELSLIVE,
                    ledStripColorFromIndex(globalLiveLedColorIndex));
  leds.show();
}

#endif
