// BFMIDI webApp — visual estilo iPhone, totalmente plugado nos endpoints do ESP32-S2.
// Mantém todo o estado/handlers do app.jsx anterior (loadGlobalConfig, saveGlobalConfig,
// selectBank, scan/connect/disconnect WiFi, loadBankCurrent, loadWifiStatus).
// Visual = referência "BFMIDI iPhone Live".

const { useState, useEffect, useRef, useCallback } = React;

// ─── Paleta de LEDs (mantém id 0..14 igual ao firmware) ─────────────
const LED_COLORS = [
  { id: 0,  hex: '#ff3030', name: 'VERMELHO',     rgb: [255, 48, 48] },
  { id: 1,  hex: '#22cc44', name: 'VERDE',        rgb: [34, 204, 68] },
  { id: 2,  hex: '#3a6dff', name: 'AZUL',         rgb: [58, 109, 255] },
  { id: 3,  hex: '#ffcc20', name: 'AMARELO',      rgb: [255, 204, 32] },
  { id: 4,  hex: '#9a2bd9', name: 'ROXO',         rgb: [154, 43, 217] },
  { id: 5,  hex: '#22d4d4', name: 'CYAN',         rgb: [34, 212, 212] },
  { id: 6,  hex: '#f5f5ff', name: 'BRANCO',       rgb: [245, 245, 255] },
  { id: 7,  hex: '#ff7a1a', name: 'LARANJA',      rgb: [255, 122, 26] },
  { id: 8,  hex: '#ff3a92', name: 'MAGENTA',      rgb: [255, 58, 146] },
  { id: 9,  hex: '#ff5a3a', name: 'CORAL',        rgb: [255, 90, 58] },
  { id: 10, hex: '#1aa3ff', name: 'AZUL CELESTE', rgb: [26, 163, 255] },
  { id: 11, hex: '#b835ff', name: 'VIOLETA',      rgb: [184, 53, 255] },
  { id: 12, hex: '#ff89cc', name: 'ROSA',         rgb: [255, 137, 204] },
  { id: 13, hex: '#3aff7a', name: 'MENTA',        rgb: [58, 255, 122] },
  { id: 14, hex: '#3a3a3e', name: 'OFF',          rgb: [58, 58, 62] },
];

// ─── Paleta visual (cores de display, distinta de LED_COLORS) ──────
// ─── Paleta de cores do display (espelha DISPLAY_PALETTE em DISPLAY_COLORS.h) ──
// Ordem e contagem DEVEM bater com o firmware. IDs = indices neste array.
const DISP_TYPE = {
  SOLID: 0,
  GRADIENT_1: 1,
  GRADIENT_2: 2,
  CUSTOM_BLACK: 3,
  MISC_GRADIENT: 4,
  TRANSPARENT: 5,
  BACK_IMAGE: 6,
};
const DISP_DIR = { NONE: 0, H: 1, V: 2, D: 3, RADIAL: 4 };

// 32 cores base reutilizadas pelos blocos SOLID/G1/G2/CUSTOM.
const DISPLAY_BASE_COLORS = [
  { name: 'Preto',           hex: 0x000000 },
  { name: 'Cinza Escuro',    hex: 0x555555 },
  { name: 'Cinza Claro',     hex: 0xAAAAAA },
  { name: 'Branco',          hex: 0xFFFFFF },
  { name: 'Oliva Escuro',    hex: 0x666600 },
  { name: 'Oliva',           hex: 0xAAAA00 },
  { name: 'Amarelo',         hex: 0xFFFF00 },
  { name: 'Amarelo Claro',   hex: 0xFFFF88 },
  { name: 'Marrom',          hex: 0x8B4513 },
  { name: 'Ocre',            hex: 0xD2691E },
  { name: 'Laranja',         hex: 0xFF8C00 },
  { name: 'Pessego',         hex: 0xFFDAB9 },
  { name: 'Bordo',           hex: 0x800000 },
  { name: 'Vermelho Escuro', hex: 0xCC0000 },
  { name: 'Vermelho',        hex: 0xFF0000 },
  { name: 'Salmao',          hex: 0xFA8072 },
  { name: 'Purpura',         hex: 0x800080 },
  { name: 'Magenta Escura',  hex: 0xCC00CC },
  { name: 'Magenta',         hex: 0xFF00FF },
  { name: 'Rosa Claro',      hex: 0xFFB6C1 },
  { name: 'Indigo',          hex: 0x4B0082 },
  { name: 'Roxo',            hex: 0x8A2BE2 },
  { name: 'Violeta',         hex: 0x9932CC },
  { name: 'Lilas',           hex: 0xDDA0DD },
  { name: 'Azul Marinho',    hex: 0x000080 },
  { name: 'Azul Escuro',     hex: 0x0000CC },
  { name: 'Azul',            hex: 0x0000FF },
  { name: 'Azul Claro',      hex: 0x87CEFA },
  { name: 'Verde Escuro',    hex: 0x006400 },
  { name: 'Verde Medio',     hex: 0x00A000 },
  { name: 'Verde',           hex: 0x00FF00 },
  { name: 'Verde Claro',     hex: 0x98FB98 },
];

// SOLID/G1/G2/CUSTOM: hex_mid/hex_end ficam null (derivam stops da base).
// G2 e DIAGONAL; CUSTOM e VERTICAL com preto/base/preto.
const _baseAs = (prefix, type, direction) =>
  DISPLAY_BASE_COLORS.map((c) => ({
    name: prefix + c.name, hex: c.hex, hex_mid: null, hex_end: null, type, direction,
  }));

