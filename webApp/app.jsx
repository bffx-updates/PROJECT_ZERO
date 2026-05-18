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
    <div className="bf-brightness">
      <div className="bf-brightness-circle">
        <span className="v">{value}</span>
      </div>
      <span className="bf-brightness-unit">%</span>
      <div
        ref={ref}
        className={'bf-slider' + (drag ? ' is-dragging' : '')}
        onMouseDown={(e) => { e.preventDefault(); setDrag(true); update(e.clientX); }}
        onTouchStart={(e) => { setDrag(true); update(e.touches[0].clientX); }}
        style={{ cursor: 'ew-resize', touchAction: 'none' }}
      >
        <div className="bf-slider-fill" style={{ width: `${value}%` }} />
        <div className="bf-slider-ticks">
          {Array.from({ length: 21 }).map((_, i) => <span key={i} className="t" />)}
        </div>
      </div>
    </div>
  );
}

function FootswitchArc({ label, colorId, onChange, litArcs, labelInside }) {
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

  // Fechar ao clicar fora ja e responsabilidade do .bf-modal-backdrop
  // (renderizado em portal). Antes tinhamos um mousedown global aqui que,
  // depois que o popup virou portal, considerava CADA swatch como "fora"
  // do ref.current — o close disparava no mousedown antes do onClick do
  // swatch rodar, e a nova cor nunca chegava no onChange. Removido.

  return (
    <div className={'bf-fsw' + (labelInside ? ' has-label-inside' : '')} ref={ref} style={{ position: 'relative' }}>
      <button className="bf-fsw-glyph" style={{ '--led-c': color, border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <svg className="bf-fsw-arcs" viewBox="0 0 72 72">
          {arcs.map((a, i) => {
            // litArcs (opcional): so esses indices ficam acesos, o resto
            // escuro. undefined = todos acesos (comportamento padrao).
            const arcLit = !litArcs || litArcs.includes(i);
            return (
              <path key={i} d={seg(a)}
                    stroke={(isOff || !arcLit) ? '#26262a' : color} />
            );
          })}
        </svg>
        {labelInside && <span className="bf-fsw-label bf-fsw-label-inside">{label}</span>}
      </button>
      {!labelInside && <span className="bf-fsw-label">{label}</span>}
      {open && ReactDOM.createPortal(
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
        </>,
        document.body
      )}
    </div>
  );
}

// ─── BANK ───────────────────────────────────────────────────────────
const DEFAULT_PRESET_META = () => ({
  name: '',
  bank: 0,            // MSB+LSB combinado, 0..16383
  channel: 0,         // 0 = MUTE/OFF (padrao), 1..16
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

  // Fechar ao clicar fora ja e responsabilidade do .bf-modal-backdrop
  // (renderizado em portal). Antes tinhamos um mousedown global aqui que,
  // depois que o popup virou portal, considerava CADA swatch como "fora"
  // do ref.current — o close disparava no mousedown antes do onClick do
  // swatch rodar, e a nova cor nunca chegava no onChange. Removido.

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
      {open && ReactDOM.createPortal(
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
        </>,
        document.body
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

function PresetEditorCard({ tag, onDisplayNameChange, onRegisterSave, savedSwModes, savedSwParams }) {
  const [metaByTag, setMetaByTag] = useState({});
  const [savedMetaByTag, setSavedMetaByTag] = useState({});
  const [status, setStatus] = useState('idle'); // idle | loading | saving | saved | error
  const [activeTab, setActiveTab] = useState('midi'); // midi | display | extras
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

  // Registra savePreset + estado pro botao SAVE global (TabBar) acionar.
  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave({ save: savePreset, status, isDirty });
  }, [onRegisterSave, savePreset, status, isDirty]);

  // Ao desmontar (ex: trocar pra LIVE MODE, o card some), limpa o registro
  // pra que o botao SAVE do TabBar volte a idle. onRegisterSave e estavel
  // (useCallback []), entao este cleanup so roda no unmount.
  useEffect(() => {
    return () => { if (onRegisterSave) onRegisterSave(null); };
  }, [onRegisterSave]);
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
                    <option value={0}>OFF</option>
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
  showMonitor, onToggleShowMonitor,
}) {
  return (
    <div className="bf-header bf-header-preset">
      <h1 className="bf-title">{title}</h1>
      <div className="bf-conn-icons">
        {typeof onToggleShowMonitor === 'function' && (
          <button
            type="button"
            className={'bf-conn-mode bf-conn-monitor' + (showMonitor ? ' is-active' : '')}
            onClick={onToggleShowMonitor}
            aria-pressed={showMonitor}
            aria-label={`Mostrar MONITOR MIDI: ${showMonitor ? 'ligado' : 'desligado'}`}
            title={showMonitor ? 'Esconder o MONITOR MIDI' : 'Mostrar o MONITOR MIDI'}
          >
            <svg viewBox="0 0 24 24" className="bf-conn-mode-ico" fill="none"
                 stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2.5" y="4" width="19" height="14" rx="1.6" />
              <path d="M6 9l2 2-2 2" />
              <path d="M11 13h6" />
              <path d="M9 21h6 M12 18v3" />
            </svg>
            <span className="bf-conn-mode-label">MON</span>
          </button>
        )}
        <div
          className={'bf-conn-mode bf-conn-wifi is-' + deviceState + ' is-mode-' + (connectionMode || 'STA').toLowerCase()}
          role="status"
          aria-label={`WiFi ${connectionMode || 'STA'} (auto-detectado): ${deviceState}`}
          title={
            `WiFi ${connectionMode || 'STA'} (auto) — ` +
            (deviceState === 'online' ? 'CONECTADO'
              : deviceState === 'loading' ? 'CONECTANDO'
              : 'OFFLINE')
          }
        >
          <svg viewBox="0 0 24 24" className="bf-conn-mode-ico" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Ondas WiFi concentricas + ponto na base */}
            <path d="M2 8.5 Q12 0 22 8.5" />
            <path d="M5 13 Q12 6 19 13" />
            <path d="M8.5 17.5 Q12 14 15.5 17.5" />
            <circle cx="12" cy="21" r="1.4" fill="currentColor" />
          </svg>
          <span className="bf-conn-mode-label">{connectionMode || 'STA'}</span>
        </div>

        <button
          type="button"
          className={'bf-conn-mode is-' + usbState}
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
          <svg viewBox="0 0 24 24" className="bf-conn-mode-ico" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* USB trident */}
            <path d="M12 2L8.5 6.5H15.5Z" fill="currentColor" stroke="none" />
            <path d="M12 6.5V20.5" />
            <path d="M12 13H7V17" />
            <rect x="5.5" y="16.5" width="3" height="3" fill="currentColor" stroke="none" />
            <path d="M12 10H17V14" />
            <circle cx="17" cy="15.2" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="21" r="1.8" fill="currentColor" stroke="none" />
          </svg>
          <span className="bf-conn-mode-label">USB</span>
        </button>
      </div>
    </div>
  );
}

// ─── LIVE MODE ──────────────────────────────────────────────────────
// Em LIVE MODE a pagina mostra 6 botoes (SW1..SW6). Cada switch e
// independente; clicar abre um card de config abaixo. O card tem 2
// icones no topo-esquerda — engrenagem (config) e display (visual) —
// e sempre abre na engrenagem. Os conteudos de cada aba serao
// implementados aos poucos.

// As 10 opcoes de modo de operacao de um SW em LIVE MODE. id = chave
// interna; title = rotulo grande; sub = descritor. O comportamento de
// cada modo sera implementado aos poucos — por ora e so a selecao.
const SW_MODES = [
  // MUTE = padrao de um SW sem modo salvo (silencioso, nao faz nada).
  { id: 'mute',      title: 'MUTE',      sub: 'MUTE' },
  // STOMP-1/2/3 = stomps; a diferenca esta no gesto que cada um trata:
  // STOMP unificado: comporta-se como classico, dual ou trial conforme
  // o numero de secoes com canal configurado (so A / A+B / A+B+C).
  { id: 'fx1',       title: 'STOMP',     sub: 'CLICK / LONG / RECLICK' },
  // Legados — mantidos pra dados antigos, escondidos do picker.
  { id: 'fx2',       title: 'STOMP - 2', sub: 'DUAL STOMP', hidden: true },
  { id: 'fx3',       title: 'STOMP - 3', sub: 'TRIAL STOMP', hidden: true },
  { id: 'spin',      title: 'SPIN',      sub: 'SPIN' },
  { id: 'ramp',      title: 'RAMPA',     sub: 'RAMP' },
  { id: 'momentary', title: 'MOMENTARY', sub: 'MOMENTARY' },
  // FAVORITE como modo separado foi removido — agora vive como toggle
  // por secao dentro do STOMP. Mantido oculto no array pra preservar o
  // indice 7 em SW_MODE_IDS (compat com presets antigos).
  { id: 'favorite',  title: 'FAVORITE',  sub: 'FAVORITE', hidden: true },
  { id: 'macros',    title: 'MACROS',    sub: 'MACROS' },
  { id: 'tap_tempo', title: 'TAP TEMPO', sub: 'TAP TEMPO' },
  { id: 'single',    title: 'SINGLE',    sub: 'SINGLE' },
];

// ─── SW DISPLAY (icone + cores por SW) ──────────────────────────────
// Lista dos 51 PNGs servidos por webApp/icons/sw/<id>.png. Cada SW pode
// escolher um deles (mode='icon') ou exibir so a sigla (mode='text').
// A cor nao esta no bitmap — e aplicada via CSS mask-image no render.
const SW_ICONS = Array.from({ length: 51 }, (_, i) => `ico${i + 1}`);

// Defaults por SW. mode 'icon' + ico1 + sigla vazia.
// Cores padrao (DISPLAY_PALETTE indices):
//   1 = SOLID Preto, 3 = SOLID Cinza Claro, 4 = SOLID Branco
//   ICON  ON=Branco / OFF=Cinza
//   BACK  ON=Preto  / OFF=Preto
//   BORDA ON=Branco / OFF=Cinza
function DEFAULT_SW_DISPLAY() {
  return {
    icon_id: 1,           // 1..51 (indice no SW_ICONS)
    mode: 'icon',         // 'icon' | 'text'
    sigla: '',            // rodape do icone (icon mode) ou texto central (text mode)
    ic_off: 3, ic_on: 4,  // ICON: Cinza Claro / Branco (estados OFF/ON)
    bg_off: 1, bg_on: 1,  // BACK: Preto / Preto
    br_off: 3, br_on: 4,  // BORDER: Cinza Claro / Branco
    // SPIN: 3 sub-configs INDEPENDENTES (so usadas quando modo=SPIN). Cada
    // estado tem icone proprio + sigla + cor ON dos 3 elementos (ICON/BACK/
    // BORDER). Nao tem OFF — SPIN sempre cicla entre os 3 estados ativos.
    spin: [DEFAULT_SW_SPIN_STATE(), DEFAULT_SW_SPIN_STATE(), DEFAULT_SW_SPIN_STATE()],
    // STOMP: 4 sub-configs adicionais pras secoes B (click longo) e C
    // (reclick), cada uma com OFF e ON. Secao A continua usando ic_off/
    // ic_on/bg_off/bg_on/br_off/br_on do config principal acima.
    //   [0]=B_off, [1]=B_on, [2]=C_off, [3]=C_on
    // Cada entrada tem icone + cor ICON + cor BACK + cor BORDER. Sigla
    // continua sendo a do config principal (compartilhada).
    stomp: [DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB(),
            DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB()],
    // TAP TEMPO: 3 sub-configs.
    //   [0]=TAP (estado unico, sem OFF/ON — analogo a um SPIN state)
    //   [1]=LP_off, [2]=LP_on (analogo a uma secao STOMP)
    // Sigla continua compartilhada com o config principal.
    tap: [DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB()],
  };
}

function DEFAULT_SW_SPIN_STATE() {
  return { icon_id: 1, sigla: '', mode: 'icon', ic_on: 4, bg_on: 1, br_on: 4 };
}

function DEFAULT_SW_STOMP_SUB() {
  return { icon_id: 1, mode: 'icon', ic: 4, bg: 1, br: 4 };
}

// Mapeamento de chaves COMPACTAS (storage) <-> longas (state JS).
// O storage usa chaves curtas pra caber no orcamento de DRAM do firmware
// (BANK_MEMORY_DATA_SIZE = 576). O state interno do React mantem nomes
// auto-descritivos.
const SW_DISPLAY_KEY_SHORT = {
  icon_id: 'i', ic_off: 'a', ic_on: 'A',
  bg_off: 'b', bg_on: 'B',
  br_off: 'c', br_on: 'C',
};
const SW_DISPLAY_KEY_LONG = Object.fromEntries(
  Object.entries(SW_DISPLAY_KEY_SHORT).map(([l, s]) => [s, l]));

// Lê os 9 campos do SW de dentro do blob da API (formato compacto
// "i=5;m=1;s=STOMP;a=0;A=4;b=0;B=0;c=0;C=0"). Separador INTERNO e ';'
// (nao '|') pra nao conflitar com o separador EXTERNO de campos do
// header do preset, que e '|'. Aceita tambem nomes longos
// (icon_id=, mode=, sigla=, ic_off=...) pra backward-compat.
function parseSwDisplayOne(blob) {
  const out = DEFAULT_SW_DISPLAY();
  // Aceita ambos os separadores (compat com payloads antigos que
  // chegaram a usar '|' antes do bug de conflito ser corrigido).
  const pairs = String(blob || '').split(/[;|]/);
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq);
    const v = pair.slice(eq + 1);
    if (k === 'm' || k === 'mode') {
      out.mode = (v === 'text' || v === '0') ? 'text' : 'icon';
      continue;
    }
    if (k === 's' || k === 'sigla') { out.sigla = v; continue; }
    // SPIN sub-configs (tags 1..3): chaves i1/s1/A1/B1/C1 → spin[0] etc.
    // STOMP sub-configs (tags 4..7): chaves i4/A4/B4/C4 → stomp[0] etc.
    //   [0]=B_off, [1]=B_on, [2]=C_off, [3]=C_on
    // TAP TEMPO sub-configs (sufixos 't', 'o', 'n'): chaves it/At/Bt/Ct
    //   → tap[0] (TAP); io/... → tap[1] (LP_off); in/... → tap[2] (LP_on)
    if (k.length === 2) {
      const last = k.charCodeAt(k.length - 1);
      const base = k[0];
      // Digit tag (1..7) → SPIN/STOMP
      if (last >= 49 && last <= 55) {
        const tag = last - 48;
        if (tag <= 3) {
          const state = out.spin[tag - 1];
          if (base === 'i') state.icon_id = parseInt(v, 10) || 1;
          else if (base === 's') state.sigla = v;
          else if (base === 'm') state.mode = v === '0' ? 'text' : 'icon';
          else if (base === 'A') state.ic_on = parseInt(v, 10) || 0;
          else if (base === 'B') state.bg_on = parseInt(v, 10) || 0;
          else if (base === 'C') state.br_on = parseInt(v, 10) || 0;
        } else {
          const stompIdx = tag - 4;
          const sub = out.stomp[stompIdx];
          if (base === 'i') sub.icon_id = parseInt(v, 10) || 1;
          else if (base === 'm') sub.mode = v === '0' ? 'text' : 'icon';
          else if (base === 'A') sub.ic = parseInt(v, 10) || 0;
          else if (base === 'B') sub.bg = parseInt(v, 10) || 0;
          else if (base === 'C') sub.br = parseInt(v, 10) || 0;
        }
        continue;
      }
      // Letter tag (t/o/n) → TAP TEMPO
      const tapIdx = k[1] === 't' ? 0 : k[1] === 'o' ? 1 : k[1] === 'n' ? 2 : -1;
      if (tapIdx >= 0) {
        const sub = out.tap[tapIdx];
        if (base === 'i') sub.icon_id = parseInt(v, 10) || 1;
        else if (base === 'm') sub.mode = v === '0' ? 'text' : 'icon';
        else if (base === 'A') sub.ic = parseInt(v, 10) || 0;
        else if (base === 'B') sub.bg = parseInt(v, 10) || 0;
        else if (base === 'C') sub.br = parseInt(v, 10) || 0;
        continue;
      }
    }
    const longKey = SW_DISPLAY_KEY_LONG[k] || k;
    if (longKey in out && longKey !== 'mode' && longKey !== 'sigla' &&
        longKey !== 'spin') {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) out[longKey] = n;
    }
  }
  return out;
}

// Extrai sw_display dos 6 SWs do meta retornado pela API. Cada entry vem
// como string compacta na chave swdispN. Sempre retorna 6 entries com
// defaults se faltar algum.
function parseSwDisplayFromMeta(rawMeta) {
  const out = {};
  for (let sw = 1; sw <= 6; sw++) {
    const blob = (rawMeta && rawMeta['swdisp' + sw]) || '';
    out[sw] = parseSwDisplayOne(blob);
  }
  return out;
}

// Serializa um SW pro formato COMPACTO "i=5;m=1;s=STOMP;a=0;A=4;b=0;...".
// Separador INTERNO e ';' (nao '|') pra nao conflitar com o separador
// EXTERNO de campos do header. Chaves curtas pra caber no orcamento de
// DRAM do firmware. Sigla truncada em 8 chars; '|' e ';' filtrados da
// sigla pra nao quebrar nenhum parser (interno ou externo).
function serializeSwDisplayOne(d) {
  const merged = { ...DEFAULT_SW_DISPLAY(), ...(d || {}) };
  const spin = Array.isArray(d && d.spin) ? d.spin : [];
  const stomp = Array.isArray(d && d.stomp) ? d.stomp : [];
  const sigla = String(merged.sigla || '').replace(/[|;]/g, ' ').slice(0, 8);
  const parts = [
    `i=${merged.icon_id|0}`,
    `m=${merged.mode === 'text' ? 0 : 1}`,
    `s=${sigla}`,
    `a=${merged.ic_off|0}`, `A=${merged.ic_on|0}`,
    `b=${merged.bg_off|0}`, `B=${merged.bg_on|0}`,
    `c=${merged.br_off|0}`, `C=${merged.br_on|0}`,
  ];
  // SPIN sub-configs (i1/i2/i3 etc.): emite so campos != default.
  // mode='text' vira m{N}=0; default 'icon' (m{N}=1) e omitido.
  const defSpin = DEFAULT_SW_SPIN_STATE();
  for (let i = 0; i < 3; i++) {
    const s = { ...defSpin, ...(spin[i] || {}) };
    const tag = String(i + 1);
    if ((s.icon_id|0) !== defSpin.icon_id) parts.push(`i${tag}=${s.icon_id|0}`);
    const sg = String(s.sigla || '').replace(/[|;]/g, ' ').slice(0, 6);
    if (sg) parts.push(`s${tag}=${sg}`);
    if (s.mode === 'text') parts.push(`m${tag}=0`);
    if ((s.ic_on|0) !== defSpin.ic_on) parts.push(`A${tag}=${s.ic_on|0}`);
    if ((s.bg_on|0) !== defSpin.bg_on) parts.push(`B${tag}=${s.bg_on|0}`);
    if ((s.br_on|0) !== defSpin.br_on) parts.push(`C${tag}=${s.br_on|0}`);
  }
  // STOMP sub-configs pras secoes B e C, OFF e ON. Tags: 4..7.
  const defStomp = DEFAULT_SW_STOMP_SUB();
  for (let i = 0; i < 4; i++) {
    const s = { ...defStomp, ...(stomp[i] || {}) };
    const tag = String(i + 4);  // 4,5,6,7
    if ((s.icon_id|0) !== defStomp.icon_id) parts.push(`i${tag}=${s.icon_id|0}`);
    if (s.mode === 'text') parts.push(`m${tag}=0`);
    if ((s.ic|0) !== defStomp.ic) parts.push(`A${tag}=${s.ic|0}`);
    if ((s.bg|0) !== defStomp.bg) parts.push(`B${tag}=${s.bg|0}`);
    if ((s.br|0) !== defStomp.br) parts.push(`C${tag}=${s.br|0}`);
  }
  // TAP TEMPO sub-configs (3 estados). Sufixos: 't' = TAP, 'o' = LP_off,
  // 'n' = LP_on. Mesma estrutura {icon_id, mode, ic, bg, br}.
  const tap = Array.isArray(d && d.tap) ? d.tap : [];
  const tapTags = ['t', 'o', 'n'];
  for (let i = 0; i < 3; i++) {
    const s = { ...defStomp, ...(tap[i] || {}) };
    const tag = tapTags[i];
    if ((s.icon_id|0) !== defStomp.icon_id) parts.push(`i${tag}=${s.icon_id|0}`);
    if (s.mode === 'text') parts.push(`m${tag}=0`);
    if ((s.ic|0) !== defStomp.ic) parts.push(`A${tag}=${s.ic|0}`);
    if ((s.bg|0) !== defStomp.bg) parts.push(`B${tag}=${s.bg|0}`);
    if ((s.br|0) !== defStomp.br) parts.push(`C${tag}=${s.br|0}`);
  }
  return parts.join(';');
}

// Insere os 6 swdispN no body de POST /bank/preset.
function swDisplayToApiBody(disp, body) {
  for (let sw = 1; sw <= 6; sw++) {
    body.set('swdisp' + sw,
             serializeSwDisplayOne(disp && disp[sw]));
  }
}

// Defaults pros 6 SWs — usado quando ainda nao carregou nada.
function defaultSwDisplayMap() {
  const out = {};
  for (let sw = 1; sw <= 6; sw++) out[sw] = DEFAULT_SW_DISPLAY();
  return out;
}

// Compara dois mapas de swDisplay pra dirty tracking.
function swDisplayEqual(a, b) {
  if (a === b) return true;
  for (let sw = 1; sw <= 6; sw++) {
    const A = serializeSwDisplayOne(a && a[sw]);
    const B = serializeSwDisplayOne(b && b[sw]);
    if (A !== B) return false;
  }
  return true;
}

// sw_modes no PRESET: 6 indices em SW_MODES, formato compacto "i,i,i,i,i,i".
// "0,4,0,..." <-> { 1:'mute', 2:'spin', ... }. Indice fora de faixa cai
// em 'mute' (0) — cobre presets antigos sem o campo.
function parseSwModesStr(s) {
  const parts = (typeof s === 'string' && s ? s : '').split(',');
  const out = {};
  for (let i = 0; i < 6; i++) {
    const mode = SW_MODES[parseInt(parts[i], 10)] || SW_MODES[0];
    out[i + 1] = mode.id;
  }
  return out;
}
function swModesToStr(obj) {
  const parts = [];
  for (let n = 1; n <= 6; n++) {
    let idx = SW_MODES.findIndex((m) => m.id === ((obj && obj[n]) || 'mute'));
    if (idx < 0) idx = 0;
    parts.push(idx);
  }
  return parts.join(',');
}

// ── Parametros por SW/modo ────────────────────────────────────────────
// Cada SW, em cada modo, tem um conjunto de campos proprio. O firmware
// guarda como linhas sw<N>.<modo>:<key=value|...> e a API entrega/recebe
// o blob. Aqui o shape e { [sw]: { [modeId]: {campos} } }.
//
// STOMP (fx1, unificado): ate 3 secoes — A (sem sufixo), B (sufixo 2),
// C (sufixo 3). Cada secao tem num 0..127 (CC), ch 0=OFF 1..16, custom
// 0/1, on/off 0..127, start 0/1, color 0..14. O comportamento de uso
// adapta conforme quantas secoes tem canal valido (1..16):
//   so A      -> STOMP classico: tap = toggle, segurar = momentaneo.
//   A + B     -> tap = A, long-press = B (sem momentaneo).
//   A + B + C -> tap (apos 350ms) = A, long-press = B, duplo-click = C.
// Os legados fx2 (14 campos) e fx3 (21 campos, mesmas chaves do fx1)
// seguem existindo pra dados antigos, mas o picker so oferece fx1.
// MACROS — helpers de serializacao dos 4 slots de uma secao. Cada slot:
//   { t: 0|1, ch: 0..16, num: 0..16383, on: -1..16383, off: -1..16383 }
//   t=0 (CC): num e o CC#, on/off sao valores de CC.
//   t=1 (PC): num ignorado; on e o PC# pra ON; off e o PC# pra OFF.
//   on/off = -1 -> pula a direcao (OFF na UI).
// Storage: string "t:ch:num:on:off,t:ch:num:on:off,t:ch:num:on:off,t:ch:num:on:off"
function emptyMslot() {
  return { t: 0, ch: 0, num: 0, on: 127, off: 0 };
}
function emptyMslotsStr() {
  // Pre-popula 4 slots vazios (ch=0 = inativo). O firmware ignora slots
  // com ch fora de 1..16, entao o resultado fica inert sem precisar de
  // logica de "slot existe/nao existe".
  return '0:0:0:127:0,0:0:0:127:0,0:0:0:127:0,0:0:0:127:0';
}
function parseMslots(str) {
  const out = [emptyMslot(), emptyMslot(), emptyMslot(), emptyMslot()];
  if (typeof str !== 'string' || !str) return out;
  const parts = str.split(',');
  for (let i = 0; i < 4 && i < parts.length; i++) {
    const p = (parts[i] || '').split(':');
    if (p.length < 5) continue;
    const t = parseInt(p[0], 10);
    const ch = parseInt(p[1], 10);
    const num = parseInt(p[2], 10);
    const on = parseInt(p[3], 10);
    const off = parseInt(p[4], 10);
    out[i] = {
      t: t === 1 ? 1 : 0,
      ch: Number.isFinite(ch) ? clamp(ch, 0, 16) : 0,
      num: Number.isFinite(num) ? clamp(num, 0, 16383) : 0,
      on: Number.isFinite(on) ? clamp(on, -1, 16383) : 127,
      off: Number.isFinite(off) ? clamp(off, -1, 16383) : 0,
    };
  }
  return out;
}
function serializeMslots(slots) {
  const four = (slots || []).slice(0, 4);
  while (four.length < 4) four.push(emptyMslot());
  return four.map((s) =>
    `${s.t|0}:${s.ch|0}:${s.num|0}:${s.on|0}:${s.off|0}`
  ).join(',');
}

// SINGLE — slots mais simples que os do MACROS: um valor unico por slot
// (sem ON/OFF). Cada slot { t, ch, num, val }.
//   t=0 (CC): num=CC#, val=valor de CC (0..127).
//   t=1 (PC): num ignorado, val=PC# (0..16383).
// Storage: "t:ch:num:val,t:ch:num:val,t:ch:num:val,t:ch:num:val" (4 slots).
function emptySingleSlot() {
  return { t: 0, ch: 0, num: 0, val: 127 };
}
function emptySingleSlotsStr() {
  return '0:0:0:127,0:0:0:127,0:0:0:127,0:0:0:127';
}
function parseSingleSlots(str) {
  const out = [emptySingleSlot(), emptySingleSlot(), emptySingleSlot(), emptySingleSlot()];
  if (typeof str !== 'string' || !str) return out;
  const parts = str.split(',');
  for (let i = 0; i < 4 && i < parts.length; i++) {
    const p = (parts[i] || '').split(':');
    if (p.length < 4) continue;
    const t = parseInt(p[0], 10);
    const ch = parseInt(p[1], 10);
    const num = parseInt(p[2], 10);
    const val = parseInt(p[3], 10);
    out[i] = {
      t: t === 1 ? 1 : 0,
      ch: Number.isFinite(ch) ? clamp(ch, 0, 16) : 0,
      num: Number.isFinite(num) ? clamp(num, 0, 16383) : 0,
      val: Number.isFinite(val) ? clamp(val, 0, 16383) : 127,
    };
  }
  return out;
}
function serializeSingleSlots(slots) {
  const four = (slots || []).slice(0, 4);
  while (four.length < 4) four.push(emptySingleSlot());
  return four.map((s) =>
    `${s.t|0}:${s.ch|0}:${s.num|0}:${s.val|0}`
  ).join(',');
}

// TAP TEMPO — slots ainda mais simples: so canal e CC# (valor fixo 127
// na hora do disparo, sem type CC/PC). Storage: "ch:num,ch:num,..." (4).
// TAP TEMPO slot: ch + num + mode. mode 1 = so CC+127 (classico). mode 2
// = CC+127 seguido de CC+0 (pulse). Formato compacto "ch:num:mode";
// formato legado "ch:num" (sem mode) cai em mode=1. Maximo 3 slots
// (sobra espaco no UI pra um slot fixo de long-press separado).
const TAP_MAX_SLOTS = 3;
function emptyTapSlot() { return { ch: 0, num: 0, mode: 1 }; }
function emptyTapSlotsStr() { return '0:0:1,0:0:1,0:0:1'; }
function parseTapSlots(str) {
  const out = Array.from({ length: TAP_MAX_SLOTS }, () => emptyTapSlot());
  if (typeof str !== 'string' || !str) return out;
  const parts = str.split(',');
  for (let i = 0; i < TAP_MAX_SLOTS && i < parts.length; i++) {
    const p = (parts[i] || '').split(':');
    if (p.length < 2) continue;
    const ch = parseInt(p[0], 10);
    const num = parseInt(p[1], 10);
    const mode = p.length >= 3 ? parseInt(p[2], 10) : 1;
    out[i] = {
      ch: Number.isFinite(ch) ? clamp(ch, 0, 16) : 0,
      num: Number.isFinite(num) ? clamp(num, 0, 127) : 0,
      mode: mode === 2 ? 2 : 1,
    };
  }
  return out;
}
function serializeTapSlots(slots) {
  const arr = (slots || []).slice(0, TAP_MAX_SLOTS);
  while (arr.length < TAP_MAX_SLOTS) arr.push(emptyTapSlot());
  return arr.map((s) => `${s.ch|0}:${s.num|0}:${s.mode === 2 ? 2 : 1}`).join(',');
}

// SPIN slot — ch + num + 3 valores (um por estado). Ate 3 slots por SW,
// disparados simultaneamente em cada press (mesmo estado). Formato:
// "ch:num:v1:v2:v3,ch:num:v1:v2:v3,ch:num:v1:v2:v3".
function emptySpinSlot() {
  return { ch: 0, num: 0, v1: 0, v2: 64, v3: 127 };
}
function emptySpinSlotsStr() {
  return '0:0:0:64:127,0:0:0:64:127,0:0:0:64:127';
}
function parseSpinSlots(str) {
  const out = [emptySpinSlot(), emptySpinSlot(), emptySpinSlot()];
  if (typeof str !== 'string' || !str) return out;
  const parts = str.split(',');
  for (let i = 0; i < 3 && i < parts.length; i++) {
    const p = (parts[i] || '').split(':');
    if (p.length < 2) continue;
    const ch = parseInt(p[0], 10);
    const num = parseInt(p[1], 10);
    const v1 = p.length >= 3 ? parseInt(p[2], 10) : 0;
    const v2 = p.length >= 4 ? parseInt(p[3], 10) : 64;
    const v3 = p.length >= 5 ? parseInt(p[4], 10) : 127;
    out[i] = {
      ch: Number.isFinite(ch) ? clamp(ch, 0, 16) : 0,
      num: Number.isFinite(num) ? clamp(num, 0, 127) : 0,
      v1: Number.isFinite(v1) ? clamp(v1, 0, 127) : 0,
      v2: Number.isFinite(v2) ? clamp(v2, 0, 127) : 64,
      v3: Number.isFinite(v3) ? clamp(v3, 0, 127) : 127,
    };
  }
  return out;
}
function serializeSpinSlots(slots) {
  const arr = (slots || []).slice(0, 3);
  while (arr.length < 3) arr.push(emptySpinSlot());
  return arr.map((s) =>
    `${s.ch|0}:${s.num|0}:${s.v1|0}:${s.v2|0}:${s.v3|0}`).join(',');
}

// MOMENTARY slot — pulse de ch+num com par on/off. Formato "ch:num:on:off"
// (4 campos), ate 4 slots. Cada press do SW dispara TODOS os slots em
// sequencia: ON, delay, OFF. Default: on=127, off=0.
const MOM_MAX_SLOTS = 4;
function emptyMomSlot() { return { ch: 0, num: 0, on: 127, off: 0 }; }
function emptyMomSlotsStr() { return '0:0:127:0,0:0:127:0,0:0:127:0,0:0:127:0'; }
function parseMomSlots(str) {
  const out = Array.from({ length: MOM_MAX_SLOTS }, () => emptyMomSlot());
  if (typeof str !== 'string' || !str) return out;
  const parts = str.split(',');
  for (let i = 0; i < MOM_MAX_SLOTS && i < parts.length; i++) {
    const p = (parts[i] || '').split(':');
    if (p.length < 2) continue;
    const ch = parseInt(p[0], 10);
    const num = parseInt(p[1], 10);
    const on = p.length >= 3 ? parseInt(p[2], 10) : 127;
    const off = p.length >= 4 ? parseInt(p[3], 10) : 0;
    out[i] = {
      ch: Number.isFinite(ch) ? clamp(ch, 0, 16) : 0,
      num: Number.isFinite(num) ? clamp(num, 0, 127) : 0,
      on: Number.isFinite(on) ? clamp(on, 0, 127) : 127,
      off: Number.isFinite(off) ? clamp(off, 0, 127) : 0,
    };
  }
  return out;
}
function serializeMomSlots(slots) {
  const arr = (slots || []).slice(0, MOM_MAX_SLOTS);
  while (arr.length < MOM_MAX_SLOTS) arr.push(emptyMomSlot());
  return arr.map((s) =>
    `${s.ch|0}:${s.num|0}:${s.on|0}:${s.off|0}`).join(',');
}

