// PRESET LEDS - toggle between LETRAS (A-E) and NUMEROS (SW1-SW6).
// Each slot is a glowing LED-bar that opens a color palette popover.

const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

// 15 LED colors (index = firmware id). 14 = OFF (black).
const LED_COLORS = [
  { id: 0, rgb: [255, 0, 0], name: 'VERMELHO' },
  { id: 1, rgb: [0, 255, 0], name: 'VERDE' },
  { id: 2, rgb: [0, 0, 255], name: 'AZUL' },
  { id: 3, rgb: [255, 255, 0], name: 'AMARELO' },
  { id: 4, rgb: [128, 0, 128], name: 'ROXO' },
  { id: 5, rgb: [0, 255, 255], name: 'CYAN' },
  { id: 6, rgb: [255, 255, 255], name: 'BRANCO' },
  { id: 7, rgb: [255, 80, 0], name: 'LARANJA' },
  { id: 8, rgb: [255, 0, 128], name: 'MAGENTA' },
  { id: 9, rgb: [255, 20, 20], name: 'CORAL' },
  { id: 10, rgb: [0, 150, 255], name: 'AZUL CELESTE' },
  { id: 11, rgb: [180, 0, 255], name: 'VIOLETA' },
  { id: 12, rgb: [255, 100, 200], name: 'ROSA' },
  { id: 13, rgb: [50, 255, 100], name: 'MENTA' },
  { id: 14, rgb: [0, 0, 0], name: 'PRETO (OFF)' },
];

const rgbStr = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

function PresetLeds({
  mode,
  setMode,
  letterColors,
  setLetterColors,
  numberColors,
  setNumberColors,
}) {
  const letterSlots = ['A', 'B', 'C', 'D', 'E'];
  const numberSlots = ['1', '2', '3', '4', '5', '6'];

  const isLetters = mode === 'letras';
  const slots = isLetters ? letterSlots : numberSlots;
  const colors = isLetters ? letterColors : numberColors;
  const setColors = isLetters ? setLetterColors : setNumberColors;
  const labelPrefix = isLetters ? 'PRESET' : 'SW';

  const updateAt = (i, colorId) => {
    setColors((prev) => prev.map((c, idx) => (idx === i ? colorId : c)));
  };

  return (
    <div className="module">
      <div className="module-head">
        <h2>Preset LEDs</h2>
        <span className="meta">{isLetters ? 'POR LETRA A-E' : 'POR SWITCH 1-6'}</span>
      </div>

      <div className="led-mode-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={isLetters}
          className={'led-mode-btn' + (isLetters ? ' is-active' : '')}
          onClick={() => setMode('letras')}
        >LED LETRAS</button>
        <button
          type="button"
          role="tab"
          aria-selected={!isLetters}
          className={'led-mode-btn' + (!isLetters ? ' is-active' : '')}
          onClick={() => setMode('numeros')}
        >LED NUMEROS</button>
      </div>

      <div className="led-slots">
        {slots.map((s, i) => (
          <LedSlot
            key={`${mode}-${i}`}
            label={`${labelPrefix} ${s}:`}
            colorId={colors[i]}
            onChange={(id) => updateAt(i, id)}
          />
        ))}
      </div>
    </div>
  );
}

function LedSlot({ label, colorId, onChange }) {
  const [open, setOpen] = useStateP(false);
  const wrapRef = useRefP(null);
  const color = LED_COLORS.find((c) => c.id === colorId) || LED_COLORS[0];

  useEffectP(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const isOff = color.id === 14;
  const base = rgbStr(color.rgb);

  return (
    <div className="led-slot" ref={wrapRef}>
      <span className="led-slot-label">{label}</span>
      <button
        type="button"
        className={'fsw-btn' + (open ? ' is-open' : '') + (isOff ? ' is-off' : '')}
        onClick={() => setOpen((v) => !v)}
        style={{
          '--led-color': base,
          '--led-glow-rgb': isOff ? '0,0,0' : color.rgb.join(','),
        }}
        aria-label={`${label} cor ${color.name}`}
      >
        <svg className="fsw-arcs" viewBox="0 0 100 100" aria-hidden="true">
          {/* 3 equal arcs of 80° each, separated by 40° gaps. Centers at 90°, 210°, 330°. */}
          {[90, 210, 330].map((center, i) => {
            const r = 36, cx = 50, cy = 50;
            const a1 = (center - 40) * Math.PI / 180;
            const a2 = (center + 40) * Math.PI / 180;
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
            const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
            return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} />;
          })}
        </svg>
      </button>

      {open && (
        <ColorPalette
          activeId={colorId}
          onPick={(id) => { onChange(id); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ColorPalette({ activeId, onPick }) {
  return (
    <div className="led-palette" role="dialog" aria-label="Selecione a cor">
      <div className="led-palette-title">SELECIONE A COR</div>
      <div className="led-palette-grid">
        {LED_COLORS.map((c) => {
          const active = c.id === activeId;
          const isOff = c.id === 14;
          return (
            <button
              key={c.id}
              type="button"
              className={'led-swatch' + (active ? ' is-active' : '') + (isOff ? ' is-off' : '')}
              style={{ '--sw-color': rgbStr(c.rgb) }}
              onClick={() => onPick(c.id)}
              aria-label={c.name}
              title={c.name}
            >
              {isOff && <span className="led-swatch-off">OFF</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { PresetLeds, LedSlot, LED_COLORS });
