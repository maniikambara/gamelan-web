/**
 * main.js — Gamelan Bali Synthesizer
 * Orchestrates UI, instrument panels, settings, recording.
 */

// ─── State ───────────────────────────────────────────────────────────────────
const State = {
  instrument: 'gangsa',
  params: {
    gangsa:  { resonance: 0.5, gain: 0.8, ombak: 6, release_ms: 2000 },
    kendang: { resonance: 0.4, gain: 0.8, depth: 0.6, dryness: 0.7, release_ms: 160 },
    suling:  { resonance: 0.4, gain: 0.8, breath: 22, attack_ms: 90, release_ms: 600 },
  },
  recording: false,
  recStartTime: 0,
  recTimer: null,
  lastNote: null,
  lastWasSample: false,
  // Per-instrument last hit highlights
  highlight: { gangsa: null, kendang_muka: null, kendang_belakang: null, suling: null },
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildInstrumentNav();
  switchInstrument('gangsa');
  buildSettings();
  initRecordingUI();
  initSampleUpload();
});

// ─── Instrument Navigation ────────────────────────────────────────────────────
function buildInstrumentNav() {
  const nav = $('#inst-nav');
  Object.values(INSTRUMENTS).forEach(inst => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.inst = inst.key;
    btn.innerHTML = `
      <span class="nav-btn-name">${inst.label}</span>
      <span class="nav-btn-desc">${inst.notes.length} ${inst.key === 'kendang' ? 'suara' : 'nada'}</span>
    `;
    btn.addEventListener('click', () => switchInstrument(inst.key));
    nav.appendChild(btn);
  });
}

function switchInstrument(key) {
  State.instrument = key;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.inst === key));
  renderInstrumentPanel(key);
  updateNoteStatusList(key);
  // Update settings panel visibility
  $$('.settings-group').forEach(g => {
    g.classList.toggle('hidden', g.dataset.inst !== key);
  });
  // Update accent color
  const inst = INSTRUMENTS[key];
  document.documentElement.style.setProperty('--accent', inst.color);
  document.documentElement.style.setProperty('--accent-dim', inst.colorDim);

  // Update info card
  const INFO_TEXT = {
    gangsa:  '10 bilah logam dalam bingkai ukir emas merah.<br>Nada: Ding, Dong, Deng, Deung, Dung, Dang, Daing + 3 oktaf atas.<br>Karakter: metalik, dengung panjang, efek ombak.',
    kendang: 'Drum bermembran dua muka dimainkan dengan tangan.<br>4 variasi: Tung Tengah dan Pak Pinggir per muka.<br>Karakter: serangan instan, perkusif, fondasi ritmis.',
    suling:  'Seruling bambu 6 lubang, laras pelog Bali.<br>Nada: Ding, Dong, Deng, Dung, Dang, Daing.<br>Karakter: hembusan halus, serangan lambat, melodik.',
  };
  const ib = document.getElementById('inst-info-body');
  if (ib) ib.innerHTML = INFO_TEXT[key] || '';
}

// ─── Instrument Panel Renderer ────────────────────────────────────────────────
function renderInstrumentPanel(key) {
  const container = $('#instrument-panel');
  container.innerHTML = '';

  const inst = INSTRUMENTS[key];

  const title = document.createElement('div');
  title.className = 'panel-header';
  title.innerHTML = `
    <h2 class="panel-title" style="color:var(--accent)">${inst.label}</h2>
    <p class="panel-desc">${inst.description}</p>
  `;
  container.appendChild(title);

  if (key === 'gangsa') renderGangsa(container, inst);
  else if (key === 'kendang') renderKendang(container, inst);
  else if (key === 'suling') renderSuling(container, inst);
}

// ─── GANGSA Panel ─────────────────────────────────────────────────────────────
function renderGangsa(container, inst) {
  const wrap = document.createElement('div');
  wrap.className = 'img-wrap gangsa-wrap';

  const img = document.createElement('img');
  img.src = inst.image;
  img.className = 'instrument-img';
  img.draggable = false;
  img.alt = 'Gangsa';

  const canvas = document.createElement('canvas');
  canvas.className = 'hit-canvas';

  wrap.appendChild(img);
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  img.addEventListener('load', () => setupGangsaCanvas(canvas, img, inst));
  if (img.complete) setupGangsaCanvas(canvas, img, inst);

  const hint = document.createElement('p');
  hint.className = 'hint-text';
  hint.textContent = 'Klik pada bilah untuk memainkan nada';
  container.appendChild(hint);
}