const DISPLAY_PALETTE = [
  { name: 'Sem Cor', hex: 0x000000, hex_mid: null, hex_end: null, type: DISP_TYPE.TRANSPARENT, direction: DISP_DIR.NONE },
  ..._baseAs('',         DISP_TYPE.SOLID,        DISP_DIR.NONE),
  ..._baseAs('G1 ',      DISP_TYPE.GRADIENT_1,   DISP_DIR.V),
  ..._baseAs('G2 ',      DISP_TYPE.GRADIENT_2,   DISP_DIR.D),
  ..._baseAs('Custom ',  DISP_TYPE.CUSTOM_BLACK, DISP_DIR.V),
  // MISC: 3 stops explicitos (start -> mid -> end) ao longo da direcao.
  { name: 'Sunset Horizontal',        hex: 0xFF2D55, hex_mid: 0xFFB347, hex_end: 0xFF6A00, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Fire Diagonal',            hex: 0xFFD200, hex_mid: 0xFF6A00, hex_end: 0xB30000, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Ember Horizontal',         hex: 0xFF8C00, hex_mid: 0xFF3D00, hex_end: 0x6E0E0E, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Lava Vertical',            hex: 0xFFD000, hex_mid: 0xFF3C00, hex_end: 0x800000, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.V },
  { name: 'Berry Diagonal',           hex: 0xFF85B3, hex_mid: 0xFF2D74, hex_end: 0x800040, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Flamingo Horizontal',      hex: 0xFFB6C1, hex_mid: 0xFF6E96, hex_end: 0xC0426E, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Candy Diagonal',           hex: 0xFFB3D9, hex_mid: 0xFF50B4, hex_end: 0x7A1F5E, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Por do Sol Vertical',      hex: 0xFFB347, hex_mid: 0xFF7832, hex_end: 0xB33A00, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.V },
  { name: 'Gold Vertical',            hex: 0xFFEB99, hex_mid: 0xFFC247, hex_end: 0xB8860B, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.V },
  { name: 'Cobre Horizontal',         hex: 0xE8A77A, hex_mid: 0xC87832, hex_end: 0x6B3410, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Steel Vertical',           hex: 0xD7DAE0, hex_mid: 0xA5B0C4, hex_end: 0x4F5562, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.V },
  { name: 'Noite Vertical',           hex: 0x4B5BAF, hex_mid: 0x191970, hex_end: 0x000033, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.V },
  { name: 'Lima Horizontal',          hex: 0xDEFF80, hex_mid: 0xA0FF00, hex_end: 0x5C9900, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Toxic Horizontal',         hex: 0xB3FF80, hex_mid: 0x76FF03, hex_end: 0x2E7D00, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Aurora Vertical',          hex: 0xA8FFD8, hex_mid: 0x44FFB0, hex_end: 0x00805F, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.V },
  { name: 'Floresta Horizontal',      hex: 0x4FE077, hex_mid: 0x00B43C, hex_end: 0x003D14, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Neon Diagonal',            hex: 0xB3FFE0, hex_mid: 0x00FFB4, hex_end: 0x008866, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Aqua Diagonal',            hex: 0x99EEFF, hex_mid: 0x00D8FF, hex_end: 0x007A99, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Ice Diagonal',             hex: 0xC8F7FF, hex_mid: 0x78F0FF, hex_end: 0x0099AA, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Ocean Horizontal',         hex: 0x99DAFF, hex_mid: 0x00B4FF, hex_end: 0x003C99, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Sky Diagonal',             hex: 0xBBDFFF, hex_mid: 0x62BEFF, hex_end: 0x0E5499, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Oceano Profundo Diagonal', hex: 0x4683C5, hex_mid: 0x0050A0, hex_end: 0x002550, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
  { name: 'Grape Horizontal',         hex: 0xD9B3FF, hex_mid: 0x9B4DFF, hex_end: 0x4A1E80, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.H },
  { name: 'Ametista Diagonal',        hex: 0xC599FF, hex_mid: 0x823CFF, hex_end: 0x3A0F80, type: DISP_TYPE.MISC_GRADIENT, direction: DISP_DIR.D },
];
// IDs por bloco — uteis pra renderizar secoes no popover.
const PALETTE_SECTIONS = (() => {
  const sections = { transparent: [], solid: [], g1: [], g2: [], custom: [], misc: [] };
  DISPLAY_PALETTE.forEach((c, id) => {
    if (c.type === DISP_TYPE.TRANSPARENT)    sections.transparent.push(id);
    else if (c.type === DISP_TYPE.SOLID)     sections.solid.push(id);
    else if (c.type === DISP_TYPE.GRADIENT_1) sections.g1.push(id);
    else if (c.type === DISP_TYPE.GRADIENT_2) sections.g2.push(id);
    else if (c.type === DISP_TYPE.CUSTOM_BLACK) sections.custom.push(id);
    else if (c.type === DISP_TYPE.MISC_GRADIENT) sections.misc.push(id);
  });
  return sections;
})();

function hexToCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}
function shiftHex(hex, amt) {
  let r = (hex >> 16) & 0xFF, g = (hex >> 8) & 0xFF, b = hex & 0xFF;
  if (amt >= 0) {
    r = r + (255 - r) * amt; g = g + (255 - g) * amt; b = b + (255 - b) * amt;
  } else {
    r = r * (1 + amt); g = g * (1 + amt); b = b * (1 + amt);
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
// CSS background string para preview do swatch. Espelha o renderer do firmware:
//   G1 (V):   light(base) -> base -> dark(base)
//   G2 (D):   light(base) -> base -> dark(base)
//   CUSTOM (V): preto       -> base -> preto
//   MISC:     hex          -> hex_mid -> hex_end (na direcao do struct)
function paletteBackground(entry) {
  if (!entry) return '#000';
  const { type, direction, hex, hex_mid, hex_end } = entry;
  if (type === DISP_TYPE.TRANSPARENT) {
    return 'repeating-conic-gradient(#9aa3b2 0% 25%, #4a4f59 0% 50%) 50% / 12px 12px';
  }
  if (type === DISP_TYPE.SOLID || type === DISP_TYPE.BACK_IMAGE) {
    return hexToCss(hex);
  }
  const base = hexToCss(hex);
  if (type === DISP_TYPE.GRADIENT_1) {
    const light = shiftHex(hex, 0.35);
    const dark = shiftHex(hex, -0.45);
    return `linear-gradient(180deg, ${light} 0%, ${base} 50%, ${dark} 100%)`;
  }
  if (type === DISP_TYPE.GRADIENT_2) {
    const light = shiftHex(hex, 0.35);
    const dark = shiftHex(hex, -0.45);
    return `linear-gradient(135deg, ${light} 0%, ${base} 50%, ${dark} 100%)`;
  }
  if (type === DISP_TYPE.CUSTOM_BLACK) {
    return `linear-gradient(180deg, #000 0%, ${base} 50%, #000 100%)`;
  }
  if (type === DISP_TYPE.MISC_GRADIENT) {
    const s0 = hexToCss(hex);
    const s1 = hexToCss(hex_mid != null ? hex_mid : hex);
    const s2 = hexToCss(hex_end != null ? hex_end : hex);
    const angle =
      direction === DISP_DIR.H ? '90deg' :
      direction === DISP_DIR.D ? '135deg' :
      '180deg';
    return `linear-gradient(${angle}, ${s0} 0%, ${s1} 50%, ${s2} 100%)`;
  }
  return base;
}

// ─── Modelos ────────────────────────────────────────────────────────
const MODELS = [
  { id: 'BFMIDI-1 7S_A1', tag: 'BFMIDI-1', switches: 8, size: '3x3 GRID' },
  { id: 'BFMIDI-1 7S_B1', tag: 'BFMIDI-1', switches: 8, size: '3x3 GRID' },
  { id: 'BFMIDI-1 7S_C1', tag: 'BFMIDI-1', switches: 8, size: '3x3 GRID' },
  { id: 'BFMIDI-1 4S',    tag: 'BFMIDI-1', switches: 4, size: '1x4 LAYOUT' },
  { id: 'BFMIDI-2 NANO',  tag: 'BFMIDI-2', switches: 6, size: '2x3 LAYOUT' },
  { id: 'BFMIDI-2 MICRO', tag: 'BFMIDI-2', switches: 6, size: '2x3 LAYOUT' },
  { id: 'BFMIDI-2 4S',    tag: 'BFMIDI-2', switches: 4, size: '1x4 LAYOUT' },
  { id: 'BFMIDI-2 6S',    tag: 'BFMIDI-2', switches: 6, size: '2x3 LAYOUT' },
  { id: 'BFMIDI-2 7S',    tag: 'BFMIDI-2', switches: 8, size: '3x3 GRID' },
  { id: 'BFMIDI-3 NANO',  tag: 'BFMIDI-3', switches: 6, size: '2x3 LAYOUT' },
  { id: 'BFMIDI-3 6S',    tag: 'BFMIDI-3', switches: 6, size: '2x3 LAYOUT' },
  { id: 'BFMIDI-3 7S',    tag: 'BFMIDI-3', switches: 8, size: '3x3 GRID' },
];

const FAMILIES = ['BFMIDI-1', 'BFMIDI-2', 'BFMIDI-3'];

// ─── API base ───────────────────────────────────────────────────────
const DEFAULT_DEVICE_API = 'http://192.168.4.1';
const URL_API = new URLSearchParams(location.search).get('api');

function normalizeApiBase(value) {
  const api = String(value || '').trim();
  if (!api) return '';
  const withProtocol = /^https?:\/\//i.test(api) ? api : `http://${api}`;
  return withProtocol.replace(/\/+$/, '');
}
function isLocalPreviewHost(h) {
  return location.protocol === 'file:' || h === '' || h === 'localhost' || h === '127.0.0.1' || h === '::1';
}
// Device API e mutavel: a tela de conexao pode trocar o IP em runtime,
// e o resultado e persistido em localStorage pra autoreconexao no proximo
// boot. Em .bat localhost ja vem com DEFAULT_DEVICE_API; quando o webApp
// ja roda dentro do ESP32 (same-origin), DEVICE_API fica '' e os fetchs
// usam paths relativos.
let DEVICE_API = normalizeApiBase(URL_API) ||
                 (isLocalPreviewHost(location.hostname) ? DEFAULT_DEVICE_API : '') ||
                 (typeof localStorage !== 'undefined' ? (localStorage.getItem('bfmidi_deviceApi') || '') : '');
function apiUrl(path) { return DEVICE_API + path; }
function setDeviceApi(url) {
  DEVICE_API = normalizeApiBase(url);
  try { localStorage.setItem('bfmidi_deviceApi', DEVICE_API); } catch {}
}
function clearDeviceApi() {
  DEVICE_API = '';
  try { localStorage.removeItem('bfmidi_deviceApi'); } catch {}
}

let _httpQueue = Promise.resolve();

function queuedFetch(url, init = {}, timeoutMs = 12000) {
  const run = async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };
  const task = _httpQueue.then(run, run);
  _httpQueue = task.catch(() => {});
  return task;
}

// Transport selector: o webApp pode falar com o firmware via HTTP (WiFi) ou
// USB Serial (Web Serial API). Quando USB esta conectado, _transport.usbSend
// e populado e apiCall() roteia automaticamente. Caso contrario cai pra HTTP.
//
// Resposta do firmware (USB): "STATUS JSON-OR-TEXT" (sem o prefixo '<', ja
// removido pelo reader). apiCallUsb parseia STATUS + corpo JSON.
const _transport = { usbSend: null, usbConnected: false };

async function apiCallUsb(method, path, body) {
  let line = method + ' ' + path;
  if (body !== undefined && body !== null && body !== '') {
    const s = typeof body === 'string' ? body : String(body);
    line += ' ' + s;
  }
  const resp = await _transport.usbSend(line);
  // resp = "200 {...}" ou "400 {...}" — parseia status + body
  const space = resp.indexOf(' ');
  const status = parseInt(resp.slice(0, space >= 0 ? space : resp.length), 10);
  const bodyStr = space >= 0 ? resp.slice(space + 1) : '';
  if (status >= 200 && status < 300) {
    return bodyStr ? JSON.parse(bodyStr) : {};
  }
  let errMsg = `USB ${status}`;
  try { const j = JSON.parse(bodyStr); if (j.error) errMsg += ': ' + j.error; } catch {}
  throw new Error(errMsg);
}

async function apiCallHttp(method, path, body) {
  const init = { method };
  if (body !== undefined && body !== null && body !== '') init.body = body;
  const timeoutMs = path.startsWith('/wifi/connect') ? 18000 : 12000;
  const r = await queuedFetch(apiUrl(path), init, timeoutMs);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  // Alguns endpoints HTTP retornam texto puro ("OK"). Tenta parsear como
  // JSON; se falhar, devolve um objeto vazio (callers que precisam dos
  // dados usam endpoints JSON conhecidos).
  const text = await r.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

// Roteia entre HTTP e USB conforme estado do transporte.
async function apiCall(method, path, body) {
  if (_transport.usbConnected && _transport.usbSend) {
    return apiCallUsb(method, path, body);
  }
  return apiCallHttp(method, path, body);
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, Number(v) || 0)); }
// Limite de segurança: 100% no app = 80% real no LED (byte máx = 204).
const BRIGHTNESS_BYTE_MAX = 204;
function brightnessByteToPercent(v) { return Math.round(clamp(v, 0, BRIGHTNESS_BYTE_MAX) / BRIGHTNESS_BYTE_MAX * 100); }
function brightnessPercentToByte(v) { return Math.round(clamp(v, 0, 100) / 100 * BRIGHTNESS_BYTE_MAX); }
function applyDevicePalette(colors) {
  if (!Array.isArray(colors)) return;
  colors.forEach((rgb, i) => {
    if (!LED_COLORS[i] || !Array.isArray(rgb) || rgb.length < 3) return;
    LED_COLORS[i].rgb = [clamp(rgb[0], 0, 255), clamp(rgb[1], 0, 255), clamp(rgb[2], 0, 255)];
  });
}
window.LED_COLORS = LED_COLORS;

// ─── Atoms visuais ──────────────────────────────────────────────────
function StatusBar({ time }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      padding: '18px 28px 10px', display: 'flex',
      justifyContent: 'space-between', zIndex: 20, color: '#fff',
      fontFamily: '-apple-system, system-ui', fontSize: 17, fontWeight: 590,
      pointerEvents: 'none',
    }}>
      <span>{time}</span>
      <span style={{ width: 126 }} />
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx=".6" fill="#fff"/><rect x="5" y="5" width="3" height="6" rx=".6" fill="#fff"/><rect x="10" y="2" width="3" height="9" rx=".6" fill="#fff"/><rect x="15" y="0" width="3" height="11" rx=".6" fill="#fff"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="#fff"><path d="M8 2.8C10.1 2.8 12 3.6 13.4 4.9L14.5 3.8C12.7 2.2 10.5 1.2 8 1.2C5.5 1.2 3.3 2.2 1.5 3.8L2.6 4.9C4 3.6 5.9 2.8 8 2.8z"/><path d="M8 6.2C9.3 6.2 10.4 6.6 11.2 7.4L12.3 6.3C11.1 5.2 9.6 4.5 8 4.5C6.4 4.5 4.9 5.2 3.7 6.3L4.8 7.4C5.6 6.6 6.7 6.2 8 6.2z"/><circle cx="8" cy="9.5" r="1.3"/></svg>
        <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#fff" strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="19" height="8" rx="2" fill="#fff"/><path d="M24 4v4c.7-.2 1.3-1 1.3-2s-.6-1.8-1.3-2z" fill="#fff" fillOpacity=".4"/></svg>
      </span>
    </div>
  );
}

function HomeIndicator() {
  return (
    <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
      <div style={{ width: 134, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.5)' }} />
    </div>
  );
}

function BrightnessSlider({ value, onChange }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);

  const update = useCallback((clientX) => {
    const node = ref.current; if (!node) return;
    const r = node.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(Math.round(t * 100));
  }, [onChange]);

  useEffect(() => {
    if (!drag) return;
    const mm = (e) => { e.preventDefault(); update(e.clientX); };
    const tm = (e) => { e.preventDefault(); update(e.touches[0].clientX); };
    const up = () => setDrag(false);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', up);
    };
  }, [drag, update]);

  return (
    <div
      ref={ref}
      className={'bf-slider' + (drag ? ' is-dragging' : '')}
      onMouseDown={(e) => { e.preventDefault(); setDrag(true); update(e.clientX); }}
      onTouchStart={(e) => { setDrag(true); update(e.touches[0].clientX); }}
      style={{ cursor: 'ew-resize', touchAction: 'none' }}
    >
      <div className="bf-slider-fill" style={{ width: `${value}%` }} />
      <div className="bf-slider-label">
        <span className="v">{value}</span><span className="u">%</span>
      </div>
      <div className="bf-slider-ticks">
        {Array.from({ length: 21 }).map((_, i) => <span key={i} className="t" />)}
      </div>
    </div>
  );
}

