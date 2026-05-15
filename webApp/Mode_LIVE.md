# BFMIDI · Modos LIVE

Referência de **como cada modo de SW funciona em LIVE MODE**. Complementa o
[design.md §3.6](design.md) (que cobre a estrutura de UI/armazenamento) — aqui o
foco é o **comportamento**: o que cada modo faz no MIDI, no LED e no toque do
footswitch.

**Implementados:** STOMP (`fx1` unificado), MOMENTARY, MACROS, SINGLE.
**Legados:** `fx2` e `fx3` (ocultos no picker, dados antigos ainda carregam).
**Roadmap:** spin, ramp, favorite, tap_tempo.

---

## 1. Visão geral

Em LIVE MODE cada um dos 6 footswitches (SW1–SW6) opera de forma independente,
segundo o **modo** atribuído a ele. O modo de cada SW é escolhido no picker do
card de SW e guardado no campo `sw_modes` do header do preset (6 índices,
`i,i,i,i,i,i`). Os **parâmetros** de cada SW/modo ficam em linhas próprias do
arquivo do preset (`sw<N>.<modo>:<key=value|...>` em `/banks/<tag>.txt`).

Dois tempos distintos:

- **Na chamada do preset** (em QUALQUER modo — BANK ou LIVE): o firmware
  dispara o MIDI inicial de cada SW (quando o modo tem estado de partida),
  junto do header do preset.
- **Em LIVE MODE**: o footswitch fica interativo (toque altera/dispara MIDI) e
  o LED de cada SW reflete o estado. Em BANK MODE o SW não é interativo e não
  há visualização por LED — só o disparo inicial aconteceu.

O estado de runtime de cada SW vive em `swActive`
([BANK_MEMORY.h](../BANK_MEMORY.h)), um cache só do preset ativo, recarregado a
cada troca de preset. Campos relevantes:

- `liveOn[6]` / `liveOn2[6]` / `liveOn3[6]` — on/off persistente das três seções
  do STOMP/MACROS (A=tap, B=long-press, C=duplo-click).
- `momentaryFlashUntilMs[6]` — deadline (em `millis()`) do flash do LED do
  MOMENTARY.
- `momentaryPressCount[6]` / `singlePressCount[6]` — contadores monotônicos de
  pulses do MOMENTARY/SINGLE (uint16, wraps em 65k); o webApp usa o delta entre
  polls pra logar cada pulse no MONITOR.
- `lastActiveSingleSw` (int8, -1 = nenhum) — qual SW em SINGLE foi o último a
  disparar (só ele fica com o LED aceso).

---

## 2. Modos disponíveis

| Índice | id | Nome | Status |
|---|---|---|---|
| 0 | `mute` | MUTE | padrão — SW silencioso, não faz nada |
| 1 | `fx1` | STOMP | **implementado** unificado (1/2/3 seções, §3) |
| 2 | `fx2` | STOMP - 2 | legado, oculto do picker (§7) |
| 3 | `fx3` | STOMP - 3 | legado, oculto do picker (§7) |
| 4 | `spin` | SPIN | a implementar |
| 5 | `ramp` | RAMPA | a implementar |
| 6 | `momentary` | MOMENTARY | **implementado** (§4) |
| 7 | `favorite` | FAVORITE | a implementar |
| 8 | `macros` | MACROS | **implementado** (§5) |
| 9 | `tap_tempo` | TAP TEMPO | a implementar |
| 10 | `single` | SINGLE | **implementado** (§6) |

---

## 3. STOMP (`fx1`) — unificado, adaptativo

### 3.1 Conceito

Um único modo "STOMP" que **adapta o comportamento** conforme quantas seções
têm canal MIDI configurado. O usuário configura até 3 seções (A, B, C) no
editor; o firmware decide em runtime se opera como STOMP clássico, dual ou
trial.

Tiers (decisão tomada em runtime a partir de `ch2` e `ch3` no blob):

| Canais configurados | Tier | Apelido | Gestos / LED |
|---|---|---|---|
| Só A (`ch ∈ 1..16`, `ch2 = 0`, `ch3 = 0`) | 1 | STOMP clássico | tap = toggle de A; segurar = momentary em A. **LED**: 3 pixels na cor A. |
| A + B (`ch2 ∈ 1..16`, `ch3 = 0`) | 2 | DUAL STOMP | tap = toggle A (imediato no release); long-press = toggle B (permanente). **LED**: pixels externos = A, pixel central = B. |
| A + B + C (todos válidos) | 3 | TRIAL STOMP | tap = toggle A (após janela do duplo-click); long-press = toggle B; duplo-click = toggle C. **LED**: pixel 1 = A, pixel 2 = B, pixel 3 = C. |