function setupGangsaCanvas(canvas, img, inst) {
  const rect  = img.getBoundingClientRect();
  canvas.width  = img.offsetWidth;
  canvas.height = img.offsetHeight;
  canvas.style.position = 'absolute';
  canvas.style.top  = '0';
  canvas.style.left = '0';

  drawGangsaOverlay(canvas, img, inst, null);

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // Scale to original image space for hit detection
    const scaleX = inst.imgW / canvas.width;
    const origX  = x * scaleX;
    const noteI  = inst.detectHit(x, y, inst.imgW, canvas.width);
    if (noteI === null) return;

    const note = inst.notes[noteI];
    triggerNote(inst.key, note.index, note.name, note.freq);
    State.highlight.gangsa = noteI;
    drawGangsaOverlay(canvas, img, inst, noteI);
    flashNote(note.name, inst.color);

    // Clear highlight after short time
    setTimeout(() => {
      if (State.highlight.gangsa === noteI) {
        State.highlight.gangsa = null;
        drawGangsaOverlay(canvas, img, inst, null);
      }
    }, 400);
  });

  // Resize observer
  const ro = new ResizeObserver(() => {
    canvas.width  = img.offsetWidth;
    canvas.height = img.offsetHeight;
    drawGangsaOverlay(canvas, img, inst, State.highlight.gangsa);
  });
  ro.observe(img);
}

function drawGangsaOverlay(canvas, img, inst, activeKey) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;

  // Map original x range to display coordinates
  const scaleX  = W / inst.imgW;
  const xStart  = inst.xStart * scaleX;
  const xEnd    = inst.xEnd   * scaleX;
  const keyW    = (xEnd - xStart) / 10;

  inst.notes.forEach((note, i) => {
    const kx  = xStart + i * keyW;
    const isActive = activeKey === i;

    // Key highlight
    if (isActive) {
      ctx.fillStyle = 'rgba(200,150,12,0.45)';
      ctx.fillRect(kx + 2, 0, keyW - 4, H * 0.9);
    }

    // Label pill
    const lx = kx + keyW / 2;
    const ly = H * 0.08;
    const text = note.name;
    ctx.font = `bold ${Math.max(10, Math.floor(keyW * 0.18))}px 'Cinzel', serif`;
    const tw = ctx.measureText(text).width;

    ctx.fillStyle = isActive ? 'rgba(200,150,12,0.9)' : 'rgba(0,0,0,0.65)';
    const pad = 5;
    ctx.beginPath();
    ctx.roundRect(lx - tw/2 - pad, ly - 10, tw + pad*2, 22, 4);
    ctx.fill();

    ctx.fillStyle = isActive ? '#1a0f0a' : 'rgba(200,150,12,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, lx, ly + 1);

    // Key divider line
    if (i > 0) {
      ctx.strokeStyle = 'rgba(200,150,12,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(kx, H * 0.03);
      ctx.lineTo(kx, H * 0.87);
      ctx.stroke();
    }
  });
}

