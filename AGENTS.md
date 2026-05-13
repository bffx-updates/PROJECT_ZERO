# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

BFMIDI Project Zero — firmware for an ESP32-S2 MIDI footswitch controller with TFT display, NeoPixel ring, on-device WebServer, and a companion desktop web editor. Code, comments and logs are in **Portuguese**; preserve that when editing.

The repository sits inside an Arduino IDE *portable sketchbook* (`D:/ARDUINO ESP32 CORE 3x/portable/sketchbook/`). The toolchain (compiler, ESP32 core, libraries) lives in the parent `portable/` tree, not here.

## Build / flash / run

There is no Makefile or CLI build script. Build with the **Arduino IDE** (or `arduino-cli`) using:
- **Board**: ESP32-S2 (`CONFIG_IDF_TARGET_ESP32S2` is required — see [BFMIDI_PROJECT_ZERO.ino:12-14](BFMIDI_PROJECT_ZERO.ino:12)).
- **Partition scheme**: custom — must use [partitions.csv](partitions.csv) (defines a `storage` partition, subtype `0x83`, at `0x310000`, size `0xF0000`, that LittleFS mounts).
- **Filesystem**: upload [data/](data/) to LittleFS using the ESP32 LittleFS uploader plugin (the `data/` HTML/CSS/JS files are served by the on-device WebServer at runtime — without uploading, every HTTP route returns 404).

There is no test suite, no linter config, and no package manager.

### Running the desktop webApp editor

Two Windows .bat helpers launch a local Python `http.server` and open the React editor in the browser:
- [abrir_webApp.bat](abrir_webApp.bat) — opens [webApp/BFMIDI webApp.html](webApp/BFMIDI%20webApp.html) without a target API.
- [abrir_BFMIDI_STA.bat](abrir_BFMIDI_STA.bat) `<device-ip>` — same, but appends `?api=http://<ip>` so the editor talks to a device on the LAN. Default IP `192.168.100.123` if no arg.

Both pick a random port in `[20000, 50000]` and require `py` or `python` on PATH. [webApp/serve_webapp.py](webApp/serve_webapp.py) is a cross-platform equivalent.

## Architecture

### Firmware (one .ino + header-only modules)

[BFMIDI_PROJECT_ZERO.ino](BFMIDI_PROJECT_ZERO.ino) is the single translation unit. It `#include`s a set of `.h` files that are **not** traditional headers — they contain `static inline` definitions and rely on globals declared earlier in the .ino. **Order of includes is load-bearing**: `ALL_SWITCHES.h`, `BOARDS.h`, `DISPLAY_CONFIG.h`, `GLOBAL_CONFIG.h` come first (types + globals), then both `DISPLAY_320.h` and `DISPLAY_480.h` (their inline functions live in namespaces `dsp320::` / `dsp480::`, so both can coexist). After `setup()`-time globals like `tft`, `activePins`, `bankButtons`, `activeBankLetterIndex`, `activePresetIndex` and the `welcome_screen`/`draw_bank_screen`/`draw_live_screen` function-pointer dispatch table exist, the .ino includes `BANK_MEMORY.h`, `LED_STRIP.h`, `NET_WIFI.h`, `SW_BANK.h`, `SW_LIVE.h`, `SW_MODE.h`, `WEB_SERVER.h`. `WEB_SERVER.h` itself then pulls in `WEB_API_WIFI.h`, `WEB_API_BANK.h`, `WEB_API_CONFIG.h`, `WEB_UPLOAD.h` (those depend on `webServer`, `webJsonBuf`, the bank/config helpers and the swBank* API). Reordering or moving symbols across files will break compilation.