> **Trade-off do tier 3**: o tap simples só pode ser confirmado depois que a
> janela do duplo-click expira (~350 ms em `doubleClickMs` de
> [ALL_SWITCHES.h](../ALL_SWITCHES.h)). Tap fica com ~350 ms de latência. Long-press
> e duplo-click são imediatos.

### 3.2 Parâmetros

Blob da linha `sw<N>.fx1:` — até 21 chaves, divididas em 3 seções:

| Seção | Sufixo | Gesto | Chaves |
|---|---|---|---|
| A | (vazio) | tap | `num`, `ch`, `custom`, `on`, `off`, `start`, `color` |
| B | `2` | long-press | `num2`, `ch2`, `custom2`, `on2`, `off2`, `start2`, `color2` |
| C | `3` | duplo-click | `num3`, `ch3`, `custom3`, `on3`, `off3`, `start3`, `color3` |

| Key | Range | Significado |
|---|---|---|
| `num` | 0–127 | número do CC |
| `ch` | `0` = OFF, 1–16 | canal MIDI — **define se a seção está ativa** |
| `custom` | 0/1 | habilita valores ON/OFF próprios |
| `on` | 0–127 | valor do CC no estado ligado |
| `off` | 0–127 | valor do CC no estado desligado |
| `start` | 0/1 | estado inicial na chamada do preset |
| `color` | 0–14 | cor do LED da seção (índice em `LED_COLORS`) |

**Valores efetivos do CC** (helper `swFxCcValue` em
[BANK_MEMORY.h](../BANK_MEMORY.h)):

- `custom = 0` → ignora `on`/`off`, usa o padrão **127** (ligado) / **0**
  (desligado).
- `custom = 1` → usa os valores `on`/`off` salvos.

### 3.3 Comportamento

**Na chamada do preset** (`swActiveSendInitialMidi`,
[SW_BANK.h](../SW_BANK.h)): para cada seção com `ch ∈ 1..16`, envia `CC num` no
canal `ch` com o valor efetivo de `start` e fixa o estado interno (`liveOn[i]`,
`liveOn2[i]`, `liveOn3[i]`). Seções com `ch = 0` ficam inertes.

**No toque do footswitch** (`swLiveUpdateButton` + `swLiveHandleTapSection`,
[SW_LIVE.h](../SW_LIVE.h)) — só em LIVE MODE: conforme o tier ativo, dispara o
gesto correspondente.

**LED** (`ledStripShowLiveSwitches`, [LED_STRIP.h](../LED_STRIP.h)): layout
adapta por tier; cada seção acende seu pixel na sua cor quando ON.

### 3.4 Armazenamento + API

Linha esparsa no `/banks/<tag>.txt`:

```
sw1.fx1:num=48|ch=1|custom=0|on=127|off=0|start=0|color=1|num2=49|ch2=1|...
```

API: `GET /sw/params?bank=A1` (lista) e `POST /sw/params?bank=A1&sw=1&mode=fx1`
(grava). Body vazio remove a linha.

`SW_PARAM_BLOB_SIZE = 384` em [BANK_MEMORY.h](../BANK_MEMORY.h) (cobre o pior
caso de modos com slots, ver §5).

Após o save, o firmware recarrega o cache (`swActiveLoadCurrent`) e re-renderiza
(`swLiveRenderCurrent` / `swBankRenderCurrent`) — assim a cor do LED atualiza
no primeiro SAVE.

### 3.5 Sinalização no MONITOR

Snapshot:

```
SW-1 STOMP CC 48 - CH 1                              (tier 1)
SW-1 STOMP CC 48 - CH 1 / CC 49 - CH 1               (tier 2)
SW-1 STOMP CC 48 - CH 1 / CC 49 - CH 1 / CC 50 - CH 2 (tier 3)
```

Eventos LIVE: label muda conforme o tier (`CURTO`/`LONGO`/`RECLICK` no tier 3;
sem label no tier 1). Detecção via flips em `sw_live_on`/`sw_live_on2`/
`sw_live_on3` no poll de `/bank/current` (1.5 s).