// ─── KENDANG Panel ────────────────────────────────────────────────────────────
function renderKendang(container, inst) {
  // Decorative kendang body image
  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'kendang-body-wrap';
  const bodyImg = document.createElement('img');
  bodyImg.src = inst.image;
  bodyImg.className = 'kendang-body-img';
  bodyImg.alt = 'Kendang Bali';
  bodyImg.draggable = false;
  bodyWrap.appendChild(bodyImg);
  container.appendChild(bodyWrap);

  const hint = document.createElement('p');
  hint.className = 'hint-text';
  hint.textContent = 'Klik pada membran drum — bagian dalam (Tung) atau tepi (Pak)';
  container.appendChild(hint);

  // Two snare drums side by side
  const drums = document.createElement('div');
  drums.className = 'drums-row';

  ['muka', 'belakang'].forEach(bagian => {
    const cell = document.createElement('div');
    cell.className = 'drum-cell';

    const label = document.createElement('div');
    label.className = `drum-label drum-label-${bagian}`;
    label.textContent = bagian === 'muka' ? 'MUKA' : 'BELAKANG';
    cell.appendChild(label);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'snare-wrap';

    const img = document.createElement('img');
    img.src = inst.snareImage;
    img.className = 'snare-img';
    img.alt = `Kendang ${bagian}`;
    img.draggable = false;

    const canvas = document.createElement('canvas');
    canvas.className = 'hit-canvas';

    imgWrap.appendChild(img);
    imgWrap.appendChild(canvas);
    cell.appendChild(imgWrap);

    const zones = document.createElement('div');
    zones.className = 'zone-hints';
    zones.innerHTML = `
      <span class="zone-inner">Tengah = Tung</span>
      <span class="zone-sep">·</span>
      <span class="zone-outer">Tepi = Pak</span>
    `;
    cell.appendChild(zones);
    drums.appendChild(cell);

    img.addEventListener('load', () => setupSnareCanvas(canvas, img, inst, bagian));
    if (img.complete) setupSnareCanvas(canvas, img, inst, bagian);
  });

  container.appendChild(drums);
}

function setupSnareCanvas(canvas, img, inst, bagian) {
  canvas.width  = img.offsetWidth;
  canvas.height = img.offsetHeight;

  const hlKey = `kendang_${bagian}`;
  drawSnareOverlay(canvas, inst, State.highlight[hlKey]);

  canvas.addEventListener('click', (e) => {
    const r   = canvas.getBoundingClientRect();
    const x   = e.clientX - r.left;
    const y   = e.clientY - r.top;
    const noteI = inst.detectHit(x, y, inst.snareW, canvas.width, bagian);
    if (noteI === null) return;

    const note = inst.notes[noteI];
    triggerNote(inst.key, note.index, note.name, note.freq);

    const zone = (noteI % 2 === 0) ? 'tengah' : 'pinggir';
    State.highlight[hlKey] = zone;
    drawSnareOverlay(canvas, inst, zone);
    flashNote(note.name.split(' · ')[0], inst.color);

    setTimeout(() => {
      if (State.highlight[hlKey] === zone) {
        State.highlight[hlKey] = null;
        drawSnareOverlay(canvas, inst, null);
      }
    }, 350);
  });

  const ro = new ResizeObserver(() => {
    canvas.width  = img.offsetWidth;
    canvas.height = img.offsetHeight;
    drawSnareOverlay(canvas, inst, State.highlight[hlKey]);
  });
  ro.observe(img);
}

function drawSnareOverlay(canvas, inst, activeZone) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width, H = canvas.height;
  const scale = W / inst.snareW;
  const cx = inst.snareCX * scale;
  const cy = inst.snareCY * scale;
  const ri = inst.innerR * scale;
  const ro_ = inst.outerR * scale;

  // Outer zone (Pinggir/Pak) ring
  ctx.beginPath();
  ctx.arc(cx, cy, ro_, 0, Math.PI * 2);
  ctx.fillStyle = activeZone === 'pinggir' ? 'rgba(0,180,220,0.22)' : 'rgba(0,180,220,0.07)';
  ctx.fill();
  ctx.strokeStyle = activeZone === 'pinggir' ? 'rgba(0,200,240,0.95)' : 'rgba(0,180,220,0.45)';
  ctx.lineWidth = activeZone === 'pinggir' ? 3 : 1.5;
  ctx.stroke();

  // Inner zone (Tengah/Tung)
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  ctx.fillStyle = activeZone === 'tengah' ? 'rgba(220,90,0,0.30)' : 'rgba(220,90,0,0.08)';
  ctx.fill();
  ctx.strokeStyle = activeZone === 'tengah' ? 'rgba(255,120,0,0.95)' : 'rgba(220,90,0,0.5)';
  ctx.lineWidth = activeZone === 'tengah' ? 3 : 1.5;
  ctx.stroke();

  // Labels
  const fs = Math.max(10, Math.floor(W * 0.07));
  ctx.font = `bold ${fs}px 'Cinzel', serif`;
  ctx.textAlign = 'center';

  ctx.fillStyle = activeZone === 'tengah' ? 'rgba(255,150,50,1)' : 'rgba(220,90,0,0.7)';
  ctx.fillText('TENGAH', cx, cy - fs * 0.25);
  ctx.font = `${Math.max(8, fs * 0.7)}px 'Lato', sans-serif`;
  ctx.fillText('( Tung )', cx, cy + fs * 0.7);

  ctx.font = `bold ${fs}px 'Cinzel', serif`;
  ctx.fillStyle = activeZone === 'pinggir' ? 'rgba(80,230,255,1)' : 'rgba(0,180,220,0.7)';
  ctx.fillText('PINGGIR', cx, cy - ri - fs * 0.4);
  ctx.font = `${Math.max(8, fs * 0.7)}px 'Lato', sans-serif`;
  ctx.fillText('( Pak )', cx, cy - ri + fs * 0.6);
}

