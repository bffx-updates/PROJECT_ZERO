/* BFMIDI · Monitor USB — Web MIDI API + render no estilo do live monitor
   do webApp. Roda direto no browser (Chrome/Edge/Opera). Para usar:
     1. Abrir index.html (file:// funciona; HTTPS/localhost ideal)
     2. Aceitar o pedido de permissao MIDI
     3. Escolher a entrada USB e tocar — mensagens aparecem em tempo real.
*/

const $ = (sel) => document.querySelector(sel);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F',
                    'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteName(num) {
  const n = num | 0;
  return NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);
}
function hex2(n) { return (n & 0xff).toString(16).padStart(2, '0').toUpperCase(); }
function rawBytes(data) {
  return Array.from(data).map(hex2).join(' ');
}
function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + '.' +
         String(d.getMilliseconds()).padStart(3, '0');
}

// Decodifica um Uint8Array MIDI num objeto estruturado pra render.
function decode(data) {
  if (!data || data.length === 0) return null;
  const b0 = data[0];

  // Realtime/System (sem canal)
  if (b0 >= 0xf0) {
    if (b0 === 0xf0) {
      return { kind: 'sys', label: 'SYSEX',
               desc: `${data.length} bytes`, raw: rawBytes(data), key: 'sys:f0' };
    }
    const sysLabels = {
      0xf1: 'MTC', 0xf2: 'SPP', 0xf3: 'SSEL', 0xf6: 'TUNE',
      0xf7: 'EOX', 0xf8: 'CLOCK', 0xfa: 'START', 0xfb: 'CONT',
      0xfc: 'STOP', 0xfe: 'A-SENS', 0xff: 'RESET',
    };
    const lbl = sysLabels[b0] || 'SYS';
    return { kind: 'sys', label: lbl, desc: '',
             raw: rawBytes(data), key: 'sys:' + b0 };
  }

  const status = b0 & 0xf0;
  const ch = (b0 & 0x0f) + 1;
  const d1 = data[1] || 0;
  const d2 = data[2] || 0;

  if (status === 0x80 || (status === 0x90 && d2 === 0)) {
    return { kind: 'note-off', label: 'NOTE-', ch,
             num: d1, val: d2, noteName: noteName(d1),
             raw: rawBytes(data), key: `noff:${ch}:${d1}` };
  }
  if (status === 0x90) {
    return { kind: 'note', label: 'NOTE+', ch,
             num: d1, val: d2, noteName: noteName(d1),
             raw: rawBytes(data), key: `non:${ch}:${d1}` };
  }
  if (status === 0xa0) {
    return { kind: 'at', label: 'POLY-AT', ch,
             num: d1, val: d2, noteName: noteName(d1),
             raw: rawBytes(data), key: `at:${ch}:${d1}` };
  }
  if (status === 0xb0) {
    return { kind: 'cc', label: 'CC', ch,
             num: d1, val: d2,
             raw: rawBytes(data), key: `cc:${ch}:${d1}` };
  }
  if (status === 0xc0) {
    return { kind: 'pc', label: 'PC', ch,
             pc: d1, raw: rawBytes(data), key: `pc:${ch}` };
  }
  if (status === 0xd0) {
    return { kind: 'cp', label: 'CH-PRESS', ch,
             val: d1, raw: rawBytes(data), key: `cp:${ch}` };
  }
  if (status === 0xe0) {
    const value = (d2 << 7) | d1;
    return { kind: 'pb', label: 'PITCH-B', ch,
             val: value - 8192, raw: rawBytes(data), key: `pb:${ch}` };
  }
  return { kind: 'sys', label: 'RAW', desc: '', raw: rawBytes(data),
           key: 'raw:' + b0 };
}

// ─── Estado ───────────────────────────────────────────────────────
const state = {
  midi: null,
  currentInputId: null,
  inputs: [],
  paused: false,
  events: [],        // [{time, decoded, count}]
  opt: {
    clock: false,
    active: false,
    collapse: true,
    autoscroll: true,
    autoclear: false,
    max: 300,
  },
  lastMsgTs: 0,
};

const eventsEl = $('#monitor-events');
const statusEl = $('#monitor-status');
const selectEl = $('#midi-input');
const btnPause = $('#btn-pause');
const btnClear = $('#btn-clear');
const btnCopy  = $('#btn-copy');

// ─── Render ───────────────────────────────────────────────────────
function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'bf-monitor-status' + (cls ? ' ' + cls : '');
}

