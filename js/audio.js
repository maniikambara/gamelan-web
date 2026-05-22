/**
 * audio.js — Web Audio API Engine
 * Zero-latency synthesis + sample-based playback, all client-side.
 * No server round-trip for sound — instantly plays on click.
 */

const AudioEngine = (() => {

  let ctx = null;
  let masterGain = null;
  let recordingDest = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordStartTime = 0;

  // Uploaded sample buffers: { "gangsa/Ding": AudioBuffer, ... }
  const sampleBuffers = {};
  // Active source nodes (for stopping long notes)
  const activeSources = [];

  // ── Context init (deferred to first user gesture) ────────────────────────
  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
  }

  function resume() {
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
  }

  // ── DSP helpers ──────────────────────────────────────────────────────────

  function createADSR(param, now, atk, dec, sus, rel, duration) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(0, now);
    param.linearRampToValueAtTime(1, now + atk);
    param.linearRampToValueAtTime(sus, now + atk + dec);
    param.setValueAtTime(sus, now + duration);
    param.linearRampToValueAtTime(0, now + duration + rel);
  }

  // ── Synthesis: Gangsa ────────────────────────────────────────────────────
  // Metallic inharmonic partials + beating (ombak) between two detuned copies

  function synthGangsa(freq, params) {
    const now     = ctx.currentTime;
    const res     = params.resonance ?? 0.5;
    const gain    = params.gain ?? 0.8;
    const ombak   = params.ombak ?? 6;
    const relMs   = params.release_ms ?? 2000;
    const duration = 3.0;

    const masterNode = ctx.createGain();
    masterNode.connect(masterGain);

    const ratios = [1.0, 2.756, 5.404, 8.933, 13.35];
    const amps   = [1.0, 0.55,  0.28,  0.14,  0.07];

    // Resonance: bandpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1 + res * 8;
    filter.connect(masterNode);

    const dry = ctx.createGain();
    dry.gain.value = 1 - res * 0.6;
    dry.connect(masterNode);

    const wet = ctx.createGain();
    wet.gain.value = res * 0.6;
    wet.connect(filter);

    // Create partials for main + ombak copy
    [...ratios].forEach((r, i) => {
      [0, ombak].forEach((detune, d) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * r + detune;

        const g = ctx.createGain();
        const vol = amps[i] * (d === 0 ? 1.0 : (i < 3 ? 0.45 : 0));
        if (vol < 0.001) { osc.start(now); osc.stop(now + 0.001); return; }

        createADSR(g.gain, now, 0.012, 0.1, 0.45, relMs / 1000, duration);
        g.gain.value *= gain * vol;

        osc.connect(g);
        g.connect(dry);
        g.connect(wet);
        osc.start(now);
        osc.stop(now + duration + relMs / 1000 + 0.1);
        activeSources.push(osc);
      });
    });
  }

  // ── Synthesis: Kendang Tengah (center hit - Tung) ────────────────────────
  function synthKendangTengah(freq, params) {
    const now    = ctx.currentTime;
    const gain   = params.gain ?? 0.8;
    const depth  = params.depth ?? 0.6;
    const relMs  = params.release_ms ?? 180;

    // Low pitched tonal component
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.2, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08);

    const oscGain = ctx.createGain();
    createADSR(oscGain.gain, now, 0.003, 0.05, 0.08, relMs / 1000, 0.4);

    // Noise burst (body resonance)
    const bufSize = Math.ceil(ctx.sampleRate * 1.2);
    const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = freq * 1.3;
    noiseFilter.Q.value = 2;

    const noiseGain = ctx.createGain();
    createADSR(noiseGain.gain, now, 0.002, 0.04, 0.03, relMs / 1000 * 0.5, 0.3);

    const mix = ctx.createGain();
    mix.gain.value = gain;
    mix.connect(masterGain);

    osc.connect(oscGain); oscGain.gain.value *= depth;
    oscGain.connect(mix);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain); noiseGain.gain.value *= (1 - depth);
    noiseGain.connect(mix);

    osc.start(now); osc.stop(now + 1.5);
    noiseSource.start(now); noiseSource.stop(now + 1.5);
  }

  // ── Synthesis: Kendang Pinggir (rim hit - Pak) ────────────────────────────
  function synthKendangPinggir(freq, params) {
    const now     = ctx.currentTime;
    const gain    = params.gain ?? 0.8;
    const dryness = params.dryness ?? 0.7;

    // Sharp click transient
    const bufSize = Math.ceil(ctx.sampleRate * 0.5);
    const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = freq * 1.5;
    hpFilter.Q.value = 1;

    // Click tone
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq * 2;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(1 - dryness, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    const mix = ctx.createGain();
    mix.gain.value = gain * 1.1;
    mix.connect(masterGain);

    noiseSource.connect(hpFilter);
    hpFilter.connect(mix);
    osc.connect(oscGain);
    oscGain.connect(mix);

    noiseSource.start(now); noiseSource.stop(now + 0.5);
    osc.start(now); osc.stop(now + 0.5);
  }

  // ── Synthesis: Suling Bali ────────────────────────────────────────────────
  function synthSuling(freq, params) {
    const now      = ctx.currentTime;
    const gain     = params.gain ?? 0.8;
    const breath   = (params.breath ?? 22) / 100;
    const attackMs = params.attack_ms ?? 90;
    const duration = 4.0;

    const mix = ctx.createGain();
    mix.gain.value = gain;
    mix.connect(masterGain);

    // Fundamental + harmonics
    [1, 2, 3].forEach((harmonic, i) => {
      const amps = [1.0, 0.22, 0.05];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * harmonic;

      const g = ctx.createGain();
      g.gain.value = 0;
      createADSR(g.gain, now, attackMs / 1000, 0.08, 0.88, 0.6, duration);
      g.gain.value *= amps[i];

      // Slight vibrato
      if (harmonic === 1) {
        const vib = ctx.createOscillator();
        vib.type = 'sine';
        vib.frequency.value = 5.5;
        const vibGain = ctx.createGain();
        vibGain.gain.value = freq * 0.003;
        vib.connect(vibGain);
        vibGain.connect(osc.frequency);
        vib.start(now + attackMs / 1000 + 0.2);
        vib.stop(now + duration + 0.8);
      }

      osc.connect(g); g.connect(mix);
      osc.start(now); osc.stop(now + duration + 0.8);
    });

    // Breath noise
    if (breath > 0.01) {
      const bufSize = Math.ceil(ctx.sampleRate * (duration + 1));
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) nd[i] = (Math.random() * 2 - 1) * 0.12;

      const ns = ctx.createBufferSource();
      ns.buffer = noiseBuf;

      const bf = ctx.createBiquadFilter();
      bf.type = 'bandpass';
      bf.frequency.value = freq * 1.5;
      bf.Q.value = 0.8;

      const ng = ctx.createGain();
      ng.gain.value = 0;
      createADSR(ng.gain, now, attackMs / 1000, 0.1, breath * 0.9, 0.5, duration);

      ns.connect(bf); bf.connect(ng); ng.connect(mix);
      ns.start(now); ns.stop(now + duration + 1);
    }
  }

  // ── Sample playback ───────────────────────────────────────────────────────
  async function loadSampleFile(instrument, noteName, arrayBuffer) {
    ensureContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    sampleBuffers[`${instrument}/${noteName}`] = audioBuffer;
  }

  function playSample(instrument, noteName, params) {
    const key = `${instrument}/${noteName}`;
    const buffer = sampleBuffers[key];
    if (!buffer) return false;

    const now   = ctx.currentTime;
    const gain  = params.gain ?? 0.8;
    const res   = params.resonance ?? 0.5;
    const atk   = (params.attack_ms ?? 20) / 1000;
    const rel   = (params.release_ms ?? 500) / 1000;
    const sus   = params.sustain ?? 0.8;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const envGain = ctx.createGain();
    envGain.gain.value = 0;
    createADSR(envGain.gain, now, atk, 0.1, sus, rel, buffer.duration * 0.85);

    const outGain = ctx.createGain();
    outGain.gain.value = gain;

    // Resonance filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 1 + res * 6;

    const dry = ctx.createGain(); dry.gain.value = 1 - res * 0.5;
    const wet = ctx.createGain(); wet.gain.value = res * 0.5;

    source.connect(envGain);
    envGain.connect(dry); dry.connect(outGain);
    envGain.connect(wet); wet.connect(filter); filter.connect(outGain);
    outGain.connect(masterGain);

    source.start(now);
    activeSources.push(source);
    return true;
  }

  function hasSample(instrument, noteName) {
    return !!sampleBuffers[`${instrument}/${noteName}`];
  }

  // ── Main play API ─────────────────────────────────────────────────────────
  function playNote(instrument, noteIndex, noteName, freq, params) {
    resume();

    // Try sample first
    const usedSample = playSample(instrument, noteName, params);
    if (!usedSample) {
      // Fallback to synthesis
      if (instrument === 'gangsa') {
        synthGangsa(freq, params);
      } else if (instrument === 'kendang') {
        if (noteIndex % 2 === 0) synthKendangTengah(freq, params);
        else                     synthKendangPinggir(freq, params);
      } else if (instrument === 'suling') {
        synthSuling(freq, params);
      }
    }
    return usedSample;
  }

  // ── Recording via MediaRecorder on AudioContext dest ─────────────────────
  function startRecording() {
    ensureContext();
    recordedChunks = [];
    recordStartTime = performance.now();

    // Use audio destination stream
    const dest = ctx.createMediaStreamDestination();
    // Tap masterGain into recording dest too
    masterGain.connect(dest);

    mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start(100); // collect every 100ms
    return true;
  }

  function stopRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder) { resolve(null); return; }
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        resolve(blob);
      };
      mediaRecorder.stop();
      mediaRecorder = null;
    });
  }

  function isRecording() {
    return mediaRecorder && mediaRecorder.state === 'recording';
  }

  function setMasterVolume(val) {
    ensureContext();
    if (masterGain) masterGain.gain.value = val;
  }

  return {
    playNote,
    loadSampleFile,
    hasSample,
    startRecording,
    stopRecording,
    isRecording,
    setMasterVolume,
    resume,
  };
})();

window.AudioEngine = AudioEngine;