function DEFAULT_SW_PARAMS(modeId) {
  if (modeId === 'fx1' || modeId === 'fx3') {
    return {
      num: 0, ch: 0, custom: 0, on: 127, off: 0, start: 0, at_preset: 1, color: 1,
      fav: 0, fav_bank: 0, fav_preset: 1, fav_mode: 0,
      num2: 0, ch2: 0, custom2: 0, on2: 127, off2: 0, start2: 0, at_preset2: 1, color2: 1,
      fav2: 0, fav_bank2: 0, fav_preset2: 1, fav_mode2: 0,
      num3: 0, ch3: 0, custom3: 0, on3: 127, off3: 0, start3: 0, at_preset3: 1, color3: 1,
      fav3: 0, fav_bank3: 0, fav_preset3: 1, fav_mode3: 0,
    };
  }
  if (modeId === 'fx2') {
    return {
      num: 0, ch: 0, custom: 0, on: 127, off: 0, start: 0, at_preset: 1, color: 1,
      fav: 0, fav_bank: 0, fav_preset: 1, fav_mode: 0,
      num2: 0, ch2: 0, custom2: 0, on2: 127, off2: 0, start2: 0, at_preset2: 1, color2: 1,
      fav2: 0, fav_bank2: 0, fav_preset2: 1, fav_mode2: 0,
    };
  }
  if (modeId === 'momentary') {
    // MOMENTARY: ate 4 slots em `mom_slots` ("ch:num:on:off,..."). Cada
    // press do SW dispara TODOS os slots como pulse (ON, delay, OFF).
    // Sem estado persistente. Campos legados (num/ch/custom/on/off) ficam
    // como fallback do firmware pra dados antigos (slot 1).
    return {
      mom_slots: emptyMomSlotsStr(),
      num: 0, ch: 0, custom: 0, on: 127, off: 0,
      start: 0, color: 1,
    };
  }
  if (modeId === 'macros') {
    // MACROS: uma secao unica com 4 slots (CC ou PC) com valor ON e OFF
    // (-1 = OFF/pula direcao). mslots e string compacta "t:ch:num:on:off,...".
    // at_preset + start replicam o padrao do STOMP: at_preset=0 aguarda
    // LIVE; at_preset=1 dispara ON ou OFF na chamada conforme `start`.
    return {
      mslots: emptyMslotsStr(),
      at_preset: 1, start: 0, color: 1,
    };
  }
  if (modeId === 'tap_tempo') {
    // TAP TEMPO: ate 3 slots de CC (ch + num + mode) + 1 slot fixo de
    // long-press (lp_ch + lp_num + lp_val) que dispara quando o usuario
    // segura o SW (~300ms). LED anima sozinho — idle (pixel 1 -> 2 -> 3
    // ciclico) ate bater o tempo, dai pisca no intervalo entre taps.
    return {
      tslots: emptyTapSlotsStr(),
      lp_ch: 0, lp_num: 0, lp_on: 127, lp_off: 0,
      lp_start: 0, lp_at_preset: 1,
      color: 1,
    };
  }
  if (modeId === 'single') {
    // Disparo unico — agora com ate 4 slots em `sslots` ("t:ch:num:val,..."),
    // cada slot CC ou PC. Os campos legados (num, ch, on, pc, as_pc, start)
    // ficam como fallback do firmware pra dados antigos.
    // `at_preset=1` -> dispara todos os slots na chamada do preset.
    // (Padronizado com MACROS; `start` legado ainda lido como fallback.)
    return {
      sslots: emptySingleSlotsStr(),
      num: 0, ch: 0, on: 127, pc: 0, as_pc: 0,
      at_preset: 1, color: 1,
    };
  }
  if (modeId === 'spin') {
    // SPIN — maquina de 3 estados (pixel 1, 2, 3) com ATE 3 SLOTS de CC
    // disparados SIMULTANEAMENTE em cada estado. Cada slot tem ch + num
    // + 3 valores (v1/v2/v3). Storage composta em `spin_slots`. Os
    // campos legados (ch/num/val1/val2/val3 soltos) ficam como fallback
    // pra dados antigos (vira slot 1).
    return {
      spin_slots: emptySpinSlotsStr(),
      ch: 0, num: 0, val1: 0, val2: 64, val3: 127,
      at_preset: 1, color: 1,
    };
  }
  if (modeId === 'ramp') {
    // RAMP — sweep gradual de CC entre min/max com tempo de subida/descida
    // configuravel. Mecanica de press inspirada em controladoras tipo
    // Boss FS-1, Strymon MultiSwitch e expression mapping de Helix:
    //   ch, num             — destino MIDI
    //   min_val/max_val     — valor MIDI nos extremos (default 0/127)
    //   up_ms / down_ms     — tempo total pra ir min->max / max->min
    //   curve               — 0=LINEAR, 1=EXP, 2=LOG, 3=SINE (S-curve)
    //   trigger             — 0=TOGGLE (cada press flipa direcao;
    //                                    press durante movimento INVERTE)
    //                         1=HOLD (segura = sobe; solta = desce)
    //                         2=LOOP (press inicia ping-pong continuo;
    //                                 press para)
    //   step_ms             — intervalo entre envios MIDI (default 25ms)
    //   start_on            — estado inicial (0=min, 1=max) — so visual,
    //                         RAMP NUNCA dispara no load do preset (so
    //                         opera em LIVE MODE por design)
    //   color               — LED
    return {
      ch: 0, num: 0,
      min_val: 0, max_val: 127,
      up_ms: 1000, down_ms: 1000,
      curve: 0, trigger: 0, step_ms: 25,
      start_on: 0, color: 1,
    };
  }
  return {};
}

// Parseia o objeto sw_params da API ({"sw1.fx1":"type=0|num=48|..."}) pro
// shape { [sw]: { [modeId]: {campos numericos} } }. Campos ausentes caem
// no default do modo.
function parseSwParamsObj(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const key of Object.keys(obj)) {
    const m = /^sw([1-6])\.(.+)$/.exec(key);
    if (!m) continue;
    const sw = parseInt(m[1], 10);
    const modeId = m[2];
    const fields = { ...DEFAULT_SW_PARAMS(modeId) };
    const blob = obj[key] || '';
    for (const pair of String(blob).split('|')) {
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const k = pair.slice(0, eq);
      const raw = pair.slice(eq + 1);
      // Chaves compostas string (ex.: MACROS mslots[N] = "t:ch:num:on:off,...")
      // ficam como string; os demais campos sao numericos.
      if (k && (k === 'mslots' || k === 'sslots' || k === 'tslots' ||
                k === 'mom_slots' || k === 'spin_slots')) {
        fields[k] = raw;
      } else {
        const v = parseInt(raw, 10);
        if (k && Number.isFinite(v)) fields[k] = v;
      }
    }
    if (!out[sw]) out[sw] = {};
    out[sw][modeId] = fields;
  }
  return out;
}

// Serializa os campos de um SW/modo no body de POST /sw/params.
function swParamsToApiBody(fields) {
  const body = new URLSearchParams();
  for (const k of Object.keys(fields || {})) {
    body.set(k, String(fields[k]));
  }
  return body;
}

// Helpers pra montar mensagens MIDI individuais. Cada mensagem reflete
// um disparo real no fio (CC ou PC), com os numeros que sairam de fato
// pro pedal. `when` (opcional) e um rotulo curto tipo ON/OFF/PULSE/TAP
// pra contexto em listagens com varias mensagens da mesma origem.
function ccMsg(ch, num, val, when) {
  const m = { kind: 'cc', ch: Number(ch), num: Number(num), val: Number(val) };
  if (when) m.when = when;
  return m;
}
function pcMsg(ch, pc, when) {
  const m = { kind: 'pc', ch: Number(ch), pc: Number(pc) };
  if (when) m.when = when;
  return m;
}

// SNAPSHOT (PRESET MODE) — monta a entrada estruturada de um SW pra
// mostrar TODOS os MIDIs configurados (nao so o que vai disparar em um
// press especifico). Retorna { sw, modeLabel, sections: [...] } onde
// cada section tem { label, flags, messages }. Cada modo tem seu builder
// (logica espelha o que o firmware faz em runtime).
// SNAPSHOT — apenas o MIDI que REALMENTE dispara na chamada do preset
// (i.e. so secoes com at_preset=true, e so a direcao do START). Modos
// reativos a press (MOMENTARY, TAP TEMPO) nao disparam no load do preset.
function buildSnapshotStomp(sw, id, userParams) {
  const p = { ...DEFAULT_SW_PARAMS(id), ...(userParams || {}) };
  const chOK = (v) => v >= 1 && v <= 16;
  const hasB = chOK(Number(p.ch2)) || Number(p.fav2) === 1;
  const hasC = id !== 'fx2' &&
               (chOK(Number(p.ch3)) || Number(p.fav3) === 1);
  const tierLabel = (s) => {
    if (hasC) return s === 0 ? 'CURTO' : s === 1 ? 'LONGO' : 'RECLICK';
    if (hasB) return s === 0 ? 'CURTO' : 'LONGO';
    return '';
  };
  const sections = [];
  for (let s = 0; s < 3; s++) {
    if (s === 2 && id === 'fx2') continue;
    const suf = s === 0 ? '' : s === 1 ? '2' : '3';
    // FAVORITE: secao nao dispara MIDI no load do preset (so reage a
    // press fisico). Pula no snapshot.
    if (Number(p['fav' + suf]) === 1) continue;
    const ch = Number(p['ch' + suf]);
    if (!chOK(ch)) continue;
    const atPreset = (typeof p['at_preset' + suf] !== 'undefined')
      ? Number(p['at_preset' + suf]) === 1
      : true;  // default STOMP antigo: dispara no preset
    if (!atPreset) continue;
    const num = Number(p['num' + suf]);
    const custom = p['custom' + suf] === 1;
    const onV = custom ? Number(p['on' + suf]) : 127;
    const offV = custom ? Number(p['off' + suf]) : 0;
    const startOn = Number(p['start' + suf]) === 1;
    sections.push({
      label: tierLabel(s),
      flags: [startOn ? 'START ON' : 'START OFF'],
      messages: [ccMsg(ch, num, startOn ? onV : offV)],
    });
  }
  return { sw, modeLabel: 'STOMP', sections };
}

function buildSnapshotMomentary(sw, userParams) {
  // MOMENTARY nao dispara na chamada do preset — so reage a press.
  return { sw, modeLabel: 'MOMENTARY', sections: [] };
}

function buildSnapshotSingle(sw, userParams) {
  const p = { ...DEFAULT_SW_PARAMS('single'), ...(userParams || {}) };
  const atPreset = (typeof p.at_preset !== 'undefined')
    ? p.at_preset === 1 : p.start === 1;
  if (!atPreset) return { sw, modeLabel: 'SINGLE', sections: [] };
  const slotsFromSslots = parseSingleSlots(p.sslots || '');
  const sslotsHasAny = slotsFromSslots.some((s) => s.ch >= 1 && s.ch <= 16);
  const slots = slotsFromSslots.slice();
  if (!sslotsHasAny && Number(p.ch) >= 1 && Number(p.ch) <= 16) {
    slots[0] = {
      t: Number(p.as_pc) === 1 ? 1 : 0,
      ch: Number(p.ch),
      num: Number(p.num) || 0,
      val: Number(p.as_pc) === 1 ? (Number(p.pc) || 0) : (Number(p.on) || 127),
    };
  }
  const active = slots.filter((s) => s.ch >= 1 && s.ch <= 16);
  if (active.length === 0) return { sw, modeLabel: 'SINGLE', sections: [] };
  return {
    sw, modeLabel: 'SINGLE',
    sections: [{
      label: '',
      flags: [],
      messages: active.map((s) =>
        s.t === 1 ? pcMsg(s.ch, s.val) : ccMsg(s.ch, s.num, s.val)),
    }],
  };
}

function buildSnapshotMacros(sw, userParams) {
  const p = { ...DEFAULT_SW_PARAMS('macros'), ...(userParams || {}) };
  const chOK = (s) => s.ch >= 1 && s.ch <= 16;
  if (p.at_preset !== 1) return { sw, modeLabel: 'MACROS', sections: [] };
  const slots = parseMslots(p.mslots || '');
  const active = slots.filter(chOK);
  if (active.length === 0) return { sw, modeLabel: 'MACROS', sections: [] };
  const startOn = p.start === 1;
  const messages = [];
  for (const slot of active) {
    const v = startOn ? slot.on : slot.off;
    if (v < 0) continue;
    messages.push(slot.t === 1
      ? pcMsg(slot.ch, v)
      : ccMsg(slot.ch, slot.num, v));
  }
  if (messages.length === 0) return { sw, modeLabel: 'MACROS', sections: [] };
  return {
    sw, modeLabel: 'MACROS',
    sections: [{
      label: '',
      flags: [startOn ? 'START ON' : 'START OFF'],
      messages,
    }],
  };
}

function buildSnapshotTap(sw, userParams) {
  // TAP TEMPO so dispara no preset se LP estiver com lp_at_preset=1.
  // Os slots de tap nunca disparam no load (so reagem a press).
  const p = { ...DEFAULT_SW_PARAMS('tap_tempo'), ...(userParams || {}) };
  if (Number(p.lp_at_preset) !== 1) {
    return { sw, modeLabel: 'TAP TEMPO', sections: [] };
  }
  const lpCh = Number(p.lp_ch) || 0;
  if (lpCh < 1 || lpCh > 16) {
    return { sw, modeLabel: 'TAP TEMPO', sections: [] };
  }
  const lpNum = Number(p.lp_num) || 0;
  const startOn = Number(p.lp_start) === 1;
  const lpOn = typeof p.lp_on !== 'undefined' ? Number(p.lp_on) : 127;
  const lpOff = Number(p.lp_off) || 0;
  return {
    sw, modeLabel: 'TAP TEMPO',
    sections: [{
      label: 'LONG PRESS',
      flags: [startOn ? 'START ON' : 'START OFF'],
      messages: [ccMsg(lpCh, lpNum, startOn ? lpOn : lpOff)],
    }],
  };
}

function buildSnapshotSpin(sw, userParams) {
  // SPIN fire-on-preset: se at_preset=1, envia VAL1 de cada slot
  // configurado (estado inicial = pixel 1). Sem at_preset, nao dispara
  // nada no load (fica awaiting).
  const p = { ...DEFAULT_SW_PARAMS('spin'), ...(userParams || {}) };
  if (Number(p.at_preset) !== 1) return { sw, modeLabel: 'SPIN', sections: [] };
  const parsed = parseSpinSlots(p.spin_slots || '');
  const hasAny = parsed.some((s) => s.ch >= 1 && s.ch <= 16);
  const slots = parsed.slice();
  if (!hasAny && Number(p.ch) >= 1 && Number(p.ch) <= 16) {
    slots[0] = {
      ch: Number(p.ch), num: Number(p.num) || 0,
      v1: Number(p.val1) || 0,
      v2: typeof p.val2 !== 'undefined' ? Number(p.val2) : 64,
      v3: typeof p.val3 !== 'undefined' ? Number(p.val3) : 127,
    };
  }
  const active = slots.filter((s) => s.ch >= 1 && s.ch <= 16);
  if (active.length === 0) return { sw, modeLabel: 'SPIN', sections: [] };
  return {
    sw, modeLabel: 'SPIN',
    sections: [{
      label: 'PIXEL 1',
      flags: [`${active.length} SLOT${active.length > 1 ? 'S' : ''}`],
      messages: active.map((s) => ccMsg(s.ch, s.num, s.v1)),
    }],
  };
}

function buildSnapshotRamp(sw, userParams) {
  // RAMP nunca dispara na chamada do preset (so opera em LIVE MODE
  // por design). Snapshot vazio.
  return { sw, modeLabel: 'RAMP', sections: [] };
}

function buildSnapshotSwEntry(sw, id, params) {
  if (!id || id === 'mute') return { sw, modeLabel: 'MUTE', sections: [] };
  if (id === 'fx1' || id === 'fx2' || id === 'fx3') {
    return buildSnapshotStomp(sw, id, params);
  }
  if (id === 'momentary') return buildSnapshotMomentary(sw, params);
  if (id === 'single')    return buildSnapshotSingle(sw, params);
  if (id === 'macros')    return buildSnapshotMacros(sw, params);
  if (id === 'tap_tempo') return buildSnapshotTap(sw, params);
  if (id === 'ramp')      return buildSnapshotRamp(sw, params);
  if (id === 'spin')      return buildSnapshotSpin(sw, params);
  // Outros modos ainda nao implementados — mostra so o rotulo.
  const mode = SW_MODES.find((m) => m.id === id);
  return { sw, modeLabel: mode ? (mode.sub || mode.title) : id.toUpperCase(),
           sections: [] };
}

// Monta um evento de press de SW em LIVE MODE pro MONITOR. section: 0 =
// click curto (chaves sem sufixo), 1 = click longo (sufixo 2), 2 = reclick
// do STOMP 3 (sufixo 3). nowOn: estado novo apos o press. Retorna null se
// o modo do SW nao produz MIDI naquela secao (mute, fx1 section>0, etc.).
// O objeto retornado tem:
//   sw          — numero do SW (1..6)
//   modeLabel   — rotulo do modo (STOMP, MACROS, SINGLE, etc.)
//   sectionLabel— rotulo da secao no tier (CURTO/LONGO/RECLICK) ou ''
//   on          — true/false do toggle, ou true pra disparos one-shot
//   messages    — array de { kind: 'cc'|'pc', ch, num/pc, val } com cada
//                 mensagem MIDI que foi realmente disparada
function buildLivePressEvent(sw, section, nowOn, savedSwModes, savedSwParams) {
  const id = (savedSwModes && savedSwModes[sw]) || 'mute';
  const userParams = savedSwParams && savedSwParams[sw] && savedSwParams[sw][id];

  // STOMP unificado (fx1) e legados fx2/fx3 — toggle de uma secao com
  // um CC. tierLabel mostra CURTO/LONGO/RECLICK conforme as secoes
  // configuradas (so A = sem label; A+B = CURTO/LONGO; +C = todos).
  if (id === 'fx1' || id === 'fx2' || id === 'fx3') {
    const p = { ...DEFAULT_SW_PARAMS(id), ...(userParams || {}) };
    const chOK = (v) => v >= 1 && v <= 16;
    // Secao "esta ativa" se tem canal valido OU se esta como FAVORITE.
    const hasB = chOK(Number(p.ch2)) || Number(p.fav2) === 1;
    const hasC = id !== 'fx2' &&
                 (chOK(Number(p.ch3)) || Number(p.fav3) === 1);
    const tierLabel = (s) => {
      if (hasC) return s === 0 ? 'CURTO' : s === 1 ? 'LONGO' : 'RECLICK';
      if (hasB) return s === 0 ? 'CURTO' : 'LONGO';
      return '';
    };
    const suf = section === 0 ? '' : section === 1 ? '2' : '3';
    // FAVORITE: a secao carrega banco/preset em vez de mandar CC.
    if (Number(p['fav' + suf]) === 1) {
      const bankLetters = ['A', 'B', 'C', 'D', 'E'];
      const fb = clamp(Number(p['fav_bank' + suf]) || 0, 0, 4);
      const fp = clamp(Number(p['fav_preset' + suf]) || 1, 1, 30);
      const fm = Number(p['fav_mode' + suf]) === 1 ? 'LIVE' : 'PRESET';
      return {
        sw, modeLabel: 'STOMP',
        sectionLabel: tierLabel(section),
        on: null,
        messages: [{
          kind: 'fav',
          bank: bankLetters[fb] || 'A',
          preset: fp,
          mode: fm,
        }],
      };
    }
    const ch = Number(p['ch' + suf]);
    if (!chOK(ch)) return null;
    const custom = Number(p['custom' + suf]) === 1;
    const onV = Number(p['on' + suf]);
    const offV = Number(p['off' + suf]);
    const value = custom ? (nowOn ? onV : offV) : (nowOn ? 127 : 0);
    return {
      sw, modeLabel: 'STOMP', sectionLabel: tierLabel(section), on: nowOn,
      messages: [ccMsg(ch, Number(p['num' + suf]), value)],
    };
  }

  if (id === 'momentary' && section === 0) {
    const p = { ...DEFAULT_SW_PARAMS('momentary'), ...(userParams || {}) };
    const slotsFromMom = parseMomSlots(p.mom_slots || '');
    const momHasAny = slotsFromMom.some((s) => s.ch >= 1 && s.ch <= 16);
    const slots = slotsFromMom.slice();
    if (!momHasAny && Number(p.ch) >= 1 && Number(p.ch) <= 16) {
      slots[0] = {
        ch: Number(p.ch),
        num: Number(p.num) || 0,
        on: Number(p.custom) === 1 ? (Number(p.on) || 127) : 127,
        off: Number(p.custom) === 1 ? (Number(p.off) || 0) : 0,
      };
    }
    const active = slots.filter((s) => s.ch >= 1 && s.ch <= 16);
    if (active.length === 0) return null;
    const messages = [];
    for (const s of active) {
      messages.push(ccMsg(s.ch, s.num, s.on));
      messages.push(ccMsg(s.ch, s.num, s.off));
    }
    return {
      sw, modeLabel: 'MOMENTARY', sectionLabel: '', on: null,
      messages,
    };
  }

  if (id === 'macros') {
    const p = { ...DEFAULT_SW_PARAMS('macros'), ...(userParams || {}) };
    const slots = parseMslots(p.mslots || '');
    const messages = [];
    for (const s of slots) {
      if (s.ch < 1 || s.ch > 16) continue;
      const v = nowOn ? s.on : s.off;
      if (v < 0) continue;  // -1 = OFF/pula direcao pra esse slot
      messages.push(s.t === 1 ? pcMsg(s.ch, v) : ccMsg(s.ch, s.num, v));
    }
    return {
      sw, modeLabel: 'MACROS', sectionLabel: '', on: nowOn,
      messages,
    };
  }

  if (id === 'tap_tempo') {
    const p = { ...DEFAULT_SW_PARAMS('tap_tempo'), ...(userParams || {}) };
    if (section === 0) {
      const slots = parseTapSlots(p.tslots || '');
      const messages = [];
      for (const s of slots) {
        if (s.ch < 1 || s.ch > 16) continue;
        messages.push(ccMsg(s.ch, s.num, 127));
        if (s.mode === 2) messages.push(ccMsg(s.ch, s.num, 0));
      }
      return {
        sw, modeLabel: 'TAP TEMPO', sectionLabel: 'TAP', on: null,
        messages,
      };
    }
    if (section === 1) {
      const lpCh = Number(p.lp_ch) || 0;
      if (lpCh < 1 || lpCh > 16) return null;
      const lpNum = Number(p.lp_num) || 0;
      const lpOn = typeof p.lp_on !== 'undefined' ? Number(p.lp_on) : 127;
      const lpOff = Number(p.lp_off) || 0;
      const val = nowOn ? lpOn : lpOff;
      return {
        sw, modeLabel: 'TAP TEMPO', sectionLabel: 'LONG PRESS', on: nowOn,
        messages: [ccMsg(lpCh, lpNum, val)],
      };
    }
    return null;
  }

  if (id === 'spin' && section === 0) {
    // SPIN — nowOn carrega o stateIndex (0/1/2). Cada estado dispara
    // TODOS os slots configurados (ate 3 CCs simultaneos).
    const p = { ...DEFAULT_SW_PARAMS('spin'), ...(userParams || {}) };
    const stIdx = typeof nowOn === 'number' ? clamp(nowOn, 0, 2) : 0;
    const vKey = stIdx === 0 ? 'v1' : stIdx === 1 ? 'v2' : 'v3';
    const parsed = parseSpinSlots(p.spin_slots || '');
    const hasAny = parsed.some((s) => s.ch >= 1 && s.ch <= 16);
    const slots = parsed.slice();
    if (!hasAny && Number(p.ch) >= 1 && Number(p.ch) <= 16) {
      slots[0] = {
        ch: Number(p.ch), num: Number(p.num) || 0,
        v1: Number(p.val1) || 0,
        v2: typeof p.val2 !== 'undefined' ? Number(p.val2) : 64,
        v3: typeof p.val3 !== 'undefined' ? Number(p.val3) : 127,
      };
    }
    const active = slots.filter((s) => s.ch >= 1 && s.ch <= 16);
    if (active.length === 0) return null;
    return {
      sw, modeLabel: 'SPIN',
      sectionLabel: 'PIXEL ' + (stIdx + 1),
      on: null,
      messages: active.map((s) => ccMsg(s.ch, s.num, s[vKey] || 0)),
    };
  }

  if (id === 'ramp' && section === 0) {
    // RAMP — usa liveOn[i] como toggle (direcao do sweep). Cada press
    // flipa, e o evento mostra o valor extremo daquela direcao. O sweep
    // continuo acontece no device — o monitor so loga o gatilho.
    const p = { ...DEFAULT_SW_PARAMS('ramp'), ...(userParams || {}) };
    const ch = Number(p.ch) || 0;
    if (ch < 1 || ch > 16) return null;
    const num = Number(p.num) || 0;
    const target = nowOn
      ? (typeof p.max_val !== 'undefined' ? Number(p.max_val) : 127)
      : Number(p.min_val) || 0;
    const curveLabels = ['LINEAR', 'EXP', 'LOG', 'SINE'];
    const dur = nowOn ? (Number(p.up_ms) || 1000) : (Number(p.down_ms) || 1000);
    return {
      sw, modeLabel: 'RAMP',
      sectionLabel: (nowOn ? '↑ ' : '↓ ') + (curveLabels[Number(p.curve) || 0]
        || 'LINEAR') + ` (${dur}ms)`,
      on: nowOn,
      messages: [ccMsg(ch, num, target)],
    };
  }

  if (id === 'single' && section === 0) {
    const p = { ...DEFAULT_SW_PARAMS('single'), ...(userParams || {}) };
    const slotsFromSslots = parseSingleSlots(p.sslots || '');
    const sslotsHasAny = slotsFromSslots.some((s) => s.ch >= 1 && s.ch <= 16);
    const slots = slotsFromSslots.slice();
    if (!sslotsHasAny && Number(p.ch) >= 1 && Number(p.ch) <= 16) {
      slots[0] = {
        t: Number(p.as_pc) === 1 ? 1 : 0,
        ch: Number(p.ch),
        num: Number(p.num) || 0,
        val: Number(p.as_pc) === 1
          ? (Number(p.pc) || 0)
          : (Number(p.on) || 127),
      };
    }
    const messages = slots
      .filter((s) => s.ch >= 1 && s.ch <= 16)
      .map((s) => s.t === 1 ? pcMsg(s.ch, s.val) : ccMsg(s.ch, s.num, s.val));
    return {
      sw, modeLabel: 'SINGLE', sectionLabel: '', on: null,
      messages,
    };
  }

  return null;
}

// Footswitch (pedal de stomp) — cap arredondado + pescoco + base em 2
// niveis. Reutilizado por FX1/FX2/FX3; a diferenca entre eles esta no
// comportamento (ver SW_MODES), nao no desenho.
function swFootswitch() {
  return (
    <>
      <rect className="bf-tab-shape" x="8" y="2.5" width="8" height="8" rx="3" />
      <path className="bf-tab-shape" d="M10 10.5 L10 12.5 M14 10.5 L14 12.5" />
      <rect className="bf-tab-shape" x="6.5" y="12.5" width="11" height="3" rx="0.6" />
      <rect className="bf-tab-shape" x="4" y="15.5" width="16" height="4" rx="0.8" />
    </>
  );
}

function swIcoSvg(children) {
  return (
    <svg viewBox="0 0 24 24" className="bf-tab-ico" strokeLinecap="round"
         strokeLinejoin="round" aria-hidden="true">{children}</svg>
  );
}

// Icone line-art de cada modo de SW. Mesmo estilo dos demais icones do
// app (bf-tab-shape = traco, bf-tab-dot = preenchido).
function SwModeIcon({ id }) {
  switch (id) {
    case 'mute':  // alto-falante mudo — SW silencioso (padrao)
      return swIcoSvg(<>
        <path className="bf-tab-shape" d="M3.5 9.5 L7 9.5 L11 6 L11 18 L7 14.5 L3.5 14.5 Z" />
        <path className="bf-tab-shape" d="M14.5 9 L20 15 M20 9 L14.5 15" />
      </>);
    case 'fx1':  // STOMP — click
    case 'fx2':  // DUAL STOMP — click + long click
    case 'fx3':  // TRIAL STOMP — click + long click + reclick
      return swIcoSvg(swFootswitch());
    case 'spin':  // knob + ponteiro + ticks radiais
      return swIcoSvg(<>
        <circle className="bf-tab-shape" cx="12" cy="12" r="6" />
        <path className="bf-tab-shape" d="M12 12 L15.5 8.5" />
        <path className="bf-tab-shape" d="M19.5 12 L21.5 12 M17.3 6.7 L18.7 5.3 M12 4.5 L12 2.5 M6.7 6.7 L5.3 5.3 M4.5 12 L2.5 12 M6.7 17.3 L5.3 18.7 M12 19.5 L12 21.5 M17.3 17.3 L18.7 18.7" />
      </>);
    case 'ramp':  // triangulo com hipotenusa tracejada
      return swIcoSvg(<>
        <path className="bf-tab-shape" d="M4 19 L20 19 L20 5" />
        <path className="bf-tab-shape" strokeDasharray="3 2.4" d="M4 19 L20 5" />
      </>);
    case 'momentary':  // sinaleiro / luz de alerta
      return swIcoSvg(<>
        <path className="bf-tab-shape" d="M9 18.5 L15 18.5 L15.7 20.8 L8.3 20.8 Z" />
        <path className="bf-tab-shape" d="M9 18.5 L9 13.5 C9 10.2 10.3 9 12 9 C13.7 9 15 10.2 15 13.5 L15 18.5" />
        <path className="bf-tab-shape" d="M12 7 L12 4.5 M7.7 8.3 L6 6.6 M16.3 8.3 L18 6.6 M6.3 12 L4 11.3 M17.7 12 L20 11.3" />
      </>);
    case 'favorite':  // estrela
      return swIcoSvg(
        <path className="bf-tab-shape" d="M12 2.5 L14.85 8.9 L21.5 9.6 L16.5 14.1 L18 20.7 L12 17.3 L6 20.7 L7.5 14.1 L2.5 9.6 L9.15 8.9 Z" />
      );
    case 'macros':  // 3 faders verticais
      return swIcoSvg(<>
        <path className="bf-tab-shape" d="M7 4 L7 20 M12 4 L12 20 M17 4 L17 20" />
        <rect className="bf-tab-dot" x="4.8" y="7" width="4.4" height="2.6" rx="0.7" />
        <rect className="bf-tab-dot" x="9.8" y="12.5" width="4.4" height="2.6" rx="0.7" />
        <rect className="bf-tab-dot" x="14.8" y="9.5" width="4.4" height="2.6" rx="0.7" />
      </>);
    case 'tap_tempo':  // relogio com linhas de movimento
      return swIcoSvg(<>
        <circle className="bf-tab-shape" cx="12" cy="12" r="6.5" />
        <path className="bf-tab-shape" d="M12 12 L12 7.8 M12 12 L15 13.5" />
        <path className="bf-tab-shape" d="M4 8 C2.6 12 2.6 12 4 16 M20 8 C21.4 12 21.4 12 20 16" />
      </>);
    case 'single':  // moldura de foco + circulo central
      return swIcoSvg(<>
        <path className="bf-tab-shape" d="M3.5 8 L3.5 4.5 L7 4.5 M17 4.5 L20.5 4.5 L20.5 8 M20.5 16 L20.5 19.5 L17 19.5 M7 19.5 L3.5 19.5 L3.5 16" />
        <circle className="bf-tab-shape" cx="12" cy="12" r="4" />
      </>);
    default:  // sem modo definido — placeholder pontilhado
      return swIcoSvg(
        <circle className="bf-tab-shape" cx="12" cy="12" r="7" strokeDasharray="2.5 3" opacity="0.45" />
      );
  }
}