function FootswitchArc({ label, colorId, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const safeId = clamp(colorId, 0, 14);
  const color = LED_COLORS[safeId].hex;
  const isOff = safeId === 14;
  const r = 30, cx = 36, cy = 36;
  const arcs = [90, 210, 330];
  const seg = (a) => {
    const a1 = (a - 36) * Math.PI / 180;
    const a2 = (a + 36) * Math.PI / 180;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="bf-fsw" ref={ref} style={{ position: 'relative' }}>
      <button className="bf-fsw-glyph" style={{ '--led-c': color, border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <svg className="bf-fsw-arcs" viewBox="0 0 72 72">
          {arcs.map((a, i) => (
            <path key={i} d={seg(a)} stroke={isOff ? '#26262a' : color} />
          ))}
        </svg>
      </button>
      <span className="bf-fsw-label">{label}</span>
      {open && (
        <>
        <div className="bf-modal-backdrop" onClick={() => setOpen(false)} />
        <div className="bf-color-pop">
          <div className="bf-color-pop-head">
            <div className="bf-color-pop-preview" style={{ background: LED_COLORS[safeId].hex }} />
            <div className="bf-color-pop-info">
              <span className="bf-color-pop-eyebrow">COR ATUAL · {label}</span>
              <span className="bf-color-pop-name">{LED_COLORS[safeId].name}</span>
            </div>
            <button className="bf-color-pop-close" onClick={() => setOpen(false)} aria-label="Fechar">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6L18 18M18 6L6 18"/>
              </svg>
            </button>
          </div>
          <div className="bf-color-pop-grid">
            {LED_COLORS.map((c) => (
              <button
                key={c.id}
                className={'bf-swatch' + (c.id === safeId ? ' is-active' : '') + (c.id === 14 ? ' is-off' : '')}
                style={{ '--sw': c.hex }}
                onClick={() => { onChange(c.id); setOpen(false); }}
                aria-label={c.name}
              >{c.id === 14 && <span>OFF</span>}</button>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ─── BANK ───────────────────────────────────────────────────────────
const DEFAULT_PRESET_META = () => ({
  name: '',
  bank: 0,            // MSB+LSB combinado, 0..16383
  channel: 1,         // 0 = MUTE, 1..16
  nameColorId: 4,     // SOLID Branco (DISPLAY_PALETTE)
  nameBorderColorId: 0, // TRANSPARENT (sem contorno por padrao)
  bgColorId: 0,       // TRANSPARENT (display fica preto na tela cheia)
  backLayersColorId: 0,
  tagColorId: 11,     // SOLID Laranja
  fontSize: 18,       // 9 (so bold), 12, 18, 24
  fontBold: false,    // FreeSans vs FreeSansBold
  nameAlign: 4,       // 0..8 grid 3x3 (4 = centro)
  // Extras: 4 PCs + 2 CCs. ch=0 indica slot desativado.
  extraPcs: [
    { ch: 0, program: 0 },
    { ch: 0, program: 0 },
    { ch: 0, program: 0 },
    { ch: 0, program: 0 },
  ],
  extraCcs: [
    { ch: 0, ctrl: 0, value: 0 },
    { ch: 0, ctrl: 0, value: 0 },
  ],
});

// Helpers para serializar/parsear extras na string compacta usada na API:
//   extra_pcs = "ch:pg,ch:pg,ch:pg,ch:pg"
//   extra_ccs = "ch:ctl:val,ch:ctl:val"
//
// NOTA DE ARQUITETURA: program/ctrl/value sao valores LOGICOS. A traducao
// para bytes MIDI reais (RAW PC, Bank MSB+LSB+PC, par de CCs, sysex...)
// acontece no firmware usando um OutputProfile por canal (a implementar).
// Trocar pedal de saida => editar OutputProfile, nunca os presets.
function parseExtraPcsStr(s) {
  const out = [
    { ch: 0, program: 0 }, { ch: 0, program: 0 },
    { ch: 0, program: 0 }, { ch: 0, program: 0 },
  ];
  if (typeof s !== 'string' || !s) return out;
  const parts = s.split(',');
  for (let i = 0; i < 4 && i < parts.length; i++) {
    const [ch, pg] = parts[i].split(':');
    out[i].ch = clamp(parseInt(ch, 10) || 0, 0, 16);
    out[i].program = clamp(parseInt(pg, 10) || 0, 0, 127);
  }
  return out;
}
function serializeExtraPcs(arr) {
  return arr.map(p => `${p.ch | 0}:${p.program | 0}`).join(',');
}
function parseExtraCcsStr(s) {
  const out = [
    { ch: 0, ctrl: 0, value: 0 }, { ch: 0, ctrl: 0, value: 0 },
  ];
  if (typeof s !== 'string' || !s) return out;
  const parts = s.split(',');
  for (let i = 0; i < 2 && i < parts.length; i++) {
    const [ch, ctl, val] = parts[i].split(':');
    out[i].ch = clamp(parseInt(ch, 10) || 0, 0, 16);
    out[i].ctrl = clamp(parseInt(ctl, 10) || 0, 0, 127);
    out[i].value = clamp(parseInt(val, 10) || 0, 0, 127);
  }
  return out;
}
function serializeExtraCcs(arr) {
  return arr.map(c => `${c.ch | 0}:${c.ctrl | 0}:${c.value | 0}`).join(',');
}

// Tamanhos disponiveis: regular nao tem 9pt, so bold.
const FONT_SIZES_BOLD = [9, 12, 18, 24];
const FONT_SIZES_REGULAR = [12, 18, 24];
function fontSizesFor(bold) { return bold ? FONT_SIZES_BOLD : FONT_SIZES_REGULAR; }
function nextFontSize(size, bold) {
  const list = fontSizesFor(bold);
  const idx = list.indexOf(size);
  return list[(idx + 1) % list.length];
}
function clampFontSize(size, bold) {
  const list = fontSizesFor(bold);
  return list.includes(size) ? size : list[0];
}

function ColorBar({ label, colorId, onChange, restrictTypes }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const safeId = clamp(colorId, 0, DISPLAY_PALETTE.length - 1);
  const safe = DISPLAY_PALETTE[safeId] || DISPLAY_PALETTE[0];
  const fill = paletteBackground(safe);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const allowType = (t) => !restrictTypes || restrictTypes.includes(t);
  const sectionDefs = [
    { id: 'transparent', title: 'TRANSPARENCIA', type: DISP_TYPE.TRANSPARENT, ids: PALETTE_SECTIONS.transparent },
    { id: 'solid',       title: 'SOLID COLORS',  type: DISP_TYPE.SOLID,       ids: PALETTE_SECTIONS.solid },
    { id: 'g1',          title: 'GRADIENT 1',    type: DISP_TYPE.GRADIENT_1,  ids: PALETTE_SECTIONS.g1 },
    { id: 'g2',          title: 'GRADIENT 2',    type: DISP_TYPE.GRADIENT_2,  ids: PALETTE_SECTIONS.g2 },
    { id: 'custom',      title: 'CUSTOM',        type: DISP_TYPE.CUSTOM_BLACK,ids: PALETTE_SECTIONS.custom },
    { id: 'misc',        title: 'MISC GRADIENTS',type: DISP_TYPE.MISC_GRADIENT,ids: PALETTE_SECTIONS.misc },
  ].filter((s) => allowType(s.type));

  return (
    <div className="bf-field" ref={ref} style={{ position: 'relative' }}>
      <span className="bf-field-label">{label}</span>
      <button
        type="button"
        className="bf-color-bar"
        style={{ background: fill }}
        onClick={() => setOpen((v) => !v)}
        aria-label={`${label}: ${safe.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      {open && (
        <>
          <div className="bf-modal-backdrop" onClick={() => setOpen(false)} />
          <div className="bf-color-pop bf-palette-pop">
            <div className="bf-color-pop-head">
              <div className="bf-color-pop-preview" style={{ background: fill }} />
              <div className="bf-color-pop-info">
                <span className="bf-color-pop-eyebrow">COR ATUAL · {label}</span>
                <span className="bf-color-pop-name">{safe.name}</span>
              </div>
              <button className="bf-color-pop-close" onClick={() => setOpen(false)} aria-label="Fechar">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="bf-palette-scroll">
              {sectionDefs.map((sec) => (
                <div key={sec.id} className={'bf-palette-section bf-palette-section-' + sec.id}>
                  <div className="bf-palette-section-title">{sec.title}</div>
                  <div className="bf-color-pop-grid">
                    {sec.ids.map((id) => {
                      const c = DISPLAY_PALETTE[id];
                      // Sempre seta background inline para sobrescrever o brilho
                      // radial do .bf-swatch (que e desejavel pros LEDs mas falsifica
                      // gradientes nas cores SOLIDAS da paleta do display).
                      return (
                        <button
                          key={id}
                          type="button"
                          className={'bf-swatch' + (id === safeId ? ' is-active' : '')}
                          style={{ '--sw': hexToCss(c.hex), background: paletteBackground(c) }}
                          onClick={() => { onChange(id); setOpen(false); }}
                          aria-label={c.name}
                          title={c.name}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function metaFromApi(json) {
  if (!json || typeof json !== 'object') return DEFAULT_PRESET_META();
  const fontBold = String(json.font_bold) === '1' || json.font_bold === true;
  const rawSize = parseInt(json.font_size, 10);
  const fontSize = clampFontSize(Number.isFinite(rawSize) ? rawSize : 18, fontBold);
  return {
    name: typeof json.name_raw === 'string' ? json.name_raw : '',
    bank: clamp(parseInt(json.midi_bank, 10) || 0, 0, 16383),
    channel: clamp(parseInt(json.channel, 10) || 0, 0, 16),
    nameColorId: clamp(parseInt(json.name_color, 10) || 0, 0, DISPLAY_PALETTE.length - 1),
    nameBorderColorId: clamp(parseInt(json.name_border_color, 10) || 0, 0, DISPLAY_PALETTE.length - 1),
    bgColorId: clamp(parseInt(json.bg_color, 10) || 0, 0, DISPLAY_PALETTE.length - 1),
    backLayersColorId: clamp(parseInt(json.back_layers_color, 10) || 0, 0, DISPLAY_PALETTE.length - 1),
    tagColorId: clamp(parseInt(json.tag_color, 10) || 0, 0, DISPLAY_PALETTE.length - 1),
    fontSize,
    fontBold,
    nameAlign: clamp(parseInt(json.name_align, 10) || 0, 0, 8),
    extraPcs: parseExtraPcsStr(json.extra_pcs),
    extraCcs: parseExtraCcsStr(json.extra_ccs),
  };
}

function metaToApiBody(meta) {
  const body = new URLSearchParams();
  body.set('name', meta.name);
  body.set('midi_bank', String(meta.bank));
  body.set('channel', String(meta.channel));
  body.set('name_color', String(meta.nameColorId));
  body.set('name_border_color', String(meta.nameBorderColorId));
  body.set('bg_color', String(meta.bgColorId));
  body.set('back_layers_color', String(meta.backLayersColorId));
  body.set('tag_color', String(meta.tagColorId));
  body.set('font_size', String(meta.fontSize));
  body.set('font_bold', meta.fontBold ? '1' : '0');
  body.set('name_align', String(meta.nameAlign));
  body.set('extra_pcs', serializeExtraPcs(meta.extraPcs || []));
  body.set('extra_ccs', serializeExtraCcs(meta.extraCcs || []));
  return body;
}

function PresetEditorCard({ tag, onDisplayNameChange, onRegisterSave }) {
  const [metaByTag, setMetaByTag] = useState({});
  const [savedMetaByTag, setSavedMetaByTag] = useState({});
  const [status, setStatus] = useState('idle'); // idle | loading | saving | saved | error
  const [activeTab, setActiveTab] = useState('midi'); // midi | display | extras | monitor
  const [monitorEntry, setMonitorEntry] = useState(null);
  const monitorLastTagRef = useRef(null);
  const meta = metaByTag[tag] || DEFAULT_PRESET_META();
  const savedMeta = savedMetaByTag[tag];
  const isDirty = savedMeta
    ? JSON.stringify(meta) !== JSON.stringify(savedMeta)
    : false;

  // Carrega meta do firmware ao trocar de tag (uma vez por tag). Usa
  // apiCall (HTTP ou USB conforme transporte ativo).
  useEffect(() => {
    if (metaByTag[tag] || (!DEVICE_API && !_transport.usbConnected)) return;
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const json = await apiCall('GET', `/bank/preset?bank=${encodeURIComponent(tag)}`);
        if (cancelled) return;
        const loaded = metaFromApi(json.meta || json);
        setMetaByTag((prev) => ({ ...prev, [tag]: loaded }));
        setSavedMetaByTag((prev) => ({ ...prev, [tag]: loaded }));
        setStatus('idle');
      } catch (e) {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [tag, metaByTag]);

  const savePreset = useCallback(async () => {
    if ((!DEVICE_API && !_transport.usbConnected) || !metaByTag[tag]) return;
    setStatus('saving');
    try {
      await apiCall('POST', `/bank/preset?bank=${encodeURIComponent(tag)}`, metaToApiBody(meta));
      setSavedMetaByTag((prev) => ({ ...prev, [tag]: meta }));
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1200);
    } catch (e) {
      setStatus('error');
    }
  }, [tag, meta, metaByTag]);

  const update = useCallback((patch) => {
    setMetaByTag((prev) => ({
      ...prev,
      [tag]: { ...(prev[tag] || DEFAULT_PRESET_META()), ...patch },
    }));
  }, [tag]);

  const displayName = meta.name || tag;
  useEffect(() => {
    if (onDisplayNameChange) onDisplayNameChange(meta.name || '');
  }, [meta.name, tag, onDisplayNameChange]);

  // Monitor: substitui o conteudo a cada chamada de preset (mudanca de
  // tag). Espera o saved meta carregar pra ter PC/CH corretos. Nao guarda
  // historico — eh um monitor de conferencia do dado atual.
  useEffect(() => {
    const saved = savedMetaByTag[tag];
    if (!saved) return;
    if (monitorLastTagRef.current === tag) return;
    monitorLastTagRef.current = tag;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    setMonitorEntry({
      tag,
      name: saved.name || tag,
      pc: saved.bank,
      ch: saved.channel,
      time: `${hh}:${mm}:${ss}`,
    });
  }, [tag, savedMetaByTag]);

  // Registra savePreset + estado pro botao SAVE global (TabBar) acionar.
  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave({ save: savePreset, status, isDirty });
  }, [onRegisterSave, savePreset, status, isDirty]);
  const statusLabel = {
    loading: 'CARREGANDO',
    saving: 'SALVANDO',
    saved: 'SALVO',
    error: 'ERRO',
    idle: '',
  }[status];

  const alignLabels = [
    'Topo esquerda', 'Topo centro', 'Topo direita',
    'Meio esquerda', 'Meio centro', 'Meio direita',
    'Base esquerda', 'Base centro', 'Base direita',
  ];

  return (
    <div className="bf-preset-card">
      <div className="bf-preset-card-head">
        <div
          className={'bf-status-badge is-' + (status === 'saving' ? 'saving' : status === 'error' ? 'error' : isDirty ? 'dirty' : 'ok')}
          title={
            status === 'saving' ? 'Salvando...'
            : status === 'error' ? 'Erro ao salvar'
            : isDirty ? 'Mudancas nao salvas — clique em SAVE'
            : 'Tudo salvo'
          }
          aria-label="Status de salvamento do preset"
        >
          <span className="bf-status-dot" aria-hidden="true"></span>
          <span className="bf-status-label">STATUS</span>
        </div>
        <div className="bf-preset-tabs" role="tablist" aria-label="Modo de edicao do preset">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'midi'}
            className={'bf-preset-tab' + (activeTab === 'midi' ? ' is-active' : '')}
            onClick={() => setActiveTab('midi')}
          >
            <svg viewBox="0 0 24 24" className="bf-tab-ico" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Conector DIN: corpo circular, 8 pinos em arco superior +
                  entalhe inferior tipico do conector MIDI */}
              <circle className="bf-tab-shape" cx="12" cy="12" r="8.5" />
              <circle className="bf-tab-dot" cx="12"   cy="6.5"  r="1.0" />
              <circle className="bf-tab-dot" cx="8.5"  cy="7.4"  r="1.0" />
              <circle className="bf-tab-dot" cx="15.5" cy="7.4"  r="1.0" />
              <circle className="bf-tab-dot" cx="6.5"  cy="10"   r="1.0" />
              <circle className="bf-tab-dot" cx="17.5" cy="10"   r="1.0" />
              <circle className="bf-tab-dot" cx="6.5"  cy="13"   r="1.0" />
              <circle className="bf-tab-dot" cx="17.5" cy="13"   r="1.0" />
              <circle className="bf-tab-dot" cx="12"   cy="15.5" r="1.0" />
              <path className="bf-tab-shape" d="M10 19 L12 21 L14 19" />
            </svg>
            <span>MIDI</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'display'}
            className={'bf-preset-tab' + (activeTab === 'display' ? ' is-active' : '')}
            onClick={() => setActiveTab('display')}
          >
            <svg viewBox="0 0 24 24" className="bf-tab-ico" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Monitor com EQ bars de altura variada + pe pequeno */}
              <rect className="bf-tab-shape" x="2.5" y="4.5" width="19" height="12" rx="1.6" />
              <rect className="bf-tab-dot" x="6"  y="11" width="1.6" height="3.5" />
              <rect className="bf-tab-dot" x="9"  y="9"  width="1.6" height="5.5" />
              <rect className="bf-tab-dot" x="12" y="7"  width="1.6" height="7.5" />
              <rect className="bf-tab-dot" x="15" y="10" width="1.6" height="4.5" />
              <rect className="bf-tab-dot" x="18" y="12" width="1.6" height="2.5" />
              <path className="bf-tab-shape" d="M9 21h6 M12 16.5v4.5" />
            </svg>
            <span>DISPLAY</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'extras'}
            className={'bf-preset-tab' + (activeTab === 'extras' ? ' is-active' : '')}
            onClick={() => setActiveTab('extras')}
          >
            <svg viewBox="0 0 24 24" className="bf-tab-ico" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Tres faders verticais com handles em alturas diferentes */}
              <path className="bf-tab-shape" d="M6 4V20" />
              <path className="bf-tab-shape" d="M12 4V20" />
              <path className="bf-tab-shape" d="M18 4V20" />
              <circle className="bf-tab-shape" cx="6"  cy="10" r="2.3" />
              <circle className="bf-tab-shape" cx="12" cy="15" r="2.3" />
              <circle className="bf-tab-shape" cx="18" cy="8"  r="2.3" />
            </svg>
            <span>EXTRAS</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'monitor'}
            className={'bf-preset-tab' + (activeTab === 'monitor' ? ' is-active' : '')}
            onClick={() => setActiveTab('monitor')}
          >
            <svg viewBox="0 0 24 24" className="bf-tab-ico" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Terminal/console: tela com prompt > e linha */}
              <rect className="bf-tab-shape" x="2.5" y="4" width="19" height="14" rx="1.6" />
              <path className="bf-tab-line" d="M6 9l2 2-2 2" />
              <path className="bf-tab-line" d="M11 13h6" />
              <path className="bf-tab-shape" d="M9 21h6 M12 18v3" />
            </svg>
            <span>MONITOR</span>
          </button>
        </div>
      </div>

      <div className="bf-preset-card-body">
        {activeTab === 'midi' && (
          <>
            <div className="bf-preset-name-wrap">
              <input
                type="text"
                className="bf-preset-name-input"
                value={meta.name}
                placeholder={tag}
                onChange={(e) => update({ name: e.target.value.slice(0, 16) })}
                maxLength={16}
                spellCheck={false}
                aria-label="Nome do preset"
              />
            </div>
            <hr className="bf-preset-divider" />
            <div className="bf-extras-row">
              <span className="bf-extras-index">1</span>
              <label className="bf-extras-cell">
                <span className="bf-field-label">PC</span>
                <div className="bf-select-wrap">
                  <select
                    className="bf-input bf-select"
                    value={meta.bank}
                    onChange={(e) => update({ bank: clamp(Number(e.target.value), 0, 600) })}
                    aria-label="Program Change"
                  >
                    {Array.from({ length: 601 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                  <span className="bf-select-chev">▾</span>
                </div>
              </label>
              <label className="bf-extras-cell">
                <span className="bf-field-label">Canal</span>
                <div className="bf-select-wrap">
                  <select
                    className={'bf-input bf-select' + (meta.channel === 0 ? ' is-mute' : '')}
                    value={meta.channel}
                    onChange={(e) => update({ channel: Number(e.target.value) })}
                    aria-label="Canal MIDI"
                  >
                    <option value={0}>MUTE</option>
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="bf-select-chev">▾</span>
                </div>
              </label>
            </div>
          </>
        )}

        {activeTab === 'display' && (
          <div className="bf-display-grid">
            <label className="bf-field bf-grid-tamanho">
              <span className="bf-field-label">Tamanho</span>
              <button
                type="button"
                className="bf-input bf-input-num"
                onClick={() => update({ fontSize: nextFontSize(meta.fontSize, meta.fontBold) })}
                aria-label={`Tamanho da fonte: ${meta.fontSize} pt`}
                title="Clique para alternar"
              >
                {meta.fontSize}pt
              </button>
            </label>
            <label className="bf-field bf-grid-negrito">
              <span className="bf-field-label">Negrito</span>
              <button
                type="button"
                className={'bf-input bf-input-num' + (meta.fontBold ? ' is-active' : '')}
                onClick={() => {
                  const nextBold = !meta.fontBold;
                  update({ fontBold: nextBold, fontSize: clampFontSize(meta.fontSize, nextBold) });
                }}
                aria-pressed={meta.fontBold}
                aria-label={`Negrito: ${meta.fontBold ? 'sim' : 'nao'}`}
                title="Clique para alternar"
              >
                {meta.fontBold ? 'SIM' : 'NAO'}
              </button>
            </label>
            <div className="bf-grid-namecolor-top">
              <ColorBar
                label="Name Color"
                colorId={meta.nameColorId}
                onChange={(id) => update({ nameColorId: id })}
                restrictTypes={[DISP_TYPE.TRANSPARENT, DISP_TYPE.SOLID]}
              />
            </div>

            <div className="bf-grid-namecolor">
              <ColorBar
                label="Name Border"
                colorId={meta.nameBorderColorId}
                onChange={(id) => update({ nameBorderColorId: id })}
                restrictTypes={[DISP_TYPE.TRANSPARENT, DISP_TYPE.SOLID]}
              />
            </div>
            <div className="bf-grid-background">
              <ColorBar
                label="Background"
                colorId={meta.bgColorId}
                onChange={(id) => update({ bgColorId: id })}
              />
            </div>
            <label className="bf-field bf-grid-alinhamento">
              <span className="bf-field-label">Alinhamento</span>
              <div className="bf-align-grid bf-align-grid-large" role="radiogroup" aria-label="Alinhamento do nome">
                {Array.from({ length: 9 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={meta.nameAlign === i}
                    aria-label={alignLabels[i]}
                    title={alignLabels[i]}
                    className={'bf-align-cell' + (meta.nameAlign === i ? ' is-active' : '')}
                    onClick={() => update({ nameAlign: i })}
                  />
                ))}
              </div>
            </label>

            <div className="bf-grid-tagcolor">
              <ColorBar
                label="Tag Color"
                colorId={meta.tagColorId}
                onChange={(id) => update({ tagColorId: id })}
                restrictTypes={[DISP_TYPE.TRANSPARENT, DISP_TYPE.SOLID]}
              />
            </div>
            <div className="bf-grid-backlayers">
              <ColorBar
                label="Back layers"
                colorId={meta.backLayersColorId}
                onChange={(id) => update({ backLayersColorId: id })}
              />
            </div>
          </div>
        )}

        {activeTab === 'extras' && (
          <div className="bf-extras-grid">
            <div className="bf-extras-section">
              <div className="bf-extras-section-title">PCs EXTRAS</div>
              {meta.extraPcs.map((pc, i) => (
                <div key={i} className="bf-extras-row">
                  <span className="bf-extras-index">{i + 2}</span>
                  <label className="bf-extras-cell">
                    <span className="bf-field-label">PC</span>
                    <div className="bf-select-wrap">
                      <select
                        className="bf-input bf-select"
                        value={pc.program}
                        disabled={pc.ch === 0}
                        onChange={(e) => {
                          const next = meta.extraPcs.slice();
                          next[i] = { ...next[i], program: Number(e.target.value) };
                          update({ extraPcs: next });
                        }}
                        aria-label={`Programa do PC extra ${i + 1}`}
                      >
                        {Array.from({ length: 128 }, (_, n) => n).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span className="bf-select-chev">▾</span>
                    </div>
                  </label>
                  <label className="bf-extras-cell">
                    <span className="bf-field-label">Canal</span>
                    <div className="bf-select-wrap">
                      <select
                        className="bf-input bf-select"
                        value={pc.ch}
                        onChange={(e) => {
                          const next = meta.extraPcs.slice();
                          next[i] = { ...next[i], ch: Number(e.target.value) };
                          update({ extraPcs: next });
                        }}
                        aria-label={`Canal do PC extra ${i + 1}`}
                      >
                        <option value={0}>OFF</option>
                        {Array.from({ length: 16 }, (_, n) => n + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span className="bf-select-chev">▾</span>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="bf-extras-section">
              <div className="bf-extras-section-title">CCs EXTRAS</div>
              {meta.extraCcs.map((cc, i) => (
                <div key={i} className="bf-extras-row bf-extras-row-cc">
                  <span className="bf-extras-index">{i + 6}</span>
                  <label className="bf-extras-cell">
                    <span className="bf-field-label">CC</span>
                    <div className="bf-select-wrap">
                      <select
                        className="bf-input bf-select"
                        value={cc.ctrl}
                        disabled={cc.ch === 0}
                        onChange={(e) => {
                          const next = meta.extraCcs.slice();
                          next[i] = { ...next[i], ctrl: Number(e.target.value) };
                          update({ extraCcs: next });
                        }}
                        aria-label={`Controlador do CC extra ${i + 1}`}
                      >
                        {Array.from({ length: 128 }, (_, n) => n).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span className="bf-select-chev">▾</span>
                    </div>
                  </label>
                  <label className="bf-extras-cell">
                    <span className="bf-field-label">Valor</span>
                    <div className="bf-select-wrap">
                      <select
                        className="bf-input bf-select"
                        value={cc.value}
                        disabled={cc.ch === 0}
                        onChange={(e) => {
                          const next = meta.extraCcs.slice();
                          next[i] = { ...next[i], value: Number(e.target.value) };
                          update({ extraCcs: next });
                        }}
                        aria-label={`Valor do CC extra ${i + 1}`}
                      >
                        {Array.from({ length: 128 }, (_, n) => n).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span className="bf-select-chev">▾</span>
                    </div>
                  </label>
                  <label className="bf-extras-cell">
                    <span className="bf-field-label">Canal</span>
                    <div className="bf-select-wrap">
                      <select
                        className="bf-input bf-select"
                        value={cc.ch}
                        onChange={(e) => {
                          const next = meta.extraCcs.slice();
                          next[i] = { ...next[i], ch: Number(e.target.value) };
                          update({ extraCcs: next });
                        }}
                        aria-label={`Canal do CC extra ${i + 1}`}
                      >
                        <option value={0}>OFF</option>
                        {Array.from({ length: 16 }, (_, n) => n + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span className="bf-select-chev">▾</span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="bf-monitor">
            {!monitorEntry ? (
              <div className="bf-monitor-empty">Aguardando chamada de preset...</div>
            ) : (
              <div key={monitorEntry.tag + '@' + monitorEntry.time} className="bf-monitor-entry">
                <div className="bf-monitor-line">
                  <span className="bf-monitor-time">{monitorEntry.time}</span>
                  <span className="bf-monitor-tag">{monitorEntry.tag}</span>
                  <span className="bf-monitor-sep">-</span>
                  <span className="bf-monitor-name">{monitorEntry.name}</span>
                </div>
                <div className="bf-monitor-line bf-monitor-header">
                  HEADER = PC {monitorEntry.pc} - CH {monitorEntry.ch}
                </div>
              </div>
            )}
          </div>
        )}

        {(statusLabel || (isDirty && status === 'idle')) && (
          <p className="bf-hint">
            {statusLabel && <span className={'bf-hint-status is-' + status}>{statusLabel}</span>}
            {isDirty && status === 'idle' && <span className="bf-hint-status is-dirty">NAO SALVO</span>}
          </p>
        )}
      </div>
    </div>
  );
}

// Header compartilhado entre as 3 paginas (PRESET / GLOBAL / SYSTEM):
// titulo grande a esquerda + chip AP/STA + chip USB a direita.
function PageHeader({
  title, deviceState, usbState, onToggleUsb,
  connectionMode, onToggleConnectionMode,
}) {
  return (
    <div className="bf-header bf-header-preset">
      <h1 className="bf-title">{title}</h1>
      <div className="bf-conn-icons">
        <button
          type="button"
          className={'bf-conn-mode is-' + deviceState + ' is-mode-' + (connectionMode || 'AP').toLowerCase()}
          onClick={onToggleConnectionMode}
          aria-label={`Modo de conexao WiFi: ${connectionMode}. Toque para alternar.`}
          title={
            `Modo ${connectionMode} — ` +
            (deviceState === 'online' ? 'CONECTADO'
              : deviceState === 'loading' ? 'CONECTANDO'
              : 'OFFLINE — toque pra trocar pra ' + (connectionMode === 'AP' ? 'STA' : 'AP'))
          }
        >
          <span className="bf-conn-mode-label">{connectionMode || 'AP'}</span>
        </button>

        <button
          type="button"
          className={'bf-conn-icon is-' + usbState}
          onClick={onToggleUsb}
          disabled={usbState === 'unsupported'}
          aria-label={
            usbState === 'connected' ? 'USB conectado — clique para desconectar'
            : usbState === 'connecting' ? 'USB conectando'
            : usbState === 'unsupported' ? 'USB indisponivel neste browser'
            : 'USB offline — clique para conectar'
          }
          title={
            usbState === 'connected' ? 'USB ONLINE'
            : usbState === 'connecting' ? 'USB CONECTANDO'
            : usbState === 'unsupported' ? 'Web Serial nao suportado'
            : usbState === 'error' ? 'USB falhou — clique para tentar de novo'
            : 'USB OFFLINE — clique para conectar'
          }
        >
          {/* Icone USB tradicional: trident apontando pra cima. */}
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2L8.5 6.5H15.5Z" fill="currentColor" stroke="none" />
            <path d="M12 6.5V20.5" />
            <path d="M12 13H7V17" />
            <rect x="5.5" y="16.5" width="3" height="3" fill="currentColor" stroke="none" />
            <path d="M12 10H17V14" />
            <circle cx="17" cy="15.2" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="21" r="1.8" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PagePresetConfig({
  bankLetterIndex, presetNumber, bankData, bankDisplayName, bankState, deviceState,
  usbState, onToggleUsb,
  connectionMode, onToggleConnectionMode,
  presetCount, onNextLetter, onSelectPreset, onDisplayNameChange,
  onRegisterPresetSave,
}) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const tag = `${letters[bankLetterIndex]}${presetNumber}`;
  const presets = Array.from({ length: presetCount }, (_, i) => i + 1);
  const tileName = (bankDisplayName && bankDisplayName.trim()) || tag;
  return (
    <div className="bf-content" key="bank">
      <PageHeader
        title="SET PRESET"
        deviceState={deviceState}
        usbState={usbState}
        onToggleUsb={onToggleUsb}
        connectionMode={connectionMode}
        onToggleConnectionMode={onToggleConnectionMode}
      />

      <div className="bf-bank-row">
        <button
          type="button"
          className={'bf-bank-tile' + (bankState === 'loading' ? ' is-loading' : bankState === 'error' ? ' is-error' : '')}
          onClick={onNextLetter}
          aria-label={`Bank ${letters[bankLetterIndex]} (${tag}) — toque para alternar`}
          title={`${tag} · ${bankState === 'loading' ? 'LOADING' : bankState === 'error' ? 'ERROR' : 'LOADED'}`}
        >
          <span className="led" />
          <span className="letter">{letters[bankLetterIndex]}</span>
          <span className="bf-bank-name" title={tileName}>{tileName}</span>
        </button>
        {presets.map((n) => (
          <button key={n} type="button" className={'bf-preset' + (n === presetNumber ? ' is-active' : '')} onClick={() => onSelectPreset(n)}>
            <span className="led" />
            <span className="num">{n}</span>
            <span className="label">PRESET</span>
          </button>
        ))}
      </div>

      <PresetEditorCard tag={tag} onDisplayNameChange={onDisplayNameChange} onRegisterSave={onRegisterPresetSave} />
    </div>
  );
}

// ─── GLOBAL ─────────────────────────────────────────────────────────
function PageGlobalConfig({
  brightness, setBrightness,
  autoStartEnabled, setAutoStartEnabled,
  autoStartMode, setAutoStartMode,
  autoStartBank, setAutoStartBank,
  autoStartPreset, setAutoStartPreset,
  bankLetterEnabled, setBankLetterEnabled,
  bankChangeMode, setBankChangeMode,
  ledColorMode, setLedColorMode,
  letterLedColors, setLetterLedColors,
  switchLedColors, setSwitchLedColors,
  presetCount,
  deviceState, usbState, onToggleUsb,
  connectionMode, onToggleConnectionMode,
}) {
  const [section, setSection] = useState('leds');
  const letters = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="bf-content" key="global">
      <PageHeader
        title="GLOBAL"
        deviceState={deviceState}
        usbState={usbState}
        onToggleUsb={onToggleUsb}
        connectionMode={connectionMode}
        onToggleConnectionMode={onToggleConnectionMode}
      />
      <div className="bf-icon-tabs">
          <button className={'bf-icon-tab' + (section === 'midi' ? ' is-on' : '')} onClick={() => setSection('midi')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Conector DIN MIDI: 8 pinos em arco + entalhe inferior */}
              <circle className="bf-tab-shape" cx="12" cy="12" r="8.5" />
              <circle className="bf-tab-dot" cx="12"   cy="6.5"  r="1.0" />
              <circle className="bf-tab-dot" cx="8.5"  cy="7.4"  r="1.0" />
              <circle className="bf-tab-dot" cx="15.5" cy="7.4"  r="1.0" />
              <circle className="bf-tab-dot" cx="6.5"  cy="10"   r="1.0" />
              <circle className="bf-tab-dot" cx="17.5" cy="10"   r="1.0" />
              <circle className="bf-tab-dot" cx="6.5"  cy="13"   r="1.0" />
              <circle className="bf-tab-dot" cx="17.5" cy="13"   r="1.0" />
              <circle className="bf-tab-dot" cx="12"   cy="15.5" r="1.0" />
              <path className="bf-tab-shape" d="M10 19 L12 21 L14 19" />
            </svg>
            <span>MIDI</span>
          </button>
          <button className={'bf-icon-tab' + (section === 'display' ? ' is-on' : '')} onClick={() => setSection('display')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Monitor com EQ bars + pe pequeno */}
              <rect className="bf-tab-shape" x="2.5" y="4.5" width="19" height="12" rx="1.6" />
              <rect className="bf-tab-dot" x="6"  y="11" width="1.6" height="3.5" />
              <rect className="bf-tab-dot" x="9"  y="9"  width="1.6" height="5.5" />
              <rect className="bf-tab-dot" x="12" y="7"  width="1.6" height="7.5" />
              <rect className="bf-tab-dot" x="15" y="10" width="1.6" height="4.5" />
              <rect className="bf-tab-dot" x="18" y="12" width="1.6" height="2.5" />
              <path className="bf-tab-shape" d="M9 21h6 M12 16.5v4.5" />
            </svg>
            <span>DISPLAY</span>
          </button>
          <button className={'bf-icon-tab' + (section === 'leds' ? ' is-on' : '')} onClick={() => setSection('leds')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Anel de LEDs: circulo principal + 8 pontos ao redor */}
              <circle className="bf-tab-shape" cx="12" cy="12" r="7.5" />
              <circle className="bf-tab-dot" cx="12"   cy="3.5"  r="1.1" />
              <circle className="bf-tab-dot" cx="18.0" cy="6.0"  r="1.1" />
              <circle className="bf-tab-dot" cx="20.5" cy="12"   r="1.1" />
              <circle className="bf-tab-dot" cx="18.0" cy="18.0" r="1.1" />
              <circle className="bf-tab-dot" cx="12"   cy="20.5" r="1.1" />
              <circle className="bf-tab-dot" cx="6.0"  cy="18.0" r="1.1" />
              <circle className="bf-tab-dot" cx="3.5"  cy="12"   r="1.1" />
              <circle className="bf-tab-dot" cx="6.0"  cy="6.0"  r="1.1" />
            </svg>
            <span>LEDS</span>
          </button>
          <button className={'bf-icon-tab' + (section === 'banks' ? ' is-on' : '')} onClick={() => setSection('banks')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Pilha de banks (3 camadas) */}
              <path className="bf-tab-shape" d="M12 3.5 L3 8 L12 12.5 L21 8 Z" />
              <path className="bf-tab-shape" d="M3 12 L12 16.5 L21 12" />
              <path className="bf-tab-shape" d="M3 16 L12 20.5 L21 16" />
            </svg>
            <span>BANKS</span>
          </button>
        </div>

      {section === 'midi' && (
        <div className="bf-card">
          <div className="bf-card-head">
            <h3>MIDI</h3>
            <span className="meta">EM BREVE</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 4px', lineHeight: 1.5 }}>
            Configurações MIDI ainda não disponíveis.
          </p>
        </div>
      )}

      {section === 'display' && (
        <div className="bf-card">
          <div className="bf-card-head">
            <h3>Display</h3>
            <span className="meta">EM BREVE</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 4px', lineHeight: 1.5 }}>
            Configurações de display ainda não disponíveis.
          </p>
        </div>
      )}

      {section === 'leds' && (
        <>
          <div className="bf-card">
            <div className="bf-card-head">
              <h3>LED Brightness</h3>
              <span className="meta">PWM · {brightness}%</span>
            </div>
            <BrightnessSlider value={brightness} onChange={setBrightness} />
            <div className="bf-led-strip">
              <span className="bf-led-strip-label">PREVIEW · {presetCount} LEDS</span>
              {Array.from({ length: presetCount }).map((_, i) => (
                <span key={i} className="led-dot" style={{
                  opacity: 0.15 + (brightness / 100) * 0.85,
                  boxShadow: `0 0 ${4 + brightness / 8}px var(--accent-glow)`,
                }} />
              ))}
            </div>
          </div>

          <div className="bf-card">
            <div className="bf-card-head">
              <h3>Banks &amp; Presets</h3>
              <span className="meta">{ledColorMode === 'letras' ? 'POR LETRA A-E' : 'POR SWITCH 1-6'}</span>
            </div>
            <div className="bf-seg">
              <button className={ledColorMode === 'letras' ? 'is-active' : ''} onClick={() => setLedColorMode('letras')}>POR LETRA</button>
              <button className={ledColorMode === 'numeros' ? 'is-active' : ''} onClick={() => setLedColorMode('numeros')}>POR SWITCH</button>
            </div>

            <div className="bf-fsw-grid">
              {ledColorMode === 'letras'
                ? letterLedColors.map((c, i) => (
                    <FootswitchArc
                      key={'L' + i}
                      label={'BANK ' + 'ABCDE'[i]}
                      colorId={c}
                      onChange={(id) => {
                        const next = letterLedColors.slice();
                        next[i] = id;
                        setLetterLedColors(next);
                      }}
                    />
                  ))
                : switchLedColors.map((c, i) => (
                    <FootswitchArc
                      key={'S' + i}
                      label={'PRESET ' + (i + 1)}
                      colorId={c}
                      onChange={(id) => {
                        const next = switchLedColors.slice();
                        next[i] = id;
                        setSwitchLedColors(next);
                      }}
                    />
                  ))}
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '14px 4px 0', lineHeight: 1.4 }}>
              Toque em qualquer LED para abrir a paleta de 14 cores.
            </p>
          </div>
        </>
      )}

      {section === 'banks' && (
        <>
          <div className="bf-card">
            <div className="bf-card-head">
              <h3>Auto Start</h3>
              <span className="meta">PRESET ON BOOT</span>
            </div>
            <div className="bf-auto-row">
              <span className="label">Iniciar com preset</span>
              <button
                className={'bf-switch is-accent' + (autoStartEnabled ? ' is-on' : '')}
                onClick={() => setAutoStartEnabled(!autoStartEnabled)}
              />
            </div>
            <div style={{ height: 12 }} />
            <div className="bf-seg" style={{ opacity: autoStartEnabled ? 1 : 0.4, pointerEvents: autoStartEnabled ? 'auto' : 'none' }}>
              <button className={autoStartMode === 'bank' ? 'is-active' : ''} onClick={() => setAutoStartMode('bank')}>BANK</button>
              <button className={autoStartMode === 'live' ? 'is-active' : ''} onClick={() => setAutoStartMode('live')}>LIVE</button>
            </div>
            <div className="bf-cycle" style={{ opacity: autoStartEnabled ? 1 : 0.4 }}>
              <button className="is-on" disabled={!autoStartEnabled} onClick={() => setAutoStartBank((autoStartBank + 1) % 5)}>
                <span className="cap">BANK</span>{letters[autoStartBank]}
              </button>
              <button className="is-on" disabled={!autoStartEnabled} onClick={() => setAutoStartPreset((autoStartPreset % presetCount) + 1)}>
                <span className="cap">PRESET</span>{autoStartPreset}
              </button>
            </div>
          </div>

          <div className="bf-card">
            <div className="bf-card-head">
              <h3>Change Banks</h3>
              <span className="meta">SELEÇÃO DE PRESETS</span>
            </div>
            <div className="bf-seg">
              <button className={bankChangeMode === 1 ? 'is-active' : ''} onClick={() => setBankChangeMode(1)}>MODO 1 · HÍBRIDO</button>
              <button className={bankChangeMode === 2 ? 'is-active' : ''} onClick={() => setBankChangeMode(2)}>MODO 2 · SINGLE</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '12px 4px 0', lineHeight: 1.5 }}>
              {bankChangeMode === 1
                ? 'Toque curto: troca de preset normal. Segurar um switch: o LED pisca e você navega entre banks sem efetivar — efetiva ao segurar de novo.'
                : 'Toque curto: troca de preset normal. Segurar o switch do preset atual: entra em modo LIVE.'}
            </p>
          </div>

          <div className="bf-card">
            <div className="bf-card-head">
              <h3>Active Banks</h3>
              <span className="meta">SKIP DISABLED</span>
            </div>
            <div className="bf-letter-chips">
              {letters.map((L, i) => (
                <button
                  key={L}
                  className={bankLetterEnabled[i] ? 'is-on' : 'is-off'}
                  onClick={() => {
                    const next = bankLetterEnabled.slice();
                    next[i] = !next[i];
                    setBankLetterEnabled(next);
                  }}
                >{L}</button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '12px 4px 0', lineHeight: 1.4 }}>
              Banks desativados são pulados quando você avança no footswitch.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SYSTEM ─────────────────────────────────────────────────────────
function PageSystemConfig({
  model, setModel,
  wifiStatus, wifiNetworks, wifiSsid, setWifiSsid,
  wifiPassword, setWifiPassword, wifiState,
  onWifiScan, onWifiConnect, onWifiDisconnect,
  deviceState, usbState, onToggleUsb,
  connectionMode, onToggleConnectionMode,
}) {
  const [section, setSection] = useState('model');
  const [family, variant] = (() => {
    const idx = model.indexOf(' ');
    return idx === -1 ? [model, ''] : [model.slice(0, idx), model.slice(idx + 1)];
  })();
  const list = MODELS.filter((m) => m.tag === family);
  const activeModel = MODELS.find((m) => m.id === model) || list[0];
  const wifiConnected = !!(wifiStatus && wifiStatus.sta_connected);

  return (
    <div className="bf-content" key="system">
      <PageHeader
        title="SYSTEM"
        deviceState={deviceState}
        usbState={usbState}
        onToggleUsb={onToggleUsb}
        connectionMode={connectionMode}
        onToggleConnectionMode={onToggleConnectionMode}
      />
      <div className="bf-icon-tabs cols-3">
          <button className={'bf-icon-tab' + (section === 'model' ? ' is-on' : '')} onClick={() => setSection('model')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Chip/MCU: corpo grande (14x14) + 2 pinos longos em cada lado + core dot */}
              <rect className="bf-tab-shape" x="5" y="5" width="14" height="14" rx="1.5" />
              <rect className="bf-tab-dot" x="9" y="9" width="6" height="6" />
              <path className="bf-tab-line" d="M9 2V5 M15 2V5" />
              <path className="bf-tab-line" d="M9 19V22 M15 19V22" />
              <path className="bf-tab-line" d="M2 9H5 M2 15H5" />
              <path className="bf-tab-line" d="M19 9H22 M19 15H22" />
            </svg>
            <span>MODELO</span>
          </button>
          <button className={'bf-icon-tab' + (section === 'wifi' ? ' is-on' : '')} onClick={() => setSection('wifi')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* WiFi: 3 ondas concentricas + ponto na base, ocupando todo o viewBox */}
              <path className="bf-tab-shape" d="M2 8.5 Q12 0 22 8.5" />
              <path className="bf-tab-shape" d="M5 13 Q12 6 19 13" />
              <path className="bf-tab-shape" d="M8.5 17.5 Q12 14 15.5 17.5" />
              <circle className="bf-tab-dot" cx="12" cy="21" r="1.5" />
            </svg>
            <span>WI‑FI</span>
          </button>
        </div>

      {section === 'model' && (
        <div className="bf-card">
          <div className="bf-model-tabs">
            {FAMILIES.map((f) => (
              <button
                key={f}
                className={family === f ? 'is-active' : ''}
                onClick={() => {
                  const first = MODELS.find((m) => m.tag === f);
                  if (first) setModel(first.id);
                }}
              >{f}</button>
            ))}
          </div>

          {list.map((v) => (
            <div
              key={v.id}
              className={'bf-model-row' + (model === v.id ? ' is-active' : '')}
              onClick={() => setModel(v.id)}
            >
              <span className="bf-model-radio" />
              <span className="bf-model-name">{v.id}</span>
              <span className="bf-model-meta">{v.switches}SW · {v.size}</span>
            </div>
          ))}

          <div className="bf-stats">
            <div className="bf-stat"><span className="k">Active</span><span className="v accent">{model}</span></div>
            <div className="bf-stat"><span className="k">Switches</span><span className="v">{activeModel?.switches}</span></div>
            <div className="bf-stat"><span className="k">Display</span><span className="v">{family === 'BFMIDI-3' ? '480×320' : '320×240'}</span></div>
            <div className="bf-stat"><span className="k">Firmware</span><span className="v">3.0.4</span></div>
          </div>
        </div>
      )}

      {section === 'wifi' && (
        <>
          <div className="bf-card">
            <div className="bf-wifi-status">
              <div className={'bf-wifi-icon' + (wifiConnected ? '' : ' off')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M2 8.5C8 3.5 16 3.5 22 8.5"/><path d="M5 12.5C9.5 8.5 14.5 8.5 19 12.5"/><path d="M8.5 16.5C10.5 14.5 13.5 14.5 15.5 16.5"/><circle cx="12" cy="20" r="1.2" fill="currentColor"/>
                </svg>
              </div>
              <div className="ssid">
                <b>{wifiConnected ? (wifiStatus.sta_ssid || wifiSsid) : 'Desconectado'}</b>
                <span>{wifiConnected
                  ? `STA · ${wifiStatus.sta_ip || '—'}`
                  : `Apenas modo AP · ${(wifiStatus && wifiStatus.ap_ip) || '192.168.4.1'}`}</span>
              </div>
              <button
                className={'bf-switch is-accent' + (wifiConnected ? ' is-on' : '')}
                onClick={() => (wifiConnected ? onWifiDisconnect() : onWifiConnect())}
              />
            </div>

            <div className="bf-input-stack">
              <span className="bf-input-label">SSID</span>
              <select
                className="bf-input is-focus"
                style={{ appearance: 'none', WebkitAppearance: 'none', background: 'var(--card-2)' }}
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
              >
                {wifiSsid && !wifiNetworks.some((n) => n.ssid === wifiSsid) && (
                  <option value={wifiSsid}>{wifiSsid}</option>
                )}
                <option value="">SELECT NETWORK</option>
                {wifiNetworks.map((n) => (
                  <option key={`${n.ssid}-${n.rssi}`} value={n.ssid}>
                    {n.ssid} / {n.rssi} dBm {n.secure ? '/ LOCK' : '/ OPEN'}
                  </option>
                ))}
              </select>
            </div>

            <div className="bf-input-stack" style={{ marginTop: 10 }}>
              <span className="bf-input-label">Password</span>
              <input
                className="bf-input"
                type="password"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder={wifiConnected ? 'saved' : 'network password'}
                style={{ background: 'var(--card-2)', outline: 'none' }}
              />
            </div>

            <div className="bf-actions" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <button className="bf-btn" onClick={onWifiScan} disabled={wifiState === 'scanning'}>
                {wifiState === 'scanning' ? '…' : 'SCAN'}
              </button>
              <button
                className="bf-btn primary"
                onClick={onWifiConnect}
                disabled={!wifiSsid || wifiState === 'connecting' || wifiState === 'scanning'}
              >
                {wifiState === 'connecting' ? '…' : wifiState === 'connected' ? 'OK' : 'CONNECT'}
              </button>
              <button className="bf-btn" onClick={onWifiDisconnect} disabled={wifiState === 'disconnecting'}>FORGET</button>
            </div>
          </div>

          <div className="bf-section-label">Redes próximas</div>
          <div className="bf-card" style={{ padding: 12 }}>
            {wifiNetworks.length === 0 && (
              <div className="bf-row" style={{ padding: '4px 6px', color: 'var(--muted)' }}>
                <span className="label">Nenhuma rede — clique em SCAN.</span>
              </div>
            )}
            {wifiNetworks.map((n, i) => {
              const current = n.ssid === (wifiStatus && wifiStatus.sta_ssid) && wifiConnected;
              return (
                <div
                  key={`${n.ssid}-${i}`}
                  className="bf-row"
                  style={{ padding: '4px 6px', cursor: 'pointer' }}
                  onClick={() => setWifiSsid(n.ssid)}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: current ? 'var(--accent-soft)' : 'rgba(255,255,255,0.05)',
                    color: current ? 'var(--accent)' : 'var(--muted)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M2 8.5C8 3.5 16 3.5 22 8.5"/><path d="M6 12.5C10 9 14 9 18 12.5"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>
                    </svg>
                  </span>
                  <span className="label">
                    {n.ssid}
                    {current && (
                      <span style={{ marginLeft: 8, color: 'var(--accent)', fontSize: 11, letterSpacing: '.16em', fontFamily: 'var(--font-mono)' }}>· CURRENT</span>
                    )}
                  </span>
                  <span className="right">{n.rssi} dBm {n.secure ? '🔒' : ''}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab bar ────────────────────────────────────────────────────────
function TabBar({ page, setPage, saveState, onSave }) {
  const tabs = [
    { id: 'preset_config', label: 'PRESET' },
    { id: 'global_config', label: 'GLOBAL' },
    { id: 'system_config', label: 'SYSTEM' },
  ];
  const saveLabel =
    saveState === 'saving' ? '…' :
    saveState === 'saved'  ? '✓' :
    saveState === 'error'  ? '!' : 'SAVE';
  return (
    <div className="bf-tabbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={'bf-tab ' + t.id + (page === t.id ? ' is-active' : '')}
          onClick={() => setPage(t.id)}
        >{t.label}</button>
      ))}
      <button
        className={'bf-save' + (saveState === 'saved' ? ' is-saved' : '') + (saveState === 'error' ? ' is-error' : '')}
        onClick={onSave}
      >{saveLabel}</button>
    </div>
  );
}

// ─── Tela de conexao (gate inicial) ─────────────────────────────────
// Quando o webApp roda hospedado standalone, comeca sem device API
// definido. Esta tela pergunta qual IP usar (AP do pedal, STA via mDNS,
// ou manual) e/ou oferece USB Web Serial. Apos sucesso, esconde e o
// editor segue normal.
function ConnectionScreen({ onWifiConnect, onUsbToggle, usbState, error,
                            attempting }) {
  const [ip, setIp] = useState(localStorage.getItem('bfmidi_lastManualIp') || '');
  const usbSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  const submitManual = (e) => {
    if (e) e.preventDefault();
    if (!ip.trim()) return;
    const clean = ip.trim().replace(/^https?:\/\//, '');
    localStorage.setItem('bfmidi_lastManualIp', clean);
    onWifiConnect('https://' + clean);
  };

  return (
    <div className="phone-frame">
      <div className="bf-screen">
        <div className="bf-conn-shell">
          <div className="bf-conn-logo">
            <img src="icons/app-192.png" alt="BFMIDI" width="80" height="80" />
            <h1>BFMIDI</h1>
            <p>Editor de presets</p>
          </div>

          <div className="bf-conn-section">
            <div className="bf-conn-section-title">CONECTAR VIA WIFI</div>
            <button
              type="button"
              className="bf-conn-option"
              disabled={attempting}
              onClick={() => onWifiConnect('http://192.168.4.1')}
            >
              <span className="bf-conn-option-title">AP do pedal</span>
              <span className="bf-conn-option-sub">BFMIDI_WIFI · 192.168.4.1</span>
            </button>
            <button
              type="button"
              className="bf-conn-option"
              disabled={attempting}
              onClick={() => onWifiConnect('http://bfmidi.local')}
            >
              <span className="bf-conn-option-title">Rede local (STA)</span>
              <span className="bf-conn-option-sub">bfmidi.local · mesmo WiFi de casa</span>
            </button>

            <form className="bf-conn-manual" onSubmit={submitManual}>
              <input
                type="text"
                className="bf-input"
                placeholder="IP customizado (ex: 192.168.1.50)"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                disabled={attempting}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button
                type="submit"
                className="bf-conn-go"
                disabled={attempting || !ip.trim()}
              >
                {attempting ? '…' : 'CONECTAR'}
              </button>
            </form>
          </div>

          {usbSupported && (
            <div className="bf-conn-section">
              <div className="bf-conn-section-title">OU VIA USB</div>
              <button
                type="button"
                className="bf-conn-option"
                disabled={attempting || usbState === 'connecting'}
                onClick={onUsbToggle}
              >
                <span className="bf-conn-option-title">
                  {usbState === 'connecting' ? 'Conectando…'
                    : usbState === 'connected' ? 'USB conectado ✓'
                    : 'Conectar via cabo USB'}
                </span>
                <span className="bf-conn-option-sub">
                  PC com cabo no pedal · Web Serial
                </span>
              </button>
            </div>
          )}

          {error && <div className="bf-conn-error">{error}</div>}

          <div className="bf-conn-foot">
            BFMIDI Project Zero
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ───────────────────────────────────────────────────────────
function App() {
  const [page, setPage] = useState('preset_config');
  const [saveState, setSaveState] = useState('idle');
  const [deviceState, setDeviceState] = useState('offline');
  // USB transport (Web Serial API). Estados:
  //   'unsupported' (browser nao tem navigator.serial),
  //   'disconnected', 'connecting', 'connected', 'error'.
  const [usbState, setUsbState] = useState(
    typeof navigator !== 'undefined' && 'serial' in navigator
      ? 'disconnected'
      : 'unsupported'
  );
  const usbPortRef = useRef(null);
  const usbReaderRef = useRef(null);
  const usbWriterRef = useRef(null);
  const usbReadBufRef = useRef('');
  // Fila simples de "esperando resposta": resolve a primeira promise quando
  // uma linha '<' chega. Permite request/response request-style sobre stream.
  const usbPendingRef = useRef([]);

  // ── Modo de conexao WiFi (AP vs STA) ─────────────────────────────────
  // Toggle no header alterna entre 2 hosts fixos. Cada modo aponta o
  // DEVICE_API pro IP correspondente; pingHttp valida automaticamente.
  //   AP  -> http://192.168.4.1   (conectado direto no AP do pedal)
  //   STA -> http://bfmidi.local  (mesmo WiFi de casa via mDNS)
  // Quando o webApp roda hospedado dentro do ESP32 (same-origin), esses
  // hosts ficam ignorados — DEVICE_API fica '' e as chamadas viram relativas.
  const AP_HOST = 'http://192.168.4.1';
  const STA_HOST = 'http://bfmidi.local';
  const [connectionMode, setConnectionMode] = useState(() => {
    const saved = (typeof localStorage !== 'undefined' &&
                   localStorage.getItem('bfmidi_connectionMode')) || 'AP';
    return saved === 'STA' ? 'STA' : 'AP';
  });
  const toggleConnectionMode = useCallback(() => {
    setConnectionMode((m) => (m === 'AP' ? 'STA' : 'AP'));
  }, []);
  // Aplica DEVICE_API ao mudar o modo (efeito sem pingHttp aqui;
  // o useEffect do pingHttp ja depende de connectionMode mais abaixo).
  useEffect(() => {
    const host = connectionMode === 'STA' ? STA_HOST : AP_HOST;
    setDeviceApi(host);
    try { localStorage.setItem('bfmidi_connectionMode', connectionMode); } catch {}
  }, [connectionMode]);

  const usbDisconnect = useCallback(async () => {
    try {
      if (usbReaderRef.current) {
        await usbReaderRef.current.cancel().catch(() => {});
        try { usbReaderRef.current.releaseLock(); } catch {}
      }
    } catch {}
    try {
      if (usbWriterRef.current) {
        try { usbWriterRef.current.releaseLock(); } catch {}
      }
    } catch {}
    try {
      if (usbPortRef.current) await usbPortRef.current.close();
    } catch {}
    usbReaderRef.current = null;
    usbWriterRef.current = null;
    usbPortRef.current = null;
    usbReadBufRef.current = '';
    usbPendingRef.current.forEach((p) => p.reject(new Error('disconnected')));
    usbPendingRef.current = [];
    setUsbState('disconnected');
  }, []);

  const usbStartReader = useCallback(async () => {
    const port = usbPortRef.current;
    if (!port) return;
    try {
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable).catch(() => {});
      const reader = decoder.readable.getReader();
      usbReaderRef.current = reader;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        usbReadBufRef.current += value;
        // Processa linhas completas
        let nl;
        while ((nl = usbReadBufRef.current.indexOf('\n')) >= 0) {
          const raw = usbReadBufRef.current.slice(0, nl).replace(/\r$/, '');
          usbReadBufRef.current = usbReadBufRef.current.slice(nl + 1);
          // Responses comecam com '<'. Log lines do firmware nao tem prefixo.
          if (raw.startsWith('<')) {
            const body = raw.slice(1).replace(/^\s+/, '');
            const pending = usbPendingRef.current.shift();
            if (pending) pending.resolve(body);
          }
        }
      }
    } catch (e) {
      // Reader encerrou — ja tratado por usbDisconnect
    }
  }, []);

  const usbSendCommand = useCallback(async (line, timeoutMs = 15000) => {
    if (!usbWriterRef.current) throw new Error('no writer');
    const encoder = new TextEncoder();
    await usbWriterRef.current.write(encoder.encode('> ' + line + '\n'));
    return new Promise((resolve, reject) => {
      usbPendingRef.current.push({ resolve, reject });
      // Timeout amplo (15s) cobre operacoes longas (wifi connect ~12s).
      // Comandos rapidos respondem em ms — sem efeito pratico.
      setTimeout(() => {
        const idx = usbPendingRef.current.findIndex((p) => p.resolve === resolve);
        if (idx >= 0) {
          usbPendingRef.current.splice(idx, 1);
          reject(new Error('timeout'));
        }
      }, timeoutMs);
    });
  }, []);

  const usbConnect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setUsbState('unsupported');
      return;
    }
    setUsbState('connecting');
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      usbPortRef.current = port;
      usbWriterRef.current = port.writable.getWriter();
      // Dispara o reader em background
      usbStartReader();
      // Valida link com PING/PONG
      const pong = await usbSendCommand('PING');
      if (!pong.includes('PONG')) throw new Error('ping failed');
      setUsbState('connected');
    } catch (e) {
      if (e.name === 'NotFoundError') {
        setUsbState('disconnected');
      } else {
        setUsbState('error');
        await usbDisconnect();
      }
    }
  }, [usbStartReader, usbSendCommand, usbDisconnect]);

  const toggleUsb = useCallback(() => {
    if (usbState === 'connected' || usbState === 'connecting') {
      usbDisconnect();
    } else {
      usbConnect();
    }
  }, [usbState, usbConnect, usbDisconnect]);

  // Registra/desregistra o transport USB sempre que muda o estado. Quando
  // connected, apiCall() rota chamadas dos endpoints suportados pra USB
  // em vez de HTTP via WiFi.
  useEffect(() => {
    if (usbState === 'connected') {
      _transport.usbSend = usbSendCommand;
      _transport.usbConnected = true;
    } else {
      _transport.usbSend = null;
      _transport.usbConnected = false;
    }
  }, [usbState, usbSendCommand]);
  // Handle registrado pelo PresetEditorCard para o botao SAVE global salvar
  // presets quando estamos na pagina BANK.
  const presetSaveRef = useRef({ save: null, status: 'idle', isDirty: false });
  const [presetSaveStatus, setPresetSaveStatus] = useState('idle');
  const registerPresetSave = useCallback((handle) => {
    presetSaveRef.current = handle || { save: null, status: 'idle', isDirty: false };
    setPresetSaveStatus(handle ? handle.status : 'idle');
  }, []);

  const [model, setModel] = useState('BFMIDI-3 7S');
  const [brightness, setBrightness] = useState(72);
  const [bankLedColor, setBankLedColor] = useState(2);
  const [liveLedColor, setLiveLedColor] = useState(2);
  const [ledColorMode, setLedColorMode] = useState('letras');
  const [letterLedColors, setLetterLedColors] = useState([2, 2, 2, 2, 2]);
  const [switchLedColors, setSwitchLedColors] = useState([2, 2, 2, 2, 2, 2]);

  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartMode, setAutoStartMode] = useState('bank');
  const [autoStartBank, setAutoStartBank] = useState(0);
  const [autoStartPreset, setAutoStartPreset] = useState(1);
  const [bankLetterEnabled, setBankLetterEnabled] = useState([true, true, true, true, true]);
  const [bankChangeMode, setBankChangeMode] = useState(1); // 1 = HIBRIDO, 2 = SINGLE

  const [bankLetterIndex, setBankLetterIndex] = useState(0);
  const [presetNumber, setPresetNumber] = useState(1);
  const [bankData, setBankData] = useState('');
  const [bankDisplayName, setBankDisplayName] = useState('');
  const [bankState, setBankState] = useState('idle');

  const [wifiStatus, setWifiStatus] = useState(null);
  const [wifiNetworks, setWifiNetworks] = useState([]);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiState, setWifiState] = useState('idle');

  const activeModel = MODELS.find((m) => m.id === model);
  const presetCount = Math.min((activeModel && activeModel.switches) || 6, 6);

  useEffect(() => {
    if (autoStartPreset > presetCount) setAutoStartPreset(presetCount);
  }, [presetCount, autoStartPreset]);

  // ── Health check do WiFi (HTTP) — independente do transport de edicao ──
  // O icone WiFi do header so fica verde se o HTTP responder. USB pode estar
  // ativo simultaneamente; usamos apiCall (que pode rotear por USB) so para
  // dados, e fetch HTTP puro aqui exclusivamente para o status de WiFi.
  const pingHttp = useCallback(async () => {
    if (!DEVICE_API) {
      setDeviceState('offline');
      return false;
    }
    try {
      const r = await queuedFetch(apiUrl('/config/global'), { method: 'GET' }, 3000);
      if (r.ok) {
        setDeviceState('online');
        return true;
      }
    } catch {}
    setDeviceState('offline');
    return false;
  }, []);

  // Re-ping ao trocar estado de USB, modo AP/STA, e periodicamente a 30s.
  useEffect(() => {
    pingHttp();
    const id = setInterval(pingHttp, 30000);
    return () => clearInterval(id);
  }, [pingHttp, usbState, connectionMode]);

  // ── Carregar config global ──
  const loadGlobalConfig = useCallback(async (timeoutMs = 4000) => {
    try {
      const config = await apiCall('GET', '/config/global');
      return config;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tryLoad() {
      // Tenta com timeout curto; se falhar (típico no primeiro hit ao
      // bfmidi.local que ainda precisa resolver mDNS), tenta de novo
      // com timeout maior.
      let config = await loadGlobalConfig(2500);
      if (cancelled) return;
      if (!config) {
        await new Promise((r) => setTimeout(r, 600));
        if (cancelled) return;
        config = await loadGlobalConfig(6000);
      }
      if (cancelled || !config) return;

      applyDevicePalette(config.colors);
      if (config.board) setModel(config.board);
      if (typeof config.led_brightness !== 'undefined') setBrightness(brightnessByteToPercent(config.led_brightness));
      if (typeof config.bank_led_color !== 'undefined') setBankLedColor(clamp(config.bank_led_color, 0, 14));
      if (typeof config.live_led_color !== 'undefined') setLiveLedColor(clamp(config.live_led_color, 0, 14));
      if (typeof config.led_color_mode !== 'undefined') setLedColorMode(Number(config.led_color_mode) === 1 ? 'numeros' : 'letras');
      if (Array.isArray(config.letter_led_colors)) setLetterLedColors([0, 1, 2, 3, 4].map((i) => clamp(config.letter_led_colors[i], 0, 14)));
      if (Array.isArray(config.switch_led_colors)) setSwitchLedColors([0, 1, 2, 3, 4, 5].map((i) => clamp(config.switch_led_colors[i], 0, 14)));
      if (typeof config.auto_start_enabled !== 'undefined') setAutoStartEnabled(Number(config.auto_start_enabled) === 1);
      if (typeof config.auto_start_bank !== 'undefined') setAutoStartBank(clamp(config.auto_start_bank, 0, 4));
      if (typeof config.auto_start_preset !== 'undefined') setAutoStartPreset(clamp(config.auto_start_preset, 1, 8));
      if (typeof config.auto_start_mode !== 'undefined') setAutoStartMode(Number(config.auto_start_mode) === 1 ? 'live' : 'bank');
      if (Array.isArray(config.bank_letter_enabled)) setBankLetterEnabled([0, 1, 2, 3, 4].map((i) => Number(config.bank_letter_enabled[i]) === 1));
      if (typeof config.bank_change_mode !== 'undefined') setBankChangeMode(clamp(config.bank_change_mode, 1, 2) || 1);
      // deviceState e atualizado por pingHttp, nao aqui (load pode ter vindo via USB).
    }
    tryLoad();
    return () => { cancelled = true; };
  }, [loadGlobalConfig, usbState, connectionMode]);

  // Recarregar config manualmente (clicando no status do header).
  const reloadGlobalConfig = useCallback(async () => {
    const config = await loadGlobalConfig(6000);
    if (!config) return;
    applyDevicePalette(config.colors);
    if (config.board) setModel(config.board);
    if (typeof config.led_brightness !== 'undefined') setBrightness(brightnessByteToPercent(config.led_brightness));
    if (typeof config.bank_led_color !== 'undefined') setBankLedColor(clamp(config.bank_led_color, 0, 14));
    if (typeof config.live_led_color !== 'undefined') setLiveLedColor(clamp(config.live_led_color, 0, 14));
    if (typeof config.led_color_mode !== 'undefined') setLedColorMode(Number(config.led_color_mode) === 1 ? 'numeros' : 'letras');
    if (Array.isArray(config.letter_led_colors)) setLetterLedColors([0, 1, 2, 3, 4].map((i) => clamp(config.letter_led_colors[i], 0, 14)));
    if (Array.isArray(config.switch_led_colors)) setSwitchLedColors([0, 1, 2, 3, 4, 5].map((i) => clamp(config.switch_led_colors[i], 0, 14)));
    if (typeof config.auto_start_enabled !== 'undefined') setAutoStartEnabled(Number(config.auto_start_enabled) === 1);
    if (typeof config.auto_start_bank !== 'undefined') setAutoStartBank(clamp(config.auto_start_bank, 0, 4));
    if (typeof config.auto_start_preset !== 'undefined') setAutoStartPreset(clamp(config.auto_start_preset, 1, 8));
    if (typeof config.auto_start_mode !== 'undefined') setAutoStartMode(Number(config.auto_start_mode) === 1 ? 'live' : 'bank');
    if (Array.isArray(config.bank_letter_enabled)) setBankLetterEnabled([0, 1, 2, 3, 4].map((i) => Number(config.bank_letter_enabled[i]) === 1));
    if (typeof config.bank_change_mode !== 'undefined') setBankChangeMode(clamp(config.bank_change_mode, 1, 2) || 1);
    // deviceState (WiFi) e atualizado por pingHttp, independente do transport
    // de edicao.
  }, [loadGlobalConfig]);

  // ── BANK ── (usa apiCall — roteia HTTP ou USB automaticamente)
  const loadBankCurrent = async () => {
    try {
      const bank = await apiCall('GET', '/bank/current');
      setBankLetterIndex(Number(bank.bank_letter_index) || 0);
      setPresetNumber(Number(bank.preset_number) || 1);
      setBankData(bank.data || '');
      setBankDisplayName(bank.meta?.name || '');
    } catch {/* preview */}
  };
  useEffect(() => { if (page === 'preset_config') loadBankCurrent(); }, [page, usbState]);

  // Polling do bank atual enquanto a page de preset esta ativa. Cobre
  // mudancas feitas direto no hardware (footswitches) — sem isso, o app
  // so atualiza quando o usuario interage pela UI. 1.5s e um meio termo
  // entre responsividade percebida e carga no ESP32.
  useEffect(() => {
    if (page !== 'preset_config') return;
    const id = setInterval(() => { loadBankCurrent(); }, 1500);
    return () => clearInterval(id);
  }, [page, usbState]);

  const selectBank = async (li, pn) => {
    setBankState('loading');
    try {
      const tag = `${String.fromCharCode(65 + li)}${pn}`;
      const bank = await apiCall('POST', `/bank/current?bank=${encodeURIComponent(tag)}`);
      setBankLetterIndex(Number(bank.bank_letter_index) || li);
      setPresetNumber(Number(bank.preset_number) || pn);
      setBankData(bank.data || '');
      setBankDisplayName(bank.meta?.name || '');
      setBankState('idle');
    } catch {
      // Update local state in preview mode
      setBankLetterIndex(li);
      setPresetNumber(pn);
      setBankState('error');
      setTimeout(() => setBankState('idle'), 1200);
    }
  };
  const nextBankLetter = () => selectBank((bankLetterIndex + 1) % 5, presetNumber);

  // ── WIFI ──
  const loadWifiStatus = async () => {
    try {
      const s = await apiCall('GET', '/wifi/status');
      setWifiStatus(s);
      if (s.sta_ssid) setWifiSsid(s.sta_ssid);
    } catch { setWifiStatus(null); }
  };
  useEffect(() => { if (page === 'system_config') loadWifiStatus(); }, [page, usbState]);

  const scanWifiNetworks = async () => {
    setWifiState('scanning');
    try {
      const data = await apiCall('GET', '/wifi/scan');
      const networks = Array.isArray(data.networks) ? data.networks : [];
      setWifiNetworks(networks);
      if (!wifiSsid && networks[0]) setWifiSsid(networks[0].ssid);
      setWifiState('idle');
    } catch {
      setWifiState('error');
      setTimeout(() => setWifiState('idle'), 1400);
    }
  };

  const connectWifiSta = async () => {
    setWifiState('connecting');
    try {
      const body = new URLSearchParams();
      body.set('ssid', wifiSsid);
      body.set('password', wifiPassword);
      const s = await apiCall('POST', '/wifi/connect', body);
      setWifiStatus(s);
      setWifiState(s.sta_connected ? 'connected' : 'error');
      setTimeout(() => setWifiState('idle'), 1600);
    } catch {
      setWifiState('error');
      setTimeout(() => setWifiState('idle'), 1600);
    }
  };

  const disconnectWifiSta = async () => {
    setWifiState('disconnecting');
    try {
      const s = await apiCall('POST', '/wifi/disconnect');
      setWifiStatus(s);
      setWifiPassword('');
      setWifiState('idle');
    } catch {
      setWifiState('error');
      setTimeout(() => setWifiState('idle'), 1400);
    }
  };

  // ── SAVE ──
  const saveGlobalConfig = async () => {
    setSaveState('saving');
    try {
      const body = new URLSearchParams();
      body.set('board', model);
      body.set('led_brightness', String(brightnessPercentToByte(brightness)));
      body.set('bank_led_color', String(bankLedColor));
      body.set('live_led_color', String(liveLedColor));
      body.set('led_color_mode', ledColorMode === 'numeros' ? '1' : '0');
      letterLedColors.forEach((id, i) => body.set(`letter_led_${i}`, String(id)));
      switchLedColors.forEach((id, i) => body.set(`switch_led_${i}`, String(id)));
      body.set('auto_start_enabled', autoStartEnabled ? '1' : '0');
      body.set('auto_start_bank', String(autoStartBank));
      body.set('auto_start_preset', String(autoStartPreset));
      body.set('auto_start_mode', autoStartMode === 'live' ? '1' : '0');
      bankLetterEnabled.forEach((on, i) => body.set(`bank_letter_enabled_${i}`, on ? '1' : '0'));
      body.set('bank_change_mode', String(bankChangeMode));
      LED_COLORS.forEach((c) => body.set(`color_${c.id}`, c.rgb.join(',')));

      await apiCall('POST', '/config/global', body);

      // Salva também trigger /save (persistência em flash). Opcional.
      try { await apiCall('POST', '/save'); } catch {/* opcional */}

      // Se o usuário preencheu nova senha WiFi, conecta também
      if (page === 'system_config' && wifiSsid && wifiPassword) {
        const wb = new URLSearchParams();
        wb.set('ssid', wifiSsid);
        wb.set('password', wifiPassword);
        try {
          const s = await apiCall('POST', '/wifi/connect', wb);
          setWifiStatus(s);
          setWifiState(s.sta_connected ? 'connected' : 'error');
        } catch {/* opcional */}
      }

      // deviceState (WiFi) e atualizado pelo pingHttp; saveState reflete o
      // resultado da operacao em si.
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1100);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 1400);
    }
  };


  return (
    <div className="phone-frame">
      <div className="bf-screen">
        {page === 'preset_config' && (
          <PagePresetConfig
            bankLetterIndex={bankLetterIndex}
            presetNumber={presetNumber}
            bankData={bankData}
            bankDisplayName={bankDisplayName}
            bankState={bankState}
            deviceState={deviceState}
            usbState={usbState}
            onToggleUsb={toggleUsb}
            presetCount={presetCount}
            onNextLetter={nextBankLetter}
            onSelectPreset={(n) => selectBank(bankLetterIndex, n)}
            connectionMode={connectionMode}
            onToggleConnectionMode={toggleConnectionMode}
            onDisplayNameChange={setBankDisplayName}
            onRegisterPresetSave={registerPresetSave}
          />
        )}
        {page === 'global_config' && (
          <PageGlobalConfig
            brightness={brightness} setBrightness={setBrightness}
            autoStartEnabled={autoStartEnabled} setAutoStartEnabled={setAutoStartEnabled}
            autoStartMode={autoStartMode} setAutoStartMode={setAutoStartMode}
            autoStartBank={autoStartBank} setAutoStartBank={setAutoStartBank}
            autoStartPreset={autoStartPreset} setAutoStartPreset={setAutoStartPreset}
            bankLetterEnabled={bankLetterEnabled} setBankLetterEnabled={setBankLetterEnabled}
            bankChangeMode={bankChangeMode} setBankChangeMode={setBankChangeMode}
            ledColorMode={ledColorMode} setLedColorMode={setLedColorMode}
            letterLedColors={letterLedColors} setLetterLedColors={setLetterLedColors}
            switchLedColors={switchLedColors} setSwitchLedColors={setSwitchLedColors}
            presetCount={presetCount}
            deviceState={deviceState}
            usbState={usbState}
            onToggleUsb={toggleUsb}
            connectionMode={connectionMode}
            onToggleConnectionMode={toggleConnectionMode}
          />
        )}
        {page === 'system_config' && (
          <PageSystemConfig
            model={model} setModel={setModel}
            wifiStatus={wifiStatus} wifiNetworks={wifiNetworks}
            wifiSsid={wifiSsid} setWifiSsid={setWifiSsid}
            wifiPassword={wifiPassword} setWifiPassword={setWifiPassword}
            wifiState={wifiState}
            onWifiScan={scanWifiNetworks}
            onWifiConnect={connectWifiSta}
            onWifiDisconnect={disconnectWifiSta}
            deviceState={deviceState}
            usbState={usbState}
            onToggleUsb={toggleUsb}
            connectionMode={connectionMode}
            onToggleConnectionMode={toggleConnectionMode}
          />
        )}
        <TabBar
          page={page}
          setPage={setPage}
          saveState={page === 'preset_config' ? presetSaveStatus : saveState}
          onSave={page === 'preset_config'
            ? () => { const h = presetSaveRef.current; if (h && h.save) h.save(); }
            : saveGlobalConfig}
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
