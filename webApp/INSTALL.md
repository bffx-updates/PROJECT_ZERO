# Como instalar o BFMIDI Editor no celular

O editor pode ser "instalado" como ícone na tela inicial. A experiência é diferente em iOS e Android porque cada sistema trata sites HTTP de forma diferente.

## iOS (iPhone, iPad) — Safari

✅ Funciona como app fullscreen (sem barra do Safari).

1. Conecte o iPhone ao WiFi **BFMIDI_WIFI** (senha: `bfmidi@editor`).
2. Abra o **Safari** e digite `http://192.168.4.1`.
3. Toque no botão **Compartilhar** (quadrado com seta pra cima ⎙).
4. Role e toque em **Adicionar à Tela de Início**.
5. Toque em **Adicionar** no canto superior direito.

Pronto — o ícone do BFMIDI aparece na tela inicial. Ao abrir, o app preenche a tela inteira sem mostrar a barra do navegador.

> **Importante:** o Safari precisa ser usado obrigatoriamente. Chrome, Firefox e outros navegadores no iOS abrem como aba normal.

## Android — Chrome (e maioria dos navegadores)

⚠️ Funciona como atalho, **mas a barra de endereço do Chrome continua visível**.

1. Conecte o Android ao WiFi **BFMIDI_WIFI** (senha: `bfmidi@editor`).
2. Abra o **Chrome** e digite `http://192.168.4.1`.
3. Toque no menu (⋮) → **Adicionar à tela inicial** → **Adicionar**.

O ícone aparece, mas ao abrir o app o Chrome mostra a barra de URL acima da interface.

### Por quê?

O Chrome no Android só esconde a barra (modo "PWA standalone") quando o site é servido via **HTTPS**. Como o BFMIDI serve por HTTP no IP local (`192.168.4.1`), o Chrome trata como página comum.

### Workaround opcional: Samsung Internet

Se quiser o app fullscreen no Android, instale o **Samsung Internet** da Play Store (funciona em qualquer Android, não só Samsung). Em algumas versões, ele honra o modo standalone mesmo em HTTP.

1. Abra o Samsung Internet em `http://192.168.4.1`.
2. Menu → **Adicionar página a** → **Tela inicial**.
3. Marque a opção **Aplicativo da web** se aparecer.

## Onde encontrar o IP do BFMIDI

- **AP modo:** `http://192.168.4.1` (sempre, quando conectado no `BFMIDI_WIFI`)
- **STA modo (LAN):** o IP é mostrado no display do BFMIDI quando o WiFi está ligado, ou pode ser acessado via `http://bfmidi.local` em redes que suportam mDNS.

## Funcionamento offline

⚠️ **O webApp não funciona offline quando acessado pelo BFMIDI.** O cache offline (Service Worker) é uma funcionalidade que browsers só ativam em conexões seguras (HTTPS), e o BFMIDI serve por HTTP. Mantenha o WiFi conectado ao BFMIDI durante o uso.
