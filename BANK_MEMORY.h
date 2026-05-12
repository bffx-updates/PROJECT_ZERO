#ifndef BANK_MEMORY_H
#define BANK_MEMORY_H

#include <Arduino.h>

static constexpr uint8_t BANK_MEMORY_LETTERS = 5;
static constexpr uint8_t BANK_MEMORY_PRESETS = 6;
static constexpr uint8_t BANK_MEMORY_COUNT =
    BANK_MEMORY_LETTERS * BANK_MEMORY_PRESETS;
static constexpr uint8_t BANK_MEMORY_VERSION = 2;
static const char BANK_MEMORY_FILE[] = "/bank_memory.txt";

// Tamanhos do schema v2 (key=value separados por '|' dentro de data).
// Limites espelham o webApp: name <=16, bank MIDI 0..16383, channel 0..16
// (0 = MUTE), cores 0..4 da paleta BG_COLORS.
static constexpr size_t BANK_MEMORY_NAME_MAX = 16;
// Bumpado de 160 -> 256 para acomodar extras (4 PCs + 2 CCs em formato
// compacto). Próximos passos (switches) provavelmente exigem migração
// para JSON-per-preset em /banks/<tag>.json.
static constexpr size_t BANK_MEMORY_DATA_SIZE = 256;
static constexpr size_t BANK_MEMORY_LINE_SIZE = 288;

struct BankMemoryEntry {
  char tag[3];
  char data[BANK_MEMORY_DATA_SIZE];
};

static BankMemoryEntry bankMemory[BANK_MEMORY_COUNT];

static inline uint8_t bankMemoryIndex(uint8_t bankLetterIndex,
                                      uint8_t presetIndex) {
  if (bankLetterIndex >= BANK_MEMORY_LETTERS) {
    bankLetterIndex = 0;
  }
  if (presetIndex >= BANK_MEMORY_PRESETS) {
    presetIndex = 0;
  }
  return (uint8_t)(bankLetterIndex * BANK_MEMORY_PRESETS + presetIndex);
}

static inline void bankMemoryTag(uint8_t bankLetterIndex, uint8_t presetIndex,
                                 char target[3]) {
  target[0] = (char)('A' + bankLetterIndex);
  target[1] = (char)('1' + presetIndex);
  target[2] = '\0';
}

