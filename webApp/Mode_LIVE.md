# BFMIDI · Modos LIVE

Referência de **como cada modo de SW funciona em LIVE MODE**. Complementa o
[design.md §3.6](design.md) (que cobre a estrutura de UI/armazenamento) — aqui o
foco é o **comportamento**: o que cada modo faz no MIDI, no LED e no toque do
footswitch.

Por enquanto só o **STOMP 1** está implementado; os demais estão listados como
roadmap no fim.

---

## 1. Visão geral

Em LIVE MODE cada um dos 6 footswitches (SW1–SW6) opera de forma independente,
segundo o **modo** atribuído a ele. O modo de cada SW é escolhido no picker do
card de SW e guardado no campo `sw_modes` do header do preset (6 índices,
`i,i,i,i,i,i`). Os **parâmetros** de cada SW/modo ficam em linhas próprias do
arquivo do preset (`sw<N>.<modo>:<key=value|...>` em `/banks/<tag>.txt`).

Dois tempos distintos:

- **Na chamada do preset** (em QUALQUER modo — BANK ou LIVE): o firmware dispara
  o MIDI inicial de cada SW, junto do header do preset. É o estado de partida.
- **Em LIVE MODE**: o footswitch fica interativo (toque altera/dispara MIDI) e o
  LED de cada SW reflete o estado. Em BANK MODE o SW não é interativo e não há
  visualização por LED — só o disparo inicial aconteceu.

O estado de runtime de cada SW vive em `swActive` ([BANK_MEMORY.h](../BANK_MEMORY.h)),
um cache só do preset ativo, recarregado a cada troca de preset.

---

## 2. Modos disponíveis

| Índice | id | Nome | Status |
|---|---|---|---|
| 0 | `mute` | MUTE | padrão — SW silencioso, não faz nada |
| 1 | `fx1` | STOMP 1 | **implementado** (ver §3) |
| 2 | `fx2` | STOMP 2 (DUAL STOMP) | a implementar |
| 3 | `fx3` | STOMP 3 (TRIAL STOMP) | a implementar |
| 4 | `spin` | SPIN | a implementar |
| 5 | `ramp` | RAMPA | a implementar |
| 6 | `momentary` | MOMENTARY | a implementar |
| 7 | `favorite` | FAVORITE | a implementar |
| 8 | `macros` | MACROS | a implementar |
| 9 | `tap_tempo` | TAP TEMPO | a implementar |
| 10 | `single` | SINGLE | a implementar |

---

## 3. STOMP 1 (`fx1`)

### 3.1 Conceito

STOMP de **clique simples** (toggle liga/desliga), como um pedal de efeito. Cada
toque alterna entre dois estados (ON / OFF) e manda um **Control Change** com o
valor correspondente. (O envio por Program Change será um modo separado no
futuro — STOMP 1 é só CC.)

### 3.2 Parâmetros

Blob da linha `sw<N>.fx1:` — formato `num|ch|custom|on|off|start|color`:

| Key | Range | Significado |
|---|---|---|
| `num` | 0–127 | número do CC |
| `ch` | `0` = OFF, 1–16 | canal MIDI (0 = SW não envia nada) |
| `custom` | 0/1 | habilita valores ON/OFF próprios (botão `CUSTOM` no editor) |
| `on` | 0–127 | valor do CC no estado ligado |
| `off` | 0–127 | valor do CC no estado desligado |
| `start` | 0/1 | estado inicial (ligado/desligado) na chamada do preset |
| `color` | 0–14 | cor do LED do SW (índice em `LED_COLORS`) quando aceso em LIVE |

**Valores efetivos do CC:**

- `custom = 0` → ignora `on`/`off`: usa o padrão **127** (ligado) / **0** (desligado).
- `custom = 1` → usa os valores `on` / `off` salvos pelo usuário.

`on`/`off` ficam guardados mesmo com `custom = 0`, então ligar/desligar o
`CUSTOM` não perde o que o usuário já tinha digitado.

### 3.3 Comportamento

**Na chamada do preset** (`swActiveSendInitialMidi`, em [SW_BANK.h](../SW_BANK.h)):

- Envia `CC num` no canal `ch` com o valor efetivo do estado `start` (ligado →
  valor ON, desligado → valor OFF). O estado interno do SW (`liveOn`) é fixado
  em `start`.