---

## 4. MOMENTARY (`momentary`)

### 4.1 Conceito

Disparo único e sem estado: ao pisar, envia **ON** e em seguida **OFF** no
mesmo CC. A soltura do footswitch é ignorada. Só opera em LIVE MODE — não há
MIDI inicial na chamada do preset.

### 4.2 Parâmetros (reutiliza chaves do STOMP click curto)

| Key | Range | Significado |
|---|---|---|
| `num` | 0–127 | número do CC |
| `ch` | 0/1–16 | canal MIDI (0 = OFF) |
| `custom` | 0/1 | habilita valores ON/OFF próprios |
| `on` | 0–127 | valor do pulse de ida |
| `off` | 0–127 | valor do pulse de volta |
| `color` | 0–14 | cor do LED no flash |
| `start` | 0/1 | (ignorado — sem estado persistente) |

### 4.3 Comportamento

**Na chamada do preset:** nada. Sem `liveOn`, sem MIDI inicial.

**No press** (`swLiveHandleMomentary` em [SW_LIVE.h](../SW_LIVE.h)):

1. Envia `CC num` com o valor ON.
2. `delay(2)` — garante ordem na fila USB.
3. Envia `CC num` com o valor OFF.
4. Incrementa `momentaryPressCount[i]`.
5. Seta `momentaryFlashUntilMs[i] = millis() + 500` — flash de 500 ms.
6. `swLiveRenderCurrent()` pra mostrar o flash imediatamente.

A soltura, long-press e clicks são consumidos sem ação.

### 4.4 LED

Durante o flash (500 ms a partir do press), os **3 pixels** do SW acendem na
cor `color`. Fora do flash, fica apagado. `swLiveMomentaryFlashTick()` (no
`swLiveUpdate`) apaga quando o deadline passa. Press novo dentro da janela
estende o flash a partir do novo press.

### 4.5 MONITOR

- Snapshot: `SW-1 MOMENTARY CC 64 - CH 1`.
- Eventos: detecção via delta no `sw_momentary_count`, cap em 5 por poll.

---

## 5. MACROS (`macros`)

### 5.1 Conceito

Igual ao STOMP unificado em comportamento (3 seções adaptativas com mesmo tier
detection), mas **cada seção tem até 4 slots** de mensagens MIDI (CC ou PC).
Cada slot tem valores ON e OFF independentes — quando a seção alterna,
**todos** os 4 slots disparam (CC mandam ON/OFF, PC ignora a direção
configurada como `OFF`).

### 5.2 Parâmetros

Por seção (sufixo '', '2', '3' para A/B/C):

| Key | Tipo | Significado |
|---|---|---|
| `mslots[N]` | string | até 4 slots: `"t:ch:num:on:off,t:ch:num:on:off,t:ch:num:on:off,t:ch:num:on:off"` |
| `start[N]` | 0/1 | **estado inicial** lógico da seção (ON/OFF). Sempre fixado em `liveOn[X]`, com ou sem disparo. |
| `at_preset[N]` | 0/1 | dispara os slots na chamada do preset? Independente de `start`. |
| `color[N]` | 0–14 | cor do LED da seção |

Cada slot em `mslots[N]` (`t:ch:num:on:off`):

| Sub-campo | Range | Significado |
|---|---|---|
| `t` | 0/1 | 0 = CC, 1 = PC |
| `ch` | 0/1–16 | canal MIDI (0 = slot inativo) |
| `num` | 0–127 | CC# (CC). Ignorado pra PC. |
| `on` | -1..16383 | CC value (CC) ou PC# (PC) para ON. `-1` = OFF/pula direção |
| `off` | -1..16383 | CC value (CC) ou PC# (PC) para OFF. `-1` = OFF/pula direção |

### 5.3 Tabela de comportamento (start + at_preset)

| at_preset | start | Na chamada do preset | liveOn final |
|---|---|---|---|
| 0 | 0 | nada (AGUARDA LIVE) | false |
| 0 | 1 | nada (AGUARDA LIVE) | true |
| 1 | 0 | manda valores OFF dos slots (START OFF) | false |
| 1 | 1 | manda valores ON dos slots (START ON) | true |

