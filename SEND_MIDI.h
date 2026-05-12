#ifndef SEND_MIDI_H
#define SEND_MIDI_H

#include <Arduino.h>

// =============================================================================
// SEND_MIDI.h — envio de mensagens MIDI em dois canais simultaneos:
//   1. Serial1 (DIN5 / TRS):  31250 baud 8N1, RX=GPIO2, TX=GPIO1.
//   2. USB MIDI (TinyUSB):     ESP32-S2 como USB MIDI device.
//
// REQUISITO DE BOARD CONFIG (Arduino IDE):
//   Tools -> USB Mode = "USB-OTG (TinyUSB)"
// Sem isso, os headers USB.h/USBMIDI.h nao existem; o modulo detecta via
// __has_include e desativa a parte USB (so envia pelo DIN5) sem quebrar build.
// O log de boot avisa qual caminho ficou ativo.
//
// CONVENCAO DO PROJETO:
//   - channel = 1..16  (interface do usuario)
//   - channel = 0      => slot desativado (helper retorna sem enviar)
//   - data1/data2 sao mascarados pra 7 bits (0..127) antes do envio.
//
// NOTA DE ARQUITETURA: este modulo emite os bytes MIDI BRUTOS para os valores
// recebidos. A traducao de "PC logico do preset" para a sequencia real de
// bytes (RAW PC vs Bank MSB+LSB+PC vs par de CCs vs sysex) NAO acontece aqui
// — vive em OutputProfile.channels[ch] (modulo futuro, ver memoria do
// projeto e comentarios em BANK_MEMORY.h). O chamador (ex: o renderer do
// preset) decide a sequencia de mensagens; este modulo so as transmite.
// =============================================================================

// Include incondicional: arduino-esp32 detecta a lib `USB` pelo scanner de
// #include literais e adiciona seu path. (`__has_include` nao dispara essa
// deteccao.) A lib existe no core 3.x; quando USB Mode = "USB-OTG (TinyUSB)"
// estiver ligado, CONFIG_TINYUSB_MIDI_ENABLED vira 1 e o class USBMIDI fica
// disponivel; caso contrario o symbol nao existe e SEND_MIDI_USB_AVAILABLE
// permanece desligado (so envia pelo DIN5).
#include "USB.h"
#include "USBMIDI.h"
#if defined(CONFIG_TINYUSB_MIDI_ENABLED) && CONFIG_TINYUSB_MIDI_ENABLED
  #define SEND_MIDI_USB_AVAILABLE 1
#endif

// Pinout DIN5 (fixo no hardware do projeto).
static constexpr uint32_t SEND_MIDI_SERIAL_BAUD = 31250;
static constexpr int      SEND_MIDI_SERIAL_RX_PIN = 2;
static constexpr int      SEND_MIDI_SERIAL_TX_PIN = 1;

#ifdef SEND_MIDI_USB_AVAILABLE
// Instancia global: o construtor registra a classe USB MIDI no descritor
// TinyUSB. Precisa existir antes de USB.begin() (que pode ocorrer em
// pre-setup quando "USB CDC On Boot = Enabled"), por isso vive no escopo
// global do header.
//
// Nome "BFMiDi" eh o que aparece para o host como interface MIDI.
static USBMIDI sendMidiUsb("BFMiDi");
#endif

static bool sendMidiInited = false;

// Inicializa Serial1 (DIN5) e USB MIDI (se disponivel).
// Chamar uma vez em setup() apos a config de log estar ativa.
static inline void send_midi_init() {
  if (sendMidiInited) {
    return;
  }

  // DIN5 — pinos 2/1 sao reservados a essa UART; nao usar pra mais nada.
  Serial1.begin(SEND_MIDI_SERIAL_BAUD, SERIAL_8N1,
                SEND_MIDI_SERIAL_RX_PIN, SEND_MIDI_SERIAL_TX_PIN);
  sys_log_i("midi", "DIN5 Serial1 %lu baud RX=%d TX=%d",
            (unsigned long)SEND_MIDI_SERIAL_BAUD,
            SEND_MIDI_SERIAL_RX_PIN, SEND_MIDI_SERIAL_TX_PIN);

#ifdef SEND_MIDI_USB_AVAILABLE
  // Descritor USB do device composto (CDC + MIDI). productName eh o que
  // aparece no host como "produto"; manufacturerName eh fabricante.
  USB.productName("BFMiDi");
  USB.manufacturerName("BFMiDi");
  sendMidiUsb.begin();
  // USB.begin() eh idempotente em arduino-esp32 3.x. Se "USB CDC On Boot"
  // estiver Enabled o stack ja subiu, a chamada extra so retorna; caso
  // contrario inicializa aqui.
  USB.begin();
  sys_log_i("midi", "USB MIDI ativo (TinyUSB) - BFMiDi");
#else
  sys_log_i("midi",
            "USB MIDI nao compilado (selecione USB-OTG TinyUSB no IDE)");
#endif

  sendMidiInited = true;
}

