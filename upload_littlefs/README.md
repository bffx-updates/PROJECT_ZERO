# BFMIDI · Atualizar firmware via USB

Página web pra atualizar o BFMIDI sem precisar do Arduino IDE. Hospeda no
GitHub Pages e o usuário plugga o cabo USB no PC/Mac/Android e clica
"Iniciar atualização". Usa [esptool-js](https://github.com/espressif/esptool-js)
+ Web Serial API.

## Arquivos servidos pelo Pages

| Arquivo                | O que é                                       |
|------------------------|-----------------------------------------------|
| `index.html`           | UI do flasher                                 |
| `esptool-bundle.js`    | esptool-js empacotado (gerado por `npm run build`) |
| `bootloader.bin`       | bootloader do ESP-IDF (offset `0x1000`)       |
| `partition-table.bin`  | tabela de partições (offset `0x8000`)         |
| `firmware.bin`         | firmware compilado (offset `0x10000`)         |
| `littlefs.bin`         | imagem LittleFS com o webApp (offset `0x280000`) |

A página verifica via HEAD se cada `.bin` existe. Se faltar, a opção
correspondente fica desabilitada — então dá pra subir só firmware sem
LittleFS ou vice-versa.

## Gerar `firmware.bin` + `bootloader.bin` + `partition-table.bin`

No Arduino IDE:

1. Abra o sketch `BFMIDI_PROJECT_ZERO.ino`.
2. Selecione a placa **ESP32-S2 Dev Module** e a partição customizada.
3. Menu **Sketch → Exportar binário compilado** (`Ctrl+Alt+S`).
4. O Arduino vai gerar uma pasta `build/` com os três `.bin`:
   - `BFMIDI_PROJECT_ZERO.ino.bootloader.bin`
   - `BFMIDI_PROJECT_ZERO.ino.partitions.bin`
   - `BFMIDI_PROJECT_ZERO.ino.bin`
5. Copie/renomeie pra cá:
   ```
   cp build/.../BFMIDI_PROJECT_ZERO.ino.bootloader.bin upload_littlefs/bootloader.bin
   cp build/.../BFMIDI_PROJECT_ZERO.ino.partitions.bin upload_littlefs/partition-table.bin
   cp build/.../BFMIDI_PROJECT_ZERO.ino.bin            upload_littlefs/firmware.bin
   ```

## Gerar `littlefs.bin`

A imagem é gerada pelo `mklittlefs` que vem com o ESP32 core do Arduino.

1. Rode o build do webApp pra atualizar `data/`:
   ```
   cd webApp
   npm run build
   ```
2. Gere a imagem LittleFS:
   ```
   mklittlefs -c data -b 4096 -p 256 -s 0x180000 upload_littlefs/littlefs.bin
   ```
   Onde:
   - `-s 0x180000` é o tamanho da partição storage (1.5 MB, conforme `partitions.csv`).
   - `-b 4096` / `-p 256` são valores padrão do core.

> O caminho do `mklittlefs.exe` em instalações portable do Arduino fica
> tipicamente em
> `<portable>/packages/esp32/tools/mklittlefs/<version>/mklittlefs.exe`.

## Atualizar o bundle do esptool-js

Quando sair versão nova:

```
cd upload_littlefs
npm install
npm run build         # gera esptool-bundle.js
```

`esptool-bundle.js` é commitado no repo (pra Pages servir sem CDN).

## Compatibilidade

| Cliente         | Suporte                  |
|-----------------|--------------------------|
| Chrome PC/Mac   | OK                       |
| Edge PC/Mac     | OK                       |
| Chrome Android  | OK (com cabo USB OTG)    |
| Firefox         | Não (sem Web Serial API) |
| Safari / iOS    | Não (sem Web Serial API) |

iPad/iPhone não conseguem flashar; usuário precisa de um PC/Mac/Android
ou um Arduino IDE.