Os dois toggles são **independentes**: você pode definir o estado inicial sem
disparar nada no preset (pra que o primeiro press em LIVE dispare a direção
certa).

### 5.4 LED

Mesmo layout adaptativo do STOMP por tier:

- tier 1 (só seção A com slot): 3 pixels na cor `color`.
- tier 2 (A + B): externos = A, central = B.
- tier 3 (A + B + C): pixel 1/2/3 = A/B/C.

Tier detection: presença de slot com `ch ≥ 1` em cada seção
(`macrosSectionHasAnySlot` em [BANK_MEMORY.h](../BANK_MEMORY.h)).

### 5.5 Armazenamento + API

Mesma API do STOMP: `/sw/params?...&mode=macros`. Storage compacto:

```
sw1.macros:mslots=0:1:48:127:0,0:0:0:127:0,...|start=0|at_preset=1|color=1|mslots2=...
```

Worst case ~340 chars no blob (3 seções × 4 slots). `SW_PARAM_BLOB_SIZE = 384`
cobre. O buffer JSON-escapado em `swParamFileJson` (768 bytes) está em PSRAM
porque excede o limite de 512 pra stack-buffer em handler web.

### 5.6 MONITOR

Snapshot:

```
SW-1 MACROS A:2↑P B:1↓                   (A: 2 slots, START ON, dispara no preset; B: 1 slot, START OFF, AGUARDA LIVE)
```

- `↑` = START ON, `↓` = START OFF, sufixo `P` = também dispara no preset.

Eventos: `MODO LIVE SW-X MACROS CURTO ON (3 slots)` — uma entrada por toggle
de seção (via flips em `sw_live_on*`).

---

## 6. SINGLE (`single`)

### 6.1 Conceito

Disparo único (sem estado on/off), mas com **até 4 slots** que disparam todos
juntos no press. Cada slot é independente (CC ou PC, canal, valor único). Se
houver outros SWs em SINGLE, **só o último pressionado** fica com o LED aceso
(`lastActiveSingleSw`). Pode disparar também na chamada do preset.

### 6.2 Parâmetros

| Key | Tipo | Significado |
|---|---|---|
| `sslots` | string | até 4 slots: `"t:ch:num:val,t:ch:num:val,t:ch:num:val,t:ch:num:val"` |
| `at_preset` | 0/1 | dispara todos os slots na chamada do preset |
| `color` | 0–14 | cor do LED do SW |

Cada slot em `sslots` (`t:ch:num:val`):

| Sub-campo | Range | Significado |
|---|---|---|
| `t` | 0/1 | 0 = CC, 1 = PC |
| `ch` | 0/1–16 | canal MIDI (0 = slot inativo) |
| `num` | 0–127 | CC# (CC). Ignorado pra PC. |
| `val` | 0–16383 | CC value (CC, 0–127) ou PC# logico (PC, 0–16383) |

**Compatibilidade:** o firmware aceita dados legados do SINGLE original em
`num`/`ch`/`on`/`pc`/`as_pc`/`start` quando `sslots` não está presente. O
webApp migra automaticamente na exibição (slot 1 sai dos campos legados); a
primeira save reescreve em `sslots` + `at_preset`.

### 6.3 Comportamento

**Na chamada do preset** (`swActiveSendInitialMidi`): se `at_preset = 1` (ou
legacy `start = 1` em dados antigos), dispara todos os slots configurados
(via `swLiveFireSingleSlots`) e fixa `lastActiveSingleSw = i`.

**No press** (`swLiveHandleSingle` em [SW_LIVE.h](../SW_LIVE.h)):