// ── Helpers de envio ─────────────────────────────────────────────────────
// Todos seguem a mesma estrutura: clamp do canal, mascara 7 bits dos dados,
// emite no Serial1 e (se disponivel) no USB. channel == 0 ou > 16 nao envia.

// API do USBMIDI no core arduino-esp32 3.x usa channel **1-based** (1..16)
// como ultimo argumento. Para o status byte do DIN5, ainda precisamos do
// nibble 0..15.
static inline void send_midi_pc(uint8_t channel, uint8_t program) {
  if (channel == 0 || channel > 16) {
    return;
  }
  const uint8_t ch0 = (uint8_t)(channel - 1);
  const uint8_t pgm = (uint8_t)(program & 0x7F);

  Serial1.write((uint8_t)(0xC0 | ch0));
  Serial1.write(pgm);

#ifdef SEND_MIDI_USB_AVAILABLE
  sendMidiUsb.programChange(pgm, channel);
#endif
}

static inline void send_midi_cc(uint8_t channel, uint8_t controller,
                                uint8_t value) {
  if (channel == 0 || channel > 16) {
    return;
  }
  const uint8_t ch0 = (uint8_t)(channel - 1);
  const uint8_t ctl = (uint8_t)(controller & 0x7F);
  const uint8_t val = (uint8_t)(value & 0x7F);

  Serial1.write((uint8_t)(0xB0 | ch0));
  Serial1.write(ctl);
  Serial1.write(val);

#ifdef SEND_MIDI_USB_AVAILABLE
  sendMidiUsb.controlChange(ctl, val, channel);
#endif
}

static inline void send_midi_note_on(uint8_t channel, uint8_t note,
                                     uint8_t velocity) {
  if (channel == 0 || channel > 16) {
    return;
  }
  const uint8_t ch0 = (uint8_t)(channel - 1);
  const uint8_t n   = (uint8_t)(note & 0x7F);
  const uint8_t v   = (uint8_t)(velocity & 0x7F);

  Serial1.write((uint8_t)(0x90 | ch0));
  Serial1.write(n);
  Serial1.write(v);

#ifdef SEND_MIDI_USB_AVAILABLE
  sendMidiUsb.noteOn(n, v, channel);
#endif
}

static inline void send_midi_note_off(uint8_t channel, uint8_t note,
                                      uint8_t velocity) {
  if (channel == 0 || channel > 16) {
    return;
  }
  const uint8_t ch0 = (uint8_t)(channel - 1);
  const uint8_t n   = (uint8_t)(note & 0x7F);
  const uint8_t v   = (uint8_t)(velocity & 0x7F);

  Serial1.write((uint8_t)(0x80 | ch0));
  Serial1.write(n);
  Serial1.write(v);

#ifdef SEND_MIDI_USB_AVAILABLE
  sendMidiUsb.noteOff(n, v, channel);
#endif
}

// Pitch bend: value em 0..16383 (centro = 8192). USBMIDI tem overload que
// aceita uint16_t no formato unsigned 14-bit (0..16383).
static inline void send_midi_pitch_bend(uint8_t channel, uint16_t value) {
  if (channel == 0 || channel > 16) {
    return;
  }
  const uint8_t ch0 = (uint8_t)(channel - 1);
  if (value > 16383) {
    value = 16383;
  }
  const uint8_t lsb = (uint8_t)(value & 0x7F);
  const uint8_t msb = (uint8_t)((value >> 7) & 0x7F);

  Serial1.write((uint8_t)(0xE0 | ch0));
  Serial1.write(lsb);
  Serial1.write(msb);

#ifdef SEND_MIDI_USB_AVAILABLE
  sendMidiUsb.pitchBend(value, channel);
#endif
}

#endif  // SEND_MIDI_H