// ─── SULING Panel ─────────────────────────────────────────────────────────────
function renderSuling(container, inst) {
  const wrap = document.createElement('div');
  wrap.className = 'suling-layout';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'img-wrap suling-wrap';

  const img = document.createElement('img');
  img.src = inst.image;
  img.className = 'suling-img';
  img.alt = 'Suling Bali';
  img.draggable = false;

  const canvas = document.createElement('canvas');
  canvas.className = 'hit-canvas';

  imgWrap.appendChild(img);
  imgWrap.appendChild(canvas);

  // Side note list
  const noteList = document.createElement('div');
  noteList.className = 'suling-note-list';
  noteList.id = 'suling-note-list';
  inst.notes.forEach(note => {
    const item = document.createElement('div');
    item.className = 'suling-note-item';
    item.dataset.idx = note.index;
    item.innerHTML = `
      <span class="suling-note-name">${note.name}</span>
      <span class="suling-note-freq">${note.freq} Hz</span>
    `;
    noteList.appendChild(item);
  });

  wrap.appendChild(imgWrap);
  wrap.appendChild(noteList);
  container.appendChild(wrap);

  const hint = document.createElement('p');
  hint.className = 'hint-text';
  hint.textContent = 'Klik pada lubang suling untuk memainkan nada';
  container.appendChild(hint);

  img.addEventListener('load', () => setupSulingCanvas(canvas, img, inst));
  if (img.complete) setupSulingCanvas(canvas, img, inst);
}

function setupSulingCanvas(canvas, img, inst) {
  canvas.width  = img.offsetWidth;
  canvas.height = img.offsetHeight;

  drawSulingOverlay(canvas, img, inst, null);

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const noteI = inst.detectHit(x, y, inst.imgW, canvas.width);
    if (noteI === null) return;

    const note = inst.notes[noteI];
    triggerNote(inst.key, note.index, note.name, note.freq);
    State.highlight.suling = noteI;

    drawSulingOverlay(canvas, img, inst, noteI);
    flashNote(note.name, inst.color);
    highlightSulingNote(noteI);

    setTimeout(() => {
      if (State.highlight.suling === noteI) {
        State.highlight.suling = null;
        drawSulingOverlay(canvas, img, inst, null);
        highlightSulingNote(null);
      }
    }, 600);
  });

  const ro = new ResizeObserver(() => {
    canvas.width  = img.offsetWidth;
    canvas.height = img.offsetHeight;
    drawSulingOverlay(canvas, img, inst, State.highlight.suling);
  });
  ro.observe(img);
}