1. Itera os 4 slots. Pra cada com `ch ≥ 1`:
   - Slot CC → `send_midi_cc(ch, num, val)`.
   - Slot PC → `swBankSendPcLogical(ch, val)` (`val` é o PC# 0–16383).
2. Se ao menos um slot disparou: incrementa `singlePressCount[i]`, fixa
   `lastActiveSingleSw = i`, chama `swLiveRenderCurrent()` (LED acende).

Outros SWs em SINGLE perdem o LED.

### 6.4 LED

Render em [LED_STRIP.h](../LED_STRIP.h): se `i == lastActiveSingleSw`, acende
os 3 pixels do SW na cor `color`. Os demais SINGLE ficam apagados.

### 6.5 MONITOR

Snapshot mostra todos os slots ativos:

```
SW-1 SINGLE CC 47=127/CH1 • PC 5/CH2 (PRESET)
```

Eventos: `MODO LIVE SW-X SINGLE ON (N slots)` — detecção via delta no
`sw_single_count`.

---

## 7. Modos legado (fx2, fx3)

`fx2` ("STOMP - 2") e `fx3` ("STOMP - 3") existiram como modos exclusivos antes
da unificação no `fx1`. Hoje:

- **Picker** os esconde (`hidden: true` no `SW_MODES` do webApp).
- **Dados existentes** com `fx2`/`fx3` continuam funcionando — firmware tem
  paths legados (`mode == 2` / `mode == 3` em `swLiveUpdateButton`).
- **Editores legados**: `SwFx2Editor` (2 tabs) ainda monta pra SWs em `fx2`;
  `fx3` usa o `SwStompEditor` unificado.

Ao trocar o modo de um SW pelo picker (que só oferece STOMP/fx1), salva como
`fx1` com os 21 campos.

---

## 8. Modos a implementar

- **SPIN (`spin`)** — varredura de valor (knob).
- **RAMPA (`ramp`)** — transição gradual entre dois valores.
- **FAVORITE (`favorite`)** — recall de um preset/estado favorito.
- **TAP TEMPO (`tap_tempo`)** — tempo por batida.

Cada modo, quando implementado, ganha aqui uma seção no formato dos §3–§6
(Conceito / Parâmetros / Comportamento / LED / Armazenamento / API / MONITOR).

---

## 9. Convenções de variáveis

Memória do projeto: **reaproveitar chaves entre modos**. Cada SW roda só 1
modo por vez, então as chaves podem ser compartilhadas e o blob fica enxuto.

### 9.1 Chaves canônicas

| Key | Onde aparece | Semântica |
|---|---|---|
| `num` | STOMP, MOMENTARY, SINGLE (legado), slot CC | CC# (0–127) |
| `ch` | STOMP, MOMENTARY, SINGLE (legado), slot | canal MIDI (0 = OFF, 1–16) |
| `custom` | STOMP, MOMENTARY | habilita valores ON/OFF próprios |
| `on` | STOMP, MOMENTARY, slot CC do MACROS | valor de CC no estado ON |
| `off` | STOMP, MOMENTARY, slot CC do MACROS | valor de CC no estado OFF |
| `start` | STOMP, MACROS | **estado inicial** lógico (ON/OFF) na chamada do preset |
| `color` | todos os modos com LED | cor do LED (índice 0–14) |
| `at_preset` | MACROS, SINGLE | dispara na chamada do preset? Independente de `start`. |
| `t` | slot (MACROS, SINGLE) | tipo do slot: 0 = CC, 1 = PC |
| `val` | slot SINGLE | valor único de disparo (CC value ou PC#) |
| `pc` | SINGLE (legado) | PC# 0–16383 quando `as_pc = 1` |
| `as_pc` | SINGLE (legado) | 0 = manda CC, 1 = manda PC |
| `mslots[N]` | MACROS | string com 4 slots `t:ch:num:on:off` por seção |
| `sslots` | SINGLE | string com 4 slots `t:ch:num:val` |

Sufixos `2` e `3` indicam seções B (click longo) e C (reclick/duplo-click) em
modos com seções múltiplas (STOMP unificado, MACROS).

### 9.2 Distinção semântica importante

- **`start`** = **estado inicial lógico** (ON/OFF). Sempre fixado em `liveOn`
  no boot do preset, com ou sem disparo de MIDI.
- **`at_preset`** = "dispara o MIDI agora?". Independente do estado inicial.

O SINGLE usa `at_preset` (padrão MACROS). Dados antigos do SINGLE que tinham
`start` significando "dispara no preset" continuam funcionando via fallback do
firmware: se `at_preset` não existe, ele lê `start`.

### 9.3 Quando criar uma chave nova

Antes de inventar, olhe o blob dos modos já feitos. Use o mesmo nome pra
conceitos equivalentes. Só adicione uma chave nova quando não houver nada
reaproveitável.

Modos com schema de "slot" (MACROS, SINGLE) reusam o helper genérico
`SwStompSection`-like via webApp; o slot dentro do composite string segue o
padrão `t:ch:num:...` pra ficar fácil de parsear.
