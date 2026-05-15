# BFMIDI · Modos LIVE

Referência de **como cada modo de SW funciona em LIVE MODE**. Complementa o
[design.md §3.6](design.md) (que cobre a estrutura de UI/armazenamento) — aqui o
foco é o **comportamento**: o que cada modo faz no MIDI, no LED e no toque do
footswitch.

Implementados: **STOMP** (`fx1` unificado, com 1/2/3 seções) e **MOMENTARY**.
Os modos `fx2` e `fx3` ficam como legado (ver §5); os demais estão no roadmap (§6).

---

## 1. Visão geral

Em LIVE MODE cada um dos 6 footswitches (SW1–SW6) opera de forma independente,
segundo o **modo** atribuído a ele. O modo de cada SW é escolhido no picker do
card de SW e guardado no campo `sw_modes` do header do preset (6 índices,
`i,i,i,i,i,i`). Os **parâmetros** de cada SW/modo ficam em linhas próprias do
arquivo do preset (`sw<N>.<modo>:<key=value|...>` em `/banks/<tag>.txt`).

Dois tempos distintos:

- **Na chamada do preset** (em QUALQUER modo — BANK ou LIVE): o firmware dispara
  o MIDI inicial de cada SW (quando o modo tem estado de partida), junto do
  header do preset.
- **Em LIVE MODE**: o footswitch fica interativo (toque altera/dispara MIDI) e o
  LED de cada SW reflete o estado. Em BANK MODE o SW não é interativo e não há
  visualização por LED — só o disparo inicial aconteceu.

O estado de runtime de cada SW vive em `swActive` ([BANK_MEMORY.h](../BANK_MEMORY.h)),
um cache só do preset ativo, recarregado a cada troca de preset. O estado inclui:

- `liveOn[6]` / `liveOn2[6]` / `liveOn3[6]` — on/off persistente das três seções
  do STOMP (A=tap, B=long-press, C=duplo-click).
- `momentaryFlashUntilMs[6]` — deadline (em `millis()`) do flash do LED do
  MOMENTARY.
- `momentaryPressCount[6]` — contador monotônico de pulses do MOMENTARY (uint16,
  wraps em 65k); o webApp usa o delta entre polls pra logar cada pulse no MONITOR.

---

## 2. Modos disponíveis

| Índice | id | Nome | Status |
|---|---|---|---|
| 0 | `mute` | MUTE | padrão — SW silencioso, não faz nada |
| 1 | `fx1` | STOMP | **implementado** unificado (1/2/3 seções, ver §3) |
| 2 | `fx2` | STOMP - 2 | legado, oculto do picker (§5) |
| 3 | `fx3` | STOMP - 3 | legado, oculto do picker (§5) |
| 4 | `spin` | SPIN | a implementar |
| 5 | `ramp` | RAMPA | a implementar |
| 6 | `momentary` | MOMENTARY | **implementado** (§4) |
| 7 | `favorite` | FAVORITE | a implementar |
| 8 | `macros` | MACROS | a implementar |
| 9 | `tap_tempo` | TAP TEMPO | a implementar |
| 10 | `single` | SINGLE | a implementar |

---

## 3. STOMP (`fx1`) — unificado, adaptativo

### 3.1 Conceito

Um único modo "STOMP" que **adapta o comportamento** conforme quantas seções têm
canal MIDI configurado. O usuário configura até 3 seções (A, B, C) no editor; o
firmware decide em runtime se opera como STOMP clássico, dual ou trial.

Tiers (decisão tomada em runtime a partir de `ch2` e `ch3` no blob):

| Canais configurados | Tier | Apelido | Gestos / LED |
|---|---|---|---|
| Só A (`ch ∈ 1..16`, `ch2 = 0`, `ch3 = 0`) | 1 | STOMP clássico | tap = toggle de A; segurar = momentâneo em A. **LED**: 3 pixels na cor A. |
| A + B (`ch2 ∈ 1..16`, `ch3 = 0`) | 2 | DUAL STOMP | tap = toggle A (imediato no release); long-press = toggle B (permanente). **LED**: pixels externos = A, pixel central = B. |
| A + B + C (todos válidos) | 3 | TRIAL STOMP | tap = toggle A (após janela do duplo-click); long-press = toggle B; duplo-click = toggle C. **LED**: pixel 1 = A, pixel 2 = B, pixel 3 = C. |

