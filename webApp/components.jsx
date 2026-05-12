// Reusable building blocks. Theme-aware via CSS variables on the root.

const { useState, useEffect, useRef, useCallback } = React;

// ───────────────────────────────────────────────────────────────────────────
// Wordmark — typographic only. Renders BFMIDI lockup with a subtle index.
// ───────────────────────────────────────────────────────────────────────────
function Wordmark({ model, theme }) {
  const isLab = theme === 'lab';
  return (
    <div className="wm">
      <div className="wm-row">
        <span className="wm-tick" />
        <span className="wm-bf">BF</span>
        <span className="wm-midi">MIDI</span>
        <span className="wm-dot" />
        <span className="wm-model">{model || '—'}</span>
      </div>
      <div className="wm-sub" style={{ display: 'none' }}>
        <span>CONFIGURATION INTERFACE</span>
        <span className="wm-sub-r"></span>
      </div>
    </div>);

}

// ───────────────────────────────────────────────────────────────────────────
// Knob — draggable rotary control. Vertical drag to change.
// ───────────────────────────────────────────────────────────────────────────
function Knob({ value, onChange, min = 0, max = 100, label, unit = '%', size = 220 }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ y: 0, v: 0 });

  const handleStart = (clientY) => {
    startRef.current = { y: clientY, v: value };
    setDragging(true);
  };
  const handleMove = useCallback((clientY) => {
    if (!dragging) return;
    const dy = startRef.current.y - clientY;
    const range = max - min;
    const next = Math.max(min, Math.min(max, startRef.current.v + dy / 180 * range));
    onChange(Math.round(next));
  }, [dragging, max, min, onChange]);
  const handleEnd = () => setDragging(false);

  useEffect(() => {
    if (!dragging) return;
    const mm = (e) => handleMove(e.clientY);
    const tm = (e) => handleMove(e.touches[0].clientY);
    const up = () => handleEnd();
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
  }, [dragging, handleMove]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const wheel = (e) => {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      onChange(Math.max(min, Math.min(max, value + (e.deltaY < 0 ? step : -step))));
    };

    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [max, min, onChange, value]);

  const pct = (value - min) / (max - min);
  // Sweep from -135° to +135° (270° range)
  const angle = -135 + pct * 270;

  return (
    <div className="knob-wrap" style={{ width: size }}>
      <div
        ref={ref}
        className={'knob' + (dragging ? ' is-dragging' : '')}
        style={{ width: size, height: size }}
        onMouseDown={(e) => {e.preventDefault();handleStart(e.clientY);}}
        onTouchStart={(e) => handleStart(e.touches[0].clientY)}>
        
        {/* Arc track + value arc as conic gradient */}
        <svg viewBox="0 0 100 100" className="knob-arc">
          <defs>
            <filter id="kglow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>
          {/* track */}
          <path
            d={describeArc(50, 50, 44, -135, 135)}
            stroke="var(--line)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round" />
          
          {/* tick marks */}
          {Array.from({ length: 21 }).map((_, i) => {
            const a = -135 + i / 20 * 270;
            const r1 = 46,r2 = i % 5 === 0 ? 49 : 47.5;
            const rad = (a - 90) * Math.PI / 180;
            return (
              <line
                key={i}
                x1={50 + Math.cos(rad) * r1}
                y1={50 + Math.sin(rad) * r1}
                x2={50 + Math.cos(rad) * r2}
                y2={50 + Math.sin(rad) * r2}
                stroke="var(--text-faint)"
                strokeWidth={i % 5 === 0 ? 0.6 : 0.3} />);


          })}
          {/* value arc */}
          <path
            d={describeArc(50, 50, 44, -135, angle)}
            stroke="var(--accent)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            filter="url(#kglow)" />
          
        </svg>

        {/* The dial itself */}
        <div className="knob-dial">
          <div className="knob-dial-inner" style={{ transform: `rotate(${angle}deg)` }}>
            <span className="knob-indicator" />
          </div>
          <div className="knob-cap">
            <div className="knob-cap-readout">
              <div className="knob-value">{value}</div>
              <div className="knob-unit">{unit}</div>
            </div>
          </div>
        </div>
      </div>
      {label && <div className="knob-label">{label}</div>}
    </div>);

}

