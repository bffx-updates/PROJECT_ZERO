#ifndef ALL_SWITCHES_H
#define ALL_SWITCHES_H

#include <Arduino.h>

enum ButtonMode : uint8_t {
  BUTTON_TOGGLE = 0,
  BUTTON_MOMENTARY = 1,
};

struct Button {
  int pin = -1;
  ButtonMode mode = BUTTON_TOGGLE;

  bool physicalState = HIGH;
  bool previousPhysicalState = HIGH;
  bool logicalState = false;

  bool lastRawReading = HIGH;
  uint32_t lastDebounceMs = 0;
  uint32_t pressedAtMs = 0;
  uint32_t lastReleaseMs = 0;

  uint8_t clickCount = 0;
  bool waitingSingleClick = false;
  bool longPressFired = false;

  uint32_t debounceMs = 25;
  uint32_t longPressMs = 800;
  uint32_t doubleClickMs = 350;

  bool pressedEvent = false;
  bool releasedEvent = false;
  bool singleClickEvent = false;
  bool doubleClickEvent = false;
  bool longPressEvent = false;
};

static inline void clearButtonEvents(Button &btn) {
  btn.pressedEvent = false;
  btn.releasedEvent = false;
  btn.singleClickEvent = false;
  btn.doubleClickEvent = false;
  btn.longPressEvent = false;
}

static inline void beginButton(Button &btn) {
  if (btn.pin < 0) {
    return;
  }

  pinMode(btn.pin, INPUT_PULLUP);

  const bool reading = digitalRead(btn.pin);
  btn.physicalState = reading;
  btn.previousPhysicalState = reading;
  btn.lastRawReading = reading;
  btn.logicalState = false;
  btn.lastDebounceMs = millis();
  btn.pressedAtMs = 0;
  btn.lastReleaseMs = 0;
  btn.clickCount = 0;
  btn.waitingSingleClick = false;
  btn.longPressFired = false;
  clearButtonEvents(btn);
}

static inline void updateButton(Button &btn) {
  if (btn.pin < 0) {
    return;
  }

  const uint32_t now = millis();
  const bool rawReading = digitalRead(btn.pin);

  if (rawReading != btn.lastRawReading) {
    btn.lastRawReading = rawReading;
    btn.lastDebounceMs = now;
  }

  if ((now - btn.lastDebounceMs) >= btn.debounceMs &&
      rawReading != btn.physicalState) {
    btn.previousPhysicalState = btn.physicalState;
    btn.physicalState = rawReading;

    if (btn.physicalState == LOW) {
      btn.pressedEvent = true;
      btn.pressedAtMs = now;
      btn.longPressFired = false;

      if (btn.mode == BUTTON_MOMENTARY) {
        btn.logicalState = true;
      }
    } else {
      btn.releasedEvent = true;

      if (btn.mode == BUTTON_MOMENTARY) {
        btn.logicalState = false;
      }

      if (!btn.longPressFired) {
        if (btn.clickCount == 0) {
          btn.clickCount = 1;
          btn.waitingSingleClick = true;
          btn.lastReleaseMs = now;
        } else if (btn.clickCount == 1 && btn.waitingSingleClick &&
                   (now - btn.lastReleaseMs) <= btn.doubleClickMs) {
          btn.doubleClickEvent = true;
          btn.waitingSingleClick = false;
          btn.clickCount = 0;
        } else {
          btn.clickCount = 1;
          btn.waitingSingleClick = true;
          btn.lastReleaseMs = now;
        }
      } else {
        btn.waitingSingleClick = false;
        btn.clickCount = 0;
      }
    }
  }

  if (btn.physicalState == LOW && !btn.longPressFired &&
      (now - btn.pressedAtMs) >= btn.longPressMs) {
    btn.longPressEvent = true;
    btn.longPressFired = true;
    btn.waitingSingleClick = false;
    btn.clickCount = 0;
  }

  if (btn.waitingSingleClick && btn.clickCount == 1 &&
      (now - btn.lastReleaseMs) > btn.doubleClickMs) {
    btn.singleClickEvent = true;
    btn.waitingSingleClick = false;
    btn.clickCount = 0;

    if (btn.mode == BUTTON_TOGGLE) {
      btn.logicalState = !btn.logicalState;
    }
  }
}

static inline bool wasPressed(Button &btn) {
  const bool event = btn.pressedEvent;
  btn.pressedEvent = false;
  return event;
}

static inline bool wasReleased(Button &btn) {
  const bool event = btn.releasedEvent;
  btn.releasedEvent = false;
  return event;
}

static inline bool wasSingleClicked(Button &btn) {
  const bool event = btn.singleClickEvent;
  btn.singleClickEvent = false;
  return event;
}

static inline bool wasDoubleClicked(Button &btn) {
  const bool event = btn.doubleClickEvent;
  btn.doubleClickEvent = false;
  return event;
}

static inline bool wasLongPressed(Button &btn) {
  const bool event = btn.longPressEvent;
  btn.longPressEvent = false;
  return event;
}

static inline bool isButtonOn(Button &btn) {
  return btn.logicalState;
}

#ifdef ALL_SWITCHES_EXAMPLE

Button toggleButton = {
    .pin = 5,
    .mode = BUTTON_TOGGLE,
};

Button momentaryButton = {
    .pin = 7,
    .mode = BUTTON_MOMENTARY,
};

static inline void printButtonEvents(const char *name, Button &btn) {
  bool hadEvent = false;

  if (wasPressed(btn)) {
    Serial.printf("%s: Press\n", name);
    hadEvent = true;
  }
  if (wasReleased(btn)) {
    Serial.printf("%s: Release\n", name);
    hadEvent = true;
  }
  if (wasSingleClicked(btn)) {
    Serial.printf("%s: Single Click\n", name);
    hadEvent = true;
  }
  if (wasDoubleClicked(btn)) {
    Serial.printf("%s: Double Click\n", name);
    hadEvent = true;
  }
  if (wasLongPressed(btn)) {
    Serial.printf("%s: Long Press\n", name);
    hadEvent = true;
  }

  if (hadEvent) {
    Serial.printf("%s: %s\n", name, isButtonOn(btn) ? "ON" : "OFF");
  }
}

void setup() {
  Serial.begin(115200);
  beginButton(toggleButton);
  beginButton(momentaryButton);
}

void loop() {
  updateButton(toggleButton);
  updateButton(momentaryButton);

  printButtonEvents("TOGGLE", toggleButton);
  printButtonEvents("MOMENTARY", momentaryButton);
}

#endif

#endif