Modules and their role:
- [BOARDS.h](BOARDS.h) — `PinoutConfig` struct + `loadBoardPins(...)` lookup. Holds the unified list of all 12 hardware variants (BFMIDI-1 / BFMIDI-2 / BFMIDI-3 families). Each entry sets a `DisplayVariant DISPLAY_TYPE` field (`DISPLAY_320x240` for BFMIDI-1/2, `DISPLAY_480x320` for BFMIDI-3) that drives the runtime display selection. Default fallback is `"BFMIDI-3 7S"` (`DEFAULT_BOARD_NAME` in [GLOBAL_CONFIG.h](GLOBAL_CONFIG.h)). Selected by name from `globalBoardName` and persisted via global config.
- [DISPLAY_CONFIG.h](DISPLAY_CONFIG.h) — defines two LovyanGFX driver classes, `LGFX_320` (Panel_ST7789, 320x240, BFMIDI-1/2 SPI pins) and `LGFX_480` (Panel_ST7796, 480x320, BFMIDI-3 SPI pins), both deriving from `lgfx::LGFX_Device`. The display is **selected at runtime** in `display_init()` based on `activePins.DISPLAY_TYPE` — there is no compile-time `BFMIDI3` switch anymore. The global `tft` is `lgfx::LGFX_Device*` (heap-allocated with the chosen subclass), `canvas` is an `LGFX_Sprite` whose parent is bound after `tft` is created, and the dispatch pointers `welcome_screen`/`draw_bank_screen`/`draw_live_screen` are bound to the matching `dsp320::` or `dsp480::` namespace functions. `using TFT_eSPI = lgfx::LGFX_Device;` is kept as an alias for legacy declarations.
- [GLOBAL_CONFIG.h](GLOBAL_CONFIG.h) — LED color palette, brightness, board name, auto-start preset/bank/mode, bank-letter enable mask, bank-change behavior (`HIBRIDO`/`SINGLE`), plus parser/writer for `/global_config.txt` on LittleFS. Format is one `key=value` per line; see [data/global_config.txt](data/global_config.txt) for the schema.
- [BANK_MEMORY.h](BANK_MEMORY.h) — persistent preset slots for the 5 letters × 6 presets (`bankMemory[30]`, each entry holds a 2-char tag like `A1` and a 96-char `data` string). Parser/writer for `/bank_memory.txt` on LittleFS, accessor `bankMemoryCurrent()` keyed by `activeBankLetterIndex` / `activePresetIndex`.
- [ALL_SWITCHES.h](ALL_SWITCHES.h) — `Button` struct with debounce, single/double/long-click event flags, and `beginButton`/`updateButton` helpers used by all switch modules.
- [LED_STRIP.h](LED_STRIP.h) — drives the WS2812 NeoPixel ring (`BOARD_NEOPIXEL_COUNT = 24`).
- [NET_WIFI.h](NET_WIFI.h) — runs an AP (`BFMIDI_WIFI` / `bfmidi@editor`, IP `192.168.4.1`) and optional STA (credentials persisted in `/wifi_sta.txt` on LittleFS, written by `/wifi/connect`). **WiFi is OFF at boot.** The user toggles it via the **SW2+SW3 combo** (handled in `swWifiToggleComboUpdate()` in [SW_BANK.h](SW_BANK.h), works in both BANK and LIVE modes). Lifecycle: `wifi_setup_once()` runs at boot to load saved STA creds and set `WiFi.mode(WIFI_OFF)`; the combo calls `wifi_start()` (brings up AP + STA + mDNS) or `wifi_stop()` (`WiFi.softAPdisconnect`, `WiFi.disconnect`, `WiFi.mode(WIFI_OFF)`) cyclically. `WiFi.useStaticBuffers(false)` lets Wi-Fi/lwIP RX/TX buffers land in PSRAM. The `wifiActive` flag tracks state.
- [WEB_SERVER.h](WEB_SERVER.h) — ESP32 `WebServer` on port 80. Serves `data/` files (`/`, `/bank`, `/global`, `/system`, `/upload`, `/app.css`, `/app.js`) and orchestrates the JSON API by including `WEB_API_WIFI.h`, `WEB_API_BANK.h`, `WEB_API_CONFIG.h`, `WEB_UPLOAD.h`. **Tied to the WiFi lifecycle**: `web_setup_once()` (boot) allocates `webJsonBuf` and registers all routes; `web_start()` / `web_stop()` open/close the listening socket and are called by the SW2+SW3 combo alongside `wifi_start()` / `wifi_stop()`. `web_update()` skips `handleClient()` while `webServerActive` is false. `webJsonBuf` is a single 4 KB JSON response buffer allocated in PSRAM by `web_alloc_json_buf()` (falls back to internal heap) and shared by every handler; safe because `WebServer` is single-thread via `handleClient()` in `loop()`. CORS is wide open (`*`) — the desktop editor depends on this when run from a different origin.
- [WEB_API_CONFIG.h](WEB_API_CONFIG.h) — `/config/global` (GET/POST/OPTIONS): exposes the full board/colors/auto-start/bank-change config and applies form updates with runtime side-effects (`leds.setBrightness`, re-render current screen, schedule restart on board change).
- [WEB_API_BANK.h](WEB_API_BANK.h) — `/bank/current` (GET/POST/OPTIONS): returns the active bank entry; if `bank=A1` (or `bank_letter=` + `preset_number=`) is supplied, switches the active preset via `swBankSet(...)` first.
- [WEB_API_WIFI.h](WEB_API_WIFI.h) — `/wifi/status`, `/wifi/scan`, `/wifi/connect`, `/wifi/disconnect` (each with OPTIONS); `connect` persists creds via `wifi_sta_save` and schedules a restart so AP+STA mode reapplies cleanly.
- [WEB_UPLOAD.h](WEB_UPLOAD.h) — `/upload` GET serves the page; POST streams chunks to LittleFS at `?path=/...` (path validation: must start with `/`, no `..`, no `\`, fits in `webUploadPath[64]`).
- [SW_BANK.h](SW_BANK.h), [SW_LIVE.h](SW_LIVE.h), [SW_MODE.h](SW_MODE.h) — bank-switching vs live-mode behavior. `currentSwitchMode` (a global in the .ino) is the dispatch key in `loop()`.

`setup()` order: serial → boot banner → LittleFS mount (formats on failure) → load global config → load bank memory → board init → `wifi_setup_once()` (loads STA creds, leaves radio OFF) → `web_setup_once()` (registers routes, allocates `webJsonBuf` in PSRAM) → LEDs → display (allocates canvas in PSRAM) → switches → auto-start → resources log. `loop()` is `web_update(); swModeUpdate();` then dispatches to `swLiveUpdate()` or `swBankUpdate()` — both check the SW2+SW3 combo to bring WiFi/Web up or down on demand.

### Filesystem layout (LittleFS)

[data/](data/) is the LittleFS image. `index.html`, `bank.html`, `global.html`, `system.html`, `upload.html`, `app.css`, `app.js` make up the **on-device** UI served by `WEB_SERVER.h`. `global_config.txt` is the persisted configuration; the firmware also writes `/wifi_sta.txt` here at runtime.

### Desktop editor ([webApp/](webApp/))

A separate React app, distinct from the on-device UI. Loads React 18 + Babel-standalone from unpkg; sources are JSX (`app.jsx`, `components.jsx`, `preset-leds.jsx`, `themes.jsx`, `tweaks-panel.jsx`) transpiled in the browser — there is no bundler. The editor talks to the firmware via the same HTTP/JSON endpoints in `WEB_SERVER.h`, using the `?api=...` query param set by `abrir_BFMIDI_STA.bat`. [webApp/original/](webApp/original/) holds reference copies of the on-device pages — do not confuse with the live `data/` versions.

## Conventions

- Headers use include guards (`#ifndef X_H ... #endif`) and `static inline` functions; do not convert them to .cpp files.
- Logs go through `sys_log_i(tag, fmt, ...)` (defined in the .ino) and follow ESP-IDF style `I (millis) tag: msg`. Match this format when adding logs.
- Error messages and UI strings are in Portuguese; keep new strings consistent with that.
- Don't change `partitions.csv` casually — the `storage` partition's offset/size/subtype is hard-coded in [BFMIDI_PROJECT_ZERO.ino:131-133](BFMIDI_PROJECT_ZERO.ino:131) (`FS_PARTITION_LABEL`, subtype `0x83`).

### PSRAM-first allocation (mandatory for new code)

ESP32-S2 boards in this project ship with PSRAM. **Internal SRAM (~320 KB total) is contended** by the Wi-Fi/lwIP stack, ISR handlers, DMA buffers and the FreeRTOS task stacks (the `WebServer` task default is ~8 KB) — preserve it for things that genuinely need fast access. Anything else should land in PSRAM.

Allocations to model new code on:
- `canvas` (`LGFX_Sprite`, up to 480×320×2 = 307 KB) — see `display_canvas_init()` in [BFMIDI_PROJECT_ZERO.ino](BFMIDI_PROJECT_ZERO.ino:194), which calls `canvas->setPsram(true)` before `createSprite()` and falls back to direct-to-panel drawing if PSRAM is missing.
- `webJsonBuf` (4 KB, shared JSON response buffer) — see `web_alloc_json_buf()` in [WEB_SERVER.h](WEB_SERVER.h), which calls `heap_caps_malloc(WEB_JSON_BUF_SIZE, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)`, falls back to `malloc()` and logs which area was used.
- Wi-Fi/lwIP buffers — `wifi_setup_once()` calls `WiFi.useStaticBuffers(false)` so the IDF can place RX/TX buffers in PSRAM when configured (only relevant once the user toggles WiFi on via SW2+SW3).

Rules for any new feature:
1. **Buffers ≥ 1 KB MUST go to PSRAM.** Use `heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)` (or `MALLOC_CAP_SPIRAM | MALLOC_CAP_32BIT` for 4-byte-aligned data). Mirror the `web_alloc_json_buf()` pattern: try PSRAM, fall back to `malloc()` if it returns null, and log which path was taken with `sys_log_i`.
2. **No stack buffers > 512 bytes** inside any function called from `webServer.on(...)` handlers, the WiFi/event task, or any deep call chain. Promote them to a static PSRAM-backed buffer reused across calls; the `WebServer` is single-thread (`handleClient()` runs in `loop()`), so sharing one buffer is safe — keep it that way unless you introduce true concurrency.
3. **For LovyanGFX sprites or any new graphics buffer, always call `setPsram(true)` before `createSprite(...)`.**
4. **Keep in internal SRAM** (do NOT move to PSRAM): ISR handlers and any data they touch, DMA-targeted buffers, the NeoPixel pixel array (`Adafruit_NeoPixel` internal buffer, used in tight WS2812 timing), hot-loop state (`bankButtons`, `liveModeButton`, `activePins`, `currentSwitchMode`, `activeBankLetterIndex`, `activePresetIndex`), small parser scratch (`char line[~128]` inside loaders), short string fields (SSID/password/path buffers).
5. **Never** put pointers to stack memory into PSRAM-shared structures, and never share a PSRAM buffer between an ISR and main code without explicit synchronization.
6. The boot log already prints a `RECURSOS` summary (FLASH / HEAP / PSRAM / FS). Use it to verify your allocations land where intended; if PSRAM free does not drop after your feature initializes, your buffer is in the wrong place.