function msgRow(d) {
  const row = document.createElement('div');
  row.className = 'bf-monitor-ev-msg';
  const typeCls = {
    cc: 'is-cc', pc: 'is-pc', note: 'is-note', 'note-off': 'is-note-off',
    pb: 'is-pb', cp: 'is-cp', at: 'is-at', sys: 'is-sys',
  }[d.kind] || 'is-sys';
  const t = document.createElement('span');
  t.className = 'bf-msg-type ' + typeCls;
  t.textContent = d.label;
  row.appendChild(t);

  const add = (cls, txt) => {
    const s = document.createElement('span');
    s.className = cls; s.textContent = txt; row.appendChild(s);
  };

  if (d.kind === 'cc') {
    add('bf-msg-num', d.num);
    add('bf-msg-eq', '=');
    add('bf-msg-val', d.val);
    add('bf-msg-sep', '·');
    add('bf-msg-ch', 'CH ' + d.ch);
  } else if (d.kind === 'pc') {
    add('bf-msg-num', d.pc);
    add('bf-msg-sep', '·');
    add('bf-msg-ch', 'CH ' + d.ch);
  } else if (d.kind === 'note' || d.kind === 'note-off' || d.kind === 'at') {
    add('bf-msg-num', `${d.noteName} (${d.num})`);
    add('bf-msg-eq', '=');
    add('bf-msg-val', d.val);
    add('bf-msg-sep', '·');
    add('bf-msg-ch', 'CH ' + d.ch);
  } else if (d.kind === 'pb') {
    add('bf-msg-val', (d.val >= 0 ? '+' : '') + d.val);
    add('bf-msg-sep', '·');
    add('bf-msg-ch', 'CH ' + d.ch);
  } else if (d.kind === 'cp') {
    add('bf-msg-val', d.val);
    add('bf-msg-sep', '·');
    add('bf-msg-ch', 'CH ' + d.ch);
  } else {
    if (d.desc) add('bf-msg-val', d.desc);
  }
  add('bf-msg-raw', d.raw);
  return row;
}

function evCard(ev) {
  const card = document.createElement('div');
  card.className = 'bf-monitor-ev';
  card.dataset.key = ev.decoded.key;

  const row = msgRow(ev.decoded);
  const count = document.createElement('span');
  count.className = 'bf-monitor-ev-count';
  count.textContent = '×' + ev.count;
  count.style.display = ev.count > 1 ? '' : 'none';
  row.appendChild(count);
  card.appendChild(row);
  return card;
}

function renderEmpty() {
  eventsEl.innerHTML = '';
  const e = document.createElement('div');
  e.className = 'bf-monitor-event-empty';
  e.textContent = state.currentInputId
    ? '(sem mensagens — toque algo no dispositivo)'
    : '(selecione uma entrada MIDI USB acima)';
  eventsEl.appendChild(e);
}

function appendEvent(decoded) {
  if (!decoded) return;
  if (!state.opt.clock  && decoded.key === 'sys:248') return;  // 0xF8
  if (!state.opt.active && decoded.key === 'sys:254') return;  // 0xFE

  // Auto-clear: se passou mais de 1s sem MIDI, limpa antes de mostrar
  // a proxima — usa o timestamp da ULTIMA mensagem nao-filtrada.
  const now = performance.now();
  if (state.opt.autoclear && state.lastMsgTs > 0 &&
      (now - state.lastMsgTs) > 1000 && state.events.length > 0) {
    state.events = [];
    eventsEl.innerHTML = '';
  }
  state.lastMsgTs = now;

  // Colapsa: se o ultimo evento tem a mesma key + value (val/num iguais),
  // incrementa count em vez de criar um card novo.
  const last = state.events[state.events.length - 1];
  const sameAsLast = state.opt.collapse && last &&
    last.decoded.key === decoded.key &&
    last.decoded.val === decoded.val &&
    last.decoded.num === decoded.num &&
    last.decoded.pc === decoded.pc;
  if (sameAsLast) {
    last.count++;
    const card = eventsEl.lastElementChild;
    if (card && card.classList.contains('bf-monitor-ev')) {
      const cnt = card.querySelector('.bf-monitor-ev-count');
      if (cnt) {
        cnt.textContent = '×' + last.count;
        cnt.style.display = '';
      }
    }
  } else {
    const ev = { time: nowTime(), decoded, count: 1 };
    state.events.push(ev);
    // Remove o empty placeholder se ainda estiver la
    const empty = eventsEl.querySelector('.bf-monitor-event-empty');
    if (empty) empty.remove();
    eventsEl.appendChild(evCard(ev));

    // Cap em opt.max — remove os mais antigos.
    while (state.events.length > state.opt.max) {
      state.events.shift();
      if (eventsEl.firstElementChild) eventsEl.firstElementChild.remove();
    }
  }
  if (state.opt.autoscroll) {
    eventsEl.scrollTop = eventsEl.scrollHeight;
  }
}