> **Trade-off do tier 3**: o tap simples só pode ser confirmado depois que a
> janela do duplo-click expira (~350 ms em `doubleClickMs` de
> [ALL_SWITCHES.h](../ALL_SWITCHES.h)). Tap fica com ~350 ms de latência. Long-press
> e duplo-click são imediatos.

Cada seção é um **toggle on/off permanente** (exceto a A no tier 1, que mantém o
comportamento clássico do STOMP 1 — segurar inverte momentaneamente). Cada
toggle envia um **Control Change** com o valor configurado da seção.

### 3.2 Parâmetros

Blob da linha `sw<N>.fx1:` — até 21 chaves, divididas em 3 seções:

| Seção | Sufixo | Gesto | Chaves |
|---|---|---|---|
| A | (vazio) | tap | `num`, `ch`, `custom`, `on`, `off`, `start`, `color` |
| B | `2` | long-press | `num2`, `ch2`, `custom2`, `on2`, `off2`, `start2`, `color2` |
| C | `3` | duplo-click | `num3`, `ch3`, `custom3`, `on3`, `off3`, `start3`, `color3` |

Cada conjunto tem os mesmos significados:

| Key | Range | Significado |
|---|---|---|
| `num` | 0–127 | número do CC |
| `ch` | `0` = OFF, 1–16 | canal MIDI — **define se a seção está ativa** |
| `custom` | 0/1 | habilita valores ON/OFF próprios |
| `on` | 0–127 | valor do CC no estado ligado |
| `off` | 0–127 | valor do CC no estado desligado |
| `start` | 0/1 | estado inicial na chamada do preset |
| `color` | 0–14 | cor do LED da seção (índice em `LED_COLORS`) |

**Valores efetivos do CC** (helper `swFxCcValue` em [BANK_MEMORY.h](../BANK_MEMORY.h)):

- `custom = 0` → ignora `on`/`off`, usa o padrão **127** (ligado) / **0** (desligado).
- `custom = 1` → usa os valores `on`/`off` salvos.

### 3.3 Comportamento

**Na chamada do preset** (`swActiveSendInitialMidi`, [SW_BANK.h](../SW_BANK.h)):

Para cada seção com `ch ∈ 1..16`, envia `CC num` no canal `ch` com o valor
efetivo do `start` correspondente e fixa o estado interno (`liveOn[i]`,
`liveOn2[i]`, `liveOn3[i]`). Seções com `ch = 0` ficam inertes (não enviam, não
contam pro tier).

**No toque do footswitch** (`swLiveUpdateButton` + `swLiveHandleTapSection`,
[SW_LIVE.h](../SW_LIVE.h)) — só em LIVE MODE:

Conforme o tier ativo (recalculado a cada press):

- **Tier 1** — tap alterna A; segurar inverte A momentaneamente (release reverte).
- **Tier 2** — tap alterna A no release; long-press alterna B (permanente).
- **Tier 3** — tap alterna A após a janela do duplo-click; long-press alterna B;
  duplo-click alterna C.

Cada transição manda o `CC` da seção e atualiza o LED.

**LED** (`ledStripShowLiveSwitches`, [LED_STRIP.h](../LED_STRIP.h)):

- **Tier 1**: os 3 pixels acendem na cor `color` quando A está ON. OFF + flag
  global `LED PREVIEW LIVE MODE` mantém só o pixel central aceso como indicador
  ("aqui tem um STOMP").
- **Tier 2**: pixels externos (0 e 2) = seção A na cor `color`; pixel central
  (1) = seção B na cor `color2`. Cada um acende independentemente. Sem
  preview-live.
- **Tier 3**: pixel 1 (índice 0) = A; pixel 2 (índice 1) = B; pixel 3 (índice 2)
  = C. Cores `color` / `color2` / `color3`. Cada um acende independentemente.
  Sem preview-live.

### 3.4 Persistência do estado

`liveOn` / `liveOn2` / `liveOn3` são (re)fixados em `start` / `start2` / `start3`
toda vez que o preset é chamado. Toggles feitos em LIVE persistem até a próxima
chamada de preset — inclusive ao alternar BANK ↔ LIVE sem trocar de preset
(alternar de modo não reseta; só a chamada do preset reseta).