- `ch = 0` (OFF) → o SW não envia nada.

Isso acontece **em qualquer modo** (BANK ou LIVE) — o pedal/sintetizador já recebe
o estado de partida assim que o preset é chamado.

**No toque do footswitch** (`swLiveUpdateButton` / `swLiveHandleTap`, em [SW_LIVE.h](../SW_LIVE.h)) — só em LIVE MODE:

- **Tap** (clique curto) → **alterna** o estado (ON ↔ OFF) de forma permanente,
  envia `CC num` com o novo valor efetivo e atualiza o LED do SW.
- **Long-press** (segurar ≥ 300 ms) → **momentâneo**: o estado inverte ao cruzar
  o limiar de long-press e **volta ao anterior quando soltar** o footswitch.
  Cada transição manda o `CC` correspondente e atualiza o LED.

**LED** (`ledStripShowLiveSwitches`, em [LED_STRIP.h](../LED_STRIP.h)):

- Em LIVE MODE, os pixels de cada SW acendem na cor `color` do SW quando ele
  está **ligado** (`type = CC` e estado ON). Desligado / em PC / em outro modo →
  apagado.
- Ao entrar em LIVE MODE os LEDs já refletem o estado atual.

**Persistência do estado:** `liveOn` é (re)fixado em `start` toda vez que o preset
é chamado. Toggles feitos em LIVE persistem até a próxima chamada de preset —
inclusive ao alternar BANK ↔ LIVE sem trocar de preset (alternar de modo não
reseta; só a chamada do preset reseta).

### 3.4 Armazenamento

Linha no arquivo `/banks/<tag>.txt` (esparso — só SW configurado ganha linha):

```
sw1.fx1:num=48|ch=1|custom=0|on=127|off=0|start=0|color=1
```

Trocar o modo de um SW **não apaga** a linha do modo anterior — os params ficam
guardados caso o usuário volte ao modo.

### 3.5 API

- `GET /sw/params?bank=A1` → devolve as linhas de SW do preset.
- `POST /sw/params?bank=A1&sw=1&mode=fx1` → grava o blob (params no body:
  `num=48&ch=1&custom=0&on=127&off=0&start=0&color=1`). Body vazio remove a linha.

No webApp o editor é o `SwFx1Editor`; o SAVE do rodapé em LIVE (`saveLive`) grava
o `sw_modes` do header e as linhas de SW alteradas.

---

## 4. Modos a implementar

Comportamento ainda **não definido** — entram aqui conforme forem construídos:

- **STOMP 2 (`fx2`)** — "DUAL STOMP": clique + clique longo (dois gestos).
- **STOMP 3 (`fx3`)** — "TRIAL STOMP": clique + clique longo + re-clique.
- **SPIN (`spin`)** — varredura de valor (knob).
- **RAMPA (`ramp`)** — transição gradual entre dois valores.
- **MOMENTARY (`momentary`)** — ativo só enquanto pressionado.
- **FAVORITE (`favorite`)** — recall de um preset/estado favorito.
- **MACROS (`macros`)** — sequência de várias mensagens MIDI.
- **TAP TEMPO (`tap_tempo`)** — tempo por batida.
- **SINGLE (`single`)** — disparo único.

Cada modo, quando implementado, ganha aqui uma seção no formato do §3
(Conceito / Parâmetros / Comportamento / Armazenamento / API).

### 4.1 Convenção — reaproveitar chaves de variável

Ao implementar um modo novo, **reaproveite as chaves de variável já usadas por
outros modos** em vez de criar exclusivas. Ex.: o STOMP 1 usa `num` (CC) e `ch`
(canal) — um modo novo que também tenha CC e canal deve usar `num` e `ch`, não
`cc2` / `channel`. Só adicione uma chave nova quando não houver nada equivalente
pra reaproveitar.

Motivo: cada SW roda **só 1 modo por vez**, então os modos não precisam de
variáveis exclusivas. Chaves compartilhadas mantêm o blob `sw<N>.<modo>:` enxuto
e consistente. Antes de inventar chaves, olhe o blob dos modos já feitos (STOMP
1: `num|ch|custom|on|off|start|color`) e use os mesmos nomes pros conceitos
equivalentes.