static inline char *bankMemoryTrim(char *text) {
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

static inline bool bankMemoryParseTag(const char *tag, uint8_t &letterIndex,
                                      uint8_t &presetIndex) {
  if (!tag || strlen(tag) != 2) {
    return false;
  }

  if (tag[0] < 'A' || tag[0] >= (char)('A' + BANK_MEMORY_LETTERS)) {
    return false;
  }

  if (tag[1] < '1' || tag[1] >= (char)('1' + BANK_MEMORY_PRESETS)) {
    return false;
  }

  letterIndex = (uint8_t)(tag[0] - 'A');
  presetIndex = (uint8_t)(tag[1] - '1');
  return true;
}

// Schema v2 default. IDs de cor referem-se a DISPLAY_PALETTE (DISPLAY_COLORS.h):
//   0  = TRANSPARENT ("Sem Cor")
//   4  = SOLID Branco
//   11 = SOLID Laranja
// Defaults: name_color=4 (branco), bg_color=0 (transparente -> preto na tela
// cheia), back_layers_color=0 (sem camada), tag_color=11 (laranja).
// Fonte default: FreeSans18pt7b (regular). Parser tolerante: campos ausentes
// em arquivos antigos caem no default.
//
// ── Convencao MIDI (header do preset) ───────────────────────────────────
//
// Os campos `bank` (PC principal), `extra_pcs` e `extra_ccs` armazenam
// VALORES LOGICOS — nao a sequencia de bytes MIDI que sai do cabo.
// Encoding fisico (RAW PC vs Bank MSB+LSB+PC vs par de CCs vs sysex)
// pertence a uma estrutura futura `OutputProfile.channels[16]`, configurada
// fora do preset (por canal MIDI). Ao trocar de pedal-alvo, ajusta-se o
// profile do canal — nenhum preset precisa mudar.
//
// Exemplo: preset diz "PC=42 no canal 1"; se canal 1 estiver em
//   PC_ENC_RAW       -> Program Change(42)
//   PC_ENC_BANK_FULL -> CC#0(msb), CC#32(lsb), PC(42 & 0x7F)
//   PC_ENC_CC_PAIR   -> CC#A(valor1), CC#B(valor2)   (programa interpretado
//                      como par de valores)
// O OutputProfile entra quando o modulo de envio MIDI for implementado.
static inline void bankMemoryResetDefaults() {
  for (uint8_t letter = 0; letter < BANK_MEMORY_LETTERS; letter++) {
    for (uint8_t presetIndex = 0; presetIndex < BANK_MEMORY_PRESETS;
         presetIndex++) {
      const uint8_t index = bankMemoryIndex(letter, presetIndex);
      bankMemoryTag(letter, presetIndex, bankMemory[index].tag);
      snprintf(bankMemory[index].data, sizeof(bankMemory[index].data),
               "name=|enabled=1|bank=0|channel=1|name_color=4|"
               "name_border_color=0|bg_color=0|"
               "back_layers_color=0|tag_color=11|font_size=18|font_bold=0|"
               "name_align=4|extra_pcs=0:0,0:0,0:0,0:0|"
               "extra_ccs=0:0:0,0:0:0");
    }
  }
}

// ── Acessores de campo dentro de entry.data (formato key=value|...) ────
// Tolerante a chaves ausentes (retorna default) — assim arquivos v1 com
// apenas "name=A1|enabled=1" continuam funcionando: os campos novos
// assumem o default ao serem lidos.
static inline bool bankMemoryFindField(const char *data, const char *key,
                                       const char *&valueStart,
                                       size_t &valueLen) {
  if (!data || !key) {
    return false;
  }
  const size_t keyLen = strlen(key);
  const char *cursor = data;
  while (*cursor) {
    const char *eq = strchr(cursor, '=');
    if (!eq) {
      return false;
    }
    const size_t segKeyLen = (size_t)(eq - cursor);
    const char *end = strchr(eq + 1, '|');
    const char *valEnd = end ? end : (eq + 1 + strlen(eq + 1));
    if (segKeyLen == keyLen && strncmp(cursor, key, keyLen) == 0) {
      valueStart = eq + 1;
      valueLen = (size_t)(valEnd - valueStart);
      return true;
    }
    if (!end) {
      return false;
    }
    cursor = end + 1;
  }
  return false;
}

static inline void bankMemoryGetField(const char *data, const char *key,
                                      char *out, size_t outSize,
                                      const char *defaultValue) {
  if (!out || outSize == 0) {
    return;
  }
  const char *valueStart = nullptr;
  size_t valueLen = 0;
  if (bankMemoryFindField(data, key, valueStart, valueLen)) {
    const size_t copyLen = valueLen < outSize - 1 ? valueLen : outSize - 1;
    memcpy(out, valueStart, copyLen);
    out[copyLen] = '\0';
    return;
  }
  if (defaultValue) {
    strncpy(out, defaultValue, outSize - 1);
    out[outSize - 1] = '\0';
  } else {
    out[0] = '\0';
  }
}

static inline long bankMemoryGetFieldInt(const char *data, const char *key,
                                         long defaultValue) {
  char buf[16];
  bankMemoryGetField(data, key, buf, sizeof(buf), nullptr);
  if (buf[0] == '\0') {
    return defaultValue;
  }
  char *end = nullptr;
  long v = strtol(buf, &end, 10);
  if (end == buf) {
    return defaultValue;
  }
  return v;
}

// Sanitiza um valor antes de gravar: remove os separadores '|' e '=' e
// quebras de linha. Garante que o key=value|... continue parseavel.
static inline void bankMemorySanitizeValue(char *value) {
  if (!value) {
    return;
  }
  size_t w = 0;
  for (size_t r = 0; value[r] != '\0'; r++) {
    char c = value[r];
    if (c == '|' || c == '=' || c == '\r' || c == '\n') {
      continue;
    }
    value[w++] = c;
  }
  value[w] = '\0';
}

// Atualiza (ou insere) um campo em entry.data preservando os demais e
// mantendo a ordem original quando ja existia. Retorna false se o buffer
// destino estouraria.
static inline bool bankMemorySetField(BankMemoryEntry &entry, const char *key,
                                      const char *value) {
  if (!key || !value) {
    return false;
  }

  char source[BANK_MEMORY_DATA_SIZE];
  strncpy(source, entry.data, sizeof(source) - 1);
  source[sizeof(source) - 1] = '\0';

  char out[BANK_MEMORY_DATA_SIZE];
  size_t outLen = 0;
  out[0] = '\0';

  const size_t keyLen = strlen(key);
  const size_t valueLen = strlen(value);
  bool replaced = false;

  char *cursor = source;
  while (*cursor) {
    char *end = strchr(cursor, '|');
    if (end) {
      *end = '\0';
    }

    char *eq = strchr(cursor, '=');
    const bool match = (eq && (size_t)(eq - cursor) == keyLen &&
                        strncmp(cursor, key, keyLen) == 0);

    if (outLen > 0) {
      if (outLen + 1 >= sizeof(out)) {
        return false;
      }
      out[outLen++] = '|';
      out[outLen] = '\0';
    }

    if (match) {
      if (outLen + keyLen + 1 + valueLen >= sizeof(out)) {
        return false;
      }
      memcpy(out + outLen, key, keyLen);
      outLen += keyLen;
      out[outLen++] = '=';
      memcpy(out + outLen, value, valueLen);
      outLen += valueLen;
      out[outLen] = '\0';
      replaced = true;
    } else {
      const size_t segLen = strlen(cursor);
      if (outLen + segLen >= sizeof(out)) {
        return false;
      }
      memcpy(out + outLen, cursor, segLen);
      outLen += segLen;
      out[outLen] = '\0';
    }

    if (!end) {
      break;
    }
    cursor = end + 1;
  }

  if (!replaced) {
    if (outLen > 0) {
      if (outLen + 1 >= sizeof(out)) {
        return false;
      }
      out[outLen++] = '|';
    }
    if (outLen + keyLen + 1 + valueLen >= sizeof(out)) {
      return false;
    }
    memcpy(out + outLen, key, keyLen);
    outLen += keyLen;
    out[outLen++] = '=';
    memcpy(out + outLen, value, valueLen);
    outLen += valueLen;
    out[outLen] = '\0';
  }

  strncpy(entry.data, out, sizeof(entry.data) - 1);
  entry.data[sizeof(entry.data) - 1] = '\0';
  return true;
}

static inline bool bankMemorySetFieldInt(BankMemoryEntry &entry,
                                         const char *key, long value) {
  char buf[16];
  snprintf(buf, sizeof(buf), "%ld", value);
  return bankMemorySetField(entry, key, buf);
}

// Resolve o nome efetivo exibido no display: campo `name` quando preenchido,
// caso contrario o tag (ex.: "A1"). Saida sempre null-terminated.
static inline void bankMemoryDisplayName(const BankMemoryEntry &entry,
                                         char *out, size_t outSize) {
  if (!out || outSize == 0) {
    return;
  }
  bankMemoryGetField(entry.data, "name", out, outSize, "");
  if (out[0] == '\0') {
    strncpy(out, entry.tag, outSize - 1);
    out[outSize - 1] = '\0';
  }
}

// Resolve um ID de cor da paleta DISPLAY_PALETTE (DISPLAY_COLORS.h) para
// RGB565. Fase 1: tudo cai pra SOLID (cor base). Fase 2 vai aplicar tipo
// e direcao no renderer.
static inline uint16_t bankMemoryColorRgb565(long id) {
  return display_color_resolve_solid(id);
}

// Compoe o rotulo da tela TFT para um preset. Se houver nome customizado,
// usa apenas o nome; caso contrario imprime "<prefix> <tag>" (ex.:
// "BANK A1" ou "LIVE C4"). Saida null-terminated.
static inline void bankMemoryScreenLabel(const BankMemoryEntry &entry,
                                         const char *prefix, char *out,
                                         size_t outSize) {
  if (!out || outSize == 0) {
    return;
  }
  char nameBuf[BANK_MEMORY_NAME_MAX + 1];
  bankMemoryGetField(entry.data, "name", nameBuf, sizeof(nameBuf), "");
  if (nameBuf[0] != '\0') {
    strncpy(out, nameBuf, outSize - 1);
    out[outSize - 1] = '\0';
  } else {
    snprintf(out, outSize, "%s %s", prefix ? prefix : "", entry.tag);
  }
}

static inline bool bankMemorySave() {
  File file = LittleFS.open(BANK_MEMORY_FILE, "w");
  if (!file) {
    return false;
  }

  file.printf("version=%u\n", (unsigned)BANK_MEMORY_VERSION);
  for (uint8_t i = 0; i < BANK_MEMORY_COUNT; i++) {
    file.printf("%s|%s\n", bankMemory[i].tag, bankMemory[i].data);
  }

  file.close();
  return true;
}

static inline bool bankMemoryLoad() {
  bankMemoryResetDefaults();

  if (!LittleFS.exists(BANK_MEMORY_FILE)) {
    return bankMemorySave();
  }

  File file = LittleFS.open(BANK_MEMORY_FILE, "r");
  if (!file) {
    return false;
  }

  char line[BANK_MEMORY_LINE_SIZE];
  while (file.available()) {
    size_t len = file.readBytesUntil('\n', line, sizeof(line) - 1);
    line[len] = '\0';

    char *entry = bankMemoryTrim(line);
    if (entry[0] == '\0' || entry[0] == '#') {
      continue;
    }

    char *separator = strchr(entry, '|');
    if (!separator) {
      continue;
    }

    *separator = '\0';
    char *tag = bankMemoryTrim(entry);
    char *data = bankMemoryTrim(separator + 1);

    uint8_t letter = 0;
    uint8_t presetIndex = 0;
    if (!bankMemoryParseTag(tag, letter, presetIndex)) {
      continue;
    }

    const uint8_t index = bankMemoryIndex(letter, presetIndex);
    strncpy(bankMemory[index].tag, tag, sizeof(bankMemory[index].tag) - 1);
    bankMemory[index].tag[sizeof(bankMemory[index].tag) - 1] = '\0';
    strncpy(bankMemory[index].data, data,
            sizeof(bankMemory[index].data) - 1);
    bankMemory[index].data[sizeof(bankMemory[index].data) - 1] = '\0';
  }

  file.close();
  return true;
}

static inline BankMemoryEntry &bankMemoryCurrent() {
  const uint8_t letter =
      activeBankLetterIndex < BANK_MEMORY_LETTERS ? activeBankLetterIndex : 0;
  const uint8_t presetIndex =
      activePresetIndex >= 0 ? (uint8_t)activePresetIndex : 0;
  return bankMemory[bankMemoryIndex(letter, presetIndex)];
}

static inline void bankMemoryLogCurrent() {
  BankMemoryEntry &entry = bankMemoryCurrent();
  sys_log_i("bankmem", "%s: %s", entry.tag, entry.data);
}

#endif // BANK_MEMORY_H