### 3.5 Armazenamento

Linha no arquivo `/banks/<tag>.txt` (esparso — só SW configurado ganha linha):

```
sw1.fx1:num=48|ch=1|custom=0|on=127|off=0|start=0|color=1|num2=49|ch2=1|custom2=0|on2=127|off2=0|start2=0|color2=2|num3=0|ch3=0|custom3=0|on3=127|off3=0|start3=0|color3=1
```

Seções não usadas ficam com `chN = 0` (não atuam mesmo se houver outros campos).
Trocar o modo de um SW **não apaga** a linha do modo anterior — os params ficam
guardados.

`SW_PARAM_BLOB_SIZE = 256` em [BANK_MEMORY.h](../BANK_MEMORY.h) (3 seções no pior
caso ~178 chars + folga).

### 3.6 API

- `GET /sw/params?bank=A1` → devolve as linhas de SW do preset.
- `POST /sw/params?bank=A1&sw=1&mode=fx1` → grava o blob (params no body:
  `num=48&ch=1&...`). Body vazio remove a linha. **Após o save** o firmware
  recarrega o cache (`swActiveLoadCurrent`) e re-renderiza (`swLiveRenderCurrent`
  / `swBankRenderCurrent`) — assim a cor do LED atualiza no primeiro SAVE.

No webApp o editor é o `SwStompEditor` (3 tabs CLICK CURTO / CLICK LONGO /
RECLICK + preview de LED adaptativo ao tier).

### 3.7 Sinalização no MONITOR

Snapshot do preset: mostra só as seções com canal válido —

```
SW-1 STOMP CC 48 - CH 1                              (tier 1)
SW-1 STOMP CC 48 - CH 1 / CC 49 - CH 1               (tier 2)
SW-1 STOMP CC 48 - CH 1 / CC 49 - CH 1 / CC 50 - CH 2 (tier 3)
```

Eventos LIVE MODE (label muda conforme o tier):

| Tier | Label |
|---|---|
| 1 | sem label (`SW-X ON - CC ... - CH ...`) |
| 2 | `CURTO` ou `LONGO` |
| 3 | `CURTO`, `LONGO` ou `RECLICK` |

A detecção é via flips no array `sw_live_on` / `sw_live_on2` / `sw_live_on3` do
`/bank/current` (poll a cada 1.5 s). Toggles muito rápidos (< 1.5 s, on→off→on
no mesmo tick) podem ser perdidos pelo poll.

---

## 4. MOMENTARY (`momentary`)

### 4.1 Conceito

Disparo único e sem estado: ao pisar, envia **ON** e em seguida **OFF** no mesmo
CC. A soltura do footswitch é ignorada. Útil pra controles do tipo "tap" onde o
receptor processa o evento da borda de ida (Kemper "tuner", looper play/stop por
edge, etc.). **Só opera em LIVE MODE** — não há MIDI inicial na chamada do
preset.

### 4.2 Parâmetros

Mesmas chaves da seção A do STOMP click curto. `start` fica no schema por
consistência mas é **ignorado** (modo sem estado persistente).

| Key | Range | Significado |
|---|---|---|
| `num` | 0–127 | número do CC |
| `ch` | `0` = OFF, 1–16 | canal MIDI |
| `custom` | 0/1 | habilita valores ON/OFF próprios |
| `on` | 0–127 | valor do pulse de ida (efetivo só com `custom = 1`; senão 127) |
| `off` | 0–127 | valor do pulse de volta (efetivo só com `custom = 1`; senão 0) |
| `color` | 0–14 | cor do LED no flash |

### 4.3 Comportamento

**Na chamada do preset**: nada. Sem `liveOn`, sem MIDI inicial.

**No press do footswitch** (`swLiveHandleMomentary` em [SW_LIVE.h](../SW_LIVE.h)):

1. Envia `CC num` com o valor ON (127 ou `on`).
2. `delay(2)` — garante ordem na fila USB.
3. Envia `CC num` com o valor OFF (0 ou `off`).
4. Incrementa `swActive.momentaryPressCount[i]` (contador uint16, wraps em 65k).
5. Seta `swActive.momentaryFlashUntilMs[i] = millis() + 500` — flash do LED.
6. `swLiveRenderCurrent()` pra mostrar o flash imediatamente.