// DEPRECATED — substituido pelo SwStompEditor unificado. Mantido apenas
// como referencia historica; nao e mais montado pelo LiveModePanel.
// Pode ser removido em uma limpeza futura.
function SwFx1EditorLegacy({ sw, params, onChange, ledPreviewLive, liveOn }) {
  const isCustom = params.custom === 1;
  const numOptions = Array.from({ length: 128 }, (_, n) => n);
  // Estado de teste local: o botao MIDI TEST alterna on/off, dispara o CC
  // efetivo daquele estado no dispositivo e reflete no preview do LED.
  // Inicia no estado configurado em `start` (reinicia por SW — key no
  // LiveModePanel).
  const [testOn, setTestOn] = useState(
    typeof liveOn === 'boolean' ? liveOn : params.start === 1);
  useEffect(() => {
    setTestOn(typeof liveOn === 'boolean' ? liveOn : params.start === 1);
  }, [sw, liveOn, params.start]);
  const midiTest = async () => {
    const next = !testOn;
    setTestOn(next);
    // Valor efetivo do CC: custom usa on/off salvos, senao 127/0.
    const value = isCustom ? (next ? params.on : params.off)
                           : (next ? 127 : 0);
    if (params.ch < 1 || params.ch > 16) {
      const body = new URLSearchParams();
      body.set('sw', String(sw));
      body.set('on', next ? '1' : '0');
      body.set('color', String(params.color));
      try { await apiCall('POST', '/midi/cc', body); } catch {/* preview/offline */}
      return;
    }
    if (params.ch < 1 || params.ch > 16) return;  // canal OFF — so o preview
    const body = new URLSearchParams();
    body.set('sw', String(sw));
    body.set('on', next ? '1' : '0');
    body.set('color', String(params.color));
    if (params.ch >= 1 && params.ch <= 16) {
      body.set('ch', String(params.ch));
      body.set('cc', String(params.num));
      body.set('value', String(value));
    }
    try { await apiCall('POST', '/midi/cc', body); } catch {/* preview/offline */}
  };
  // Preview do LED (FootswitchArc): ligado -> 3 arcos acesos. Desligado:
  // se o LED PREVIEW LIVE MODE estiver ON, so o arco de baixo aceso
  // (espelha o firmware, que mantem so o pixel central); se estiver OFF,
  // atenua o conjunto todo.
  const ledLitArcs = (!testOn && ledPreviewLive) ? [0] : undefined;
  const ledDimmed = !testOn && !ledPreviewLive;
  return (
    <div className="bf-sw-fx1">
      <div className="bf-extras-row">
        <label className="bf-extras-cell">
          <span className="bf-field-label">CC</span>
          <div className="bf-select-wrap">
            <select
              className="bf-input bf-select"
              value={params.num}
              onChange={(e) => onChange({ num: clamp(Number(e.target.value), 0, 127) })}
              aria-label="Numero do CC"
            >
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">Canal</span>
          <div className="bf-select-wrap">
            <select
              className={'bf-input bf-select' + (params.ch === 0 ? ' is-mute' : '')}
              value={params.ch}
              onChange={(e) => onChange({ ch: Number(e.target.value) })}
              aria-label="Canal MIDI"
            >
              <option value={0}>OFF</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
      </div>
      <div className="bf-extras-row">
        <button
          type="button"
          className={'bf-input bf-input-num' + (isCustom ? ' is-active' : '')}
          onClick={() => onChange({ custom: isCustom ? 0 : 1 })}
          aria-pressed={isCustom}
          aria-label={`Custom: ${isCustom ? 'ligado' : 'desligado'}`}
          title="Liga valores ON/OFF proprios"
        >
          CUSTOM
        </button>
        <button
          type="button"
          className={'bf-input bf-input-num' + (params.start === 1 ? ' is-active' : '')}
          onClick={() => onChange({ start: params.start === 1 ? 0 : 1 })}
          aria-pressed={params.start === 1}
          aria-label={`Estado inicial: ${params.start === 1 ? 'ligado' : 'desligado'}`}
        >
          {params.start === 1 ? 'START ON' : 'START OFF'}
        </button>
      </div>
      {isCustom && (
        <div className="bf-extras-row">
          <label className="bf-extras-cell">
            <span className="bf-field-label">Valor On</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={params.on}
                onChange={(e) => onChange({ on: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Valor do CC quando ligado"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">Valor Off</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={params.off}
                onChange={(e) => onChange({ off: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Valor do CC quando desligado"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
        </div>
      )}
      <div className="bf-extras-row bf-sw-fx1-test">
        <button
          type="button"
          className={'bf-input bf-input-num' + (testOn ? ' is-active' : '')}
          onClick={midiTest}
          aria-pressed={testOn}
          aria-label="MIDI TEST — dispara o CC do STOMP e alterna on/off"
        >
          MIDI TEST
        </button>
        <div className={'bf-sw-fx1-led' + (ledDimmed ? ' is-off' : '')}>
          <FootswitchArc
            label="LED"
            colorId={params.color}
            onChange={(id) => onChange({ color: id })}
            litArcs={ledLitArcs}
            labelInside
          />
        </div>
      </div>
    </div>
  );
}

// Uma secao do editor STOMP 2/3 — mesma estrutura do SwFx1Editor, mas
// parametrizada pelo `section`: 0 = click curto (chaves num/ch/...), 1 =
// click longo (chaves num2/ch2/...), 2 = reclick/duplo-click (chaves
// num3/ch3/...). O `onChange` recebido ja aponta pro modo do SW; aqui so
// prefixamos as chaves. `litArcsOn` define quais arcos do FootswitchArc
// acendem quando testOn (mapeamento do pixel no firmware).
function SwStompSection({ sw, section, label, litArcsOn,
                          params, onChange, ledPreviewLive, liveOn,
                          presetCount }) {
  const suf = section === 0 ? '' : section === 1 ? '2' : '3';
  const k = (base) => base + suf;
  const num = params[k('num')];
  const ch = params[k('ch')];
  const on = params[k('on')];
  const off = params[k('off')];
  const start = params[k('start')];
  const color = params[k('color')];
  const isCustom = params[k('custom')] === 1;
  const isFav = Number(params[k('fav')]) === 1;
  const favBank = clamp(Number(params[k('fav_bank')]) || 0, 0, 4);
  const favPreset = clamp(Number(params[k('fav_preset')]) || 1, 1,
                          presetCount || 6);
  const favMode = Number(params[k('fav_mode')]) === 1 ? 1 : 0;
  const bankLetters = ['A', 'B', 'C', 'D', 'E'];
  // at_preset: dispara MIDI na chamada do preset? Default 1 quando
  // ausente (dados antigos do STOMP, que sempre disparavam).
  const atPreset = (typeof params[k('at_preset')] !== 'undefined')
    ? params[k('at_preset')] === 1
    : true;
  const numOptions = Array.from({ length: 128 }, (_, n) => n);
  // Estado de teste local: o botao MIDI TEST alterna on/off, dispara o CC
  // efetivo daquele estado no dispositivo e reflete no preview do LED.
  // Inicia no estado live do firmware (so a secao A o recebe) ou, na
  // falta, no `start` configurado. Reinicia por SW (key no LiveModePanel).
  const [testOn, setTestOn] = useState(
    typeof liveOn === 'boolean' ? liveOn : start === 1);
  useEffect(() => {
    setTestOn(typeof liveOn === 'boolean' ? liveOn : start === 1);
  }, [sw, section, liveOn, start]);
  const midiTest = async () => {
    const next = !testOn;
    setTestOn(next);
    // Valor efetivo do CC: custom usa on/off salvos, senao 127/0.
    const value = isCustom ? (next ? on : off) : (next ? 127 : 0);
    const body = new URLSearchParams();
    body.set('sw', String(sw));
    body.set('on', next ? '1' : '0');
    body.set('color', String(color));
    body.set('section', String(section));
    if (ch >= 1 && ch <= 16) {
      body.set('ch', String(ch));
      body.set('cc', String(num));
      body.set('value', String(value));
    }
    try { await apiCall('POST', '/midi/cc', body); } catch {/* preview/offline */}
  };
  // Preview do LED (FootswitchArc): testOn acende os arcos definidos em
  // `litArcsOn` (o parent decide o mapeamento conforme o modo); testOff
  // apaga tudo. Sem preview-live (espelha o firmware, ver LED_STRIP.h).
  const ledLitArcs = testOn ? (litArcsOn || []) : [];
  const ledDimmed = false;
  return (
    <div className="bf-sw-fx1">
      {label && <div className="bf-section-label">{label}</div>}
      {isFav ? (
        // ─── FAVORITE MODE — substitui os campos MIDI por um seletor
        // visual de banco/preset/modo no mesmo estilo da pagina GLOBAL
        // (.bf-seg pro toggle BANK/LIVE + .bf-cycle pros cards grandes).
        // Ao pisar o SW, o firmware carrega esse preset, opcionalmente
        // entrando em LIVE MODE.
        <div className="bf-fav-picker">
          <div className="bf-seg">
            <button
              type="button"
              className={favMode === 0 ? 'is-active' : ''}
              onClick={() => onChange({ [k('fav_mode')]: 0 })}
              aria-pressed={favMode === 0}
              title="Carrega o preset entrando em PRESET MODE"
            >BANK</button>
            <button
              type="button"
              className={favMode === 1 ? 'is-active' : ''}
              onClick={() => onChange({ [k('fav_mode')]: 1 })}
              aria-pressed={favMode === 1}
              title="Carrega o preset entrando em LIVE MODE"
            >LIVE</button>
          </div>
          <div className="bf-cycle">
            <button
              type="button"
              className="is-on"
              onClick={() => onChange({ [k('fav_bank')]: (favBank + 1) % 5 })}
              aria-label={'Banco alvo: ' + bankLetters[favBank]}
              title="Toque pra ciclar A → B → C → D → E"
            >
              <span className="cap">BANK</span>{bankLetters[favBank]}
            </button>
            <button
              type="button"
              className="is-on"
              onClick={() => onChange({ [k('fav_preset')]: (favPreset % (presetCount || 6)) + 1 })}
              aria-label={'Preset alvo: ' + favPreset}
              title="Toque pra ciclar"
            >
              <span className="cap">PRESET</span>{favPreset}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bf-extras-row">
            <label className="bf-extras-cell">
              <span className="bf-field-label">CC</span>
              <div className="bf-select-wrap">
                <select
                  className="bf-input bf-select"
                  value={num}
                  onChange={(e) => onChange({ [k('num')]: clamp(Number(e.target.value), 0, 127) })}
                  aria-label="Numero do CC"
                >
                  {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="bf-select-chev">▾</span>
              </div>
            </label>
            <label className="bf-extras-cell">
              <span className="bf-field-label">Canal</span>
              <div className="bf-select-wrap">
                <select
                  className={'bf-input bf-select' + (ch === 0 ? ' is-mute' : '')}
                  value={ch}
                  onChange={(e) => onChange({ [k('ch')]: Number(e.target.value) })}
                  aria-label="Canal MIDI"
                >
                  <option value={0}>OFF</option>
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="bf-select-chev">▾</span>
              </div>
            </label>
          </div>
          <div className="bf-extras-row">
            <button
              type="button"
              className={'bf-input bf-input-num' + (isCustom ? ' is-active' : '')}
              onClick={() => onChange({ [k('custom')]: isCustom ? 0 : 1 })}
              aria-pressed={isCustom}
              aria-label={`Custom: ${isCustom ? 'ligado' : 'desligado'}`}
              title="Liga valores ON/OFF proprios"
            >
              CUSTOM
            </button>
            <button
              type="button"
              className={'bf-input bf-input-num' + (start === 1 ? ' is-active' : '')}
              onClick={() => onChange({ [k('start')]: start === 1 ? 0 : 1 })}
              aria-pressed={start === 1}
              aria-label={`Estado inicial: ${start === 1 ? 'ligado' : 'desligado'}`}
            >
              {start === 1 ? 'START ON' : 'START OFF'}
            </button>
          </div>
          <div className="bf-extras-row bf-extras-row-full">
            <button
              type="button"
              className={'bf-input bf-input-num' + (atPreset ? ' is-active' : '')}
              onClick={() => onChange({ [k('at_preset')]: atPreset ? 0 : 1 })}
              aria-pressed={atPreset}
              title={atPreset
                ? 'START ON PRESET — dispara o CC na chamada do preset (LED reflete o estado inicial em LIVE)'
                : 'WAITING LIVE MODE — nao dispara na chamada do preset; estado inicial e fixado em silencio'}
            >
              {atPreset ? 'START ON PRESET' : 'WAITING LIVE MODE'}
            </button>
          </div>
        </>
      )}
      {!isFav && isCustom && (
        <div className="bf-extras-row">
          <label className="bf-extras-cell">
            <span className="bf-field-label">Valor On</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={on}
                onChange={(e) => onChange({ [k('on')]: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Valor do CC quando ligado"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">Valor Off</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={off}
                onChange={(e) => onChange({ [k('off')]: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Valor do CC quando desligado"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
        </div>
      )}
      <div className="bf-extras-row bf-sw-fx1-test bf-stomp-test-row">
        {!isFav && (
          <button
            type="button"
            className={'bf-input bf-input-num' + (testOn ? ' is-active' : '')}
            onClick={midiTest}
            aria-pressed={testOn}
            aria-label="MIDI TEST — dispara o CC do STOMP e alterna on/off"
          >
            MIDI TEST
          </button>
        )}
        <button
          type="button"
          className={'bf-input bf-input-num bf-fav-btn' +
                     (isFav ? ' is-active' : '')}
          onClick={() => onChange({ [k('fav')]: isFav ? 0 : 1 })}
          aria-pressed={isFav}
          title={isFav
            ? 'FAVORITE ligado — ao pisar o SW carrega o preset escolhido'
            : 'FAVORITE — pisar carrega banco/preset/modo em vez de mandar CC'}
        >
          <svg viewBox="0 0 24 24" className="bf-fav-ico" aria-hidden="true">
            <path d="M12 2.5 L14.7 9 L21.5 9.6 L16.3 14.2 L17.9 21 L12 17.3 L6.1 21 L7.7 14.2 L2.5 9.6 L9.3 9 Z" />
          </svg>
          FAVORITE
        </button>
        <div className={'bf-sw-fx1-led' + (ledDimmed ? ' is-off' : '')}>
          <FootswitchArc
            label="LED"
            colorId={color}
            onChange={(id) => onChange({ [k('color')]: id })}
            litArcs={ledLitArcs}
            labelInside
          />
        </div>
      </div>
    </div>
  );
}

// Editor de parametros do modo STOMP 2 (fx2). Duas secoes iguais a do
// STOMP 1: click curto (secao A, chaves sem sufixo) e click longo (secao
// B, chaves com sufixo 2). Pra nao alongar demais o card, mostra so uma
// secao por vez — um toggle segmentado CLICK CURTO / CLICK LONGO alterna
// qual secao esta visivel. Edicao local — persistencia no SAVE do rodape.
function SwFx2Editor({ sw, params, onChange, ledPreviewLive, liveOn, presetCount }) {
  const [activeSection, setActiveSection] = useState(0);
  // Mapeamento pixel -> arco do FootswitchArc:
  //   pixel 1 e 3 (firmware) = arcos superiores esquerdo (1) e direito (2)
  //   pixel 2 (firmware central) = arco inferior (0)
  const litArcsBySection = [[1, 2], [0]];
  // So a secao A recebe o estado live (vem de sw_live_on); B cai no `start`.
  const liveBySection = [liveOn, undefined];
  return (
    <div className="bf-sw-fx2">
      <div className="bf-seg bf-sw-fx2-tabs" role="tablist"
           aria-label="Secao do STOMP 2">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 0}
          className={activeSection === 0 ? 'is-active' : ''}
          onClick={() => setActiveSection(0)}
        >CLICK CURTO</button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 1}
          className={activeSection === 1 ? 'is-active' : ''}
          onClick={() => setActiveSection(1)}
        >CLICK LONGO</button>
      </div>
      <SwStompSection
        key={activeSection}
        sw={sw} section={activeSection}
        litArcsOn={litArcsBySection[activeSection]}
        params={params} onChange={onChange}
        ledPreviewLive={ledPreviewLive}
        liveOn={liveBySection[activeSection]}
        presetCount={presetCount}
      />
    </div>
  );
}

// Editor unificado do modo STOMP (fx1). Tres tabs (CLICK CURTO / CLICK
// LONGO / RECLICK), cada um configurando uma secao independente. O
// comportamento de uso e o layout do LED adaptam conforme quantas secoes
// tem canal valido:
//   so A      -> STOMP classico (3 pixels, tap toggle + momentaneo).
//   A + B     -> DUAL STOMP (pixels externos = A, central = B).
//   A + B + C -> TRIAL STOMP (pixel 1 = A, pixel 2 = B, pixel 3 = C).
// Pixel -> arco no FootswitchArc: 0 = inferior, 1 = sup esq, 2 = sup dir.
// Tambem serve o legado fx3 (mesmas chaves).
function SwStompEditor({ sw, params, onChange, ledPreviewLive, liveOn, presetCount }) {
  const [activeSection, setActiveSection] = useState(0);
  const chOK = (v) => {
    const n = Number(v);
    return n >= 1 && n <= 16;
  };
  // Secao "esta ativa" se tem canal valido OU se esta como FAVORITE
  // (FAVORITE ignora os campos de CC e despacha carregamento de preset).
  const hasB = chOK(params.ch2) || Number(params.fav2) === 1;
  const hasC = chOK(params.ch3) || Number(params.fav3) === 1;
  // Preview do LED adapta o mapeamento pixel -> arco conforme o tier.
  const litArcsBySection = hasC
    ? [[1], [0], [2]]            // tier 3: 1 arco por secao
    : hasB
      ? [[1, 2], [0], []]         // tier 2: A externos, B central
      : [[0, 1, 2], [], []];     // tier 1: A acende os 3 arcos
  // So a secao A recebe o estado live (vem de sw_live_on); B e C caem
  // no `start` configurado.
  const liveBySection = [liveOn, undefined, undefined];
  const labels = ['CLICK CURTO', 'CLICK LONGO', 'RECLICK'];
  return (
    <div className="bf-sw-fx2">
      <div className="bf-seg bf-sw-fx2-tabs" role="tablist"
           aria-label="Secao do STOMP">
        {labels.map((label, idx) => (
          <button
            key={idx}
            type="button"
            role="tab"
            aria-selected={activeSection === idx}
            className={activeSection === idx ? 'is-active' : ''}
            onClick={() => setActiveSection(idx)}
          >{label}</button>
        ))}
      </div>
      <SwStompSection
        key={activeSection}
        sw={sw} section={activeSection}
        litArcsOn={litArcsBySection[activeSection]}
        params={params} onChange={onChange}
        ledPreviewLive={ledPreviewLive}
        liveOn={liveBySection[activeSection]}
        presetCount={presetCount}
      />
    </div>
  );
}

// MACROS — uma linha (slot) do editor. Mostra:
//   - Toggle CC / PC (decide quais campos aparecem).
//   - Canal (OFF/1..16).
//   - CC: CC# + valor ON + valor OFF (cada valor pode ser OFF/-1 = skip).
//   - PC: PC ON + PC OFF (cada pode ser OFF/-1 = skip).
// `slot` = { t, ch, num, on, off }. `onChange(patch)` recebe um patch
// parcial que e fundido pelo pai.
function SwMacrosSlot({ idx, slot, onChange }) {
  const isPc = slot.t === 1;
  const numOptions = Array.from({ length: 128 }, (_, n) => n);
  // Selects de valor incluem "OFF" (=-1) no topo.
  const valueOptionElems = (
    <>
      <option value={-1}>OFF</option>
      {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
    </>
  );
  return (
    <div className="bf-macros-slot">
      <div className="bf-macros-slot-head">
        <span className="bf-macros-slot-idx">{idx + 1}</span>
        <button
          type="button"
          className={'bf-input bf-input-num bf-macros-slot-type' +
                     (isPc ? ' is-pc' : ' is-cc')}
          onClick={() => onChange({ t: isPc ? 0 : 1 })}
          aria-pressed={isPc}
          aria-label={isPc ? 'Slot envia PC — clique pra trocar pra CC'
                           : 'Slot envia CC — clique pra trocar pra PC'}
          title={isPc ? 'Envia PC — clique pra mudar pra CC'
                      : 'Envia CC — clique pra mudar pra PC'}
        >{isPc ? 'SEND PC' : 'SEND CC'}</button>
        <div className="bf-select-wrap bf-macros-slot-ch">
          <select
            className={'bf-input bf-select' + (slot.ch === 0 ? ' is-mute' : '')}
            value={slot.ch}
            onChange={(e) => onChange({ ch: Number(e.target.value) })}
            aria-label="Canal MIDI do slot"
          >
            <option value={0}>CH OFF</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{`CH ${n}`}</option>
            ))}
          </select>
          <span className="bf-select-chev">▾</span>
        </div>
      </div>
      {!isPc ? (
        <div className={'bf-extras-row bf-macros-slot-fields' + (isPc ? ' is-pc' : '')}>
          <label className="bf-extras-cell">
            <span className="bf-field-label">CC</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={slot.num}
                onChange={(e) => onChange({ num: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Numero do CC"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">ON</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={slot.on}
                onChange={(e) => onChange({ on: Number(e.target.value) })}
                aria-label="Valor do CC no estado ON"
              >{valueOptionElems}</select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">OFF</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={slot.off}
                onChange={(e) => onChange({ off: Number(e.target.value) })}
                aria-label="Valor do CC no estado OFF"
              >{valueOptionElems}</select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
        </div>
      ) : (
        <div className={'bf-extras-row bf-macros-slot-fields' + (isPc ? ' is-pc' : '')}>
          <label className="bf-extras-cell">
            <span className="bf-field-label">PC ON</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={slot.on}
                onChange={(e) => onChange({ on: Number(e.target.value) })}
                aria-label="PC no estado ON"
              >{valueOptionElems}</select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">PC OFF</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={slot.off}
                onChange={(e) => onChange({ off: Number(e.target.value) })}
                aria-label="PC no estado OFF"
              >{valueOptionElems}</select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}

// MACROS — secao unica. 4 slots + botao START (dispara com preset) +
// LED color + botao FIRE de teste. Mantida parametrizada (section/suf)
// como vestigio do design antigo de 3 secoes; hoje so usa section=0.
const MACROS_MAX_SLOTS = 4;
function SwMacrosSection({ sw, section, label, litArcsOn,
                          params, onChange, ledPreviewLive, liveOn }) {
  const suf = section === 0 ? '' : section === 1 ? '2' : '3';
  const k = (base) => base + suf;
  const slots = parseMslots(params[k('mslots')]);
  const atPreset = params[k('at_preset')] === 1;
  const startOn = params[k('start')] === 1;
  const colorVal = params[k('color')];

  // Quantos slots ja tem dado (canal valido) — pelo menos 1 sempre visivel.
  const configuredCount = slots.filter((s) => s.ch >= 1 && s.ch <= 16).length;
  const minVisible = Math.max(1, configuredCount);
  const [visibleCount, setVisibleCount] = useState(
    Math.min(MACROS_MAX_SLOTS, minVisible));
  useEffect(() => {
    setVisibleCount((v) => Math.min(MACROS_MAX_SLOTS, Math.max(v, minVisible)));
  }, [minVisible]);

  const updateSlot = (idx, patch) => {
    const next = slots.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ [k('mslots')]: serializeMslots(next) });
  };

  // testOn: estado simulado do toggle da secao. Reinicia conforme `start`
  // (estado inicial logico — independente do at_preset) ou conforme o
  // liveOn vindo do firmware (so a secao A o recebe).
  const [testOn, setTestOn] = useState(
    typeof liveOn === 'boolean' ? liveOn : startOn);
  useEffect(() => {
    setTestOn(typeof liveOn === 'boolean' ? liveOn : startOn);
  }, [sw, section, liveOn, startOn]);

  // FIRE — alterna o estado simulado e dispara cada slot da secao.
  const fireSection = async () => {
    const next = !testOn;
    setTestOn(next);
    for (const slot of slots) {
      if (slot.ch < 1 || slot.ch > 16) continue;
      const val = next ? slot.on : slot.off;
      if (val < 0) continue;  // OFF/skip
      const body = new URLSearchParams();
      body.set('ch', String(slot.ch));
      body.set('as_pc', slot.t === 1 ? '1' : '0');
      if (slot.t === 1) {
        body.set('pc', String(val));
      } else {
        body.set('cc', String(slot.num));
        body.set('value', String(val));
      }
      try { await apiCall('POST', '/midi/cc', body); } catch {/* preview */}
    }
  };

  const ledLitArcs = testOn ? (litArcsOn || []) : [];
  const ledDimmed = false;

  return (
    <div className="bf-sw-fx1 bf-sw-macros">
      {label && <div className="bf-section-label">{label}</div>}
      {slots.slice(0, visibleCount).map((s, i) => (
        <SwMacrosSlot key={i} idx={i} slot={s}
          onChange={(patch) => updateSlot(i, patch)} />
      ))}
      {(visibleCount > 1 || visibleCount < MACROS_MAX_SLOTS) && (
        <div className="bf-tap-slot-actions">
          {visibleCount > 1 && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-remove"
              onClick={() => {
                const last = visibleCount - 1;
                const cur = slots[last];
                if (cur && (cur.ch !== 0 || cur.num !== 0 ||
                            cur.on !== 127 || cur.off !== 0 || cur.t !== 0)) {
                  updateSlot(last, emptyMslot());
                }
                setVisibleCount(visibleCount - 1);
              }}
              aria-label="Remover ultimo slot"
              title="Remover ultimo slot"
            >REMOVE SLOT</button>
          )}
          {visibleCount < MACROS_MAX_SLOTS && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-add"
              onClick={() => setVisibleCount(visibleCount + 1)}
              aria-label="Adicionar mais um slot"
              title="Adicionar mais um slot"
            >ADD SLOT</button>
          )}
        </div>
      )}
      <div className="bf-extras-row">
        <button
          type="button"
          className={'bf-input bf-input-num' + (atPreset ? ' is-active' : '')}
          onClick={() => onChange({ [k('at_preset')]: atPreset ? 0 : 1 })}
          aria-pressed={atPreset}
          title={atPreset
            ? 'START ON PRESET — dispara os slots na chamada do preset'
            : 'WAITING LIVE MODE — so dispara via press fisico'}
        >
          {atPreset ? 'START ON PRESET' : 'WAITING LIVE MODE'}
        </button>
        <button
          type="button"
          className={'bf-input bf-input-num' + (startOn ? ' is-active' : '')}
          onClick={() => onChange({ [k('start')]: startOn ? 0 : 1 })}
          aria-pressed={startOn}
          title={startOn
            ? 'START ON — estado inicial logico = ON (primeiro press alterna pra OFF)' +
              (atPreset ? '. Com DISPARA C/ PRESET, manda valores ON na chamada.' : '')
            : 'START OFF — estado inicial logico = OFF (primeiro press alterna pra ON)' +
              (atPreset ? '. Com DISPARA C/ PRESET, manda valores OFF na chamada.' : '')}
        >
          {startOn ? 'START ON' : 'START OFF'}
        </button>
      </div>
      <div className="bf-extras-row bf-sw-fx1-test">
        <button
          type="button"
          className={'bf-input bf-input-num' + (testOn ? ' is-active' : '')}
          onClick={fireSection}
          aria-pressed={testOn}
          aria-label="FIRE — dispara os 4 slots desta secao"
        >
          FIRE
        </button>
        <div className={'bf-sw-fx1-led' + (ledDimmed ? ' is-off' : '')}>
          <FootswitchArc
            label="LED"
            colorId={colorVal}
            onChange={(id) => onChange({ [k('color')]: id })}
            litArcs={ledLitArcs}
            labelInside
          />
        </div>
      </div>
    </div>
  );
}

// MACROS — uma unica secao com 4 slots (CC ou PC) + START + LED. Sem
// tabs (foram removidos junto com os modos LONGO e RECLICK).
function SwMacrosEditor({ sw, params, onChange, ledPreviewLive, liveOn }) {
  return (
    <SwMacrosSection
      sw={sw} section={0}
      litArcsOn={[0, 1, 2]}
      params={params} onChange={onChange}
      ledPreviewLive={ledPreviewLive}
      liveOn={liveOn}
    />
  );
}

// Editor do modo MOMENTARY — mesma estrutura de uma secao do STOMP
// (reusa SwStompSection com prefix '' / section=0). Sem tabs, sem
// estado live (cada press manda um pulse ON+OFF; o firmware nao
// mantem liveOn pra momentary). O MIDI TEST aqui ainda alterna em
// dois cliques (heranca do SwStompSection) — pra um pulse de teste
// rapido, basta clicar duas vezes seguido.
// MOMENTARY — um slot do editor. Cada slot pulsa CC com par ON/OFF.
function SwMomentarySlot({ idx, slot, onChange }) {
  const numOptions = Array.from({ length: 128 }, (_, n) => n);
  return (
    <div className="bf-macros-slot bf-tap-slot">
      <div className="bf-extras-row bf-tap-slot-row bf-mom-slot-row">
        <span className="bf-macros-slot-idx">{idx + 1}</span>
        <label className="bf-extras-cell">
          <span className="bf-field-label">CC</span>
          <div className="bf-select-wrap">
            <select
              className="bf-input bf-select"
              value={slot.num}
              onChange={(e) => onChange({ num: clamp(Number(e.target.value), 0, 127) })}
              aria-label="Numero do CC"
            >
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">ON</span>
          <div className="bf-select-wrap">
            <select
              className="bf-input bf-select"
              value={slot.on}
              onChange={(e) => onChange({ on: clamp(Number(e.target.value), 0, 127) })}
              aria-label="Valor enviado no pulse ON"
            >
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">OFF</span>
          <div className="bf-select-wrap">
            <select
              className="bf-input bf-select"
              value={slot.off}
              onChange={(e) => onChange({ off: clamp(Number(e.target.value), 0, 127) })}
              aria-label="Valor enviado no pulse OFF"
            >
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">Canal</span>
          <div className="bf-select-wrap">
            <select
              className={'bf-input bf-select' + (slot.ch === 0 ? ' is-mute' : '')}
              value={slot.ch}
              onChange={(e) => onChange({ ch: Number(e.target.value) })}
              aria-label="Canal MIDI do slot"
            >
              <option value={0}>OFF</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
      </div>
    </div>
  );
}

// MOMENTARY — editor com ate 4 slots em `mom_slots`. Cada press do SW
// dispara TODOS os slots como pulse (ON, delay, OFF). Sem estado
// persistente. Migracao automatica: dados legados (campos `ch`/`num`/
// `on`/`off` soltos) sao mostrados como slot 1 ate o user salvar.
function SwMomentaryEditor({ sw, params, onChange, ledPreviewLive }) {
  const slotsFromMom = parseMomSlots(params.mom_slots || '');
  const momHasAny = slotsFromMom.some((s) => s.ch >= 1 && s.ch <= 16);
  const slots = slotsFromMom.slice();
  // Fallback legado: se mom_slots vazio e ha ch/num soltos, vira slot 1.
  if (!momHasAny && Number(params.ch) >= 1 && Number(params.ch) <= 16) {
    slots[0] = {
      ch: Number(params.ch),
      num: Number(params.num) || 0,
      on: Number(params.custom) === 1 ? (Number(params.on) || 127) : 127,
      off: Number(params.custom) === 1 ? (Number(params.off) || 0) : 0,
    };
  }
  const configuredCount = slots.filter((s) => s.ch >= 1 && s.ch <= 16).length;
  const minVisible = Math.max(1, configuredCount);
  const [visibleCount, setVisibleCount] = useState(
    Math.min(MOM_MAX_SLOTS, minVisible));
  useEffect(() => {
    setVisibleCount((v) => Math.min(MOM_MAX_SLOTS, Math.max(v, minVisible)));
  }, [minVisible]);

  const updateSlot = (idx, patch) => {
    const next = slots.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ mom_slots: serializeMomSlots(next) });
  };

  const [testFired, setTestFired] = useState(false);
  const firePulse = async () => {
    setTestFired(true);
    setTimeout(() => setTestFired(false), 200);
    for (const s of slots) {
      if (s.ch < 1 || s.ch > 16) continue;
      const onBody = new URLSearchParams();
      onBody.set('ch', String(s.ch));
      onBody.set('as_pc', '0');
      onBody.set('cc', String(s.num));
      onBody.set('value', String(s.on));
      try { await apiCall('POST', '/midi/cc', onBody); } catch {/* preview */}
      const offBody = new URLSearchParams();
      offBody.set('ch', String(s.ch));
      offBody.set('as_pc', '0');
      offBody.set('cc', String(s.num));
      offBody.set('value', String(s.off));
      try { await apiCall('POST', '/midi/cc', offBody); } catch {/* preview */}
    }
  };

  return (
    <div className="bf-sw-fx1 bf-sw-macros bf-sw-single bf-sw-tap">
      {slots.slice(0, visibleCount).map((s, i) => (
        <SwMomentarySlot key={i} idx={i} slot={s}
          onChange={(patch) => updateSlot(i, patch)} />
      ))}
      <div className="bf-extras-row bf-sw-fx1-test">
        <button
          type="button"
          className={'bf-input bf-input-num' + (testFired ? ' is-active' : '')}
          onClick={firePulse}
          aria-label="PULSE — simula um press (manda ON+OFF de todos os slots)"
        >
          PULSE
        </button>
        <div className="bf-sw-fx1-led">
          <FootswitchArc
            label="LED"
            colorId={params.color}
            onChange={(id) => onChange({ color: id })}
            litArcs={testFired ? [0, 1, 2] : []}
            labelInside
          />
        </div>
      </div>
      {(visibleCount > 1 || visibleCount < MOM_MAX_SLOTS) && (
        <div className="bf-tap-slot-actions">
          {visibleCount > 1 && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-remove"
              onClick={() => {
                const last = visibleCount - 1;
                const cur = slots[last];
                if (cur && (cur.ch !== 0 || cur.num !== 0 ||
                            cur.on !== 127 || cur.off !== 0)) {
                  updateSlot(last, emptyMomSlot());
                }
                setVisibleCount(visibleCount - 1);
              }}
              aria-label="Remover ultimo slot"
              title="Remover ultimo slot"
            >REMOVE SLOT</button>
          )}
          {visibleCount < MOM_MAX_SLOTS && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-add"
              onClick={() => setVisibleCount(visibleCount + 1)}
              aria-label="Adicionar mais um slot"
              title="Adicionar mais um slot"
            >ADD SLOT</button>
          )}
        </div>
      )}
    </div>
  );
}

// TAP TEMPO — um slot: canal + CC# + mode. mode 1 = so CC+127 (classico);
// mode 2 = CC+127 seguido de CC+0 (pulse).
function SwTapTempoSlot({ idx, slot, onChange }) {
  const numOptions = Array.from({ length: 128 }, (_, n) => n);
  const mode = slot.mode === 2 ? 2 : 1;
  return (
    <div className="bf-macros-slot bf-tap-slot">
      <div className="bf-extras-row bf-tap-slot-row">
        <span className="bf-macros-slot-idx">{idx + 1}</span>
        <label className="bf-extras-cell">
          <span className="bf-field-label">CC</span>
          <div className="bf-select-wrap">
            <select
              className="bf-input bf-select"
              value={slot.num}
              onChange={(e) => onChange({ num: clamp(Number(e.target.value), 0, 127) })}
              aria-label="Numero do CC"
            >
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">Canal</span>
          <div className="bf-select-wrap">
            <select
              className={'bf-input bf-select' + (slot.ch === 0 ? ' is-mute' : '')}
              value={slot.ch}
              onChange={(e) => onChange({ ch: Number(e.target.value) })}
              aria-label="Canal MIDI do slot"
            >
              <option value={0}>OFF</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <button
          type="button"
          className={'bf-tap-mode-btn is-mode-' + mode}
          onClick={() => onChange({ mode: mode === 1 ? 2 : 1 })}
          aria-label={'Modo do slot: ' + (mode === 1
            ? 'CC + 127' : 'CC + 127 seguido de CC + 0')}
          title={mode === 1
            ? 'MODE 1 — envia so CC+127'
            : 'MODE 2 — envia CC+127 e depois CC+0'}
        >MODE {mode}</button>
      </div>
    </div>
  );
}

// ─── SPIN ─────────────────────────────────────────────────────────
// Barra horizontal estilo meter — gradient laranja no preenchimento,
// fundo escuro com marcas de tick, porcentagem no centro. Largura
// segue o pai (mesma proporcao do campo de valor).
function SpinBar({ value }) {
  const v = Math.max(0, Math.min(127, Number(value) || 0));
  const pct = Math.round((v / 127) * 100);
  return (
    <div className="bf-spin-bar" role="img" aria-label={`${pct}%`}>
      <div className="bf-spin-bar-fill" style={{ width: pct + '%' }} />
      <div className="bf-spin-bar-ticks" aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} className={'bf-spin-bar-tick' +
                                   (i % 5 === 0 ? ' is-major' : '')} />
        ))}
      </div>
      <span className="bf-spin-bar-text">{pct}%</span>
    </div>
  );
}

// Editor do modo SPIN. Um CC com 3 valores fixos; cada press cicla
// estado 1 -> 2 -> 3 -> 1, com o pixel correspondente aceso. Quando
// at_preset=ON, o preset call entra em estado 1 (val1 disparado).
// Quando at_preset=OFF, fica em "awaiting" (pixel 1 piscando) ate o
// primeiro press, que entao firma val1.
function SwSpinEditor({ sw, params, onChange, ledPreviewLive }) {
  const p = { ...DEFAULT_SW_PARAMS('spin'), ...(params || {}) };
  const numOptions = Array.from({ length: 128 }, (_, n) => n);

  // Carrega os 3 slots; se spin_slots vazio mas ha campos legados (ch/
  // num/val1/val2/val3 soltos), vira slot 1 pro user reaproveitar.
  const parsedSlots = parseSpinSlots(p.spin_slots || '');
  const slotsHasAny = parsedSlots.some((s) => s.ch >= 1 && s.ch <= 16);
  const slots = parsedSlots.slice();
  if (!slotsHasAny && Number(p.ch) >= 1 && Number(p.ch) <= 16) {
    slots[0] = {
      ch: Number(p.ch),
      num: Number(p.num) || 0,
      v1: Number(p.val1) || 0,
      v2: typeof p.val2 !== 'undefined' ? Number(p.val2) : 64,
      v3: typeof p.val3 !== 'undefined' ? Number(p.val3) : 127,
    };
  }

  const [activeSlot, setActiveSlot] = useState(0);
  const updateSlot = (idx, patch) => {
    const next = slots.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ spin_slots: serializeSpinSlots(next) });
  };
  const slot = slots[activeSlot] || emptySpinSlot();

  const [testStage, setTestStage] = useState(0);
  const fireTest = async () => {
    const next = (testStage + 1) % 3;
    setTestStage(next);
    const vKey = next === 0 ? 'v1' : next === 1 ? 'v2' : 'v3';
    // Dispara TODOS os slots simultaneamente (com canal valido).
    for (const s of slots) {
      if (s.ch < 1 || s.ch > 16) continue;
      const body = new URLSearchParams();
      body.set('ch', String(s.ch));
      body.set('as_pc', '0');
      body.set('cc', String(s.num));
      body.set('value', String(s[vKey] || 0));
      try { await apiCall('POST', '/midi/cc', body); } catch {/* preview */}
    }
  };
  const stateToArc = [1, 0, 2];
  const litArcs = [stateToArc[testStage] ?? 1];

  // Marca tabs com bullet quando o slot tem canal valido.
  const slotConfigured = (idx) =>
    slots[idx] && slots[idx].ch >= 1 && slots[idx].ch <= 16;

  return (
    <div className="bf-sw-fx1 bf-sw-spin">
      {/* Tabs SLOT 1 / SLOT 2 / SLOT 3 — disparados SIMULTANEAMENTE
          em cada press. Bullet "•" indica slot com canal configurado. */}
      <div className="bf-seg bf-sw-fx2-tabs" role="tablist"
           aria-label="Slot do SPIN">
        {[0, 1, 2].map((idx) => (
          <button key={idx}
            type="button"
            role="tab"
            aria-selected={activeSlot === idx}
            className={activeSlot === idx ? 'is-active' : ''}
            onClick={() => setActiveSlot(idx)}
          >SLOT {idx + 1}{slotConfigured(idx) ? ' •' : ''}</button>
        ))}
      </div>

      {/* CC + Canal do slot ativo */}
      <div className="bf-extras-row">
        <label className="bf-extras-cell">
          <span className="bf-field-label">CC</span>
          <div className="bf-select-wrap">
            <select className="bf-input bf-select" value={slot.num}
                    onChange={(e) => updateSlot(activeSlot, { num: clamp(Number(e.target.value), 0, 127) })}
                    aria-label="Numero do CC do slot">
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">Canal</span>
          <div className="bf-select-wrap">
            <select className={'bf-input bf-select' + (slot.ch === 0 ? ' is-mute' : '')}
                    value={slot.ch}
                    onChange={(e) => updateSlot(activeSlot, { ch: Number(e.target.value) })}
                    aria-label="Canal MIDI do slot">
              <option value={0}>OFF</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
      </div>

      {/* Val 1 / Val 2 / Val 3 do slot ativo */}
      {[1, 2, 3].map((idx) => {
        const key = 'v' + idx;
        const value = Number(slot[key]) || 0;
        return (
          <div className="bf-spin-val-row" key={idx}>
            <span className="bf-field-label">VAL {idx} (pixel {idx})</span>
            <div className="bf-spin-val-top">
              <div className="bf-select-wrap">
                <select className="bf-input bf-select" value={value}
                        onChange={(e) => updateSlot(activeSlot, { [key]: clamp(Number(e.target.value), 0, 127) })}
                        aria-label={`Valor enviado quando o estado ${idx} ativar`}>
                  {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="bf-select-chev">▾</span>
              </div>
              <SpinBar value={value} />
            </div>
            <input
              type="range"
              className="bf-spin-slider"
              min={0} max={127} step={1}
              value={value}
              onChange={(e) => updateSlot(activeSlot, { [key]: clamp(Number(e.target.value), 0, 127) })}
              aria-label={`Fader do VAL ${idx}`}
            />
          </div>
        );
      })}

      {/* AT_PRESET */}
      <div className="bf-extras-row">
        <button
          type="button"
          className={'bf-input bf-input-num' +
                     (Number(p.at_preset) === 1 ? ' is-active' : '')}
          onClick={() => onChange({ at_preset: Number(p.at_preset) === 1 ? 0 : 1 })}
          aria-pressed={Number(p.at_preset) === 1}
          title={Number(p.at_preset) === 1
            ? 'START ON PRESET — entra em estado 1 (val1 enviado, pixel 1 aceso) ao chamar o preset'
            : 'WAITING LIVE MODE — pixel 1 pisca aguardando; primeiro press firma val1'}
        >
          {Number(p.at_preset) === 1 ? 'START ON PRESET' : 'WAITING LIVE MODE'}
        </button>
      </div>

      {/* SPIN test + LED */}
      <div className="bf-extras-row bf-sw-fx1-test">
        <button
          type="button"
          className="bf-input bf-input-num"
          onClick={fireTest}
          aria-label="SPIN test — cicla estados 1/2/3 e dispara o valor"
        >
          SPIN
        </button>
        <div className="bf-sw-fx1-led">
          <FootswitchArc
            label="LED"
            colorId={Number(p.color)}
            onChange={(id) => onChange({ color: id })}
            litArcs={litArcs}
            labelInside
          />
        </div>
      </div>
    </div>
  );
}

// ─── RAMP ─────────────────────────────────────────────────────────
// Editor do modo RAMPA. Sweep gradual de CC entre min/max com curva e
// tempo configuraveis. Inspirado em controladoras tipo expression
// volume/wah, Boss FS-1, Strymon MultiSwitch e mapping de expressao
// do Helix. Slots: 1 (mono — pode-se estender pra multi-secao depois).
function SwRampEditor({ sw, params, onChange, ledPreviewLive }) {
  const p = { ...DEFAULT_SW_PARAMS('ramp'), ...(params || {}) };
  const numOptions = Array.from({ length: 128 }, (_, n) => n);
  const curves = [
    { id: 0, label: 'LINEAR' },
    { id: 1, label: 'EXP' },
    { id: 2, label: 'LOG' },
    { id: 3, label: 'SINE' },
  ];
  const triggers = [
    { id: 0, label: 'TOGGLE', sub: 'press flipa direcao' },
    { id: 1, label: 'HOLD',   sub: 'sobe enquanto segura' },
    { id: 2, label: 'LOOP',   sub: 'ping-pong continuo' },
  ];

  const [testFired, setTestFired] = useState(false);
  const [testDir, setTestDir] = useState(Number(p.start_on) === 1);
  const fireRamp = async () => {
    // Preview simples: pisca o LED e manda os 2 extremos (sem animacao).
    // O dispositivo real faz o sweep continuo.
    if (Number(p.ch) < 1 || Number(p.ch) > 16) return;
    setTestFired(true);
    setTimeout(() => setTestFired(false), 400);
    const next = !testDir;
    setTestDir(next);
    const body = new URLSearchParams();
    body.set('ch', String(p.ch));
    body.set('as_pc', '0');
    body.set('cc', String(p.num));
    body.set('value', String(next ? p.max_val : p.min_val));
    try { await apiCall('POST', '/midi/cc', body); } catch {/* preview */}
  };

  return (
    <div className="bf-sw-fx1 bf-sw-macros bf-sw-single bf-sw-ramp">
      {/* Linha 1: CC + Canal */}
      <div className="bf-extras-row">
        <label className="bf-extras-cell">
          <span className="bf-field-label">CC</span>
          <div className="bf-select-wrap">
            <select className="bf-input bf-select" value={Number(p.num) || 0}
                    onChange={(e) => onChange({ num: clamp(Number(e.target.value), 0, 127) })}
                    aria-label="Numero do CC">
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">Canal</span>
          <div className="bf-select-wrap">
            <select className={'bf-input bf-select' + (Number(p.ch) === 0 ? ' is-mute' : '')}
                    value={Number(p.ch) || 0}
                    onChange={(e) => onChange({ ch: Number(e.target.value) })}
                    aria-label="Canal MIDI">
              <option value={0}>OFF</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
      </div>

      {/* Linha 2: MIN + MAX */}
      <div className="bf-extras-row">
        <label className="bf-extras-cell">
          <span className="bf-field-label">MIN</span>
          <div className="bf-select-wrap">
            <select className="bf-input bf-select" value={Number(p.min_val) || 0}
                    onChange={(e) => onChange({ min_val: clamp(Number(e.target.value), 0, 127) })}
                    aria-label="Valor minimo do sweep">
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
        <label className="bf-extras-cell">
          <span className="bf-field-label">MAX</span>
          <div className="bf-select-wrap">
            <select className="bf-input bf-select"
                    value={typeof p.max_val !== 'undefined' ? Number(p.max_val) : 127}
                    onChange={(e) => onChange({ max_val: clamp(Number(e.target.value), 0, 127) })}
                    aria-label="Valor maximo do sweep">
              {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="bf-select-chev">▾</span>
          </div>
        </label>
      </div>

      {/* SUBIDA / DESCIDA — input numerico + fader deslizante (100..3000ms).
          Lado a lado na mesma linha; cada coluna empilha input em cima e
          fader embaixo. */}
      <div className="bf-ramp-time-grid">
        {[
          { key: 'up_ms',   label: 'SUBIDA (ms)',  ariaIn: 'Tempo de subida em ms',
            ariaSl: 'Fader do tempo de subida' },
          { key: 'down_ms', label: 'DESCIDA (ms)', ariaIn: 'Tempo de descida em ms',
            ariaSl: 'Fader do tempo de descida' },
        ].map((f) => {
          const v = clamp(Number(p[f.key]) || 1000, 100, 3000);
          return (
            <div className="bf-ramp-time-col" key={f.key}>
              <label className="bf-extras-cell">
                <span className="bf-field-label">{f.label}</span>
                <input type="number" className="bf-input bf-input-num"
                       min={100} max={3000} step={10} value={v}
                       onChange={(e) => onChange({ [f.key]: clamp(Number(e.target.value) || 1000, 100, 3000) })}
                       aria-label={f.ariaIn} />
              </label>
              <input
                type="range"
                className="bf-spin-slider bf-ramp-time-slider"
                min={100} max={3000} step={10}
                value={v}
                onChange={(e) => onChange({ [f.key]: clamp(Number(e.target.value), 100, 3000) })}
                aria-label={f.ariaSl}
              />
            </div>
          );
        })}
      </div>

      {/* Linha 4: CURVA (botoes segmented) */}
      <div className="bf-extras-row bf-ramp-segmented">
        {curves.map((c) => (
          <button key={c.id} type="button"
            className={'bf-input bf-input-num' +
                       (Number(p.curve) === c.id ? ' is-active' : '')}
            onClick={() => onChange({ curve: c.id })}
            aria-pressed={Number(p.curve) === c.id}
            title={'Curva de sweep: ' + c.label}
          >{c.label}</button>
        ))}
      </div>

      {/* Linha 5: TRIGGER MODE */}
      <div className="bf-extras-row bf-ramp-segmented">
        {triggers.map((t) => (
          <button key={t.id} type="button"
            className={'bf-input bf-input-num' +
                       (Number(p.trigger) === t.id ? ' is-active' : '')}
            onClick={() => onChange({ trigger: t.id })}
            aria-pressed={Number(p.trigger) === t.id}
            title={t.sub}
          >{t.label}</button>
        ))}
      </div>

      {/* START direction fixo em OFF (comeca em MIN) — sem expor no UI.
          RESOLUCAO ms fica fixa em 25ms no codigo (fallback do firmware). */}

      {/* RAMP nao tem START ON PRESET — opera SO em LIVE MODE por design.
          O preset apenas carrega a config; o sweep so comeca quando o
          usuario pisar no footswitch em LIVE. */}

      {/* SWEEP test + LED */}
      <div className="bf-extras-row bf-sw-fx1-test">
        <button
          type="button"
          className={'bf-input bf-input-num' + (testFired ? ' is-active' : '')}
          onClick={fireRamp}
          aria-label="SWEEP — alterna entre min e max pra preview"
        >
          SWEEP
        </button>
        <div className={'bf-sw-fx1-led' + (testFired ? '' : ' is-off')}>
          <FootswitchArc
            label="LED"
            colorId={Number(p.color)}
            onChange={(id) => onChange({ color: id })}
            litArcs={testFired ? [0, 1, 2] : []}
            labelInside
          />
        </div>
      </div>
    </div>
  );
}

// Editor do modo TAP TEMPO — ate 4 slots de CC. Cada press do SW dispara
// todos os slots com valor 127, e o firmware calcula o tempo entre os
// dois ultimos taps. O LED no device anima conforme: idle (sem tempo
// batido) cicla pixel 1 -> 2 -> 3; com tempo batido pisca no intervalo.
function SwTapTempoEditor({ sw, params, onChange, ledPreviewLive }) {
  const slots = parseTapSlots(params.tslots || '');
  const configuredCount = slots.filter((s) => s.ch >= 1 && s.ch <= 16).length;
  const minVisible = Math.max(1, configuredCount);
  const [visibleCount, setVisibleCount] = useState(
    Math.min(TAP_MAX_SLOTS, minVisible));
  useEffect(() => {
    setVisibleCount((v) => Math.min(TAP_MAX_SLOTS, Math.max(v, minVisible)));
  }, [minVisible]);

  const updateSlot = (idx, patch) => {
    const next = slots.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ tslots: serializeTapSlots(next) });
  };

  const [testFired, setTestFired] = useState(false);
  const fireTap = async () => {
    setTestFired(true);
    setTimeout(() => setTestFired(false), 150);  // flash visual breve
    for (const s of slots) {
      if (s.ch < 1 || s.ch > 16) continue;
      const body = new URLSearchParams();
      body.set('ch', String(s.ch));
      body.set('as_pc', '0');
      body.set('cc', String(s.num));
      body.set('value', '127');
      try { await apiCall('POST', '/midi/cc', body); } catch {/* preview */}
    }
  };

  const ledLitArcs = testFired ? [0, 1, 2] : [];
  const ledDimmed = !testFired;

  const lpCh = Number(params.lp_ch) || 0;
  const lpNum = clamp(Number(params.lp_num) || 0, 0, 127);
  const lpOn = clamp(typeof params.lp_on !== 'undefined'
    ? Number(params.lp_on) : 127, 0, 127);
  const lpOff = clamp(Number(params.lp_off) || 0, 0, 127);
  const numOptions = Array.from({ length: 128 }, (_, n) => n);

  return (
    <div className="bf-sw-fx1 bf-sw-macros bf-sw-single bf-sw-tap">
      {slots.slice(0, visibleCount).map((s, i) => (
        <SwTapTempoSlot key={i} idx={i} slot={s}
          onChange={(patch) => updateSlot(i, patch)} />
      ))}

      {/* Slot fixo de LONG PRESS — dispara um CC quando o usuario segura
          o SW (~300ms). Independente dos slots de tap. */}
      <div className="bf-macros-slot bf-tap-slot bf-tap-lp-slot">
        <div className="bf-tap-lp-title">LONG PRESS</div>
        <div className="bf-extras-row bf-tap-slot-row">
          <label className="bf-extras-cell">
            <span className="bf-field-label">CC</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={lpNum}
                onChange={(e) => onChange({ lp_num: clamp(Number(e.target.value), 0, 127) })}
                aria-label="CC do long press"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">ON</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={lpOn}
                onChange={(e) => onChange({ lp_on: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Valor enviado ao segurar (ON)"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">OFF</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={lpOff}
                onChange={(e) => onChange({ lp_off: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Valor enviado ao soltar (OFF)"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">Canal</span>
            <div className="bf-select-wrap">
              <select
                className={'bf-input bf-select' + (lpCh === 0 ? ' is-mute' : '')}
                value={lpCh}
                onChange={(e) => onChange({ lp_ch: Number(e.target.value) })}
                aria-label="Canal do long press"
              >
                <option value={0}>OFF</option>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
        </div>
        {/* START ON/OFF + START ON PRESET — toggle do estado inicial e
            controle de disparo no load do preset (espelha STOMP/MACROS). */}
        <div className="bf-extras-row bf-tap-lp-flags">
          <button
            type="button"
            className={'bf-input bf-input-num' + (params.lp_start === 1 ? ' is-active' : '')}
            onClick={() => onChange({ lp_start: params.lp_start === 1 ? 0 : 1 })}
            aria-label="Estado inicial do LONG PRESS"
            title="START ON = comeca ligado; START OFF = comeca desligado"
          >START {params.lp_start === 1 ? 'ON' : 'OFF'}</button>
          <button
            type="button"
            className={'bf-input bf-input-num' + (params.lp_at_preset === 1 ? ' is-active' : '')}
            onClick={() => onChange({ lp_at_preset: params.lp_at_preset === 1 ? 0 : 1 })}
            aria-label="Disparar com o preset"
            title="ON = dispara o LONG PRESS na chamada do preset; OFF = aguarda LIVE"
          >{params.lp_at_preset === 1 ? 'START ON PRESET' : 'WAITING LIVE MODE'}</button>
        </div>
      </div>

      <div className="bf-extras-row bf-sw-fx1-test">
        <button
          type="button"
          className={'bf-input bf-input-num' + (testFired ? ' is-active' : '')}
          onClick={fireTap}
          aria-label="TAP — dispara todos os slots (simula um press)"
        >
          TAP
        </button>
        <div className={'bf-sw-fx1-led' + (ledDimmed ? ' is-off' : '')}>
          <FootswitchArc
            label="LED"
            colorId={params.color}
            onChange={(id) => onChange({ color: id })}
            litArcs={ledLitArcs}
            labelInside
          />
        </div>
      </div>
      {(visibleCount > 1 || visibleCount < TAP_MAX_SLOTS) && (
        <div className="bf-tap-slot-actions">
          {visibleCount > 1 && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-remove"
              onClick={() => {
                const last = visibleCount - 1;
                if (slots[last] && (slots[last].ch !== 0 || slots[last].num !== 0)) {
                  updateSlot(last, { ch: 0, num: 0 });
                }
                setVisibleCount(visibleCount - 1);
              }}
              aria-label="Remover ultimo slot"
              title="Remover ultimo slot"
            >REMOVE</button>
          )}
          {visibleCount < TAP_MAX_SLOTS && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-add"
              onClick={() => setVisibleCount(visibleCount + 1)}
              aria-label="Adicionar mais um slot de tap"
              title="Adicionar mais um slot de tap"
            >ADD TAP</button>
          )}
        </div>
      )}
    </div>
  );
}

// SINGLE — um slot do editor (semelhante ao SwMacrosSlot mas mais
// simples: um valor unico por slot, sem ON/OFF). Slot { t, ch, num, val }.
function SwSingleSlot({ idx, slot, onChange }) {
  const isPc = slot.t === 1;
  const numOptions = Array.from({ length: 128 }, (_, n) => n);
  return (
    <div className="bf-macros-slot">
      <div className="bf-macros-slot-head">
        <span className="bf-macros-slot-idx">{idx + 1}</span>
        <button
          type="button"
          className={'bf-input bf-input-num bf-macros-slot-type' +
                     (isPc ? ' is-pc' : ' is-cc')}
          onClick={() => onChange({ t: isPc ? 0 : 1 })}
          aria-pressed={isPc}
          aria-label={isPc ? 'Slot envia PC — clique pra trocar pra CC'
                           : 'Slot envia CC — clique pra trocar pra PC'}
          title={isPc ? 'Envia PC — clique pra mudar pra CC'
                      : 'Envia CC — clique pra mudar pra PC'}
        >{isPc ? 'SEND PC' : 'SEND CC'}</button>
        <div className="bf-select-wrap bf-macros-slot-ch">
          <select
            className={'bf-input bf-select' + (slot.ch === 0 ? ' is-mute' : '')}
            value={slot.ch}
            onChange={(e) => onChange({ ch: Number(e.target.value) })}
            aria-label="Canal MIDI do slot"
          >
            <option value={0}>CH OFF</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{`CH ${n}`}</option>
            ))}
          </select>
          <span className="bf-select-chev">▾</span>
        </div>
      </div>
      {!isPc ? (
        <div className="bf-extras-row bf-macros-slot-fields is-pc">
          <label className="bf-extras-cell">
            <span className="bf-field-label">CC</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={slot.num}
                onChange={(e) => onChange({ num: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Numero do CC"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
          <label className="bf-extras-cell">
            <span className="bf-field-label">Valor</span>
            <div className="bf-select-wrap">
              <select
                className="bf-input bf-select"
                value={slot.val}
                onChange={(e) => onChange({ val: clamp(Number(e.target.value), 0, 127) })}
                aria-label="Valor do CC"
              >
                {numOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="bf-select-chev">▾</span>
            </div>
          </label>
        </div>
      ) : (
        <div className="bf-extras-row bf-macros-slot-fields is-pc">
          <label className="bf-extras-cell">
            <span className="bf-field-label">PC</span>
            <input
              type="number"
              className="bf-input"
              min={0}
              max={16383}
              value={slot.val}
              onChange={(e) => onChange({ val: clamp(Number(e.target.value) || 0, 0, 16383) })}
              aria-label="Numero do Program Change (0..16383)"
            />
          </label>
        </div>
      )}
    </div>
  );
}

// Editor do modo SINGLE — disparo unico (sem estado on/off). Comeca com
// 1 slot visivel; botao "+" na ponta inferior direita revela mais ate
// totalizar 4 slots. Cada slot e independente (CC ou PC, canal, valor).
// Toggle "DISPARA COM PRESET" / "AGUARDA LIVE" e color do LED sao
// globais do SW (todos os slots compartilham). Quando o SW e pressionado
// em LIVE, TODOS os slots configurados disparam (e o LED acende).
function SwSingleEditor({ sw, params, onChange, ledPreviewLive, isActiveSingle }) {
  // Slots vem do `sslots`. Se vazio E havia config legada (single antigo
  // de 1 slot em num/ch/on/pc/as_pc), migra slot[0] dos campos legados
  // pra UI ficar coerente. Save sobrescreve `sslots`; campos legados
  // permanecem mas o firmware ignora quando `sslots` esta presente.
  const slotsFromSslots = parseSingleSlots(params.sslots || '');
  const sslotsHasAny = slotsFromSslots.some((s) => s.ch >= 1 && s.ch <= 16);
  const legacyCh = Number(params.ch) || 0;
  const slots = slotsFromSslots.slice();
  if (!sslotsHasAny && legacyCh >= 1 && legacyCh <= 16) {
    slots[0] = {
      t: Number(params.as_pc) === 1 ? 1 : 0,
      ch: legacyCh,
      num: Number(params.num) || 0,
      val: Number(params.as_pc) === 1
        ? (Number(params.pc) || 0)
        : (Number(params.on) || 127),
    };
  }
  const configuredCount = slots.filter((s) => s.ch >= 1 && s.ch <= 16).length;
  const minVisible = Math.max(1, configuredCount);
  const [visibleCount, setVisibleCount] = useState(minVisible);
  useEffect(() => {
    setVisibleCount((v) => Math.max(v, minVisible));
  }, [minVisible]);

  // at_preset substitui o `start` antigo do SINGLE. Pra dados legados
  // que ainda guardam `start`, usamos como fallback.
  const fireOnPreset = (typeof params.at_preset !== 'undefined')
    ? params.at_preset === 1
    : params.start === 1;
  const [testFired, setTestFired] = useState(false);
  useEffect(() => {
    if (isActiveSingle) setTestFired(true);
  }, [sw, isActiveSingle]);

  const updateSlot = (idx, patch) => {
    const next = slots.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ sslots: serializeSingleSlots(next) });
  };

  const fireTest = async () => {
    setTestFired(true);
    let firedAny = false;
    for (const slot of slots) {
      if (slot.ch < 1 || slot.ch > 16) continue;
      firedAny = true;
      const body = new URLSearchParams();
      body.set('ch', String(slot.ch));
      body.set('as_pc', slot.t === 1 ? '1' : '0');
      if (slot.t === 1) {
        body.set('pc', String(slot.val));
      } else {
        body.set('cc', String(slot.num));
        body.set('value', String(slot.val));
      }
      try { await apiCall('POST', '/midi/cc', body); } catch {/* preview */}
    }
    if (!firedAny) setTestFired(false);
  };

  const ledLitArcs = testFired ? [0, 1, 2] : [];
  const ledDimmed = !testFired;

  return (
    <div className="bf-sw-fx1 bf-sw-macros bf-sw-single">
      {slots.slice(0, visibleCount).map((s, i) => (
        <SwSingleSlot key={i} idx={i} slot={s}
          onChange={(patch) => updateSlot(i, patch)} />
      ))}
      {(visibleCount > 1 || visibleCount < 4) && (
        <div className="bf-tap-slot-actions">
          {visibleCount > 1 && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-remove"
              onClick={() => {
                const last = visibleCount - 1;
                const cur = slots[last];
                if (cur && (cur.ch !== 0 || cur.num !== 0 ||
                            cur.val !== 0 || cur.t !== 0)) {
                  updateSlot(last, emptySingleSlot());
                }
                setVisibleCount(visibleCount - 1);
              }}
              aria-label="Remover ultimo slot"
              title="Remover ultimo slot"
            >REMOVE SLOT</button>
          )}
          {visibleCount < 4 && (
            <button
              type="button"
              className="bf-tap-action bf-tap-action-add"
              onClick={() => setVisibleCount(visibleCount + 1)}
              aria-label="Adicionar mais um slot"
              title="Adicionar mais um slot"
            >ADD SLOT</button>
          )}
        </div>
      )}
      <div className="bf-extras-row">
        <button
          type="button"
          className={'bf-input bf-input-num' + (fireOnPreset ? ' is-active' : '')}
          onClick={() => onChange({ at_preset: fireOnPreset ? 0 : 1 })}
          aria-pressed={fireOnPreset}
          title={fireOnPreset
            ? 'START ON PRESET — dispara todos os slots na chamada do preset'
            : 'WAITING LIVE MODE — so dispara via press fisico em LIVE MODE'}
        >
          {fireOnPreset ? 'START ON PRESET' : 'WAITING LIVE MODE'}
        </button>
      </div>
      <div className="bf-extras-row bf-sw-fx1-test">
        <button
          type="button"
          className={'bf-input bf-input-num' + (testFired ? ' is-active' : '')}
          onClick={fireTest}
          aria-label="FIRE — dispara todos os slots configurados"
        >
          FIRE
        </button>
        <div className={'bf-sw-fx1-led' + (ledDimmed ? ' is-off' : '')}>
          <FootswitchArc
            label="LED"
            colorId={params.color}
            onChange={(id) => onChange({ color: id })}
            litArcs={ledLitArcs}
            labelInside
          />
        </div>
      </div>
    </div>
  );
}

// Resolve um colorId da DISPLAY_PALETTE pra um CSS background string.
// SOLIDS viram hex; gradientes viram linear-gradient via paletteBackground
// (reusa a logica do ColorBar pra fidelidade visual com o resto do app).
// Transparentes viram 'transparent'.
function paletteCss(colorId) {
  const id = clamp(colorId, 0, DISPLAY_PALETTE.length - 1);
  const c = DISPLAY_PALETTE[id];
  if (!c || c.type === DISP_TYPE.TRANSPARENT) return 'transparent';
  return paletteBackground(c);
}
// Versao "solida" pra contextos onde o gradiente nao funciona (ex.: cor
// de texto, sombras, cor do icone tingido via CSS mask — esses precisam
// de uma cor unica). Pega o primeiro stop do gradiente.
function paletteCssSolid(colorId) {
  const id = clamp(colorId, 0, DISPLAY_PALETTE.length - 1);
  const c = DISPLAY_PALETTE[id];
  if (!c || c.type === DISP_TYPE.TRANSPARENT) return 'transparent';
  return hexToCss(c.hex);
}

// Renderiza um icone PNG mascarado com cor arbitraria via CSS mask-image.
// O PNG e a forma; a cor vem do background. Browsers modernos (Safari
// iOS 14+, Chrome 4+, Firefox 53+) suportam isso de forma simples.
function SwIconImg({ iconId, color, size }) {
  const id = Math.max(1, Math.min(51, parseInt(iconId, 10) || 1));
  const url = `./icons/sw/ICO${id}.png`;
  return (
    <span
      className="bf-sw-icon-img"
      style={{
        display: 'inline-block',
        width: size + 'px',
        height: Math.round(size * 72 / 95) + 'px',  // mantem aspecto 95:72
        background: color,
        WebkitMask: `url('${url}') no-repeat center / contain`,
        mask: `url('${url}') no-repeat center / contain`,
      }}
      aria-hidden="true"
    />
  );
}

// Tile de SW com moldura (background) + borda + icone OU texto centralizado.
// Reusado em LIVE MODE (botoes SW1..SW6) e no preview do editor display.
// `on` decide entre cores OFF e ON. footerInfo (opcional) e exibido no
// rodape DENTRO da moldura: { swNum, modeLabel, ledColorHex }. No editor
// e omitido — quem usa e o painel LIVE pra mostrar "SW1 - STOMP - O".
function SwDisplayTile({ disp, on, spinState, size, footerInfo, isActive }) {
  let d = { ...DEFAULT_SW_DISPLAY(), ...(disp || {}) };
  // Modo SPIN: spinState 0/1/2 seleciona qual sub-config (spin[i]) usar.
  // Cada estado tem icone + sigla + cores ON proprios. State -1 (awaiting)
  // cai no estado 1 como fallback (primeiro press confirma o valor 1).
  if (typeof spinState === 'number') {
    const spin = Array.isArray(d.spin) ? d.spin : [];
    const idx = spinState >= 0 && spinState <= 2 ? spinState : 0;
    const s = { ...DEFAULT_SW_SPIN_STATE(), ...(spin[idx] || {}) };
    d = {
      ...d,
      icon_id: s.icon_id,
      sigla: s.sigla || d.sigla,
      mode: 'icon',
      ic_on: s.ic_on, ic_off: s.ic_on,
      bg_on: s.bg_on, bg_off: s.bg_on,
      br_on: s.br_on, br_off: s.br_on,
    };
    on = true;  // SPIN sempre "on" — o estado escolhe a cor, nao off/on.
  }
  // BACK e BORDER aceitam gradiente (paletteCss devolve linear-gradient
  // quando aplicavel). ICON e tinta solida — CSS mask-image so pinta com
  // background-color, gradiente nao funciona; cai pra cor unica.
  const icColor  = paletteCssSolid(on ? d.ic_on : d.ic_off);
  const bgColor  = paletteCss(on ? d.bg_on  : d.bg_off);
  const brColor  = paletteCss(on ? d.br_on  : d.br_off);
  // Pra borda, o `border-color` tambem nao aceita gradiente — usa solid
  // como fallback. Se for gradient, a borda pega so a primeira cor.
  const brColorSolid = paletteCssSolid(on ? d.br_on : d.br_off);
  const isText   = d.mode === 'text';
  const sigla    = String(d.sigla || '').trim();
  // Moldura quadrada-ish; iconSize ~70% da moldura.
  // Icone ocupa ~82% da largura da moldura — proximo das bordas mas com
  // folga pequena pra nao colar. Sigla embaixo (quando tem) toma o resto.
  const iconW = Math.round(size * 0.82);
  return (
    <div
      className={'bf-sw-tile' + (isActive ? ' is-active-frame' : '')}
      style={{
        width: size + 'px',
        height: size + 'px',
        background: bgColor === 'transparent' ? undefined : bgColor,
        borderColor: brColorSolid === 'transparent' ? undefined : brColorSolid,
        borderWidth: brColorSolid === 'transparent' ? undefined : '2px',
        borderStyle: brColorSolid === 'transparent' ? undefined : 'solid',
      }}
    >
      {isText ? (
        // TEXT mode: 3 chars grandes centralizados, na cor do ICON (icColor).
        // Fonte ~38% do tile pra preencher visualmente sem encostar na borda.
        <span
          className="bf-sw-tile-text"
          style={{ color: icColor, fontSize: Math.round(size * 0.38) + 'px' }}
        >
          {(sigla || '—').slice(0, 3)}
        </span>
      ) : (
        <>
          <SwIconImg iconId={d.icon_id} color={icColor} size={iconW} />
          {sigla && (
            <span className="bf-sw-tile-sigla" style={{ color: icColor }}>
              {sigla}
            </span>
          )}
        </>
      )}
      {footerInfo && (
        <span className="bf-sw-tile-footer" style={{ color: icColor }}>
          <span className="bf-sw-tile-footer-text">
            SW{footerInfo.swNum} · {footerInfo.modeLabel}
          </span>
          <span
            className="bf-sw-tile-footer-dot"
            style={{ background: footerInfo.ledColorHex }}
            aria-label={`LED color ${footerInfo.ledColorHex}`}
          />
        </span>
      )}
    </div>
  );
}

// Modal picker dos 51 icones + uma celula "TEXT" coringa como primeiro
// item (id=0). Selecionar TEXT manda o mode pra 'text' no editor (mostra
// so a sigla centralizada, sem icone). Selecionar um dos 51 manda pra
// 'icon'. Grid 6 colunas, tinta usando a cor on/selecionada.
//   allowText (default true): se false, omite a celula TEXT — usado em
//   contextos onde TEXT nao faz sentido (ex.: sub-estados do SPIN/STOMP
//   que sao puramente visuais).
function SwIconPicker({ open, onClose, currentId, currentMode, previewColor, onPick, allowText = false }) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="bf-modal-backdrop" onClick={onClose}>
      <div
        className="bf-modal bf-sw-icon-picker"
        role="dialog"
        aria-label="Escolher icone do SW"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bf-modal-head">
          <span className="bf-modal-title">Escolher icone</span>
          <button type="button" className="bf-modal-close"
                  onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                 stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 5 L19 19 M19 5 L5 19" />
            </svg>
          </button>
        </div>
        <div className="bf-sw-icon-grid">
          {allowText && (
            <button
              key="text"
              type="button"
              className={'bf-sw-icon-cell bf-sw-icon-cell-text' +
                         (currentMode === 'text' ? ' is-active' : '')}
              onClick={() => { onPick(0); onClose(); }}
              aria-label="Modo texto (sem icone)"
              title="TEXT — mostra so a sigla centralizada"
            >
              <span style={{ color: previewColor || '#fff' }}>TEXT</span>
            </button>
          )}
          {SW_ICONS.map((_, i) => {
            const id = i + 1;
            const isActive = currentMode !== 'text' && id === currentId;
            return (
              <button
                key={id}
                type="button"
                className={'bf-sw-icon-cell' + (isActive ? ' is-active' : '')}
                onClick={() => { onPick(id); onClose(); }}
                aria-label={`Icone ${id}`}
                title={`ICO${id}`}
              >
                <SwIconImg iconId={id} color={previewColor || '#fff'} size={44} />
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Editor de display SPIN — 3 abas (SPIN1/SPIN2/SPIN3), cada uma com seu
// proprio icone + cor ON dos 3 elementos (ICON/BACK/BORDER) + sigla.
// SPIN nao tem OFF — o estado SEM press cai no estado 1 por convencao.
function SwDisplaySpinEditor({ sw, disp, onChange }) {
  const [activeIdx, setActiveIdx] = useState(0);  // 0/1/2
  const [pickerOpen, setPickerOpen] = useState(false);
  const spin = Array.isArray(disp.spin) ? disp.spin : [];
  const s = { ...DEFAULT_SW_SPIN_STATE(), ...(spin[activeIdx] || {}) };

  // Atualiza apenas o estado ativo, preservando os outros 2.
  const setState = (patch) => {
    const next = [
      { ...DEFAULT_SW_SPIN_STATE(), ...(spin[0] || {}) },
      { ...DEFAULT_SW_SPIN_STATE(), ...(spin[1] || {}) },
      { ...DEFAULT_SW_SPIN_STATE(), ...(spin[2] || {}) },
    ];
    next[activeIdx] = { ...next[activeIdx], ...patch };
    onChange({ ...disp, spin: next });
  };

  // Tile usado como preview do estado ativo: monta um disp efetivo onde
  // icon_id/sigla/mode vem do spin state e as cores ON sao as do spin state.
  // Cores OFF sao irrelevantes (preview sempre ON pra SPIN).
  const previewDisp = {
    ...disp,
    icon_id: s.icon_id,
    sigla: s.sigla,
    mode: s.mode || 'icon',
    ic_on: s.ic_on, ic_off: s.ic_on,
    bg_on: s.bg_on, bg_off: s.bg_on,
    br_on: s.br_on, br_off: s.br_on,
  };

  const colorCell = (label, key) => (
    <div className="bf-sw-disp-color-cell">
      <span className="bf-sw-disp-color-state">{label}</span>
      <ColorBar label={label} colorId={s[key]}
                onChange={(id) => setState({ [key]: id })} />
    </div>
  );

  return (
    <div className="bf-sw-disp">
      {/* 3 abas SPIN1/SPIN2/SPIN3 — cada uma edita o seu estado */}
      <div className="bf-seg bf-sw-disp-spin-tabs" role="tablist"
           aria-label="Estado do SPIN">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={activeIdx === i}
            className={activeIdx === i ? 'is-active' : ''}
            onClick={() => setActiveIdx(i)}
          >SPIN {i + 1}</button>
        ))}
      </div>

      {/* 3 linhas de cor, com label ICON/BACK/BORDER e 1 swatch ON cada
          (SPIN nao tem OFF). Mesma estrutura visual do editor basico. */}
      <div className="bf-sw-disp-colors">
        <div className="bf-sw-disp-color">
          <div className="bf-sw-disp-color-label">ICON</div>
          <div className="bf-sw-disp-color-swatches">{colorCell('ON', 'ic_on')}</div>
        </div>
        <div className="bf-sw-disp-color">
          <div className="bf-sw-disp-color-label">BACK</div>
          <div className="bf-sw-disp-color-swatches">{colorCell('ON', 'bg_on')}</div>
        </div>
        <div className="bf-sw-disp-color">
          <div className="bf-sw-disp-color-label">BORDER</div>
          <div className="bf-sw-disp-color-swatches">{colorCell('ON', 'br_on')}</div>
        </div>
      </div>

      <div className="bf-sw-disp-preview-row">
        <button
          type="button"
          className="bf-sw-disp-preview"
          onClick={() => setPickerOpen(true)}
          aria-label="Trocar icone deste estado SPIN"
          title="Trocar icone"
        >
          <SwDisplayTile disp={previewDisp} on={true} size={96} />
        </button>
        <div className="bf-sw-disp-toggles">
          <label className="bf-field bf-sw-disp-sigla">
            <span className="bf-field-label">NOME DO ICONE / SIGLA</span>
            <input
              type="text"
              className="bf-input"
              value={s.sigla}
              maxLength={6}
              onChange={(e) => setState({ sigla: e.target.value.slice(0, 6) })}
              placeholder={`S${activeIdx + 1}`}
            />
          </label>
        </div>
      </div>

      <SwIconPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentId={s.icon_id}
        currentMode={s.mode}
        allowText={true}
        previewColor={(() => {
          const c = paletteCss(s.ic_on);
          return c === 'transparent' ? '#cfcfd6' : c;
        })()}
        onPick={(id) => {
          if (id === 0) setState({ mode: 'text' });
          else setState({ icon_id: id, mode: 'icon' });
        }}
      />
    </div>
  );
}

// Editor de display STOMP — tabs por (secao × estado). Secao A (curto)
// usa o config principal (ic_off/ic_on/bg_off/.../br_on). Secao B (longo)
// e secao C (reclick) usam stomp[0..3] = B_off, B_on, C_off, C_on.
// Tabs sao filtradas pra mostrar so as secoes habilitadas (ch2>0 → B,
// ch3>0 → C, lidas dos params fx1 do SW).
function SwDisplayStompEditor({ sw, disp, onChange, swParams }) {
  const fxParams = (swParams && swParams[sw] && swParams[sw].fx1)
                   || DEFAULT_SW_PARAMS('fx1');
  const hasB = Number(fxParams.ch2) >= 1 && Number(fxParams.ch2) <= 16;
  const hasC = Number(fxParams.ch3) >= 1 && Number(fxParams.ch3) <= 16;

  // Tabs de SECAO no topo (CLICK CURTO/LONGO/RECLICK). Dentro de cada
  // secao, o layout ESPELHA o editor basico: 3 linhas de cor com OFF/ON
  // lado a lado, botao PREVIEW OFF/ON, preview + sigla.
  const [secaoIdx, setSecaoIdx] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (secaoIdx === 1 && !hasB) setSecaoIdx(0);
    if (secaoIdx === 2 && !hasC) setSecaoIdx(0);
  }, [hasB, hasC, secaoIdx]);

  const stomp = Array.isArray(disp.stomp) && disp.stomp.length === 4
                ? disp.stomp
                : [DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB(),
                   DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB()];
  const isMain = secaoIdx === 0;
  // sub indices: B-off=0, B-on=1, C-off=2, C-on=3.
  const subBase = secaoIdx === 1 ? 0 : secaoIdx === 2 ? 2 : -1;
  const subOff = isMain ? null : stomp[subBase];
  const subOn  = isMain ? null : stomp[subBase + 1];

  // Le um campo do estado atual (off ou on) da secao ativa.
  const getField = (field, on) => {
    if (isMain) {
      if (field === 'icon_id') return disp.icon_id;
      if (field === 'mode') return disp.mode || 'icon';
      if (field === 'ic') return on ? disp.ic_on : disp.ic_off;
      if (field === 'bg') return on ? disp.bg_on : disp.bg_off;
      if (field === 'br') return on ? disp.br_on : disp.br_off;
    }
    const sub = on ? subOn : subOff;
    if (!sub) return null;
    if (field === 'icon_id') return sub.icon_id;
    if (field === 'mode') return sub.mode || 'icon';
    return sub[field];
  };

  // Atualiza campos do estado especificado (on=true/false) na secao ativa.
  // Aceita patch obj pra fazer multiplas mudancas atomicas (icon_id + mode
  // no mesmo click do picker, sem stale closure).
  const setStateFields = (on, patch) => {
    if (isMain) {
      const mapped = {};
      for (const [field, value] of Object.entries(patch)) {
        const key = field === 'icon_id' ? 'icon_id'
                  : field === 'mode' ? 'mode'
                  : field === 'ic' ? (on ? 'ic_on' : 'ic_off')
                  : field === 'bg' ? (on ? 'bg_on' : 'bg_off')
                  : field === 'br' ? (on ? 'br_on' : 'br_off')
                  : null;
        if (key) mapped[key] = value;
      }
      onChange({ ...disp, ...mapped });
    } else {
      const idx = subBase + (on ? 1 : 0);
      const next = stomp.map((s, i) => i === idx
        ? { ...DEFAULT_SW_STOMP_SUB(), ...s, ...patch }
        : s);
      onChange({ ...disp, stomp: next });
    }
  };

  // Preview reflete previewOn (igual basico).
  const curIcon = getField('icon_id', previewOn);
  const curMode = getField('mode', previewOn);
  const curIc   = getField('ic', previewOn);
  const curBg   = getField('bg', previewOn);
  const curBr   = getField('br', previewOn);

  const previewDisp = {
    ...disp,
    icon_id: curIcon,
    mode: curMode,
    ic_on: curIc, ic_off: curIc,
    bg_on: curBg, bg_off: curBg,
    br_on: curBr, br_off: curBr,
  };

  // Mesma helper do editor basico: 1 linha = label + (OFF cell — ON cell).
  // OFF e ON editam o mesmo campo (ic/bg/br) so que em estados diferentes.
  const colorCell = (stateLabel, on, field) => (
    <div className="bf-sw-disp-color-cell">
      <span className="bf-sw-disp-color-state">{stateLabel}</span>
      <ColorBar label={`${field} ${stateLabel}`} colorId={getField(field, on)}
                onChange={(id) => setStateFields(on, { [field]: id })} />
    </div>
  );
  const colorRow = (label, field) => (
    <div className="bf-sw-disp-color">
      <div className="bf-sw-disp-color-label">{label}</div>
      <div className="bf-sw-disp-color-swatches">
        {colorCell('OFF', false, field)}
        <span className="bf-sw-disp-color-sep">—</span>
        {colorCell('ON',  true,  field)}
      </div>
    </div>
  );

  const secoes = [
    { idx: 0, label: 'CLICK CURTO', enabled: true },
    { idx: 1, label: 'CLICK LONGO', enabled: hasB },
    { idx: 2, label: 'RECLICK',     enabled: hasC },
  ];

  return (
    <div className="bf-sw-disp">
      {/* Tabs de SECAO (3 colunas, mesmo visual do editor de params) */}
      <div className="bf-seg bf-sw-fx2-tabs" role="tablist"
           aria-label="Secao do STOMP">
        {secoes.map((s) => (
          <button
            key={s.idx}
            type="button"
            role="tab"
            aria-selected={secaoIdx === s.idx}
            disabled={!s.enabled}
            className={secaoIdx === s.idx ? 'is-active' : ''}
            onClick={() => s.enabled && setSecaoIdx(s.idx)}
            title={s.enabled ? s.label
                  : `Configure ch${s.idx === 1 ? '2' : '3'} no STOMP pra habilitar`}
          >{s.label}</button>
        ))}
      </div>

      {/* Body = mesmo layout do editor basico (3 linhas OFF/ON + preview + sigla) */}
      <div className="bf-sw-disp-colors">
        {colorRow('ICON',   'ic')}
        {colorRow('BACK',   'bg')}
        {colorRow('BORDER', 'br')}
      </div>

      <div className="bf-sw-disp-preview-row">
        <button
          type="button"
          className="bf-sw-disp-preview"
          onClick={() => setPickerOpen(true)}
          aria-label="Trocar icone"
          title="Trocar icone"
        >
          <SwDisplayTile disp={previewDisp} on={true} size={96} />
        </button>
        <div className="bf-sw-disp-toggles">
          <button
            type="button"
            className={'bf-input bf-input-num' + (previewOn ? ' is-active' : '')}
            onClick={() => setPreviewOn((v) => !v)}
            aria-pressed={previewOn}
            title="Alterna o preview entre estados OFF/ON desta secao"
          >
            PREVIEW {previewOn ? 'ON' : 'OFF'}
          </button>
          <label className="bf-field bf-sw-disp-sigla">
            <span className="bf-field-label">NOME DO ICONE / SIGLA</span>
            <input
              type="text"
              className="bf-input"
              value={disp.sigla || ''}
              maxLength={8}
              onChange={(e) => onChange({ ...disp, sigla: e.target.value.slice(0, 8) })}
              placeholder="STOMP"
            />
          </label>
        </div>
      </div>

      <SwIconPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentId={curIcon}
        currentMode={curMode}
        allowText={true}
        previewColor={(() => {
          const c = paletteCss(curIc);
          return c === 'transparent' ? '#cfcfd6' : c;
        })()}
        onPick={(id) => {
          // O icone/mode aplicam pro estado atualmente em preview (OFF ou ON).
          if (id === 0) setStateFields(previewOn, { mode: 'text' });
          else setStateFields(previewOn, { icon_id: id, mode: 'icon' });
        }}
      />
    </div>
  );
}

// Editor de display TAP TEMPO. 2 abas: TAP (estado unico, igual SPIN) e
// LONG PRESS (OFF/ON, igual STOMP secao).
function SwDisplayTapEditor({ sw, disp, onChange }) {
  // tabIdx: 0=TAP, 1=LONG PRESS
  const [tabIdx, setTabIdx] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const tap = Array.isArray(disp.tap) && disp.tap.length === 3
              ? disp.tap
              : [DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB()];

  // TAP usa tap[0] (estado unico). LP usa tap[1]=off / tap[2]=on.
  const isLp = tabIdx === 1;
  const lpSubIdx = isLp ? (previewOn ? 2 : 1) : 0;
  const activeSub = tap[lpSubIdx] || DEFAULT_SW_STOMP_SUB();

  const setSubFields = (subIdx, patch) => {
    const next = tap.map((s, i) => i === subIdx
      ? { ...DEFAULT_SW_STOMP_SUB(), ...s, ...patch }
      : s);
    onChange({ ...disp, tap: next });
  };

  const previewDisp = {
    ...disp,
    icon_id: activeSub.icon_id,
    mode: activeSub.mode || 'icon',
    ic_on: activeSub.ic, ic_off: activeSub.ic,
    bg_on: activeSub.bg, bg_off: activeSub.bg,
    br_on: activeSub.br, br_off: activeSub.br,
  };

  // colorCell: pra TAP (1 swatch) ou LP (2 swatches OFF/ON).
  const colorCellLp = (label, on, field) => {
    const sub = tap[on ? 2 : 1] || DEFAULT_SW_STOMP_SUB();
    return (
      <div className="bf-sw-disp-color-cell">
        <span className="bf-sw-disp-color-state">{label}</span>
        <ColorBar label={`${field} ${label}`} colorId={sub[field]}
                  onChange={(id) => setSubFields(on ? 2 : 1, { [field]: id })} />
      </div>
    );
  };
  const colorCellTap = (field) => (
    <div className="bf-sw-disp-color-cell">
      <span className="bf-sw-disp-color-state">TAP</span>
      <ColorBar label={field} colorId={(tap[0] || DEFAULT_SW_STOMP_SUB())[field]}
                onChange={(id) => setSubFields(0, { [field]: id })} />
    </div>
  );

  const colorRow = (label, field) => (
    <div className="bf-sw-disp-color">
      <div className="bf-sw-disp-color-label">{label}</div>
      <div className="bf-sw-disp-color-swatches">
        {isLp ? (
          <>
            {colorCellLp('OFF', false, field)}
            <span className="bf-sw-disp-color-sep">—</span>
            {colorCellLp('ON',  true,  field)}
          </>
        ) : (
          colorCellTap(field)
        )}
      </div>
    </div>
  );

  return (
    <div className="bf-sw-disp">
      {/* Tabs TAP / LONG PRESS */}
      <div className="bf-seg bf-sw-fx2-tabs" role="tablist"
           aria-label="Secao do TAP TEMPO">
        <button
          type="button" role="tab"
          aria-selected={tabIdx === 0}
          className={tabIdx === 0 ? 'is-active' : ''}
          onClick={() => setTabIdx(0)}
        >TAP</button>
        <button
          type="button" role="tab"
          aria-selected={tabIdx === 1}
          className={tabIdx === 1 ? 'is-active' : ''}
          onClick={() => setTabIdx(1)}
        >LONG PRESS</button>
      </div>

      <div className="bf-sw-disp-colors">
        {colorRow('ICON',   'ic')}
        {colorRow('BACK',   'bg')}
        {colorRow('BORDER', 'br')}
      </div>

      <div className="bf-sw-disp-preview-row">
        <button
          type="button"
          className="bf-sw-disp-preview"
          onClick={() => setPickerOpen(true)}
          aria-label="Trocar icone"
          title="Trocar icone"
        >
          <SwDisplayTile disp={previewDisp} on={true} size={96} />
        </button>
        <div className="bf-sw-disp-toggles">
          {isLp && (
            <button
              type="button"
              className={'bf-input bf-input-num' + (previewOn ? ' is-active' : '')}
              onClick={() => setPreviewOn((v) => !v)}
              aria-pressed={previewOn}
              title="Alterna o preview entre OFF/ON do LONG PRESS"
            >
              PREVIEW {previewOn ? 'ON' : 'OFF'}
            </button>
          )}
          <label className="bf-field bf-sw-disp-sigla">
            <span className="bf-field-label">NOME DO ICONE / SIGLA</span>
            <input
              type="text"
              className="bf-input"
              value={disp.sigla || ''}
              maxLength={8}
              onChange={(e) => onChange({ ...disp, sigla: e.target.value.slice(0, 8) })}
              placeholder="TAP"
            />
          </label>
        </div>
      </div>

      <SwIconPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentId={activeSub.icon_id}
        currentMode={activeSub.mode}
        allowText={true}
        previewColor={(() => {
          const c = paletteCss(activeSub.ic);
          return c === 'transparent' ? '#cfcfd6' : c;
        })()}
        onPick={(id) => {
          if (id === 0) setSubFields(lpSubIdx, { mode: 'text' });
          else setSubFields(lpSubIdx, { icon_id: id, mode: 'icon' });
        }}
      />
    </div>
  );
}

// Editor da aba DISPLAY do card de SW.
// - Modo NAO-especial: 3 linhas de cor (ICON/BACK/BORDER × OFF/ON), preview
//   clicavel pro picker, PREVIEW ON/OFF, sigla.
// - Modo SPIN: delega pra SwDisplaySpinEditor (3 abas SPIN1/2/3).
// - Modo STOMP (fx1): delega pra SwDisplayStompEditor (tabs CLICK CURTO/
//   LONGO/RECLICK conforme secoes habilitadas + body igual basico).
// - Modo TAP TEMPO: delega pra SwDisplayTapEditor (tabs TAP/LONG PRESS).
function SwDisplayEditor({ sw, disp, onChange, swMode, swParams }) {
  const d = { ...DEFAULT_SW_DISPLAY(), ...(disp || {}) };
  if (!Array.isArray(d.spin) || d.spin.length !== 3) {
    d.spin = [DEFAULT_SW_SPIN_STATE(), DEFAULT_SW_SPIN_STATE(), DEFAULT_SW_SPIN_STATE()];
  }
  if (!Array.isArray(d.stomp) || d.stomp.length !== 4) {
    d.stomp = [DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB(),
               DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB()];
  }
  if (!Array.isArray(d.tap) || d.tap.length !== 3) {
    d.tap = [DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB(), DEFAULT_SW_STOMP_SUB()];
  }
  const isSpin = swMode === 'spin';
  const isStomp = swMode === 'fx1';
  const isTap = swMode === 'tap_tempo';

  if (isSpin) {
    return <SwDisplaySpinEditor sw={sw} disp={d} onChange={onChange} />;
  }
  if (isStomp) {
    return <SwDisplayStompEditor sw={sw} disp={d} onChange={onChange} swParams={swParams} />;
  }
  if (isTap) {
    return <SwDisplayTapEditor sw={sw} disp={d} onChange={onChange} />;
  }

  const [previewOn, setPreviewOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const set = (patch) => onChange({ ...d, ...patch });

  const colorCell = (stateLabel, key) => (
    <div className="bf-sw-disp-color-cell">
      <span className="bf-sw-disp-color-state">{stateLabel}</span>
      <ColorBar label={`${key}`} colorId={d[key]}
                onChange={(id) => set({ [key]: id })} />
    </div>
  );

  const colorRow = (label, offKey, onKey) => (
    <div className="bf-sw-disp-color">
      <div className="bf-sw-disp-color-label">{label}</div>
      <div className="bf-sw-disp-color-swatches">
        {colorCell('OFF', offKey)}
        <span className="bf-sw-disp-color-sep">—</span>
        {colorCell('ON', onKey)}
      </div>
    </div>
  );

  return (
    <div className="bf-sw-disp">
      <div className="bf-sw-disp-colors">
        {colorRow('ICON',   'ic_off', 'ic_on')}
        {colorRow('BACK',   'bg_off', 'bg_on')}
        {colorRow('BORDER', 'br_off', 'br_on')}
      </div>

      <div className="bf-sw-disp-preview-row">
        <button
          type="button"
          className="bf-sw-disp-preview"
          onClick={() => setPickerOpen(true)}
          aria-label="Trocar icone"
          title="Trocar icone"
        >
          <SwDisplayTile disp={d} on={previewOn} size={96} />
        </button>
        <div className="bf-sw-disp-toggles">
          <button
            type="button"
            className={'bf-input bf-input-num' + (previewOn ? ' is-active' : '')}
            onClick={() => setPreviewOn((v) => !v)}
            aria-pressed={previewOn}
            title="Alterna o preview entre estados OFF/ON"
          >
            PREVIEW {previewOn ? 'ON' : 'OFF'}
          </button>
          <label className="bf-field bf-sw-disp-sigla">
            <span className="bf-field-label">NOME DO ICONE / SIGLA</span>
            <input
              type="text"
              className="bf-input"
              value={d.sigla}
              maxLength={8}
              onChange={(e) => set({ sigla: e.target.value.slice(0, 8) })}
              placeholder="STOMP"
            />
          </label>
        </div>
      </div>

      <SwIconPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentId={d.icon_id}
        currentMode={d.mode}
        allowText={true}
        previewColor={(() => {
          // Fallback pra branco se a cor escolhida for transparente —
          // senao os icones do picker ficariam invisiveis.
          const c = paletteCss(previewOn ? d.ic_on : d.ic_off);
          return c === 'transparent' ? '#cfcfd6' : c;
        })()}
        onPick={(id) => {
          if (id === 0) set({ mode: 'text' });
          else set({ icon_id: id, mode: 'icon' });
        }}
      />
    </div>
  );
}

function LiveModePanel({ presetCount, swModes, onSetSwMode, swParams, onSetSwParam, ledPreviewLive, swLiveOn, lastSingleSw, swSpinState, swDisplay, onSetSwDisplay }) {
  const [selectedSw, setSelectedSw] = useState(null);  // 1..N ou null
  const [cardTab, setCardTab] = useState('gear');      // 'gear' | 'display'
  const [pickerOpen, setPickerOpen] = useState(false); // popup de selecao de modo
  // Clipboard pra COPY/PASTE entre SWs — { modeId, params } do SW copiado.
  // Vive enquanto a pagina LIVE estiver aberta; perdido ao trocar de page.
  const [swClipboard, setSwClipboard] = useState(null);
  const [copyFlash, setCopyFlash] = useState(false);
  const switches = Array.from({ length: presetCount }, (_, i) => i + 1);

  // Modo de um SW: o que estiver salvo, ou MUTE como padrao quando nada
  // foi salvo ainda.
  const modeOf = (n) => swModes[n] || 'mute';

  // Copia modo + params do SW selecionado pro clipboard interno.
  const copyFromSelected = () => {
    if (selectedSw === null) return;
    const modeId = modeOf(selectedSw);
    if (modeId === 'mute') return;
    const params = (swParams && swParams[selectedSw] && swParams[selectedSw][modeId])
      ? swParams[selectedSw][modeId]
      : DEFAULT_SW_PARAMS(modeId);
    // Clona profundo pra desacoplar do state vivo do SW de origem.
    setSwClipboard({ modeId, params: JSON.parse(JSON.stringify(params)) });
    setCopyFlash(true);
    setTimeout(() => setCopyFlash(false), 800);
  };

  // Cola o clipboard no SW selecionado (troca modo + sobrescreve params).
  const pasteIntoSelected = () => {
    if (selectedSw === null || !swClipboard) return;
    onSetSwMode(selectedSw, swClipboard.modeId);
    onSetSwParam(selectedSw, swClipboard.modeId,
      JSON.parse(JSON.stringify(swClipboard.params)));
  };

  const selectSw = (n) => {
    setPickerOpen(false);
    if (selectedSw === n) { setSelectedSw(null); return; }  // re-clicar fecha
    setSelectedSw(n);
    setCardTab('gear');  // o card sempre abre em modo engrenagem
  };

  // Modo do SW aberto — sempre definido (MUTE quando nada salvo).
  const currentMode = SW_MODES.find((m) => m.id === modeOf(selectedSw));

  return (
    <>
      <div className="bf-sw-row">
        {switches.map((n) => {
          const disp = (swDisplay && swDisplay[n]) || DEFAULT_SW_DISPLAY();
          const ledOn = Array.isArray(swLiveOn) ? !!swLiveOn[n - 1] : false;
          const activeMode = modeOf(n);
          const modeEntry = SW_MODES.find((m) => m.id === activeMode);
          const modeLabel = (modeEntry && modeEntry.title) || activeMode.toUpperCase();
          // Cor do LED do modo ativo (campo `color` nos params do modo).
          // Se nao tem params salvos, usa o default do modo. mute = OFF.
          let ledColorId = 14;  // OFF default
          if (activeMode !== 'mute') {
            const params = (swParams && swParams[n] && swParams[n][activeMode])
              || DEFAULT_SW_PARAMS(activeMode);
            if (params && typeof params.color === 'number') ledColorId = params.color;
          }
          const ledColorHex = (LED_COLORS[ledColorId] || LED_COLORS[14]).hex;
          // Para SPIN, passa o spinState atual (0/1/2 ou -1 awaiting) pra
          // o tile pintar com a cor do estado correto. Outros modos usam
          // on/off do swLiveOn como sempre.
          const spinStateForTile = activeMode === 'spin' && Array.isArray(swSpinState)
            ? swSpinState[n - 1] : null;
          return (
            <button
              key={n}
              type="button"
              className={'bf-sw-btn bf-sw-btn-tile' + (selectedSw === n ? ' is-active' : '')}
              onClick={() => selectSw(n)}
            >
              <SwDisplayTile disp={disp} on={ledOn} spinState={spinStateForTile} size={120} />
              <span className="bf-sw-btn-info-line">
                SW · {n} ·
                <span
                  className="bf-sw-btn-info-dot"
                  style={{ background: ledColorHex }}
                  aria-label={`LED ${ledColorHex}`}
                />
              </span>
              <span className="bf-sw-btn-mode">{modeLabel}</span>
            </button>
          );
        })}
      </div>

      {selectedSw !== null && (
        <div className="bf-sw-card">
          <div className="bf-sw-card-tabs" aria-label={`Configuração do SW${selectedSw}`}>
            <button
              type="button"
              className="bf-sw-mode-field"
              onClick={() => setPickerOpen(true)}
              aria-label={`Modo: ${currentMode.title}. Toque para trocar.`}
            >
              <SwModeIcon id={modeOf(selectedSw)} />
              <span className="bf-sw-mode-field-name">{currentMode.title}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cardTab === 'gear'}
              className={'bf-sw-card-tab' + (cardTab === 'gear' ? ' is-active' : '')}
              onClick={() => setCardTab('gear')}
              aria-label="Configurações"
            >
              <svg viewBox="0 0 24 24" className="bf-tab-ico" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {/* Engrenagem (cog) — outline classico de configuracoes */}
                <circle className="bf-tab-shape" cx="12" cy="12" r="3" />
                <path className="bf-tab-shape" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cardTab === 'display'}
              className={'bf-sw-card-tab' + (cardTab === 'display' ? ' is-active' : '')}
              onClick={() => setCardTab('display')}
              aria-label="Display"
            >
              <svg viewBox="0 0 24 24" className="bf-tab-ico" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {/* Monitor com EQ bars — mesmo icone da aba DISPLAY do preset */}
                <rect className="bf-tab-shape" x="2.5" y="4.5" width="19" height="12" rx="1.6" />
                <rect className="bf-tab-dot" x="6"  y="11" width="1.6" height="3.5" />
                <rect className="bf-tab-dot" x="9"  y="9"  width="1.6" height="5.5" />
                <rect className="bf-tab-dot" x="12" y="7"  width="1.6" height="7.5" />
                <rect className="bf-tab-dot" x="15" y="10" width="1.6" height="4.5" />
                <rect className="bf-tab-dot" x="18" y="12" width="1.6" height="2.5" />
                <path className="bf-tab-shape" d="M9 21h6 M12 16.5v4.5" />
              </svg>
            </button>
            {/* COPY / PASTE — coluna estreita com 2 botoes empilhados,
                mesma largura dos icones de aba mas cada um com metade da
                altura. Permite copiar a config inteira (modo + params) de
                um SW e colar em outro. */}
            <div className="bf-sw-card-copypaste">
              <button
                type="button"
                className={'bf-sw-card-cp bf-sw-card-cp-copy' +
                           (copyFlash ? ' is-flash' : '')}
                onClick={copyFromSelected}
                disabled={modeOf(selectedSw) === 'mute'}
                title="COPY — copia modo + configuracao desse SW"
                aria-label="Copiar configuracao do SW"
              >
                <svg viewBox="0 0 24 24" className="bf-tab-ico"
                     strokeLinecap="round" strokeLinejoin="round"
                     aria-hidden="true">
                  {/* Icone clipboard duplicado: 2 retangulos sobrepostos */}
                  <rect className="bf-tab-shape" x="8" y="8" width="11" height="13" rx="2" />
                  <path className="bf-tab-shape" d="M16 8V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h1" />
                </svg>
              </button>
              <button
                type="button"
                className="bf-sw-card-cp bf-sw-card-cp-paste"
                onClick={pasteIntoSelected}
                disabled={!swClipboard}
                title={swClipboard
                  ? `PASTE — aplica config copiada (${swClipboard.modeId.toUpperCase()})`
                  : 'PASTE — nada copiado ainda'}
                aria-label="Colar configuracao no SW"
              >
                <svg viewBox="0 0 24 24" className="bf-tab-ico"
                     strokeLinecap="round" strokeLinejoin="round"
                     aria-hidden="true">
                  {/* Icone clipboard com seta pra dentro */}
                  <path className="bf-tab-shape" d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect className="bf-tab-shape" x="8" y="2" width="8" height="4" rx="1" />
                  <path className="bf-tab-shape" d="M12 11v6 M9 14l3 3 3-3" />
                </svg>
              </button>
            </div>
          </div>

          <div className="bf-sw-card-body">
            {cardTab === 'gear' && (
              (modeOf(selectedSw) === 'fx1' || modeOf(selectedSw) === 'fx3') ? (
                <SwStompEditor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw][modeOf(selectedSw)])
                    || DEFAULT_SW_PARAMS(modeOf(selectedSw))}
                  onChange={(patch) => onSetSwParam(selectedSw, modeOf(selectedSw), patch)}
                  ledPreviewLive={ledPreviewLive}
                  liveOn={Array.isArray(swLiveOn) ? swLiveOn[selectedSw - 1] : undefined}
                  presetCount={presetCount}
                />
              ) : modeOf(selectedSw) === 'fx2' ? (
                <SwFx2Editor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw].fx2)
                    || DEFAULT_SW_PARAMS('fx2')}
                  onChange={(patch) => onSetSwParam(selectedSw, 'fx2', patch)}
                  ledPreviewLive={ledPreviewLive}
                  liveOn={Array.isArray(swLiveOn) ? swLiveOn[selectedSw - 1] : undefined}
                  presetCount={presetCount}
                />
              ) : modeOf(selectedSw) === 'momentary' ? (
                <SwMomentaryEditor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw].momentary)
                    || DEFAULT_SW_PARAMS('momentary')}
                  onChange={(patch) => onSetSwParam(selectedSw, 'momentary', patch)}
                  ledPreviewLive={ledPreviewLive}
                />
              ) : modeOf(selectedSw) === 'macros' ? (
                <SwMacrosEditor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw].macros)
                    || DEFAULT_SW_PARAMS('macros')}
                  onChange={(patch) => onSetSwParam(selectedSw, 'macros', patch)}
                  ledPreviewLive={ledPreviewLive}
                  liveOn={Array.isArray(swLiveOn) ? swLiveOn[selectedSw - 1] : undefined}
                />
              ) : modeOf(selectedSw) === 'tap_tempo' ? (
                <SwTapTempoEditor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw].tap_tempo)
                    || DEFAULT_SW_PARAMS('tap_tempo')}
                  onChange={(patch) => onSetSwParam(selectedSw, 'tap_tempo', patch)}
                  ledPreviewLive={ledPreviewLive}
                />
              ) : modeOf(selectedSw) === 'single' ? (
                <SwSingleEditor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw].single)
                    || DEFAULT_SW_PARAMS('single')}
                  onChange={(patch) => onSetSwParam(selectedSw, 'single', patch)}
                  ledPreviewLive={ledPreviewLive}
                  isActiveSingle={lastSingleSw === selectedSw - 1}
                />
              ) : modeOf(selectedSw) === 'ramp' ? (
                <SwRampEditor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw].ramp)
                    || DEFAULT_SW_PARAMS('ramp')}
                  onChange={(patch) => onSetSwParam(selectedSw, 'ramp', patch)}
                  ledPreviewLive={ledPreviewLive}
                />
              ) : modeOf(selectedSw) === 'spin' ? (
                <SwSpinEditor
                  key={selectedSw}
                  sw={selectedSw}
                  params={(swParams && swParams[selectedSw] && swParams[selectedSw].spin)
                    || DEFAULT_SW_PARAMS('spin')}
                  onChange={(patch) => onSetSwParam(selectedSw, 'spin', patch)}
                  ledPreviewLive={ledPreviewLive}
                />
              ) : (
                <div className="bf-sw-card-empty">
                  SW{selectedSw} · {currentMode.title} — config em breve
                </div>
              )
            )}
            {cardTab === 'display' && (
              <SwDisplayEditor
                sw={selectedSw}
                disp={(swDisplay && swDisplay[selectedSw]) || DEFAULT_SW_DISPLAY()}
                onChange={(next) => onSetSwDisplay && onSetSwDisplay(selectedSw, next)}
                swMode={modeOf(selectedSw)}
                swParams={swParams}
              />
            )}
          </div>
        </div>
      )}

      {pickerOpen && selectedSw !== null && ReactDOM.createPortal(
        <div className="bf-modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div
            className="bf-modal"
            role="dialog"
            aria-label={`Modo de operação do SW${selectedSw}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bf-modal-head">
              <span className="bf-modal-title">SW{selectedSw} · modo de operação</span>
              <button
                type="button"
                className="bf-modal-close"
                onClick={() => setPickerOpen(false)}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 5 L19 19 M19 5 L5 19" />
                </svg>
              </button>
            </div>
            <div className="bf-sw-mode-grid">
              {SW_MODES.filter((m) => !m.hidden).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={'bf-sw-mode' + (modeOf(selectedSw) === m.id ? ' is-active' : '')}
                  onClick={() => { onSetSwMode(selectedSw, m.id); setPickerOpen(false); }}
                >
                  <SwModeIcon id={m.id} />
                  <span className="bf-sw-mode-title">{m.title}</span>
                  <span className="bf-sw-mode-sub">{m.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function PagePresetConfig({
  bankLetterIndex, presetNumber, bankData, bankDisplayName, bankState, deviceState,
  usbState, onToggleUsb,
  connectionMode, onToggleConnectionMode,
  presetCount, onNextLetter, onSelectPreset, onDisplayNameChange,
  onRegisterPresetSave,
  switchMode, onSetSwitchMode, modeSync, onToggleModeSync,
  showMonitor, onToggleShowMonitor,
  swModes, savedSwModes, onSetSwMode,
  swParams, savedSwParams, onSetSwParam, swLiveOn, lastSingleSw,
  swSpinState,
  swDisplay, onSetSwDisplay,
  liveEvents, monitorEntry,
  ledPreviewLive,
}) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const tag = `${letters[bankLetterIndex]}${presetNumber}`;
  const presets = Array.from({ length: presetCount }, (_, i) => i + 1);
  const tileName = (bankDisplayName && bankDisplayName.trim()) || tag;

  // --tile-color e setado no nivel do .bf-screen (App.jsx) baseado no
  // banco/preset ativo — bank-tile e preset.is-active herdam dele.

  return (
    <div className="bf-content" key="bank">
      <PageHeader
        title="SET PRESET"
        deviceState={deviceState}
        usbState={usbState}
        onToggleUsb={onToggleUsb}
        connectionMode={connectionMode}
        onToggleConnectionMode={onToggleConnectionMode}
        showMonitor={showMonitor}
        onToggleShowMonitor={onToggleShowMonitor}
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
          <button
            key={n}
            type="button"
            className={'bf-preset' + (n === presetNumber ? ' is-active' : '')}
            onClick={() => onSelectPreset(n)}
          >
            <span className="led" />
            <span className="num">{n}</span>
            <span className="label">PRESET</span>
          </button>
        ))}
      </div>

      <div className="bf-mode-switch-wrap">
        <div className="bf-seg bf-mode-switch">
          <button
            className={switchMode === 'live' ? '' : 'is-active'}
            onClick={() => onSetSwitchMode && onSetSwitchMode('preset')}
          >PRESET MODE</button>
          <button
            className={switchMode === 'live' ? 'is-active' : ''}
            onClick={() => onSetSwitchMode && onSetSwitchMode('live')}
          >LIVE MODE</button>
        </div>
        <button
          type="button"
          className={'bf-mode-sync' + (modeSync ? ' is-active' : '')}
          onClick={() => onToggleModeSync && onToggleModeSync()}
          aria-pressed={modeSync}
          aria-label={`Sync PRESET/LIVE com a controladora: ${modeSync ? 'ligado' : 'desligado'}`}
          title={modeSync
            ? 'Sync ON — alternar aqui troca o modo na controladora'
            : 'Sync OFF — alternar aqui nao troca o modo na controladora'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"
               stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round">
            {modeSync ? (
              <>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </>
            ) : (
              <>
                <path d="M9.5 13.5 L13 17 a4 4 0 0 1-5.66 0 a4 4 0 0 1 0-5.66 L9 9.5" />
                <path d="M14.5 10.5 L11 7 a4 4 0 0 1 5.66 0 a4 4 0 0 1 0 5.66 L15 14.5" />
                <path d="M4 4 L20 20" />
              </>
            )}
          </svg>
        </button>
      </div>

      {switchMode === 'live'
        ? <LiveModePanel presetCount={presetCount} swModes={swModes} onSetSwMode={onSetSwMode}
            swParams={swParams} onSetSwParam={onSetSwParam} ledPreviewLive={ledPreviewLive}
            swLiveOn={swLiveOn} lastSingleSw={lastSingleSw}
            swSpinState={swSpinState}
            swDisplay={swDisplay} onSetSwDisplay={onSetSwDisplay} />
        : <PresetEditorCard tag={tag} onDisplayNameChange={onDisplayNameChange} onRegisterSave={onRegisterPresetSave} savedSwModes={savedSwModes} savedSwParams={savedSwParams} />}

      {showMonitor && (
        <MonitorView switchMode={switchMode}
          monitorEntry={monitorEntry} liveEvents={liveEvents} />
      )}
    </div>
  );
}

// MONITOR persistente — comportamento depende do modo do app:
//   PRESET MODE -> mostra o snapshot da CHAMADA DE PRESET (header MIDI +
//                  lista dos modos dos SWs).
//   LIVE MODE   -> mostra o disparo MAIS RECENTE de um SW (eventos
//                  acumulam so dentro do mesmo press; o proximo press
//                  substitui o anterior).
// Formata uma mensagem MIDI estruturada em texto curto pra copia/share.
function formatMsgText(m) {
  const when = m.when ? `[${m.when}] ` : '';
  if (m.kind === 'pc') return `${when}PC ${m.pc} · CH ${m.ch}`;
  return `${when}CC ${m.num} = ${m.val} · CH ${m.ch}`;
}

// Monta o texto do MONITOR (PRESET) — usado pelo botao de copiar.
function buildPresetMonitorText(entry) {
  if (!entry) return '';
  const lines = [];
  lines.push(`[${entry.time}] ${entry.tag} - ${entry.name}`);
  lines.push(`HEADER = PC ${entry.pc} - CH ${entry.ch}`);
  (entry.extraPcs || []).forEach((pc) => {
    lines.push(`PC EXTRA ${pc.slot} = PC ${pc.program} - CH ${pc.ch}`);
  });
  (entry.extraCcs || []).forEach((cc) => {
    lines.push(`CC EXTRA ${cc.slot} = CC ${cc.ctrl} - VAL ${cc.value} - CH ${cc.ch}`);
  });
  (entry.swEntries || []).forEach((sw) => {
    lines.push('');
    lines.push(`SW-${sw.sw} ${sw.modeLabel}`);
    if (!sw.sections || sw.sections.length === 0) {
      lines.push('  (sem MIDI configurado)');
      return;
    }
    sw.sections.forEach((sec) => {
      const head = [sec.label, ...(sec.flags || [])].filter(Boolean).join(' · ');
      if (head) lines.push(`  ${head}`);
      (sec.messages || []).forEach((m) => lines.push(`    ${formatMsgText(m)}`));
    });
  });
  return lines.join('\n');
}

// Monta o texto do MONITOR (LIVE) — usado pelo botao de copiar.
function buildLiveMonitorText(events) {
  if (!events || events.length === 0) return '';
  const lines = [];
  events.forEach((ev) => {
    const parts = [`SW-${ev.sw}`, ev.modeLabel || 'STOMP'];
    if (ev.sectionLabel) parts.push(ev.sectionLabel);
    if (ev.on === true) parts.push('ON');
    else if (ev.on === false) parts.push('OFF');
    lines.push(parts.join(' · '));
    const msgs = Array.isArray(ev.messages) ? ev.messages : [];
    if (msgs.length === 0) {
      lines.push('  (nenhum MIDI disparado)');
    } else {
      msgs.forEach((m) => lines.push(`  ${formatMsgText(m)}`));
    }
  });
  return lines.join('\n');
}

function MonitorCopyButton({ getText }) {
  const [copied, setCopied] = React.useState(false);
  const onClick = async () => {
    const text = (getText() || '').trim();
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) { /* noop */ }
  };
  return (
    <button type="button"
            className={'bf-monitor-copy' + (copied ? ' is-copied' : '')}
            onClick={onClick}
            title="Copiar pra enviar no WhatsApp">
      {copied ? 'COPIADO' : 'COPIAR'}
    </button>
  );
}

function MonitorView({ switchMode, monitorEntry, liveEvents }) {
  const events = Array.isArray(liveEvents) ? liveEvents : [];
  const isLive = switchMode === 'live';
  if (!isLive) {
    // ── PRESET MODE — snapshot da chamada de preset ──
    return (
      <div className="bf-live-monitor">
        <div className="bf-live-monitor-head">
          <span>MONITOR · CHAMADA DE PRESET</span>
          {monitorEntry && (
            <MonitorCopyButton getText={() => buildPresetMonitorText(monitorEntry)} />
          )}
        </div>
        <div className="bf-live-monitor-body">
          {!monitorEntry ? (
            <div className="bf-monitor-empty">Aguardando chamada de preset...</div>
          ) : (
            <>
              <div key={monitorEntry.tag + '@' + monitorEntry.time}
                   className="bf-monitor-entry">
                <div className="bf-monitor-line">
                  <span className="bf-monitor-time">{monitorEntry.time}</span>
                  <span className="bf-monitor-tag">{monitorEntry.tag}</span>
                  <span className="bf-monitor-sep">-</span>
                  <span className="bf-monitor-name">{monitorEntry.name}</span>
                </div>
                <div className="bf-monitor-line bf-monitor-header">
                  HEADER = PC {monitorEntry.pc} - CH {monitorEntry.ch}
                </div>
                {(monitorEntry.extraPcs || []).map((pc) => (
                  <div key={'pc' + pc.slot}
                       className="bf-monitor-line bf-monitor-header">
                    PC EXTRA {pc.slot} = PC {pc.program} - CH {pc.ch}
                  </div>
                ))}
                {(monitorEntry.extraCcs || []).map((cc) => (
                  <div key={'cc' + cc.slot}
                       className="bf-monitor-line bf-monitor-header">
                    CC EXTRA {cc.slot} = CC {cc.ctrl} - VAL {cc.value} - CH {cc.ch}
                  </div>
                ))}
              </div>
              <div className="bf-monitor-sw-list">
                {(monitorEntry.swEntries || []).map((entry, i) => (
                  <div key={i} className="bf-monitor-ev">
                    <div className="bf-monitor-ev-head">
                      <span className="bf-monitor-ev-sw">SW-{entry.sw}</span>
                      <span className="bf-monitor-ev-mode">{entry.modeLabel}</span>
                    </div>
                    {(!entry.sections || entry.sections.length === 0) ? (
                      <div className="bf-monitor-ev-msg bf-monitor-ev-msg-empty">
                        (sem MIDI configurado)
                      </div>
                    ) : (
                      entry.sections.map((sec, j) => (
                        <div key={j} className="bf-monitor-section">
                          {(sec.label || (sec.flags && sec.flags.length > 0)) && (
                            <div className="bf-monitor-section-head">
                              {sec.label && (
                                <span className="bf-monitor-ev-sec">{sec.label}</span>
                              )}
                              {(sec.flags || []).map((f, k) => (
                                <span key={k} className="bf-monitor-flag">{f}</span>
                              ))}
                            </div>
                          )}
                          <div className="bf-monitor-ev-msgs">
                            {(sec.messages || []).map((m, k) => (
                              <div key={k} className="bf-monitor-ev-msg">
                                {m.when && (
                                  <span className="bf-msg-when">{m.when}</span>
                                )}
                                {m.kind === 'pc' ? (
                                  <>
                                    <span className="bf-msg-type is-pc">PC</span>
                                    <span className="bf-msg-num">{m.pc}</span>
                                    <span className="bf-msg-sep">·</span>
                                    <span className="bf-msg-ch">CH {m.ch}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="bf-msg-type is-cc">CC</span>
                                    <span className="bf-msg-num">{m.num}</span>
                                    <span className="bf-msg-eq">=</span>
                                    <span className="bf-msg-val">{m.val}</span>
                                    <span className="bf-msg-sep">·</span>
                                    <span className="bf-msg-ch">CH {m.ch}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  // ── LIVE MODE — disparo mais recente do SW ──
  return (
    <div className="bf-live-monitor">
      <div className="bf-live-monitor-head">
        <span>MONITOR · LIVE MODE</span>
        {events.length > 0 && (
          <MonitorCopyButton getText={() => buildLiveMonitorText(events)} />
        )}
      </div>
      <div className="bf-live-monitor-body">
        <div className="bf-monitor-events-section">
          {events.length === 0 ? (
            <div className="bf-monitor-event-empty">
              (sem disparos capturados — pressione um SW em LIVE MODE)
            </div>
          ) : (
            events.map((ev, i) => {
              const msgs = Array.isArray(ev.messages) ? ev.messages : [];
              return (
                <div key={i} className="bf-monitor-ev">
                  <div className="bf-monitor-ev-head">
                    <span className="bf-monitor-ev-sw">SW-{ev.sw}</span>
                    <span className="bf-monitor-ev-mode">{ev.modeLabel || 'STOMP'}</span>
                    {ev.sectionLabel && (
                      <span className="bf-monitor-ev-sec">{ev.sectionLabel}</span>
                    )}
                    {(ev.on === true || ev.on === false) && (
                      <span className={'bf-monitor-ev-state is-' + (ev.on ? 'on' : 'off')}>
                        {ev.on ? 'ON' : 'OFF'}
                      </span>
                    )}
                  </div>
                  {msgs.length > 0 ? (
                    <div className="bf-monitor-ev-msgs">
                      {msgs.map((m, j) => (
                        <div key={j} className="bf-monitor-ev-msg">
                          {m.kind === 'pc' ? (
                            <>
                              <span className="bf-msg-type is-pc">PC</span>
                              <span className="bf-msg-num">{m.pc}</span>
                              <span className="bf-msg-sep">·</span>
                              <span className="bf-msg-ch">CH {m.ch}</span>
                            </>
                          ) : m.kind === 'fav' ? (
                            <>
                              <span className="bf-msg-type is-fav">FAV</span>
                              <span className="bf-msg-num">{m.bank}{m.preset}</span>
                              <span className="bf-msg-sep">·</span>
                              <span className="bf-msg-ch">{m.mode}</span>
                            </>
                          ) : (
                            <>
                              <span className="bf-msg-type is-cc">CC</span>
                              <span className="bf-msg-num">{m.num}</span>
                              <span className="bf-msg-eq">=</span>
                              <span className="bf-msg-val">{m.val}</span>
                              <span className="bf-msg-sep">·</span>
                              <span className="bf-msg-ch">CH {m.ch}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bf-monitor-ev-msg bf-monitor-ev-msg-empty">
                      (nenhum MIDI disparado — canais OFF)
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
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
  ledPreviewLive, setLedPreviewLive,
  gigView, setGigView,
  liveLayout, setLiveLayout,
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
        <>
          {/* GIG VIEW — controla o que o display do pedal mostra durante
              o uso ao vivo. Padrao: segue o modo real (BANK ou LIVE).
              Forcado: trava num dos dois pra evitar trocar acidentalmente. */}
          <div className="bf-card">
            <div className="bf-card-head">
              <h3>Gig View</h3>
              <span className="meta">
                {gigView === 'preset' ? 'ONLY PRESET'
                  : gigView === 'live' ? 'ONLY LIVE'
                  : 'PADRAO'}
              </span>
            </div>
            <div className="bf-seg">
              <button
                className={gigView === 'padrao' ? 'is-active' : ''}
                onClick={() => setGigView('padrao')}
                title="Display segue o modo real (BANK ou LIVE)"
              >PADRAO</button>
              <button
                className={gigView === 'preset' ? 'is-active' : ''}
                onClick={() => setGigView('preset')}
                title="Display sempre mostra o nome do preset, mesmo em LIVE"
              >ONLY PRESET</button>
              <button
                className={gigView === 'live' ? 'is-active' : ''}
                onClick={() => setGigView('live')}
                title="Display sempre mostra a tela LIVE, mesmo em BANK"
              >ONLY LIVE</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 4px 0', lineHeight: 1.4 }}>
              {gigView === 'padrao'
                ? 'Comportamento normal: o display alterna entre BANK e LIVE conforme o modo selecionado.'
                : gigView === 'preset'
                  ? 'Display fica trancado na tela do PRESET — mesmo entrando em LIVE MODE.'
                  : 'Display fica trancado na tela LIVE — mesmo voltando pra BANK MODE.'}
            </p>
          </div>

          {/* LIVE MODE LAYOUT — esquema visual da tela LIVE no display.
              3 opcoes:
                1: 3x2 tiles + faixa NOME DO PRESET no meio
                2: 3x2 tiles (sem faixa)
                3: faixa NOME DO PRESET no topo + 1x6 tiles pequenos */}
          <div className="bf-card">
            <div className="bf-card-head">
              <h3>Live Mode Layout</h3>
              <span className="meta">LAYOUT {liveLayout}</span>
            </div>
            <div className="bf-seg">
              <button
                className={liveLayout === 1 ? 'is-active' : ''}
                onClick={() => setLiveLayout(1)}
                title="3x2 tiles 120x120 + faixa do preset no meio"
              >LAYOUT 1</button>
              <button
                className={liveLayout === 2 ? 'is-active' : ''}
                onClick={() => setLiveLayout(2)}
                title="3x2 tiles 150x150 (sem faixa)"
              >LAYOUT 2</button>
              <button
                className={liveLayout === 3 ? 'is-active' : ''}
                onClick={() => setLiveLayout(3)}
                title="Faixa do preset no topo + 1x6 tiles 70x70"
              >LAYOUT 3</button>
            </div>
          </div>
        </>
      )}

      {section === 'leds' && (
        <>
          <div className="bf-card">
            <div className="bf-card-head">
              <h3>LED Brightness</h3>
              <span className="meta">PWM · {brightness}%</span>
            </div>
            <BrightnessSlider value={brightness} onChange={setBrightness} />
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

          <div className="bf-card">
            <div className="bf-card-head">
              <h3>LED Preview Live Mode</h3>
              <span className="meta">{ledPreviewLive ? 'ON' : 'OFF'}</span>
            </div>
            <div className="bf-auto-row">
              <span className="label">Preview do SW desligado</span>
              <button
                className={'bf-switch is-accent' + (ledPreviewLive ? ' is-on' : '')}
                onClick={() => setLedPreviewLive(!ledPreviewLive)}
                aria-label="LED Preview Live Mode"
                aria-pressed={ledPreviewLive}
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '14px 4px 0', lineHeight: 1.4 }}>
              Com ON, em LIVE MODE um SW STOMP desligado mantém só o pixel central
              aceso (em vez de apagar os 3). OFF = comportamento padrão.
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

// ─── ERASE DATA (destrutivo) ───────────────────────────────────────
// Zera presets ou config global aos defaults. Cada acao tem confirmacao
// porque nao tem undo (a menos que o usuario tenha um backup recente).
function EraseDataCard() {
  const [busy, setBusy] = useState(null);  // 'presets' | 'global' | null
  const [msg, setMsg] = useState('');

  const erase = useCallback(async (target, label) => {
    const confirmMsg = target === 'presets'
      ? 'APAGAR todos os presets? Esta acao reseta os 30 slots aos defaults e e IRREVERSIVEL (a menos que voce tenha um backup).'
      : 'APAGAR a config global? Resetara paleta, brilho, auto-start, banks habilitados, etc. WiFi STA NAO e afetado. Irreversivel.';
    if (!window.confirm(confirmMsg)) return;
    setBusy(target);
    setMsg('');
    try {
      await apiCall('POST', `/erase/${target}`);
      setMsg(`${label} apagado(s) com sucesso.`);
    } catch (e) {
      setMsg('Falha: ' + e.message);
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="bf-card" style={{ marginTop: 14 }}>
      <div className="bf-card-head">
        <h3>ZONA DE PERIGO</h3>
        <span className="meta">IRREVERSIVEL</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 4px 14px', lineHeight: 1.5 }}>
        Reseta dados aos valores de fábrica. Faça um backup antes.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="bf-action"
          onClick={() => erase('presets', 'Presets')}
          disabled={!!busy}
          style={{ flex: 1 }}
        >
          ERASE ALL PRESETS
        </button>
        <button
          className="bf-action"
          onClick={() => erase('global', 'Config global')}
          disabled={!!busy}
          style={{ flex: 1 }}
        >
          ERASE GLOBAL CONFIG
        </button>
      </div>
      {msg && (
        <p style={{
          marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11,
          letterSpacing: '0.08em',
          color: msg.startsWith('Falha') ? 'var(--danger, #ff6b6b)' : 'var(--success, #30d158)',
        }}>{msg}</p>
      )}
    </div>
  );
}

// ─── HARD TEST ─────────────────────────────────────────────────────
// 3 testes nao-bloqueantes (10s cada) + STOP. Botoes disparam POST
// /hardtest?mode=leds|display|midi|stop. Logica do teste vive no
// firmware (HARD_TEST.h) — frontend so dispara e mostra status.
function HardTestCard() {
  const [running, setRunning] = useState(null);  // 'leds'|'display'|'midi'|null
  const [msg, setMsg] = useState('');

  const fire = useCallback(async (mode) => {
    setMsg('');
    try {
      await apiCall('POST', '/hardtest', `mode=${mode}`);
      if (mode === 'stop') {
        setRunning(null);
        setMsg('Teste interrompido.');
      } else {
        setRunning(mode);
        setMsg(`Teste ${mode.toUpperCase()} rodando...`);
        // Auto-clear do estado UI apos a duracao do teste (firmware ja
        // restaura sozinho). 10.5s pra cobrir folga do clock.
        setTimeout(() => {
          setRunning((cur) => (cur === mode ? null : cur));
        }, 10500);
      }
    } catch (e) {
      setMsg('Falha: ' + e.message);
    }
  }, []);

  const isOn = (m) => running === m;
  return (
    <div className="bf-card">
      <div className="bf-card-head">
        <h3>HARD TEST</h3>
        <span className="meta">DIAGNOSTICO</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 4px 14px', lineHeight: 1.5 }}>
        Cada teste roda por 10 segundos (MIDI envia PC 0–9 no canal 1, 1 por
        segundo). Use STOP pra interromper.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <button className={'bf-action' + (isOn('leds') ? ' is-running' : '')}
                onClick={() => fire('leds')} disabled={!!running && !isOn('leds')}>
          LEDS
        </button>
        <button className={'bf-action' + (isOn('display') ? ' is-running' : '')}
                onClick={() => fire('display')} disabled={!!running && !isOn('display')}>
          DISPLAY
        </button>
        <button className={'bf-action' + (isOn('midi') ? ' is-running' : '')}
                onClick={() => fire('midi')} disabled={!!running && !isOn('midi')}>
          MIDI
        </button>
      </div>
      <button className="bf-action" style={{ marginTop: 10, width: '100%' }}
              onClick={() => fire('stop')} disabled={!running}>
        STOP
      </button>
      {msg && (
        <p style={{
          marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11,
          letterSpacing: '0.08em',
          color: msg.startsWith('Falha') ? 'var(--danger, #ff6b6b)' : 'var(--muted)',
        }}>{msg}</p>
      )}
    </div>
  );
}

// ─── BACKUP / RESTORE ──────────────────────────────────────────────
// Backup: GET /backup → JSON com presets MODIFICADOS apenas.
// Restore: POST /restore com mesmo JSON; aplica como MERGE (presets
// ausentes ficam intactos). Sem persistir NVS — apenas LittleFS de
// bank_memory.txt, que é o escopo do backup.
function BackupRestoreCard() {
  const [status, setStatus] = useState({ kind: 'idle', msg: '' });
  // progress: { phase, pct, bytes, total } — pct/total opcionais.
  const [progress, setProgress] = useState(null);

  const fmtKB = (b) => {
    if (!b) return '0 KB';
    if (b < 1024) return b + ' B';
    return (b / 1024).toFixed(1) + ' KB';
  };

  const doBackup = useCallback(async () => {
    setStatus({ kind: 'loading', msg: 'Conectando...' });
    setProgress({ phase: 'requesting', pct: 0 });
    try {
      // Pra ter progresso real, usa fetch + stream reader em vez do
      // apiCall (que faria .text()/.json() de uma vez). USB nao suporta
      // streaming via Web Serial: cai pro caminho antigo (apiCall).
      let text;
      if (_transport.usbConnected) {
        // USB nao tem progresso real — mostra so "baixando".
        setProgress({ phase: 'downloading', pct: null });
        const json = await apiCall('GET', '/backup');
        text = JSON.stringify(json);
        setProgress({ phase: 'downloading', pct: 100, bytes: text.length });
      } else {
        const base = DEVICE_API || '';
        const resp = await fetch(`${base}/backup`, { method: 'GET' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        // Content-Length pode nao vir em chunked transfer — tratamos null.
        const total = parseInt(resp.headers.get('Content-Length') || '0', 10);
        const reader = resp.body && resp.body.getReader();
        if (!reader) {
          text = await resp.text();
        } else {
          const decoder = new TextDecoder();
          const chunks = [];
          let received = 0;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            setProgress({
              phase: 'downloading',
              pct: total ? Math.round((received / total) * 100) : null,
              bytes: received,
              total,
            });
          }
          text = chunks.map((c) => decoder.decode(c, { stream: true })).join('')
               + decoder.decode();
        }
      }
      setProgress({ phase: 'saving', pct: 100 });
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `bfmidi-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      let count = 0;
      try {
        const json = JSON.parse(text);
        count = json.presets ? Object.keys(json.presets).length : 0;
      } catch {/* ignore parse — file ainda foi baixado */}
      setStatus({
        kind: 'ok',
        msg: `Backup OK · ${count} preset(s) · ${fmtKB(text.length)}`,
      });
      setProgress(null);
    } catch (e) {
      setStatus({ kind: 'error', msg: 'Falha: ' + e.message });
      setProgress(null);
    }
  }, []);

  const doRestore = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      setStatus({ kind: 'loading', msg: 'Lendo arquivo...' });
      setProgress({ phase: 'reading', pct: 0 });
      try {
        const text = await file.text();
        setProgress({ phase: 'reading', pct: 100, bytes: text.length });
        // Valida estrutura antes de enviar pro device
        const parsed = JSON.parse(text);
        if (!parsed.presets || typeof parsed.presets !== 'object') {
          throw new Error('arquivo invalido (sem campo presets)');
        }
        // Limite USB: linha de comando max 2048 chars. Backups maiores
        // exigem WiFi (HTTP).
        if (_transport.usbConnected && text.length > 1900) {
          throw new Error('arquivo muito grande pro USB (use WiFi)');
        }
        setStatus({ kind: 'loading', msg: 'Enviando ao dispositivo...' });
        // Pra ter progresso de UPLOAD usa XMLHttpRequest (fetch nao expoe
        // upload progress). Cai pro apiCall em USB.
        let result;
        if (_transport.usbConnected) {
          setProgress({ phase: 'uploading', pct: null, bytes: 0, total: text.length });
          result = await apiCall('POST', '/restore', text);
        } else {
          const base = DEVICE_API || '';
          result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${base}/restore`);
            // text/plain e o que o ESP precisa pra popular webServer.arg("plain").
            // Application/x-www-form-urlencoded seria parseado como pares key=val
            // e o body JSON do restore nao tem '=' — daria 400 "missing body".
            xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
            xhr.upload.onprogress = (evt) => {
              setProgress({
                phase: 'uploading',
                pct: evt.lengthComputable
                  ? Math.round((evt.loaded / evt.total) * 100)
                  : null,
                bytes: evt.loaded,
                total: evt.total,
              });
            };
            xhr.upload.onload = () => {
              setProgress({ phase: 'applying', pct: null });
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText || '{}')); }
                catch { resolve({}); }
              } else {
                reject(new Error('HTTP ' + xhr.status));
              }
            };
            xhr.onerror = () => reject(new Error('network error'));
            xhr.send(text);
          });
        }
        setStatus({
          kind: 'ok',
          msg: `Restore OK · ${result.applied || 0} preset(s) aplicado(s) · ${fmtKB(text.length)}`,
        });
        setProgress(null);
      } catch (err) {
        setStatus({ kind: 'error', msg: 'Falha: ' + err.message });
        setProgress(null);
      }
    };
    input.click();
  }, []);

  return (
    <div className="bf-card">
      <div className="bf-card-head">
        <h3>BACKUP & RESTORE</h3>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 4px 14px', lineHeight: 1.5 }}>
        Exporta apenas os presets modificados como arquivo JSON. O restore é
        em modo merge — presets ausentes do arquivo ficam intactos.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          className="bf-action"
          onClick={doBackup}
          disabled={status.kind === 'loading'}
          style={{ flex: 1 }}
        >
          FAZER BACKUP
        </button>
        <button
          className="bf-action"
          onClick={doRestore}
          disabled={status.kind === 'loading'}
          style={{ flex: 1 }}
        >
          RESTAURAR
        </button>
      </div>
      {progress && (
        <div className="bf-backup-progress">
          <div className="bf-backup-progress-track">
            <div
              className={'bf-backup-progress-fill' +
                         (progress.pct == null ? ' is-indeterminate' : '')}
              style={progress.pct != null
                ? { width: progress.pct + '%' }
                : undefined}
            />
          </div>
          <div className="bf-backup-progress-info">
            <span>{
              progress.phase === 'requesting' ? 'Conectando…'
              : progress.phase === 'downloading' ? 'Baixando…'
              : progress.phase === 'saving' ? 'Salvando arquivo…'
              : progress.phase === 'reading' ? 'Lendo arquivo…'
              : progress.phase === 'uploading' ? 'Enviando…'
              : progress.phase === 'applying' ? 'Aplicando no dispositivo…'
              : '…'
            }</span>
            <span className="bf-backup-progress-bytes">
              {progress.pct != null && `${progress.pct}%`}
              {typeof progress.bytes === 'number' && (
                <> · {fmtKB(progress.bytes)}
                  {progress.total ? ` / ${fmtKB(progress.total)}` : ''}
                </>
              )}
            </span>
          </div>
        </div>
      )}
      {status.kind !== 'idle' && (
        <p
          style={{
            marginTop: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: status.kind === 'error' ? 'var(--danger, #ff6b6b)'
                : status.kind === 'ok'    ? 'var(--success, #30d158)'
                : 'var(--muted)',
          }}
        >
          {status.msg}
        </p>
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
      <div className="bf-icon-tabs cols-4">
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
          <button className={'bf-icon-tab' + (section === 'backup' ? ' is-on' : '')} onClick={() => setSection('backup')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Disquete classico (save/backup): corpo + slot superior +
                  janela do slot + label inferior */}
              <rect className="bf-tab-shape" x="3" y="3" width="18" height="18" rx="2" />
              <rect className="bf-tab-dot" x="6" y="3" width="12" height="6.5" />
              <rect className="bf-tab-shape" x="14" y="4.5" width="2" height="3.5" />
              <rect className="bf-tab-shape" x="6.5" y="13" width="11" height="6" />
            </svg>
            <span>BACKUP</span>
          </button>
          <button className={'bf-icon-tab' + (section === 'hardtest' ? ' is-on' : '')} onClick={() => setSection('hardtest')}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Chave inglesa (hardware test) */}
              <path className="bf-tab-shape" d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z" />
            </svg>
            <span>HARD TEST</span>
          </button>
        </div>

      {section === 'model' && (
        <div className="bf-card">
          <div className="bf-model-tabs">
            {FAMILIES.map((f) => {
              // "BFMIDI-1" → num="1", label="BFMIDI"
              const num = (f.split('-')[1] || f).trim();
              return (
                <button
                  key={f}
                  className={family === f ? 'is-active' : ''}
                  onClick={() => {
                    const first = MODELS.find((m) => m.tag === f);
                    if (first) setModel(first.id);
                  }}
                >
                  <span className="num">{num}</span>
                  <span className="label">BFMIDI</span>
                </button>
              );
            })}
          </div>

          <div className="bf-model-list">
            {list.map((v) => (
              <div
                key={v.id}
                className={'bf-model-row' + (model === v.id ? ' is-active' : '')}
                onClick={() => setModel(v.id)}
              >
                <span className="bf-model-radio" />
                <span className="bf-model-name">{v.id}</span>
              </div>
            ))}
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

      {section === 'backup' && (
        <>
          <BackupRestoreCard />
          <EraseDataCard />
        </>
      )}

      {section === 'hardtest' && (
        <HardTestCard />
      )}
    </div>
  );
}

// ─── Tab bar ────────────────────────────────────────────────────────
function TabBar({ page, setPage, saveState, onSave,
                  onCopyPreset, onPastePreset, presetClipboard,
                  presetClipboardStatus,
                  onCopyBank, onPasteBank, bankClipboard,
                  bankClipboardStatus }) {
  const tabs = [
    { id: 'preset_config', label: 'PRESET' },
    { id: 'global_config', label: 'GLOBAL' },
    { id: 'system_config', label: 'SYSTEM' },
  ];
  const saveLabel =
    saveState === 'saving' ? '…' :
    saveState === 'saved'  ? '✓' :
    saveState === 'error'  ? '!' : 'SAVE';
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (e.target.closest('.bf-tabbar-plus-wrap')) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);
  return (
    <div className="bf-tabbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={'bf-tab ' + t.id + (page === t.id ? ' is-active' : '')}
          onClick={() => setPage(t.id)}
        >{t.label}</button>
      ))}
      {/* Botao "+" abre menu com COPY PRESET / PASTE PRESET. So
          aparece quando esta na pagina PRESET (acoes nao fazem sentido
          em GLOBAL/SYSTEM). */}
      {page === 'preset_config' && (
        <div className="bf-tabbar-plus-wrap">
          <button
            type="button"
            className={'bf-tabbar-plus' +
                       (menuOpen ? ' is-open' : '') +
                       ((presetClipboardStatus === 'copied' || presetClipboardStatus === 'pasted' ||
                         bankClipboardStatus === 'copied' || bankClipboardStatus === 'pasted')
                         ? ' is-flash-ok' : '') +
                       ((presetClipboardStatus === 'pasting' || bankClipboardStatus === 'pasting' ||
                         bankClipboardStatus === 'copying')
                         ? ' is-busy' : '') +
                       ((presetClipboardStatus === 'error' || bankClipboardStatus === 'error')
                         ? ' is-flash-err' : '')}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Acoes do preset"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Acoes do preset (copy/paste)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18"
                 fill="none" stroke="currentColor" strokeWidth="2.6"
                 strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14 M5 12h14" />
            </svg>
          </button>
          {menuOpen && (
            <div className="bf-tabbar-plus-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="bf-tabbar-plus-item"
                onClick={() => { setMenuOpen(false); onCopyPreset && onCopyPreset(); }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16"
                     fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8" y="8" width="11" height="13" rx="2" />
                  <path d="M16 8V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h1" />
                </svg>
                <span>COPY PRESET</span>
              </button>
              {presetClipboard && (
                <button
                  type="button"
                  role="menuitem"
                  className="bf-tabbar-plus-item"
                  onClick={() => { setMenuOpen(false); onPastePreset && onPastePreset(); }}
                  title={`Cola o preset copiado (${presetClipboard.srcTag})`}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16"
                       fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" />
                    <path d="M12 11v6 M9 14l3 3 3-3" />
                  </svg>
                  <span>PASTE PRESET <em>({presetClipboard.srcTag})</em></span>
                </button>
              )}
              <div className="bf-tabbar-plus-sep" />
              <button
                type="button"
                role="menuitem"
                className="bf-tabbar-plus-item"
                onClick={() => { setMenuOpen(false); onCopyBank && onCopyBank(); }}
                disabled={bankClipboardStatus === 'copying'}
                title="Copia os 6 presets do banco atual (pode demorar 2-5s)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16"
                     fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {/* Pilha de 3 retangulos = banco com varios presets */}
                  <rect x="3" y="3" width="14" height="14" rx="2" />
                  <path d="M7 7h14v14H7z" />
                </svg>
                <span>COPY BANK {bankClipboardStatus === 'copying' ? '…' : ''}</span>
              </button>
              {bankClipboard && (
                <button
                  type="button"
                  role="menuitem"
                  className="bf-tabbar-plus-item"
                  onClick={() => { setMenuOpen(false); onPasteBank && onPasteBank(); }}
                  disabled={bankClipboardStatus === 'pasting'}
                  title={`Cola os 6 presets do banco ${bankClipboard.srcLetter} no banco atual`}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16"
                       fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="14" height="14" rx="2" />
                    <path d="M7 7h14v14H7z" />
                    <path d="M14 11v6 M11 14l3 3 3-3" />
                  </svg>
                  <span>PASTE BANK <em>({bankClipboard.srcLetter}{bankClipboardStatus === 'pasting' ? '…' : ''})</em></span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <button
        className={'bf-save is-' + (saveState || 'idle')}
        onClick={onSave}
        title={
          saveState === 'dirty'  ? 'Mudancas nao salvas — clique pra salvar'
          : saveState === 'saving' ? 'Salvando...'
          : saveState === 'saved'  ? 'Tudo salvo'
          : saveState === 'error'  ? 'Erro ao salvar'
          : 'Salvar'
        }
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

// Modal de progresso pra PASTE PRESET / PASTE BANK. Bloqueante (sem
// click-to-close no backdrop) — fecha sozinho quando o paste termina.
// Reusa a barra .bf-backup-progress* (mesmo visual do backup/restore).
function PasteProgressModal({ progress }) {
  if (!progress) return null;
  const pct = progress.total > 0
    ? Math.min(100, Math.round((progress.step / progress.total) * 100))
    : null;
  const title = progress.kind === 'bank'
    ? 'COLANDO BANCO' : 'COLANDO PRESET';
  return ReactDOM.createPortal(
    <div className="bf-modal-backdrop">
      <div className="bf-modal" role="dialog" aria-label={title}
           onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-head">
          <span className="bf-modal-title">{title}</span>
        </div>
        <div style={{ padding: '16px 18px 18px' }}>
          <div className="bf-backup-progress" style={{ marginTop: 0 }}>
            <div className="bf-backup-progress-track">
              <div
                className={'bf-backup-progress-fill' +
                           (pct == null ? ' is-indeterminate' : '')}
                style={pct != null ? { width: pct + '%' } : undefined}
              />
            </div>
            <div className="bf-backup-progress-info">
              <span>{progress.label || '…'}</span>
              <span className="bf-backup-progress-bytes">
                {pct != null
                  ? `${progress.step}/${progress.total}`
                  : '…'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
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
    // Preferimos STA (mesma rede de casa via mDNS). pingHttp roda
    // auto-detect e ajusta pra AP se STA falhar.
    const saved = (typeof localStorage !== 'undefined' &&
                   localStorage.getItem('bfmidi_connectionMode')) || 'STA';
    return saved === 'AP' ? 'AP' : 'STA';
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
    // 'dirty' e um estado *derivado* (idle + mudancas pendentes). O botao
    // SAVE no TabBar usa o estado pra colorir: idle/branco, dirty/vermelho,
    // saving/laranja, saved/verde, error/vermelho.
    if (!handle) {
      setPresetSaveStatus('idle');
    } else if (handle.status === 'idle' && handle.isDirty) {
      setPresetSaveStatus('dirty');
    } else {
      setPresetSaveStatus(handle.status);
    }
  }, []);

  const [model, setModel] = useState('BFMIDI-3 7S');
  const [brightness, setBrightness] = useState(72);
  const [bankLedColor, setBankLedColor] = useState(2);
  const [liveLedColor, setLiveLedColor] = useState(2);
  const [ledColorMode, setLedColorMode] = useState('letras');
  const [letterLedColors, setLetterLedColors] = useState([2, 2, 2, 2, 2]);
  const [switchLedColors, setSwitchLedColors] = useState([2, 2, 2, 2, 2, 2]);
  // LED PREVIEW LIVE MODE: SW STOMP desligado mantem o pixel central aceso.
  // Padrao ON — sincronizado com /config/global no load.
  const [ledPreviewLive, setLedPreviewLive] = useState(true);
  // GIG VIEW: 'padrao' | 'preset' | 'live'. Mapeia 0/1/2 do firmware.
  // Padrao 'padrao' = comportamento atual (display segue o modo real).
  const [gigView, setGigView] = useState('padrao');
  // LIVE MODE LAYOUT: 1 ou 2. Por enquanto so persiste o valor — a
  // renderizacao real dos dois layouts fica pra fase futura.
  const [liveLayout, setLiveLayout] = useState(1);

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
  // Modo de operacao do hardware: 'preset' (BANK no firmware) ou 'live'.
  // Sincronizado via /bank/current (poll) e alterado via POST /mode.
  const [switchMode, setSwitchMode] = useState('preset');
  // Sync do toggle PRESET MODE / LIVE MODE com a controladora. Quando ON
  // (padrao), clicks no webApp postam /mode e o poll de /bank/current
  // reflete o modo do hardware. Quando OFF, o toggle e puramente local —
  // nenhuma das duas direcoes propaga. Botaozinho redondo no meio dos
  // dois botoes alterna o estado.
  const [modeSync, setModeSync] = useState(true);
  const modeSyncRef = useRef(true);
  useEffect(() => { modeSyncRef.current = modeSync; }, [modeSync]);
  // Mostra ou oculta o painel MONITOR no fim da pagina de preset.
  // Dois botaozinhos flanqueando o toggle PRESET/LIVE alternam isso.
  const [showMonitor, setShowMonitor] = useState(true);
  // Modo de operacao escolhido por SW em LIVE MODE (1..6 -> id do modo).
  // Vive aqui (nao no LiveModePanel) pra sobreviver ao toggle PRESET<->LIVE.
  // Persistido no PRESET atual (campo sw_modes): editar marca pendente,
  // o botao SAVE do rodape grava — igual ao card de preset.
  const [swModes, setSwModes] = useState({});
  const [savedSwModes, setSavedSwModes] = useState({});
  const [swModesStatus, setSwModesStatus] = useState('idle'); // idle|saving|saved|error
  const swModesDirty = swModesToStr(swModes) !== swModesToStr(savedSwModes);
  // Display config (icone + cores + sigla) por SW. Vive no header do
  // preset (campos swdisp1..swdisp6). Mesmo padrao do swModes: dirty
  // tracking, salvo via saveLive junto com sw_modes.
  const [swDisplay, setSwDisplay] = useState(defaultSwDisplayMap);
  const [savedSwDisplay, setSavedSwDisplay] = useState(defaultSwDisplayMap);
  const swDisplayDirty = !swDisplayEqual(swDisplay, savedSwDisplay);
  const setSwDisplayOne = useCallback((sw, next) => {
    setSwDisplay((prev) => ({ ...prev, [sw]: { ...DEFAULT_SW_DISPLAY(), ...next } }));
  }, []);
  const [swLiveOn, setSwLiveOn] = useState([false, false, false, false, false, false]);
  // Estado da secao B (click longo do STOMP 2) — espelha swActive.liveOn2
  // do firmware. Separado pra o poll detectar press do click longo.
  const [swLiveOn2, setSwLiveOn2] = useState([false, false, false, false, false, false]);
  // Estado da secao C (reclick / duplo-click do STOMP 3) — espelha
  // swActive.liveOn3 do firmware.
  const [swLiveOn3, setSwLiveOn3] = useState([false, false, false, false, false, false]);
  // Log de presses de SW em LIVE MODE — cada flip em swLiveOn / swLiveOn2
  // entre polls vira uma entrada. Mostrado no MONITOR (visivel em PRESET
  // e LIVE). Limpa na troca de preset. Cap em 50 entradas.
  const [liveEvents, setLiveEvents] = useState([]);
  // Meta salva do preset ativo (fonte do snapshot do MONITOR no nivel da
  // pagina — sobrevive ao toggle PRESET/LIVE, diferente do savedMetaByTag
  // do PresetEditorCard que desmonta com o card).
  const [currentSavedMeta, setCurrentSavedMeta] = useState(null);
  // Clipboard de preset INTEIRO — { srcTag, meta, swModes, swParams }.
  // COPY: snapshot do preset atual; PASTE: aplica em outro preset.
  // Vive enquanto o webApp roda (perdido no refresh da pagina).
  const [presetClipboard, setPresetClipboard] = useState(null);
  const [presetClipboardStatus, setPresetClipboardStatus] = useState('idle');
  // Clipboard de BANK INTEIRO — { srcLetter, presets: [{ tag, meta,
  // swModes, swParams }, ...] }. COPY BANK varre os 6 presets do banco
  // atual; PASTE BANK aplica todos no banco corrente. Mais pesado que
  // o clipboard de preset — pode demorar varios segundos pra colar.
  const [bankClipboard, setBankClipboard] = useState(null);
  const [bankClipboardStatus, setBankClipboardStatus] = useState('idle');
  // Progresso visual do PASTE PRESET / PASTE BANK. null = sem operacao.
  // { kind: 'preset'|'bank', step, total, label } — exibido em modal
  // bloqueante via <PasteProgressModal>. Cada API call avanca o step.
  const [pasteProgress, setPasteProgress] = useState(null);
  // Snapshot do preset atual exibido no MONITOR. Reconstruido pelo
  // useEffect abaixo a partir do savedMeta + savedSwModes + savedSwParams.
  const [monitorEntry, setMonitorEntry] = useState(null);
  const monitorLastSnapshotRef = useRef(null);
  // Refs pra detectar press dentro do setInterval (closure velha).
  const swLiveOnRef = useRef([false, false, false, false, false, false]);
  const swLiveOn2Ref = useRef([false, false, false, false, false, false]);
  const swLiveOn3Ref = useRef([false, false, false, false, false, false]);
  // Contador de pulses do modo MOMENTARY (do firmware) — usado pra
  // detectar quantos pulses ocorreram entre polls e logar no MONITOR.
  const swMomentaryCountRef = useRef([0, 0, 0, 0, 0, 0]);
  // Contador de disparos do modo SINGLE (mesma mecanica).
  const swSingleCountRef = useRef([0, 0, 0, 0, 0, 0]);
  // Contador de taps do modo TAP TEMPO.
  const swTapCountRef = useRef([0, 0, 0, 0, 0, 0]);
  const swSpinStateRef = useRef([-1, -1, -1, -1, -1, -1]);
  // Estado SPIN espelhado em React state pra o tile do LiveModePanel
  // re-renderizar quando o firmware reporta novo state (1/2/3) — assim
  // o icone troca de cor no preview ao receber o press fisico.
  const [swSpinState, setSwSpinState] = useState([-1, -1, -1, -1, -1, -1]);
  // Qual SW em SINGLE foi o ultimo a disparar (vindo do firmware).
  // -1 = nenhum. Usado pelo SwSingleEditor pra mostrar o LED aceso.
  const [lastSingleSw, setLastSingleSw] = useState(-1);
  const switchModeRef = useRef('preset');
  const savedSwModesRef = useRef({});
  const savedSwParamsRef = useRef({});
  const liveEventsTagRef = useRef('');
  useEffect(() => { swLiveOnRef.current = swLiveOn; }, [swLiveOn]);
  useEffect(() => { swLiveOn2Ref.current = swLiveOn2; }, [swLiveOn2]);
  useEffect(() => { swLiveOn3Ref.current = swLiveOn3; }, [swLiveOn3]);
  useEffect(() => { switchModeRef.current = switchMode; }, [switchMode]);
  // Parametros por SW/modo do preset atual (ver parseSwParamsObj). Mesma
  // mecanica do swModes: editar marca pendente, o SAVE do rodape grava.
  const [swParams, setSwParams] = useState({});
  const [savedSwParams, setSavedSwParams] = useState({});
  const swParamsDirty =
    JSON.stringify(swParams) !== JSON.stringify(savedSwParams);
  // dirty combinado do LIVE MODE (sw_modes do header + params dos SWs +
  // display config dos SWs).
  const liveDirty = swModesDirty || swParamsDirty || swDisplayDirty;
  // Espelha o dirty pro poll de loadBankCurrent (setInterval com closure
  // velha) decidir se pode sobrescrever o estado ou se respeita a edicao.
  const swModesDirtyRef = useRef(false);
  useEffect(() => { swModesDirtyRef.current = swModesDirty; }, [swModesDirty]);
  const swParamsDirtyRef = useRef(false);
  useEffect(() => { swParamsDirtyRef.current = swParamsDirty; }, [swParamsDirty]);
  const swDisplayDirtyRef = useRef(false);
  useEffect(() => { swDisplayDirtyRef.current = swDisplayDirty; }, [swDisplayDirty]);
  // Espelha o saved* pra o poll snapshotar config no momento do press
  // (eventos do MONITOR ficam congelados se o usuario editar depois).
  useEffect(() => { savedSwModesRef.current = savedSwModes; }, [savedSwModes]);
  useEffect(() => { savedSwParamsRef.current = savedSwParams; }, [savedSwParams]);

  // Constroi o snapshot do MONITOR a partir do meta salvo + modos/params
  // dos SWs. Dedup por JSON pra so atualizar quando algo realmente muda
  // (evita recriar o entry e bagunçar o `time` mostrado).
  useEffect(() => {
    if (!currentSavedMeta) return;
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const tag = `${letters[bankLetterIndex] || 'A'}${presetNumber}`;
    // Estrutura por SW: { sw, modeLabel, sections: [{label, flags, messages}] }
    const swEntries = Array.from({ length: 6 }, (_, i) => {
      const sw = i + 1;
      const id = (savedSwModes && savedSwModes[sw]) || 'mute';
      const params = savedSwParams && savedSwParams[sw] && savedSwParams[sw][id];
      return buildSnapshotSwEntry(sw, id, params);
    }).filter((e) => e.sections && e.sections.length > 0);
    const snapshot = JSON.stringify({
      tag, name: currentSavedMeta.name || tag,
      pc: currentSavedMeta.bank, ch: currentSavedMeta.channel,
      extraPcs: currentSavedMeta.extraPcs,
      extraCcs: currentSavedMeta.extraCcs,
      swEntries,
    });
    if (monitorLastSnapshotRef.current === snapshot) return;
    monitorLastSnapshotRef.current = snapshot;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${
        String(now.getMinutes()).padStart(2, '0')}:${
        String(now.getSeconds()).padStart(2, '0')}`;
    setMonitorEntry({
      tag, name: currentSavedMeta.name || tag,
      pc: currentSavedMeta.bank, ch: currentSavedMeta.channel,
      time,
      extraPcs: (currentSavedMeta.extraPcs || [])
        .map((pc, i) => ({ slot: i + 1, ch: Number(pc.ch),
                           program: Number(pc.program) }))
        .filter((pc) => pc.ch >= 1 && pc.ch <= 16),
      extraCcs: (currentSavedMeta.extraCcs || [])
        .map((cc, i) => ({ slot: i + 1, ch: Number(cc.ch),
                           ctrl: Number(cc.ctrl), value: Number(cc.value) }))
        .filter((cc) => cc.ch >= 1 && cc.ch <= 16),
      swEntries,
    });
  }, [currentSavedMeta, savedSwModes, savedSwParams, bankLetterIndex, presetNumber]);
  // Tag do preset atual ("A1"...) sempre fresca — saveLive grava nela.
  const currentTagRef = useRef('A1');
  // Tag pra qual swParams foi carregado — o poll re-busca quando muda.
  const swParamsTagRef = useRef(null);

  // Apenas estado local — a persistencia acontece no SAVE (saveLive).
  const setSwMode = (sw, modeId) =>
    setSwModes((prev) => ({ ...prev, [sw]: modeId }));

  // COPY PRESET — snapshot completo do preset atual (meta + sw_modes +
  // sw_params) pro clipboard interno. Usa SAVED state (nao edits ainda
  // pendentes) pra evitar copiar lixo nao confirmado.
  const copyCurrentPreset = useCallback(() => {
    const tag = currentTagRef.current;
    if (!currentSavedMeta) return;
    const clone = (o) => JSON.parse(JSON.stringify(o));
    setPresetClipboard({
      srcTag: tag,
      meta: clone(currentSavedMeta),
      swModes: clone(savedSwModes || {}),
      swParams: clone(savedSwParams || {}),
      swDisplay: clone(savedSwDisplay || {}),
    });
    setPresetClipboardStatus('copied');
    setTimeout(() => setPresetClipboardStatus('idle'), 1500);
  }, [currentSavedMeta, savedSwModes, savedSwParams, savedSwDisplay]);

  // Helper compartilhado entre PASTE PRESET e PASTE BANK. Aplica um
  // snapshot (meta + swModes + swParams) em um preset destino.
  //
  // Cuidado importante: o destino pode ter dados antigos em sw<N>.<modo>
  // de um uso anterior. Se o snapshot fonte nao tem entrada pra um modo
  // que VAI ficar ATIVO no destino (porque o usuario nunca abriu o
  // editor desse modo na origem), o POST de params nao acontece e o
  // destino continua usando a config antiga daquele modo — gerando o
  // bug "SWs com opcoes um pouco diferentes" depois do paste. Pra
  // corrigir, materializamos DEFAULT_SW_PARAMS(activeMode) quando o
  // snapshot nao tem entrada — assim o destino sempre fica com o
  // mesmo comportamento que a origem tinha.
  //
  // onStep(label) e chamado a cada API call (header + cada sw/mode),
  // pra o modal de progresso avancar. countPasteSteps abaixo pre-calcula
  // o total de calls pro componente conseguir desenhar a barra.
  const pastePresetToDest = useCallback(async (destTag, src, onStep) => {
    onStep && onStep('Header');
    const headerBody = metaToApiBody(src.meta);
    headerBody.set('sw_modes', swModesToStr(src.swModes));
    if (src.swDisplay) swDisplayToApiBody(src.swDisplay, headerBody);
    await apiCall('POST',
      `/bank/preset?bank=${encodeURIComponent(destTag)}`, headerBody);

    for (let sw = 1; sw <= 6; sw++) {
      const modes = { ...((src.swParams || {})[sw] || {}) };
      const activeMode = (src.swModes || {})[sw] || 'mute';
      // Garante que o MODO ATIVO sempre tem params escritos no destino,
      // mesmo que a origem nunca tenha aberto o editor pra esse modo.
      if (activeMode !== 'mute' && !modes[activeMode]) {
        modes[activeMode] = DEFAULT_SW_PARAMS(activeMode);
      }
      const modeIds = Object.keys(modes);
      for (const modeId of modeIds) {
        onStep && onStep(`SW${sw} · ${modeId}`);
        await apiCall('POST',
          `/sw/params?bank=${encodeURIComponent(destTag)}&sw=${sw}` +
          `&mode=${encodeURIComponent(modeId)}`,
          swParamsToApiBody(modes[modeId]));
      }
    }
  }, []);

  // Conta quantas chamadas o paste vai fazer (1 header + 1 por sw/mode
  // que sera escrito). Usado pra montar a barra de progresso ANTES do
  // primeiro request, pra o usuario ja ver o "X de Y" desde o inicio.
  const countPasteSteps = useCallback((src) => {
    let n = 1; // header POST
    for (let sw = 1; sw <= 6; sw++) {
      const modes = { ...((src.swParams || {})[sw] || {}) };
      const activeMode = (src.swModes || {})[sw] || 'mute';
      if (activeMode !== 'mute' && !modes[activeMode]) modes[activeMode] = {};
      n += Object.keys(modes).length;
    }
    return n;
  }, []);

  // PASTE PRESET — aplica o clipboard no preset ATUAL (currentTag).
  // Sobrescreve meta (header), sw_modes e sw_params no firmware via API
  // e atualiza o state local. Nao copia o tag (preset identity fica).
  const pasteIntoCurrentPreset = useCallback(async () => {
    if (!presetClipboard) return;
    const tag = currentTagRef.current;
    if (!tag || tag === presetClipboard.srcTag) {
      // Colar no mesmo preset que foi copiado nao faz sentido.
      setPresetClipboardStatus('error');
      setTimeout(() => setPresetClipboardStatus('idle'), 1500);
      return;
    }
    setPresetClipboardStatus('pasting');
    const total = countPasteSteps(presetClipboard);
    let step = 0;
    setPasteProgress({
      kind: 'preset', step: 0, total,
      label: `Colando preset em ${tag}…`,
    });
    try {
      await pastePresetToDest(tag, presetClipboard, (sublabel) => {
        step += 1;
        setPasteProgress({
          kind: 'preset', step, total,
          label: `Colando em ${tag} · ${sublabel}`,
        });
      });
      await loadSwParams(tag);
      setPasteProgress(null);
      setPresetClipboardStatus('pasted');
      setTimeout(() => setPresetClipboardStatus('idle'), 1500);
    } catch (e) {
      setPasteProgress(null);
      setPresetClipboardStatus('error');
      setTimeout(() => setPresetClipboardStatus('idle'), 1800);
    }
  }, [presetClipboard, pastePresetToDest, countPasteSteps]);

  // COPY BANK — varre todos os 6 presets do banco atual (A..E) e
  // armazena um snapshot completo. Faz 12 GETs (6 metas + 6 sw_params).
  // Pode demorar 2-5s dependendo do transport (USB/WiFi).
  const copyCurrentBank = useCallback(async () => {
    const letterIdx = bankLetterIndex;
    const letter = String.fromCharCode(65 + (letterIdx % 5));
    setBankClipboardStatus('copying');
    try {
      const presets = [];
      for (let p = 1; p <= 6; p++) {
        const tag = `${letter}${p}`;
        const presetResp = await apiCall('GET',
          `/bank/preset?bank=${encodeURIComponent(tag)}`);
        const rawMeta = (presetResp && presetResp.meta) || presetResp || {};
        const meta = metaFromApi(rawMeta);
        const swModes = parseSwModesStr(rawMeta.sw_modes || '0,0,0,0,0,0');
        const swDisplay = parseSwDisplayFromMeta(rawMeta);
        const paramsResp = await apiCall('GET',
          `/sw/params?bank=${encodeURIComponent(tag)}`);
        const swParams = parseSwParamsObj(paramsResp && paramsResp.sw_params);
        presets.push({ tag, meta, swModes, swParams, swDisplay });
      }
      setBankClipboard({ srcLetter: letter, presets });
      setBankClipboardStatus('copied');
      setTimeout(() => setBankClipboardStatus('idle'), 1500);
    } catch (e) {
      setBankClipboardStatus('error');
      setTimeout(() => setBankClipboardStatus('idle'), 1800);
    }
  }, [bankLetterIndex]);

  // PASTE BANK — aplica os 6 presets do clipboard no banco corrente.
  // Sobrescreve TUDO (meta + sw_modes + sw_params) de cada preset.
  // Pula se for o mesmo banco origem.
  const pasteIntoCurrentBank = useCallback(async () => {
    if (!bankClipboard || !Array.isArray(bankClipboard.presets)) return;
    const letterIdx = bankLetterIndex;
    const letter = String.fromCharCode(65 + (letterIdx % 5));
    if (letter === bankClipboard.srcLetter) {
      setBankClipboardStatus('error');
      setTimeout(() => setBankClipboardStatus('idle'), 1500);
      return;
    }
    setBankClipboardStatus('pasting');
    // Soma os steps de todos os 6 presets pra a barra cobrir o bank todo.
    const total = bankClipboard.presets.reduce(
      (acc, src) => acc + countPasteSteps(src), 0);
    let step = 0;
    setPasteProgress({
      kind: 'bank', step: 0, total,
      label: `Colando banco em ${letter}…`,
    });
    try {
      for (let i = 0; i < bankClipboard.presets.length; i++) {
        const src = bankClipboard.presets[i];
        // src.tag e o tag de origem (ex: A1, A2...). Reescreve no destino
        // mantendo o numero do preset (1..6), so trocando a letra.
        const presetNum = parseInt(src.tag.slice(1), 10) || 1;
        const destTag = `${letter}${presetNum}`;
        await pastePresetToDest(destTag, src, (sublabel) => {
          step += 1;
          setPasteProgress({
            kind: 'bank', step, total,
            label: `Preset ${i + 1}/6 · ${destTag} · ${sublabel}`,
          });
        });
      }
      // Re-carrega o preset corrente pra refletir mudancas no UI.
      const curTag = currentTagRef.current;
      if (curTag) await loadSwParams(curTag);
      setPasteProgress(null);
      setBankClipboardStatus('pasted');
      setTimeout(() => setBankClipboardStatus('idle'), 1500);
    } catch (e) {
      setPasteProgress(null);
      setBankClipboardStatus('error');
      setTimeout(() => setBankClipboardStatus('idle'), 1800);
    }
  }, [bankClipboard, bankLetterIndex, pastePresetToDest, countPasteSteps]);

  // Edita um campo de um SW/modo. Cria a entrada com os defaults do modo
  // se ainda nao existir. Local — persistido pelo SAVE do rodape.
  const setSwParam = (sw, modeId, patch) =>
    setSwParams((prev) => {
      const prevSw = prev[sw] || {};
      const prevMode = prevSw[modeId] || DEFAULT_SW_PARAMS(modeId);
      return {
        ...prev,
        [sw]: { ...prevSw, [modeId]: { ...prevMode, ...patch } },
      };
    });

  // Carrega os params de SW de um preset (GET /sw/params). Seta swParams e
  // savedSwParams (baseline) — descarta edicao pendente. Otimista no
  // swParamsTagRef pra o poll nao re-buscar antes da resposta chegar.
  const loadSwParams = async (tag) => {
    swParamsTagRef.current = tag;
    try {
      const resp = await apiCall(
        'GET', `/sw/params?bank=${encodeURIComponent(tag)}`);
      const parsed = parseSwParamsObj(resp && resp.sw_params);
      setSwParams(parsed);
      setSavedSwParams(parsed);
    } catch {
      swParamsTagRef.current = null;  // permite retry no proximo poll
    }
  };

  // Grava o estado do LIVE MODE do preset atual: o sw_modes do header e,
  // em seguida, os params de cada SW/modo que mudou. Acionado pelo botao
  // SAVE do rodape quando switchMode === 'live'. Sao varias chamadas em
  // serie — se uma falhar, marca erro e re-sincroniza do dispositivo pra
  // nao ficar em estado torto. Em preview/offline cai no catch.
  const saveLive = async () => {
    setSwModesStatus('saving');
    const tag = currentTagRef.current;
    try {
      const headerBody = new URLSearchParams();
      headerBody.set('sw_modes', swModesToStr(swModes));
      // Display config (icone + cores + sigla) por SW vai junto, pra
      // ser uma unica escrita do header.
      swDisplayToApiBody(swDisplay, headerBody);
      await apiCall('POST',
        `/bank/preset?bank=${encodeURIComponent(tag)}`, headerBody);
      setSavedSwModes(swModes);
      setSavedSwDisplay(swDisplay);

      // Params: posta SW/modo que mudou desde o ultimo SAVE. Tambem
      // garante que o MODO ATIVO de cada SW tenha linha gravada — mesmo
      // que o usuario nao tenha aberto o editor (sem isso, escolher o
      // modo pelo picker sem tocar em nenhum campo nao gera linha
      // sw<N>.<modo>: no arquivo do preset, e o firmware nao reconhece
      // a configuracao na proxima chamada).
      const updatedSwParams = { ...swParams };
      for (let sw = 1; sw <= 6; sw++) {
        const activeMode = swModes[sw] || 'mute';
        // Materializa defaults se o usuario nao abriu o editor desse SW.
        if (activeMode !== 'mute') {
          const cur = swParams[sw] && swParams[sw][activeMode];
          if (!cur) {
            const defaults = DEFAULT_SW_PARAMS(activeMode);
            updatedSwParams[sw] = {
              ...(updatedSwParams[sw] || {}),
              [activeMode]: defaults,
            };
          }
        }
        const modes = updatedSwParams[sw] || {};
        for (const modeId of Object.keys(modes)) {
          // Para o modo ativo, sempre posta se ainda nao foi salvo.
          // Para outros modos no swParams, segue diff normal.
          const cur = JSON.stringify(modes[modeId]);
          const prev = JSON.stringify((savedSwParams[sw] || {})[modeId]);
          if (cur === prev) continue;
          await apiCall('POST',
            `/sw/params?bank=${encodeURIComponent(tag)}&sw=${sw}` +
            `&mode=${encodeURIComponent(modeId)}`,
            swParamsToApiBody(modes[modeId]));
        }
      }
      setSwParams(updatedSwParams);
      setSavedSwParams(updatedSwParams);

      setSwModesStatus('saved');
      setTimeout(() => setSwModesStatus((s) => (s === 'saved' ? 'idle' : s)), 1200);
    } catch {
      setSwModesStatus('error');
      setTimeout(() => setSwModesStatus((s) => (s === 'error' ? 'idle' : s)), 1400);
      // Re-sincroniza pra refletir o que realmente gravou no dispositivo.
      loadSwParams(tag);
    }
  };

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
  //
  // Estrategia robusta contra flicker:
  //   - Endpoint /ping (resposta de 16 bytes em ~10ms, evita timeout em STA lenta)
  //   - Timeout 5s (em vez de 3s) — STA via roteador pode demorar
  //   - Polling 10s (em vez de 30s) — recupera mais rapido apos online
  //   - 2 falhas seguidas antes de marcar offline (suaviza flicker de 1 ping perdido)
  //   - Mostra 'loading' (amarelo) enquanto ainda esta no limbo (1 falha so)
  const pingFailCountRef = useRef(0);
  // Auto-detecta o modo de WiFi a cada ping: probe STA primeiro (preferido),
  // depois AP como fallback. Atualiza connectionMode + deviceState pela
  // resposta. Sem probe disponivel (same-origin), so reporta offline.
  const pingHttp = useCallback(async () => {
    const probeHost = async (host) => {
      // /ping (firmware novo, 16 bytes, ~10ms). Se 404, tenta /config/global
      // pra cobrir firmware antigo.
      try {
        const r = await queuedFetch(`${host}/ping`,
          { method: 'GET' }, 3000);
        if (r.ok) return true;
      } catch {}
      try {
        const r = await queuedFetch(`${host}/config/global`,
          { method: 'GET' }, 4000);
        return r.ok;
      } catch { return false; }
    };
    let mode = null;
    if (await probeHost(STA_HOST)) mode = 'STA';
    else if (await probeHost(AP_HOST)) mode = 'AP';
    if (mode) {
      pingFailCountRef.current = 0;
      setConnectionMode((cur) => (cur === mode ? cur : mode));
      setDeviceState('online');
      return true;
    }
    pingFailCountRef.current += 1;
    if (pingFailCountRef.current >= 2) {
      setDeviceState('offline');
    } else {
      // 1a falha: ainda nao desce pra offline; mostra "loading" pra
      // sinalizar instabilidade sem alarmar com vermelho.
      setDeviceState('loading');
    }
    return false;
  }, []);

  // Re-ping ao trocar estado de USB e periodicamente a 10s. NAO depende
  // mais de connectionMode (auto-detect atualiza ele aqui dentro).
  useEffect(() => {
    pingFailCountRef.current = 0;  // reset ao trocar contexto
    pingHttp();
    const id = setInterval(pingHttp, 10000);
    return () => clearInterval(id);
  }, [pingHttp, usbState]);

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
      if (typeof config.led_preview_live_mode !== 'undefined') setLedPreviewLive(Number(config.led_preview_live_mode) === 1);
      if (typeof config.gig_view !== 'undefined') {
        const g = Number(config.gig_view);
        setGigView(g === 1 ? 'preset' : g === 2 ? 'live' : 'padrao');
      }
      if (typeof config.live_layout !== 'undefined') {
        const v = Number(config.live_layout);
        setLiveLayout((v === 2 || v === 3) ? v : 1);
      }
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
    if (typeof config.led_preview_live_mode !== 'undefined') setLedPreviewLive(Number(config.led_preview_live_mode) === 1);
    if (typeof config.gig_view !== 'undefined') {
      const g = Number(config.gig_view);
      setGigView(g === 1 ? 'preset' : g === 2 ? 'live' : 'padrao');
    }
    if (typeof config.live_layout !== 'undefined') {
      const v = Number(config.live_layout);
      setLiveLayout((v === 2 || v === 3) ? v : 1);
    }
    // deviceState (WiFi) e atualizado por pingHttp, independente do transport
    // de edicao.
  }, [loadGlobalConfig]);

  // ── BANK ── (usa apiCall — roteia HTTP ou USB automaticamente)
  const loadBankCurrent = async () => {
    try {
      const bank = await apiCall('GET', '/bank/current');
      const li = Number(bank.bank_letter_index) || 0;
      const pn = Number(bank.preset_number) || 1;
      setBankLetterIndex(li);
      setPresetNumber(pn);
      currentTagRef.current = `${String.fromCharCode(65 + li)}${pn}`;
      setBankData(bank.data || '');
      setBankDisplayName(bank.meta?.name || '');
      if (bank.meta) setCurrentSavedMeta(metaFromApi(bank.meta));
      // Sincroniza o modo com o hardware — cobre o botao fisico LIVE.
      // Com sync OFF, ignora — o toggle do webApp fica desacoplado.
      if (typeof bank.switch_mode !== 'undefined' && modeSyncRef.current) {
        setSwitchMode(Number(bank.switch_mode) === 1 ? 'live' : 'preset');
      }
      const newTag = `${String.fromCharCode(65 + li)}${pn}`;
      const newLiveOn = Array.isArray(bank.sw_live_on)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on[i]) === 1)
        : null;
      const newLiveOn2 = Array.isArray(bank.sw_live_on2)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on2[i]) === 1)
        : null;
      const newLiveOn3 = Array.isArray(bank.sw_live_on3)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on3[i]) === 1)
        : null;
      const newMomentaryCount = Array.isArray(bank.sw_momentary_count)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_momentary_count[i]) || 0)
        : null;
      const newSingleCount = Array.isArray(bank.sw_single_count)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_single_count[i]) || 0)
        : null;
      const newLastSingle = (typeof bank.last_single_sw !== 'undefined')
        ? Number(bank.last_single_sw)
        : null;
      const newTapCount = Array.isArray(bank.sw_tap_count)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_tap_count[i]) || 0)
        : null;
      const newSpinState = Array.isArray(bank.sw_spin_state)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_spin_state[i]))
        : null;
      // Detecta presses em LIVE MODE: flip em swLiveOn / swLiveOn2 /
      // swLiveOn3 entre polls vira um evento pro MONITOR. Delta no
      // sw_momentary_count loga um evento por pulse do modo MOMENTARY
      // (que nao mexe em liveOn, entao precisa do contador). So conta
      // dentro do mesmo preset (troca de preset reseta o log e nao gera
      // evento por initial-MIDI).
      if (switchModeRef.current === 'live' &&
          liveEventsTagRef.current === newTag) {
        const prevA = swLiveOnRef.current;
        const prevB = swLiveOn2Ref.current;
        const prevC = swLiveOn3Ref.current;
        const prevM = swMomentaryCountRef.current;
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${
            String(now.getMinutes()).padStart(2, '0')}:${
            String(now.getSeconds()).padStart(2, '0')}`;
        const newEvents = [];
        for (let i = 0; i < 6; i++) {
          if (newLiveOn && newLiveOn[i] !== prevA[i]) {
            const ev = buildLivePressEvent(i + 1, 0, newLiveOn[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
          if (newLiveOn2 && newLiveOn2[i] !== prevB[i]) {
            const ev = buildLivePressEvent(i + 1, 1, newLiveOn2[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
          if (newLiveOn3 && newLiveOn3[i] !== prevC[i]) {
            const ev = buildLivePressEvent(i + 1, 2, newLiveOn3[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
          if (newMomentaryCount && newMomentaryCount[i] !== prevM[i]) {
            // Delta com wrap (uint16 no firmware). Cap em 5 pra evitar
            // spam caso o user aperte muito entre dois polls.
            const delta = (newMomentaryCount[i] - prevM[i] + 65536) % 65536;
            const n = Math.min(delta, 5);
            for (let k = 0; k < n; k++) {
              const ev = buildLivePressEvent(i + 1, 0, true,
                savedSwModesRef.current, savedSwParamsRef.current);
              if (ev) newEvents.push({ ...ev, time });
            }
          }
          if (newSingleCount && newSingleCount[i] !== swSingleCountRef.current[i]) {
            const prevS = swSingleCountRef.current[i];
            const delta = (newSingleCount[i] - prevS + 65536) % 65536;
            const n = Math.min(delta, 5);
            for (let k = 0; k < n; k++) {
              const ev = buildLivePressEvent(i + 1, 0, true,
                savedSwModesRef.current, savedSwParamsRef.current);
              if (ev) newEvents.push({ ...ev, time });
            }
          }
          if (newTapCount && newTapCount[i] !== swTapCountRef.current[i]) {
            const prevT = swTapCountRef.current[i];
            const delta = (newTapCount[i] - prevT + 65536) % 65536;
            const n = Math.min(delta, 8);  // taps podem ser frequentes
            for (let k = 0; k < n; k++) {
              const ev = buildLivePressEvent(i + 1, 0, true,
                savedSwModesRef.current, savedSwParamsRef.current);
              if (ev) newEvents.push({ ...ev, time });
            }
          }
          if (newSpinState && newSpinState[i] !== swSpinStateRef.current[i] &&
              newSpinState[i] >= 0) {
            // SPIN — passa o stateIndex como nowOn (hack pra reaproveitar
            // a assinatura do builder).
            const ev = buildLivePressEvent(i + 1, 0, newSpinState[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
        }
        if (newEvents.length) {
          // Substitui — o monitor mostra so o disparo MAIS RECENTE.
          // (Mantemos `newEvents` como array porque um press pode
          // disparar simultaneamente em mais de uma secao.)
          setLiveEvents(newEvents);
        }
      }
      // Reset do log na troca de preset (e captura do primeiro tag visto).
      if (liveEventsTagRef.current !== newTag) {
        if (liveEventsTagRef.current) setLiveEvents([]);
        liveEventsTagRef.current = newTag;
      }
      if (newLiveOn) {
        setSwLiveOn(newLiveOn);
        swLiveOnRef.current = newLiveOn;  // sincronia imediata pra o proximo poll
      }
      if (newLiveOn2) {
        setSwLiveOn2(newLiveOn2);
        swLiveOn2Ref.current = newLiveOn2;
      }
      if (newLiveOn3) {
        setSwLiveOn3(newLiveOn3);
        swLiveOn3Ref.current = newLiveOn3;
      }
      if (newMomentaryCount) {
        swMomentaryCountRef.current = newMomentaryCount;
      }
      if (newSingleCount) {
        swSingleCountRef.current = newSingleCount;
      }
      if (newTapCount) {
        swTapCountRef.current = newTapCount;
      }
      if (newSpinState) {
        swSpinStateRef.current = newSpinState;
        // So dispara re-render se mudou — Array.from chega como nova ref
        // todo poll, comparar item-a-item evita renders inuteis.
        setSwSpinState((cur) => {
          for (let i = 0; i < 6; i++) {
            if (cur[i] !== newSpinState[i]) return newSpinState;
          }
          return cur;
        });
      }
      if (newLastSingle !== null) {
        setLastSingleSw((cur) => (cur === newLastSingle ? cur : newLastSingle));
      }
      // sw_modes do preset atual. Pulado se ha edicao pendente (dirty),
      // senao o poll sobrescreveria o que o usuario ainda nao salvou.
      if (typeof bank.meta?.sw_modes !== 'undefined' &&
          !swModesDirtyRef.current) {
        const loaded = parseSwModesStr(bank.meta.sw_modes);
        setSwModes(loaded);
        setSavedSwModes(loaded);
      }
      // sw_display (icone + cores) — mesmo padrao do sw_modes. Respeita
      // edicao pendente pra o poll nao sobrescrever.
      if (bank.meta && !swDisplayDirtyRef.current) {
        const loadedDisp = parseSwDisplayFromMeta(bank.meta);
        setSwDisplay(loadedDisp);
        setSavedSwDisplay(loadedDisp);
      }
      // Params de SW: re-busca quando o preset muda (cobre troca pelo
      // hardware), respeitando edicao pendente. /sw/params e um GET
      // separado — so chamado na troca de preset, nao a cada poll.
      if (swParamsTagRef.current !== currentTagRef.current &&
          !swParamsDirtyRef.current) {
        loadSwParams(currentTagRef.current);
      }
    } catch {/* preview */}
  };
  useEffect(() => { if (page === 'preset_config') loadBankCurrent(); }, [page, usbState]);

  // Poll leve: GET /bank/live (payload ~280B vs 3-6KB de /bank/current).
  // Atualiza so campos volateis (estado de SW, contadores, spin_state) +
  // detecta troca de preset feita no hardware. Se o tag mudou, dispara
  // 1 fetch de /bank/current pra refrescar meta+data+sw_params. Reduz a
  // banda do poll em ~95% e o tempo de snprintf no firmware.
  const loadBankLive = async () => {
    try {
      const bank = await apiCall('GET', '/bank/live');
      const li = Number(bank.bank_letter_index) || 0;
      const pn = Number(bank.preset_number) || 1;
      const newTag = `${String.fromCharCode(65 + li)}${pn}`;
      setBankLetterIndex(li);
      setPresetNumber(pn);
      if (typeof bank.switch_mode !== 'undefined' && modeSyncRef.current) {
        setSwitchMode(Number(bank.switch_mode) === 1 ? 'live' : 'preset');
      }

      const newLiveOn = Array.isArray(bank.sw_live_on)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on[i]) === 1)
        : null;
      const newLiveOn2 = Array.isArray(bank.sw_live_on2)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on2[i]) === 1)
        : null;
      const newLiveOn3 = Array.isArray(bank.sw_live_on3)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on3[i]) === 1)
        : null;
      const newMomentaryCount = Array.isArray(bank.sw_momentary_count)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_momentary_count[i]) || 0)
        : null;
      const newSingleCount = Array.isArray(bank.sw_single_count)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_single_count[i]) || 0)
        : null;
      const newLastSingle = (typeof bank.last_single_sw !== 'undefined')
        ? Number(bank.last_single_sw)
        : null;
      const newTapCount = Array.isArray(bank.sw_tap_count)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_tap_count[i]) || 0)
        : null;
      const newSpinState = Array.isArray(bank.sw_spin_state)
        ? Array.from({ length: 6 }, (_, i) => Number(bank.sw_spin_state[i]))
        : null;

      // Detecta presses em LIVE MODE igual loadBankCurrent. Mesma lógica
      // de eventos — duplicada aqui em vez de extraída pra manter
      // loadBankCurrent intocado (refactor incremental).
      if (switchModeRef.current === 'live' &&
          liveEventsTagRef.current === newTag) {
        const prevA = swLiveOnRef.current;
        const prevB = swLiveOn2Ref.current;
        const prevC = swLiveOn3Ref.current;
        const prevM = swMomentaryCountRef.current;
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${
            String(now.getMinutes()).padStart(2, '0')}:${
            String(now.getSeconds()).padStart(2, '0')}`;
        const newEvents = [];
        for (let i = 0; i < 6; i++) {
          if (newLiveOn && newLiveOn[i] !== prevA[i]) {
            const ev = buildLivePressEvent(i + 1, 0, newLiveOn[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
          if (newLiveOn2 && newLiveOn2[i] !== prevB[i]) {
            const ev = buildLivePressEvent(i + 1, 1, newLiveOn2[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
          if (newLiveOn3 && newLiveOn3[i] !== prevC[i]) {
            const ev = buildLivePressEvent(i + 1, 2, newLiveOn3[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
          if (newMomentaryCount && newMomentaryCount[i] !== prevM[i]) {
            const delta = (newMomentaryCount[i] - prevM[i] + 65536) % 65536;
            const n = Math.min(delta, 5);
            for (let k = 0; k < n; k++) {
              const ev = buildLivePressEvent(i + 1, 0, true,
                savedSwModesRef.current, savedSwParamsRef.current);
              if (ev) newEvents.push({ ...ev, time });
            }
          }
          if (newSingleCount && newSingleCount[i] !== swSingleCountRef.current[i]) {
            const prevS = swSingleCountRef.current[i];
            const delta = (newSingleCount[i] - prevS + 65536) % 65536;
            const n = Math.min(delta, 5);
            for (let k = 0; k < n; k++) {
              const ev = buildLivePressEvent(i + 1, 0, true,
                savedSwModesRef.current, savedSwParamsRef.current);
              if (ev) newEvents.push({ ...ev, time });
            }
          }
          if (newTapCount && newTapCount[i] !== swTapCountRef.current[i]) {
            const prevT = swTapCountRef.current[i];
            const delta = (newTapCount[i] - prevT + 65536) % 65536;
            const n = Math.min(delta, 8);
            for (let k = 0; k < n; k++) {
              const ev = buildLivePressEvent(i + 1, 0, true,
                savedSwModesRef.current, savedSwParamsRef.current);
              if (ev) newEvents.push({ ...ev, time });
            }
          }
          if (newSpinState && newSpinState[i] !== swSpinStateRef.current[i] &&
              newSpinState[i] >= 0) {
            const ev = buildLivePressEvent(i + 1, 0, newSpinState[i],
              savedSwModesRef.current, savedSwParamsRef.current);
            if (ev) newEvents.push({ ...ev, time });
          }
        }
        if (newEvents.length) setLiveEvents(newEvents);
      }
      if (liveEventsTagRef.current !== newTag) {
        if (liveEventsTagRef.current) setLiveEvents([]);
        liveEventsTagRef.current = newTag;
      }
      if (newLiveOn) {
        setSwLiveOn(newLiveOn);
        swLiveOnRef.current = newLiveOn;
      }
      if (newLiveOn2) {
        setSwLiveOn2(newLiveOn2);
        swLiveOn2Ref.current = newLiveOn2;
      }
      if (newLiveOn3) {
        setSwLiveOn3(newLiveOn3);
        swLiveOn3Ref.current = newLiveOn3;
      }
      if (newMomentaryCount) swMomentaryCountRef.current = newMomentaryCount;
      if (newSingleCount) swSingleCountRef.current = newSingleCount;
      if (newTapCount) swTapCountRef.current = newTapCount;
      if (newSpinState) {
        swSpinStateRef.current = newSpinState;
        setSwSpinState((cur) => {
          for (let i = 0; i < 6; i++) {
            if (cur[i] !== newSpinState[i]) return newSpinState;
          }
          return cur;
        });
      }
      if (newLastSingle !== null) {
        setLastSingleSw((cur) => (cur === newLastSingle ? cur : newLastSingle));
      }

      // Troca de preset detectada pelo poll (footswitch fisico) — recarrega
      // meta/data/sw_modes/sw_display/sw_params via /bank/current.
      if (currentTagRef.current !== newTag) {
        currentTagRef.current = newTag;
        loadBankCurrent();
      }
    } catch {/* preview */}
  };

  // Polling enquanto a page de preset esta ativa. Usa /bank/live (leve);
  // o /bank/current so eh chamado em troca de preset detectada. Pausa
  // quando a aba esta em background (document.hidden) — economiza
  // bateria do device e banda do WiFi.
  useEffect(() => {
    if (page !== 'preset_config') return;
    let id = null;
    const start = () => {
      if (id) return;
      loadBankLive();
      id = setInterval(() => { loadBankLive(); }, 1500);
    };
    const stop = () => {
      if (id) { clearInterval(id); id = null; }
    };
    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [page, usbState]);

  const selectBank = async (li, pn) => {
    setBankState('loading');
    try {
      const tag = `${String.fromCharCode(65 + li)}${pn}`;
      const bank = await apiCall('POST', `/bank/current?bank=${encodeURIComponent(tag)}`);
      const eli = Number(bank.bank_letter_index) || li;
      const epn = Number(bank.preset_number) || pn;
      setBankLetterIndex(eli);
      setPresetNumber(epn);
      currentTagRef.current = `${String.fromCharCode(65 + eli)}${epn}`;
      setBankData(bank.data || '');
      setBankDisplayName(bank.meta?.name || '');
      if (bank.meta) setCurrentSavedMeta(metaFromApi(bank.meta));
      if (Array.isArray(bank.sw_live_on)) {
        setSwLiveOn(Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on[i]) === 1));
      }
      if (Array.isArray(bank.sw_live_on2)) {
        setSwLiveOn2(Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on2[i]) === 1));
      }
      if (Array.isArray(bank.sw_live_on3)) {
        setSwLiveOn3(Array.from({ length: 6 }, (_, i) => Number(bank.sw_live_on3[i]) === 1));
      }
      // Reset dos contadores de momentary / single apos troca de preset
      // (firmware tambem zera em swActiveSendInitialMidi).
      if (Array.isArray(bank.sw_momentary_count)) {
        swMomentaryCountRef.current = Array.from({ length: 6 },
          (_, i) => Number(bank.sw_momentary_count[i]) || 0);
      } else {
        swMomentaryCountRef.current = [0, 0, 0, 0, 0, 0];
      }
      if (Array.isArray(bank.sw_single_count)) {
        swSingleCountRef.current = Array.from({ length: 6 },
          (_, i) => Number(bank.sw_single_count[i]) || 0);
      } else {
        swSingleCountRef.current = [0, 0, 0, 0, 0, 0];
      }
      if (Array.isArray(bank.sw_tap_count)) {
        swTapCountRef.current = Array.from({ length: 6 },
          (_, i) => Number(bank.sw_tap_count[i]) || 0);
      } else {
        swTapCountRef.current = [0, 0, 0, 0, 0, 0];
      }
      if (Array.isArray(bank.sw_spin_state)) {
        swSpinStateRef.current = Array.from({ length: 6 },
          (_, i) => Number(bank.sw_spin_state[i]));
      } else {
        swSpinStateRef.current = [-1, -1, -1, -1, -1, -1];
      }
      setSwSpinState(swSpinStateRef.current);
      if (typeof bank.last_single_sw !== 'undefined') {
        setLastSingleSw(Number(bank.last_single_sw));
      } else {
        setLastSingleSw(-1);
      }
      // Troca explicita de preset: limpa o log de presses em LIVE MODE
      // (era do preset anterior) e fixa o novo tag pro detector.
      setLiveEvents([]);
      liveEventsTagRef.current = currentTagRef.current;
      // Troca de banco e acao explicita do usuario: carrega os sw_modes
      // do novo preset como estado atual E baseline (descarta edicao nao
      // salva do preset anterior).
      const loadedSwModes = parseSwModesStr(bank.meta?.sw_modes);
      setSwModes(loadedSwModes);
      setSavedSwModes(loadedSwModes);
      // sw_display do novo preset — mesma logica, descarta edicao nao salva.
      const loadedSwDisplay = parseSwDisplayFromMeta(bank.meta || {});
      setSwDisplay(loadedSwDisplay);
      setSavedSwDisplay(loadedSwDisplay);
      // Troca explicita de preset: recarrega tambem os params de SW
      // (descarta edicao nao salva do preset anterior).
      loadSwParams(currentTagRef.current);
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

  // Alterna o modo PRESET/LIVE no hardware. Atualiza local na hora
  // (feedback instantaneo) e reconcilia com a resposta do firmware —
  // assim o poll de /bank/current nao reverte o estado por uma janela.
  // Com sync OFF, alterna so o estado local — nao posta /mode.
  const setDeviceSwitchMode = async (mode) => {
    setSwitchMode(mode);
    if (!modeSync) return;
    try {
      const resp = await apiCall('POST', `/mode?value=${mode === 'live' ? 1 : 0}`);
      if (resp && typeof resp.switch_mode !== 'undefined') {
        setSwitchMode(Number(resp.switch_mode) === 1 ? 'live' : 'preset');
      }
    } catch {/* preview/offline — mantem o estado local */}
  };

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
      body.set('led_preview_live_mode', ledPreviewLive ? '1' : '0');
      body.set('gig_view', gigView === 'preset' ? '1' : gigView === 'live' ? '2' : '0');
      body.set('live_layout',
               liveLayout === 2 ? '2' : liveLayout === 3 ? '3' : '1');
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

  // Cor dinamica do "tile ativo" — baseada no preset/banco selecionado.
  // Aplicada como CSS variable --tile-color no root .bf-screen pra que TODOS
  // os botoes/tabs com estado ativo (is-active, is-on, is-running) usem
  // automaticamente, sem cada componente precisar saber dessa logica.
  // Modo POR LETRA → cor da letra ativa.
  // Modo POR SWITCH → cor do switch correspondente ao preset ativo.
  const currentTileColor = (() => {
    const safeColor = (idx, fallback = '#ff7a1a') =>
      (LED_COLORS[idx] && LED_COLORS[idx].hex) || fallback;
    const letterIdx = (letterLedColors && letterLedColors[bankLetterIndex]) ?? 7;
    if (ledColorMode === 'numeros' && switchLedColors) {
      const swIdx = switchLedColors[presetNumber - 1];
      return safeColor(swIdx, safeColor(letterIdx));
    }
    return safeColor(letterIdx);
  })();

  return (
    <div className="phone-frame">
      <div className="bf-screen" style={{
        '--tile-color': currentTileColor,
        // Sobrescreve --accent com a cor do banco/preset ativo. Dessa forma
        // TODOS os elementos que usam var(--accent) hardcoded (botoes
        // ativos, sliders, switches, focus, etc.) acompanham a cor do tile
        // sem precisar mexer em cada CSS rule individualmente.
        '--accent': currentTileColor,
      }}>
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
            switchMode={switchMode}
            onSetSwitchMode={setDeviceSwitchMode}
            modeSync={modeSync}
            onToggleModeSync={() => setModeSync((v) => !v)}
            showMonitor={showMonitor}
            onToggleShowMonitor={() => setShowMonitor((v) => !v)}
            swModes={swModes}
            savedSwModes={savedSwModes}
            onSetSwMode={setSwMode}
            swParams={swParams}
            savedSwParams={savedSwParams}
            onSetSwParam={setSwParam}
            swLiveOn={swLiveOn}
            lastSingleSw={lastSingleSw}
            swSpinState={swSpinState}
            swDisplay={swDisplay}
            onSetSwDisplay={setSwDisplayOne}
            liveEvents={liveEvents}
            monitorEntry={monitorEntry}
            ledPreviewLive={ledPreviewLive}
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
            ledPreviewLive={ledPreviewLive} setLedPreviewLive={setLedPreviewLive}
            gigView={gigView} setGigView={setGigView}
            liveLayout={liveLayout} setLiveLayout={setLiveLayout}
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
          saveState={
            page !== 'preset_config' ? saveState
              : switchMode === 'live'
                ? (swModesStatus === 'idle' && liveDirty ? 'dirty' : swModesStatus)
                : presetSaveStatus}
          onSave={
            page !== 'preset_config' ? saveGlobalConfig
              : switchMode === 'live'
                ? saveLive
                : () => { const h = presetSaveRef.current; if (h && h.save) h.save(); }}
          onCopyPreset={copyCurrentPreset}
          onPastePreset={pasteIntoCurrentPreset}
          presetClipboard={presetClipboard}
          presetClipboardStatus={presetClipboardStatus}
          onCopyBank={copyCurrentBank}
          onPasteBank={pasteIntoCurrentBank}
          bankClipboard={bankClipboard}
          bankClipboardStatus={bankClipboardStatus}
        />
      </div>
      <PasteProgressModal progress={pasteProgress} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
