#ifndef DISPLAY_CONFIG_H
#define DISPLAY_CONFIG_H

#include <Arduino.h>
#include <SPI.h>
#include <hal/spi_types.h>

#define LGFX_USE_V1
#include <LovyanGFX.hpp>

using lgfx::fonts::FreeSans9pt7b;
using lgfx::fonts::FreeSans12pt7b;
using lgfx::fonts::FreeSans18pt7b;
using lgfx::fonts::FreeSans24pt7b;
using lgfx::fonts::FreeSansBold9pt7b;
using lgfx::fonts::FreeSansBold12pt7b;
using lgfx::fonts::FreeSansBold18pt7b;
using lgfx::fonts::FreeSansBold24pt7b;

// Escolhe ponteiro de fonte LGFX para (tamanho, bold). Tamanhos suportados:
// bold = {9,12,18,24}; regular = {12,18,24} (nao existe FreeSans9pt7b sem bold).
// Valores invalidos caem em 18pt do estilo correspondente.
static inline const lgfx::IFont *bfmidi_pick_font(int size, bool bold) {
  if (bold) {
    switch (size) {
      case 9:  return &FreeSansBold9pt7b;
      case 12: return &FreeSansBold12pt7b;
      case 24: return &FreeSansBold24pt7b;
      case 18:
      default: return &FreeSansBold18pt7b;
    }
  }
  switch (size) {
    case 12: return &FreeSans12pt7b;
    case 24: return &FreeSans24pt7b;
    case 18:
    default: return &FreeSans18pt7b;
  }
}

template <typename G>
static inline void bfmidi_apply_font(G &g, int size, bool bold) {
  g.setFont(bfmidi_pick_font(size, bold));
  g.setTextSize(1);
}

// =============================================================================
// DISPLAY_CONFIG.h — duas classes LGFX (uma por painel) instanciadas em runtime
// conforme a placa selecionada (ver BOARDS.h::DisplayVariant).
// =============================================================================

namespace bfmidi_display {

#if defined(CONFIG_IDF_TARGET_ESP32S3) || defined(CONFIG_IDF_TARGET_ESP32S2) ||  \
    defined(CONFIG_IDF_TARGET_ESP32C3)
static constexpr spi_host_device_t SPI_HOST = SPI2_HOST;
#else
static constexpr spi_host_device_t SPI_HOST = VSPI_HOST;
#endif

} // namespace bfmidi_display

// =============================================================================
// LGFX_320 — ST7789 320x240 (placas BFMIDI-1 e BFMIDI-2)
// =============================================================================
class LGFX_320 : public lgfx::LGFX_Device {
  lgfx::Bus_SPI _bus_instance;
  lgfx::Panel_ST7789 _panel_instance;

public:
  LGFX_320() {
    {
      auto cfg = _bus_instance.config();
      cfg.spi_host = bfmidi_display::SPI_HOST;
      cfg.spi_mode = 0;
      cfg.freq_write = 40000000;
      cfg.freq_read = 20000000;
      cfg.spi_3wire = false;
      cfg.use_lock = true;
      cfg.dma_channel = 0;
      cfg.pin_sclk = 36;
      cfg.pin_mosi = 35;
      cfg.pin_miso = -1;
      cfg.pin_dc = 37;
      _bus_instance.config(cfg);
      _panel_instance.setBus(&_bus_instance);
    }

    {
      auto cfg = _panel_instance.config();
      cfg.pin_cs = 38;
      cfg.pin_rst = -1;
      cfg.pin_busy = -1;
      cfg.memory_width = 240;
      cfg.memory_height = 320;
      cfg.panel_width = 240;
      cfg.panel_height = 320;
      cfg.offset_x = 0;
      cfg.offset_y = 0;
      cfg.offset_rotation = 0;
      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits = 1;
      cfg.readable = false;
      cfg.invert = false;
      cfg.rgb_order = false;
      cfg.dlen_16bit = false;
      cfg.bus_shared = true;
      _panel_instance.config(cfg);
    }

    setPanel(&_panel_instance);
  }
};

// =============================================================================
// LGFX_480 — ST7796S 480x320 (placas BFMIDI-3)
// =============================================================================
class LGFX_480 : public lgfx::LGFX_Device {
  lgfx::Bus_SPI _bus_instance;
  lgfx::Panel_ST7796 _panel_instance;

public:
  LGFX_480() {
    {
      auto cfg = _bus_instance.config();
      cfg.spi_host = bfmidi_display::SPI_HOST;
      cfg.spi_mode = 0;
      cfg.freq_write = 80000000;
      cfg.freq_read = 20000000;
      cfg.spi_3wire = false;
      cfg.use_lock = true;
      cfg.dma_channel = 0;
      cfg.pin_sclk = 38;
      cfg.pin_mosi = 36;
      cfg.pin_miso = -1;
      cfg.pin_dc = 21;
      _bus_instance.config(cfg);
      _panel_instance.setBus(&_bus_instance);
    }

    {
      auto cfg = _panel_instance.config();
      cfg.pin_cs = 17;
      cfg.pin_rst = 34;
      cfg.pin_busy = -1;
      cfg.memory_width = 320;
      cfg.memory_height = 480;
      cfg.panel_width = 320;
      cfg.panel_height = 480;
      cfg.offset_x = 0;
      cfg.offset_y = 0;
      cfg.offset_rotation = 0;
      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits = 1;
      cfg.readable = false;
      cfg.invert = false;
      cfg.rgb_order = false;
      cfg.dlen_16bit = false;
      cfg.bus_shared = true;
      _panel_instance.config(cfg);
    }

    setPanel(&_panel_instance);
  }
};

// Alias mantido para compatibilidade com declarações antigas (referências a
// TFT_eSPI passam a apontar para a base abstrata polimórfica).
using TFT_eSPI = lgfx::LGFX_Device;

#endif // DISPLAY_CONFIG_H