function drawSulingOverlay(canvas, img, inst, activeHole) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width  / inst.imgW;
  const scaleY = canvas.height / inst.imgH;

  inst.holeY.forEach((hy, i) => {
    const cx = inst.holeCX * scaleX;
    const cy = hy * scaleY;
    const r  = inst.hitRadius * scaleX;
    const isActive = activeHole === i;

    // Glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isActive ? 'rgba(126,200,80,1)' : 'rgba(126,200,80,0.35)';
    ctx.lineWidth   = isActive ? 3 : 1.5;
    if (isActive) {
      ctx.fillStyle = 'rgba(126,200,80,0.25)';
      ctx.fill();
    }
    ctx.stroke();

    // Note label to the right
    const lx = cx + r + 8;
    const fs = Math.max(9, Math.floor(canvas.width * 0.06));
    ctx.font      = `${isActive ? 'bold ' : ''}${fs}px 'Cinzel', serif`;
    ctx.fillStyle = isActive ? 'rgba(150,230,100,1)' : 'rgba(126,200,80,0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(inst.notes[i].name, lx, cy);
  });
}

function highlightSulingNote(idx) {
  $$('#suling-note-list .suling-note-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

// ─── Note trigger ──────────────────────────────────────────────────────────────
function triggerNote(instrument, noteIndex, noteName, freq) {
  const params = State.params[instrument];
  const usedSample = AudioEngine.playNote(instrument, noteIndex, noteName, freq, params);

  State.lastNote      = { instrument, noteIndex, noteName, freq };
  State.lastWasSample = usedSample;
  updateNoteOutput(noteName, usedSample);
}

// ─── Note output display ──────────────────────────────────────────────────────
function flashNote(name, color) {
  const el = $('#note-flash');
  if (!el) return;
  el.textContent = name;
  el.style.borderColor = color;
  el.style.color = color;
  el.classList.remove('fade');
  void el.offsetWidth;
  el.classList.add('fade');
}

function updateNoteOutput(name, isSample) {
  const flash = $('#note-flash');
  if (flash) {
    flash.textContent = name;
  }
  const badge = $('#sample-badge');
  if (badge) {
    badge.textContent  = isSample ? 'Sampel Asli' : 'Sintetis';
    badge.className    = `badge ${isSample ? 'badge-ok' : 'badge-syn'}`;
  }
}

function updateNoteStatusList(key) {
  const inst = INSTRUMENTS[key];
  const list = $('#note-status-list');
  if (!list) return;
  list.innerHTML = '';
  inst.notes.forEach(note => {
    const li = document.createElement('div');
    li.className = 'note-status-item';
    li.dataset.inst = key;
    li.dataset.note = note.name;
    const hasSamp = AudioEngine.hasSample(key, note.name);
    li.innerHTML = `
      <span class="ns-dot ${hasSamp ? 'ns-ok' : 'ns-syn'}"></span>
      <span class="ns-name">${note.name}</span>
    `;
    list.appendChild(li);
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────
function buildSettings() {
  const container = $('#settings-container');

  // Common: Volume
  container.appendChild(makeSlider('Volume', 'vol-master', 0, 100, 80, 1, (v) => {
    AudioEngine.setMasterVolume(v / 100);
  }));

  // GANGSA settings
  const gs = document.createElement('div');
  gs.className = 'settings-group';
  gs.dataset.inst = 'gangsa';
  gs.appendChild(makeSlider('Resonansi', 'g-res', 0, 100, 50, 1, (v) => {
    State.params.gangsa.resonance = v / 100;
  }));
  gs.appendChild(makeSlider('Efek Ombak (Hz)', 'g-ombak', 0, 20, 6, 0.5, (v) => {
    State.params.gangsa.ombak = v;
  }));
  gs.appendChild(makeSlider('Dengung / Release (ms)', 'g-rel', 500, 4000, 2000, 100, (v) => {
    State.params.gangsa.release_ms = v;
  }));
  container.appendChild(gs);

  // KENDANG settings
  const ks = document.createElement('div');
  ks.className = 'settings-group hidden';
  ks.dataset.inst = 'kendang';
  ks.appendChild(makeSlider('Kedalaman Tung (%)', 'k-depth', 0, 100, 60, 1, (v) => {
    State.params.kendang.depth = v / 100;
  }));
  ks.appendChild(makeSlider('Kekeringan Pak (%)', 'k-dry', 0, 100, 70, 1, (v) => {
    State.params.kendang.dryness = v / 100;
  }));
  container.appendChild(ks);

  // SULING settings
  const ss = document.createElement('div');
  ss.className = 'settings-group hidden';
  ss.dataset.inst = 'suling';
  ss.appendChild(makeSlider('Serangan / Attack (ms)', 's-atk', 10, 350, 90, 5, (v) => {
    State.params.suling.attack_ms = v;
  }));
  ss.appendChild(makeSlider('Nafas Hembusan (%)', 's-breath', 0, 100, 22, 1, (v) => {
    State.params.suling.breath = v;
  }));
  container.appendChild(ss);
}

function makeSlider(label, id, min, max, val, step, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'slider-wrap';
  const topRow = document.createElement('div');
  topRow.className = 'slider-top';
  const lbl = document.createElement('label');
  lbl.className = 'slider-label';
  lbl.textContent = label;
  const valDisplay = document.createElement('span');
  valDisplay.className = 'slider-val';
  valDisplay.textContent = val;
  topRow.appendChild(lbl);
  topRow.appendChild(valDisplay);

  const slider = document.createElement('input');
  slider.type  = 'range';
  slider.min   = min; slider.max = max;
  slider.value = val; slider.step = step;
  slider.className = 'slider';
  slider.id = id;

  slider.addEventListener('input', () => {
    valDisplay.textContent = parseFloat(slider.value);
    onChange(parseFloat(slider.value));
  });

  wrap.appendChild(topRow);
  wrap.appendChild(slider);
  return wrap;
}

// ─── Recording ────────────────────────────────────────────────────────────────
function initRecordingUI() {
  const startBtn = $('#rec-start');
  const stopBtn  = $('#rec-stop');
  const elapsed  = $('#rec-elapsed');
  const output   = $('#rec-output');

  startBtn.addEventListener('click', () => {
    AudioEngine.resume();
    AudioEngine.startRecording();
    State.recording = true;
    State.recStartTime = performance.now();

    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    $('#rec-indicator').classList.remove('hidden');

    State.recTimer = setInterval(() => {
      const s = ((performance.now() - State.recStartTime) / 1000).toFixed(1);
      elapsed.textContent = `${s}s`;
    }, 100);
  });

  stopBtn.addEventListener('click', async () => {
    State.recording = false;
    clearInterval(State.recTimer);

    const blob = await AudioEngine.stopRecording();

    stopBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
    $('#rec-indicator').classList.add('hidden');
    elapsed.textContent = '0.0s';

    if (blob) {
      output.classList.remove('hidden');
      const url = URL.createObjectURL(blob);
      const audio = $('#rec-audio');
      audio.src = url;

      const dl = $('#rec-download');
      dl.href = url;
      dl.download = 'rekaman_gamelan.webm';
    }
  });

  $('#rec-clear').addEventListener('click', () => {
    const audio = $('#rec-audio');
    audio.src = '';
    output.classList.add('hidden');
  });
}

// ─── Sample Upload ────────────────────────────────────────────────────────────
function initSampleUpload() {
  const select = $('#upload-note-select');
  const fileInput = $('#upload-file');
  const btn = $('#upload-btn');

  // Populate select when instrument changes (hook into switchInstrument)
  const originalSwitch = window.switchInstrument;
  window.switchInstrument = (key) => {
    originalSwitch(key);
    populateNoteSelect(key);
  };

  btn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const inst     = State.instrument;
    const noteName = select.value;
    const arrayBuf = await file.arrayBuffer();

    try {
      await AudioEngine.loadSampleFile(inst, noteName, arrayBuf);
      const status = $('#upload-status');
      status.textContent = `Sampel "${noteName}" berhasil dimuat`;
      status.className = 'upload-status ok';
      updateNoteStatusList(inst);
      fileInput.value = '';
    } catch (e) {
      const status = $('#upload-status');
      status.textContent = `Gagal membaca file: ${e.message}`;
      status.className = 'upload-status err';
    }
  });

  populateNoteSelect('gangsa');
}

function populateNoteSelect(key) {
  const select = $('#upload-note-select');
  if (!select) return;
  select.innerHTML = '';
  INSTRUMENTS[key].notes.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.name;
    opt.textContent = n.name;
    select.appendChild(opt);
  });
}
