# BFMIDI · Monitor USB

Monitor MIDI USB standalone, externo ao firmware do pedal. Lê mensagens
MIDI brutas que chegam via USB e mostra com o mesmo visual do MONITOR
LIVE do webApp.

## Uso

1. Abra `index.html` no Chrome, Edge ou Opera (browsers com [Web MIDI
   API](https://caniuse.com/midi)).
2. Aceite a permissão MIDI quando o browser pedir.
3. Selecione a entrada USB no dropdown e toque algo no dispositivo.

Funciona via `file://`. Para usar de outra máquina, sirva a pasta com
qualquer servidor estático e abra via HTTPS/`localhost`.

## Atalhos da UI

- **PAUSAR / RETOMAR** — congela o feed sem desconectar.
- **LIMPAR** — esvazia a lista.
- **COPIAR** — copia os eventos atuais como texto pro clipboard
  (pronto pra colar no WhatsApp).
- **Mostrar Clock / Active Sense** — por padrão Clock (`F8`) e Active
  Sense (`FE`) são filtrados (saturam a tela). Ative se precisar vê-los.
- **Colapsar mensagens repetidas** — mesma mensagem consecutiva soma
  contador `×N` em vez de criar nova linha.
- **Máx eventos** — quantos cards manter no histórico (FIFO).

## Mensagens reconhecidas

| Status   | Label    | Render                                |
|----------|----------|---------------------------------------|
| `8x`     | NOTE-    | `noteName (num) = vel · CH n`         |
| `9x`     | NOTE+    | `noteName (num) = vel · CH n`         |
| `Ax`     | POLY-AT  | `noteName (num) = val · CH n`         |
| `Bx`     | CC       | `num = val · CH n`                    |
| `Cx`     | PC       | `program · CH n`                      |
| `Dx`     | CH-PRESS | `val · CH n`                          |
| `Ex`     | PITCH-B  | `±val (signed) · CH n`                |
| `F0…F7`  | SYSEX    | `N bytes` + hex                       |
| `F8…FF`  | CLOCK/STOP/…| label                              |

Bytes brutos aparecem no canto direito de cada linha.

## Notas

- Single-file (HTML + CSS + JS), sem build, sem dependências.
- Não enviar MIDI, só recebe.
- Detecta hot-plug: conectar/desconectar dispositivos atualiza a lista.