A soltura do footswitch (`wasReleased`), long-press e clicks são consumidos sem
ação.

### 4.4 LED

Durante a janela de flash (500 ms a partir do press), os **3 pixels** do SW
acendem na cor `color`. Fora do flash, o LED fica apagado (sem estado a mostrar).

O `swLiveMomentaryFlashTick()` (chamado a cada iteração do `swLiveUpdate`)
detecta deadlines expirados, zera `momentaryFlashUntilMs[i]` e re-renderiza pra
apagar — sem overhead quando nada está piscando.

Press novo dentro da janela de 500 ms **estende** o flash a partir do novo press
(não acumula).

### 4.5 Armazenamento

```
sw1.momentary:num=64|ch=1|custom=0|on=127|off=0|start=0|color=1
```

### 4.6 API

Igual ao STOMP — `POST /sw/params?bank=A1&sw=1&mode=momentary` com os params no
body.

### 4.7 Sinalização no MONITOR

Snapshot: `SW-1 MOMENTARY CC 64 - CH 1`.

Eventos LIVE MODE: cada pulse vira uma entrada (label `MOMENTARY`):

```
MODO LIVE SW-1 MOMENTARY ON - CC 64 - VAL 127 - CH 1
```

Como `liveOn` não é tocado, a detecção é via **delta no `sw_momentary_count`**
exposto em `/bank/current` (uint16 com wrap). O webApp guarda a última leitura
e, a cada poll, loga `delta` eventos (cap em 5 por poll pra evitar spam).
Pulses muito próximos dentro do mesmo tick de 1.5 s do poll viram entradas no
mesmo "tick" (com o mesmo timestamp).

---

## 5. Modos legado (fx2, fx3)

`fx2` ("STOMP - 2") e `fx3` ("STOMP - 3") existiram como modos exclusivos antes
da unificação no `fx1`. Hoje:

- **Picker** os esconde (`hidden: true` no `SW_MODES` do webApp). Não dá pra
  criar SW novo nesses modos pela UI.
- **Dados existentes** com mode `fx2`/`fx3` continuam carregando — o firmware
  tem paths legados em `swLiveUpdateButton` (mode == 2 / mode == 3) que replicam
  os tiers 2 e 3 do `fx1`.
- **Editores legados**: `SwFx2Editor` (2 tabs) ainda monta pra SWs em modo
  `fx2`; SWs em `fx3` usam o `SwStompEditor` unificado (chaves compatíveis).
- **Migração** acontece naturalmente: ao trocar o modo de um SW pelo picker
  (que só oferece STOMP/fx1), ele passa a salvar como `fx1` com os 21 campos.

A linha legada não é apagada ao trocar de modo (igual a qualquer outra) — fica
guardada no arquivo do preset por consistência.

---

## 6. Modos a implementar

Comportamento ainda **não definido** — entram aqui conforme forem construídos:

- **SPIN (`spin`)** — varredura de valor (knob).
- **RAMPA (`ramp`)** — transição gradual entre dois valores.
- **FAVORITE (`favorite`)** — recall de um preset/estado favorito.
- **MACROS (`macros`)** — sequência de várias mensagens MIDI.
- **TAP TEMPO (`tap_tempo`)** — tempo por batida.
- **SINGLE (`single`)** — disparo único.

Cada modo, quando implementado, ganha aqui uma seção no formato dos §3/§4
(Conceito / Parâmetros / Comportamento / LED / Armazenamento / API / MONITOR).

### 6.1 Convenção — reaproveitar chaves de variável

Ao implementar um modo novo, **reaproveite as chaves de variável já usadas por
outros modos** em vez de criar exclusivas. Ex.: o STOMP usa `num` (CC), `ch`
(canal), `custom`, `on`, `off`, `start`, `color` — um modo novo que também tenha
CC e canal deve usar `num` e `ch`, não `cc2` / `channel`. Só adicione uma chave
nova quando não houver nada equivalente pra reaproveitar.

Motivo: cada SW roda **só 1 modo por vez**, então os modos não precisam de
variáveis exclusivas. Chaves compartilhadas mantêm o blob enxuto e consistente,
e o `SwStompSection` (componente parametrizado por prefixo de chave) já cobre
seções de qualquer modo que reuse o schema do STOMP.