// ─── MIDI ─────────────────────────────────────────────────────────
function refreshInputs() {
  if (!state.midi) return;
  const prev = state.currentInputId;
  state.inputs = Array.from(state.midi.inputs.values());
  selectEl.innerHTML = '';
  if (state.inputs.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— nenhuma entrada MIDI USB conectada —';
    selectEl.appendChild(opt);
    state.currentInputId = null;
    setStatus('sem entrada', '');
    return;
  }
  state.inputs.forEach((inp) => {
    const opt = document.createElement('option');
    opt.value = inp.id;
    opt.textContent = `${inp.name || inp.id}${inp.manufacturer ? ' · ' + inp.manufacturer : ''}`;
    selectEl.appendChild(opt);
  });
  // Mantem selecao se ainda existir; senao pega a primeira.
  const keep = state.inputs.find((i) => i.id === prev);
  selectInput((keep ? keep.id : state.inputs[0].id));
}

function selectInput(id) {
  if (!state.midi) return;
  // Desconecta todos primeiro
  state.midi.inputs.forEach((inp) => { inp.onmidimessage = null; });
  state.currentInputId = id || null;
  selectEl.value = id || '';
  if (!id) { setStatus('sem entrada', ''); return; }
  const inp = state.midi.inputs.get(id);
  if (!inp) { setStatus('entrada nao encontrada', 'is-error'); return; }
  inp.onmidimessage = onMidi;
  setStatus('conectado · ' + (inp.name || id), state.paused ? 'is-paused' : 'is-on');
}

function onMidi(ev) {
  if (state.paused) return;
  const decoded = decode(ev.data);
  appendEvent(decoded);
}

async function start() {
  if (!navigator.requestMIDIAccess) {
    setStatus('Web MIDI nao suportado neste browser', 'is-error');
    const opt = selectEl.querySelector('option');
    if (opt) opt.textContent = '— browser sem Web MIDI API —';
    return;
  }
  try {
    state.midi = await navigator.requestMIDIAccess({ sysex: false });
    state.midi.onstatechange = () => refreshInputs();
    refreshInputs();
  } catch (err) {
    setStatus('permissao MIDI negada', 'is-error');
    const opt = selectEl.querySelector('option');
    if (opt) opt.textContent = '— acesso MIDI negado —';
    console.error(err);
  }
}

// ─── Eventos UI ───────────────────────────────────────────────────
selectEl.addEventListener('change', () => selectInput(selectEl.value));

btnPause.addEventListener('click', () => {
  state.paused = !state.paused;
  btnPause.textContent = state.paused ? 'RETOMAR' : 'PAUSAR';
  btnPause.classList.toggle('is-active', state.paused);
  if (state.currentInputId) {
    const inp = state.midi.inputs.get(state.currentInputId);
    setStatus(
      (state.paused ? 'pausado · ' : 'conectado · ') + (inp ? inp.name : ''),
      state.paused ? 'is-paused' : 'is-on');
  }
});

btnClear.addEventListener('click', () => {
  state.events = [];
  renderEmpty();
});

btnCopy.addEventListener('click', async () => {
  if (state.events.length === 0) return;
  const lines = state.events.map((ev) => {
    const d = ev.decoded;
    const tail = (ev.count > 1 ? ` ×${ev.count}` : '');
    let body;
    if (d.kind === 'cc') body = `CC ${d.num} = ${d.val} · CH ${d.ch}`;
    else if (d.kind === 'pc') body = `PC ${d.pc} · CH ${d.ch}`;
    else if (d.kind === 'note' || d.kind === 'note-off' || d.kind === 'at') {
      body = `${d.label} ${d.noteName} (${d.num}) = ${d.val} · CH ${d.ch}`;
    } else if (d.kind === 'pb') {
      body = `PB ${d.val >= 0 ? '+' : ''}${d.val} · CH ${d.ch}`;
    } else if (d.kind === 'cp') {
      body = `CH-PRESS ${d.val} · CH ${d.ch}`;
    } else {
      body = `${d.label} ${d.desc || ''} [${d.raw}]`.trim();
    }
    return `${body}${tail}`;
  });
  const txt = lines.join('\n');
  try {
    await navigator.clipboard.writeText(txt);
    const orig = btnCopy.textContent;
    btnCopy.textContent = 'COPIADO';
    btnCopy.classList.add('is-active');
    setTimeout(() => {
      btnCopy.textContent = orig;
      btnCopy.classList.remove('is-active');
    }, 1400);
  } catch (e) { console.error(e); }
});

// Toggles do rodape
const bindToggle = (id, key) => {
  const el = $(id);
  el.checked = state.opt[key];
  el.addEventListener('change', () => { state.opt[key] = el.checked; });
};
bindToggle('#opt-clock', 'clock');
bindToggle('#opt-active', 'active');
bindToggle('#opt-collapse', 'collapse');
bindToggle('#opt-autoscroll', 'autoscroll');
bindToggle('#opt-autoclear', 'autoclear');
const maxEl = $('#opt-max');
maxEl.value = state.opt.max;
maxEl.addEventListener('change', () => {
  const v = Math.max(20, Math.min(2000, Number(maxEl.value) || 300));
  state.opt.max = v;
  maxEl.value = v;
});

renderEmpty();
start();
