#ifndef SW_MODE_H
#define SW_MODE_H

#include <Arduino.h>

enum SwitchSystemMode : uint8_t {
  SWITCH_MODE_BANK = 0,
  SWITCH_MODE_LIVE = 1,
};

static inline const char *swModeName() {
  return currentSwitchMode == SWITCH_MODE_LIVE ? "LIVE" : "BANK";
}

static inline void swModeEnterBank() {
  currentSwitchMode = SWITCH_MODE_BANK;
  swBankRenderCurrent();
  sys_log_i("mode", "Modo BANK ativo: BANK %c%u", swBankLetter(),
            (unsigned)(swBankPresetIndexOrDefault() + 1));
}

static inline void swModeEnterLive() {
  if (activePresetIndex < 0) {
    activePresetIndex = 0;
  }

  currentSwitchMode = SWITCH_MODE_LIVE;
  swLiveRenderCurrent();
  sys_log_i("mode", "Modo LIVE ativo: LIVE %c%u", swBankLetter(),
            (unsigned)(swBankPresetIndexOrDefault() + 1));
}

static inline void swModeToggle() {
  if (currentSwitchMode == SWITCH_MODE_LIVE) {
    swModeEnterBank();
  } else {
    swModeEnterLive();
  }
}

static inline void swModeBegin() {
  liveModeButton.pin = activePins.LIVE_MODE_PIN;
  liveModeButton.mode = BUTTON_MOMENTARY;
  liveModeButton.debounceMs = SWITCH_DEBOUNCE_MS;
  beginButton(liveModeButton);

  if (activePins.LIVE_MODE_PIN >= 0) {
    sys_log_i("mode", "LIVE pin=%d, inicial=%s",
              activePins.LIVE_MODE_PIN, swModeName());
  } else {
    sys_log_i("mode", "LIVE disabled, inicial=%s", swModeName());
  }
}

static inline void wifiOverlayTick() {
  if (!wifiOverlayActive) {
    return;
  }
  if ((int32_t)(millis() - wifiOverlayUntilMs) < 0) {
    return;
  }
  wifiOverlayActive = false;
  if (currentSwitchMode == SWITCH_MODE_LIVE) {
    swLiveRenderCurrent();
  } else {
    swBankRenderCurrent();
  }
}

static inline void swModeUpdate() {
  updateButton(liveModeButton);
  if (wasPressed(liveModeButton)) {
    swModeToggle();
  }
}

#endif