function polarToCartesian(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

// ───────────────────────────────────────────────────────────────────────────
// List-style model selector — radio rows. (Diagrama de preview removido;
// será reintroduzido em outro momento.)
// ───────────────────────────────────────────────────────────────────────────
function ModelSelector({ value, onChange, options }) {
  // Agrupa por tag (BFMIDI-1 / BFMIDI-2 / BFMIDI-3) preservando a ordem
  // de aparição em options.
  const groups = [];
  const indexByTag = new Map();
  options.forEach((opt) => {
    const tag = opt.tag || 'OUTROS';
    let idx = indexByTag.get(tag);
    if (idx === undefined) {
      idx = groups.length;
      indexByTag.set(tag, idx);
      groups.push({ tag, items: [] });
    }
    groups[idx].items.push(opt);
  });

  // Aba inicial: a família da placa selecionada (ou a primeira família).
  const selectedTag = (options.find((o) => o.id === value) || {}).tag;
  const initialTag = selectedTag || (groups[0] && groups[0].tag) || '';
  const [activeTag, setActiveTag] = useState(initialTag);

  // Se a seleção mudar de família por outro caminho, sincroniza a aba.
  useEffect(() => {
    if (selectedTag && selectedTag !== activeTag) setActiveTag(selectedTag);
  }, [selectedTag]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeGroup = groups.find((g) => g.tag === activeTag) || groups[0];

  return (
    <div className="model-list-wrap">
      <div className="model-tabs" role="tablist">
        {groups.map((g) => {
          const isActive = g.tag === activeTag;
          const containsSelection = g.items.some((it) => it.id === value);
          return (
            <button
              key={g.tag}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                'model-tab' +
                (isActive ? ' is-active' : '') +
                (containsSelection ? ' has-selection' : '')
              }
              onClick={() => setActiveTag(g.tag)}>
              {g.tag}
              {containsSelection && <span className="model-tab-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="model-tab-panel" role="tabpanel">
        <ul className="model-list" role="radiogroup">
          {(activeGroup ? activeGroup.items : []).map((opt) => {
            const active = value === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={'model-row' + (active ? ' is-active' : '')}
                  onClick={() => onChange(opt.id)}>

                  <span className={'model-radio' + (active ? ' on' : '')} aria-hidden="true" />
                  <span className="model-row-text">
                    <span className="model-row-name">{opt.name}</span>
                  </span>
                  <span className={'model-led' + (active ? ' on' : '')} aria-hidden="true" />
                </button>
              </li>);

          })}
        </ul>
      </div>
    </div>);

}

// ───────────────────────────────────────────────────────────────────────────
// Fader — vertical sliding fader (mixer-style). Drag the cap or click track.
// ───────────────────────────────────────────────────────────────────────────
function Fader({ value, onChange, min = 0, max = 100, label, unit = '%', height = 260 }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Drag/wheel detectam o eixo a partir do tamanho atual do track. Em
  // viewport estreita (<=720px) o CSS gira o slider para horizontal.
  const updateFromClient = useCallback((clientX, clientY) => {
    const node = trackRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    let t;
    if (rect.width > rect.height) {
      // horizontal: esquerda=min, direita=max
      t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    } else {
      // vertical: topo=max, base=min
      t = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    }
    const next = min + t * (max - min);
    onChange(Math.round(next));
  }, [min, max, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const mm = (e) => { e.preventDefault(); updateFromClient(e.clientX, e.clientY); };
    const tm = (e) => { e.preventDefault(); updateFromClient(e.touches[0].clientX, e.touches[0].clientY); };
    const up = () => setDragging(false);
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
  }, [dragging, updateFromClient]);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const wheel = (e) => {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      onChange(Math.max(min, Math.min(max, value + (e.deltaY < 0 ? step : -step))));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [max, min, onChange, value]);

  const pct = (value - min) / (max - min);
  const ticks = 21;

  return (
    <div
      className="fader-wrap"
      style={{ '--fader-h': `${height}px`, '--fader-pct': pct }}>
      <div className="fader-stage">
        <div className="fader-ticks" aria-hidden="true">
          {Array.from({ length: ticks }).map((_, i) => (
            <div key={i} className={'fader-tick' + (i % 5 === 0 ? ' is-major' : '')}>
              {i % 5 === 0 && <span className="fader-tick-label">{100 - i * 5}</span>}
            </div>
          ))}
        </div>

        <div
          ref={trackRef}
          className={'fader-track' + (dragging ? ' is-dragging' : '')}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label || 'fader'}
          tabIndex={0}
          onMouseDown={(e) => { e.preventDefault(); setDragging(true); updateFromClient(e.clientX, e.clientY); }}
          onTouchStart={(e) => { setDragging(true); updateFromClient(e.touches[0].clientX, e.touches[0].clientY); }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 5 : 1;
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
              e.preventDefault();
              onChange(Math.min(max, value + step));
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
              e.preventDefault();
              onChange(Math.max(min, value - step));
            }
          }}
        >
          <div className="fader-rail" />
          <div className="fader-fill" />
          <div className="fader-cap">
            <span className="fader-cap-line" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LedPreview — three-arc footswitch glyph used as the brightness preview.
//   on=false  → all arcs dark
//   on=true & which='bottom' → only the BOTTOM arc lit (top two stay dark)
//   on=true & which='all'    → all three arcs lit
//   intensity → 0–1 multiplier for glow strength
// ───────────────────────────────────────────────────────────────────────────
function LedPreview({ on, intensity = 1, color = '#3da5ff', size = 200, which = 'bottom' }) {
  const arcs = [
    { center: 90,  lit: true },
    { center: 210, lit: which === 'all' },
    { center: 330, lit: which === 'all' },
  ];
  const r = 36, cx = 50, cy = 50;
  const op = Math.max(0.06, intensity);

  return (
    <div
      className={'led-preview' + (on ? ' is-on' : ' is-off')}
      style={{
        width: size,
        height: size,
        '--lp-color': color,
        '--lp-glow': `${Math.round(8 + op * 26)}px`,
        '--lp-opacity': op,
      }}
      aria-label={on ? 'LED preview on' : 'LED preview off'}
    >
      <svg viewBox="0 0 100 100" className="led-preview-svg" aria-hidden="true">
        {arcs.map((a, i) => {
          const a1 = (a.center - 40) * Math.PI / 180;
          const a2 = (a.center + 40) * Math.PI / 180;
          const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
          const litNow = on && a.lit;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              className={litNow ? 'led-arc is-lit' : 'led-arc is-dark'}
            />
          );
        })}
      </svg>
    </div>
  );
}

Object.assign(window, { Wordmark, Knob, Fader, LedPreview, ModelSelector });