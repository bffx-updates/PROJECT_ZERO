BFMIDI PROJECT ZERO - ESTRUTURA DOS ARQUIVOS

Arquivo principal
-----------------

BFMIDI_PROJECT_ZERO.ino
  Responsavel pelo boot geral do sistema.
  Inicializa Serial, particoes, LittleFS, configuracoes globais, memoria de banks,
  pinagem da board, WiFi, WebServer, LEDs, display e leitura dos switches.
  Tambem concentra os estados globais principais usados pelos modulos:
  activePins, leds, bankButtons, liveModeButton, currentSwitchMode,
  activeBankLetterIndex e activePresetIndex.


Arquivos de hardware e configuracao base
----------------------------------------

ALL_SWITCHES.h
  Classe/estrutura generica de leitura de botoes.
  Implementa INPUT_PULLUP, debounce por millis(), modo TOGGLE, modo MOMENTARY,
  eventos de press, release, single click, double click e long press.

BOARDS.h
  Tabela de pinagem das boards suportadas.
  Define PinoutConfig, boards disponiveis, board padrao e a funcao que carrega
  os pinos ativos conforme o nome da board selecionada.

DISPLAY_CONFIG.h
  Configuracao fisica do display LovyanGFX.
  Centraliza SPI, pinos, tamanho de painel, frequencia e classe TFT_eSPI usada
  pelo restante do projeto.

GLOBAL_CONFIG.h
  Configuracoes globais persistidas no LittleFS.
  Guarda version=1, board selecionada, brilho global dos LEDs, modo de cor dos
  LEDs de bank, cor do LIVE e a paleta global de 15 cores.

NET_WIFI.h
  Configuracao e inicializacao do WiFi.
  Cria o AP BFMIDI_WIFI em 192.168.4.1, limita conexoes, ajusta potencia,
  carrega/salva credenciais STA no LittleFS e conecta na rede de casa quando
  houver SSID/senha salvos.


Arquivos de display
-------------------

DISPLAY_320.h
  Telas basicas para display 320x240.
  Implementa welcome_screen(), draw_bank_screen() e draw_live_screen().

DISPLAY_480.h
  Telas basicas para display 480x320.
  Implementa welcome_screen(), draw_bank_screen() e draw_live_screen().


Arquivos de memoria e estado de banks
-------------------------------------

BANK_MEMORY.h
  Memoria indexada dos banks/presets no LittleFS.
  Cria 30 entradas A1 ate E6, salva version=1 em /bank_memory.txt e fornece
  acesso ao preset atual pelo par bankLetterIndex + presetIndex.


Arquivos de LEDs
----------------

LED_STRIP.h
  Controle da fita WS2812/NeoPixel.
  Inicializa LEDs, aplica brilho global, faz teste RGB de boot, limpa a fita e
  acende pixels por switchIndex no modo BANK ou pixels LIVE no modo LIVE.


Arquivos de modos e switches
----------------------------

SW_BANK.h
  Logica do modo BANK.
  Atualiza os seis switches de bank, seleciona presetNumber 1 a 6, avanca a
  bankLetter quando o mesmo switch e pressionado novamente e trata o combo
  SW1+SW2 da BFMIDI-3 NANO para entrar/sair do LIVE.

SW_LIVE.h
  Logica inicial do modo LIVE.
  Renderiza a tela LIVE e mantem os LEDs LIVE acesos. A logica detalhada dos
  switches em LIVE sera implementada depois.

SW_MODE.h
  Controle do modo atual do sistema.
  Alterna entre SWITCH_MODE_BANK e SWITCH_MODE_LIVE, atualiza display/LEDs e
  le o botao LIVE dedicado quando a board possui esse pino.


Arquivos do WebServer
---------------------

WEB_SERVER.h
  Nucleo do servidor HTTP.
  Mantem a instancia WebServer, helpers comuns, CORS, envio de arquivos estaticos,
  rota /save, registro dos modulos de API/upload e restart agendado do ESP32-S2.

WEB_API_CONFIG.h
  API de configuracao global.
  Expoe /config/global para ler/salvar board, brilho, cores, modo de cores dos
  LEDs e paleta. Aplica mudancas em runtime quando possivel e agenda restart
  quando a board muda.

WEB_API_BANK.h
  API de bank atual.
  Expoe /bank/current para ler ou selecionar bankLetter + presetNumber.
  Retorna bank, bank_letter, bank_letter_index, preset_number, switch_index e
  data do preset atual.

WEB_API_WIFI.h
  API de WiFi.
  Expoe /wifi/status, /wifi/scan, /wifi/connect e /wifi/disconnect.
  Salva credenciais STA, conecta na rede de casa e agenda restart apos nova
  configuracao de WiFi.

WEB_UPLOAD.h
  Upload de arquivos para o LittleFS.
  Expoe /upload e /upload.html, valida caminho de destino e grava o arquivo
  recebido no filesystem.
