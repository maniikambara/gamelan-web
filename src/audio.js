/**
 * audio.js — Gamelan Bali Synthesizer · Audio Engine
 *
 * Arsitektur dua lapis:
 *   1. Sample layer   — pre-load semua WAV dari backend saat app dimuat.
 *                       Playback via AudioBufferSourceNode (zero latency).
 *   2. Procedural layer — fallback Web Audio API oscillator jika sampel
 *                         belum tersedia (upload atau backend belum online).
 *
 * Public API:
 *   await engine.loadSamples(onProgress)   — fetch + decode semua sampel
 *   engine.hasSample(instrument, noteName) — true jika sampel sudah loaded
 *   engine.playNote(...)                   — play dengan layer yang tersedia
 *   engine.startRecording()
 *   await engine.stopRecording()           → { url, blob }
 */

const API_BASE = '/api'

// ─── Procedural fallback synths (Web Audio API) ──────────────────────────────

const _fallback = {
  gangsa(ctx, freq, params) {
    const now = ctx.currentTime
    const ratios = [1.0, 2.756, 5.404, 8.933]
    const amps   = [1.0, 0.55,  0.28,  0.14]
    const dur    = (params.release_ms || 2000) / 1000 + 1.0
    const master = ctx.createGain()
    master.gain.setValueAtTime(params.gain || 0.8, now)
    master.gain.setTargetAtTime(0, now + 0.05, (dur - 0.05) / 4)
    master.connect(ctx.destination)
    const oscs = []

    ratios.forEach((r, i) => {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq * r
      g.gain.value = amps[i]
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + dur)
      oscs.push(osc)

      // Ombak detuned copy for the first 3 partials
      if (i < 3) {
        const osc2 = ctx.createOscillator()
        const g2   = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.value = freq * r + (params.ombak || 6)
        g2.gain.value = amps[i] * 0.45
        osc2.connect(g2); g2.connect(master)
        osc2.start(now); osc2.stop(now + dur)
        oscs.push(osc2)
      }
    })
    return { gainNode: master, oscillators: oscs }
  },

  kendang(ctx, freq, params, noteIndex) {
    const now    = ctx.currentTime
    const isTung = noteIndex % 2 === 0
    const dur    = isTung ? 0.5 : 0.15
    const osc    = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain   = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * (isTung ? 0.7 : 0.5), now + dur * 0.8)

    if (isTung) {
      filter.type = 'lowpass'
      filter.frequency.value = freq * 3
      filter.Q.value = 2
    } else {
      filter.type = 'highpass'
      filter.frequency.value = freq * 1.2
      filter.Q.value = (params.resonance || 0.4) * 8
    }

    gain.gain.setValueAtTime(params.gain || 0.8, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
    osc.start(now); osc.stop(now + dur)
    return { gainNode: gain, oscillators: [osc] }
  },

  suling(ctx, freq, params) {
    const now = ctx.currentTime
    const dur = (params.release_ms || 600) / 1000 + 0.5

    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    const attackSec = (params.attack_ms || 90) / 1000
    master.gain.linearRampToValueAtTime(params.gain || 0.7, now + attackSec)
    master.gain.setTargetAtTime(0, now + dur * 0.8, dur * 0.15)
    master.connect(ctx.destination)
    const oscs = []

    // Fundamental + 2nd harmonic
    ;[1.0, 2.0].forEach((r, i) => {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq * r
      g.gain.value = i === 0 ? 1.0 : 0.22
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + dur)
      oscs.push(osc)
    })
    return { gainNode: master, oscillators: oscs }
  },
}

// ─── AudioEngine class ────────────────────────────────────────────────────────

export class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null

    /** Pre-loaded sample buffers: key = "instrument/noteName" */
    this.sampleBuffers = {}

    /** true once loadSamples() completes */
    this.samplesLoaded = false

    /** Active sources for muting: key → { source, gainNode } */
    this.activeSources = {}

    // Recording state
    this.isRecording = false
    this.recordStartTime = 0
    this.recordingEvents = []
  }

  // ─── Context management ───────────────────────────────────────────────────

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    }
  }

  resume() {
    this.ensureContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  // ─── Sample pre-loading ───────────────────────────────────────────────────

  /**
   * Fetch the list of available samples from the backend, then decode each
   * WAV file into an AudioBuffer.  Calls onProgress(loaded, total) after
   * each successful decode.
   *
   * @param {function(number, number):void} [onProgress]
   * @returns {Promise<number>} Number of samples successfully loaded
   */
  async loadSamples(onProgress = null) {
    this.ensureContext()

    let listData = null
    try {
      const res = await fetch(`${API_BASE}/samples`)
      if (!res.ok) return 0
      listData = await res.json()
    } catch {
      return 0
    }

    const keys = Object.keys(listData?.loaded ?? {})
    if (keys.length === 0) return 0

    let loaded = 0
    for (const key of keys) {
      const [inst, note] = key.split('/')
      try {
        const res = await fetch(
          `${API_BASE}/samples/${encodeURIComponent(inst)}/${encodeURIComponent(note)}`
        )
        if (!res.ok) continue
        const arrayBuf = await res.arrayBuffer()
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf)
        this.sampleBuffers[key] = audioBuf
        loaded++
        if (onProgress) onProgress(loaded, keys.length)
      } catch (err) {
        console.warn(`[AudioEngine] Could not load sample "${key}":`, err)
      }
    }

    this.samplesLoaded = true
    console.info(`[AudioEngine] Loaded ${loaded}/${keys.length} samples`)
    return loaded
  }

  /** Check whether a pre-loaded buffer exists for this instrument+note. */
  hasSample(instrument, noteName) {
    return `${instrument}/${noteName}` in this.sampleBuffers
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  /**
   * Play a single note.  Returns 'sample' or 'synth' indicating which
   * layer was used (for the badge in the header).
   *
   * @param {string} instrument
   * @param {number} noteIndex
   * @param {string} noteName
   * @param {number} freq
   * @param {object} params
   * @returns {string} 'sample' | 'synth'
   */
  playNote(instrument, noteIndex, noteName, freq, params) {
    this.resume()
    return this._play(instrument, noteIndex, noteName, freq, params)
  }

  _play(instrument, noteIndex, noteName, freq, params) {
    const key = `${instrument}/${noteName}`
    const hasBuf = key in this.sampleBuffers
    const mode   = hasBuf ? 'sample' : 'synth'

    if (hasBuf) {
      const { source, gainNode } = this._playBuffer(
        this.sampleBuffers[key], params.gain ?? 0.8
      )
      // Store for muting; overwrite any previous instance of this note
      this.activeSources[key] = { source, gainNode }
      source.onended = () => {
        if (this.activeSources[key]?.source === source) {
          delete this.activeSources[key]
        }
      }
    } else {
      const result = this._procedural(instrument, noteIndex, freq, params)
      if (result) {
        // Store procedural nodes for muting
        this.activeSources[key] = {
          gainNode: result.gainNode,
          oscillators: result.oscillators,
        }
        // Auto-clean when oscillators end
        const firstOsc = result.oscillators[0]
        if (firstOsc) {
          firstOsc.onended = () => {
            if (this.activeSources[key]?.gainNode === result.gainNode) {
              delete this.activeSources[key]
            }
          }
        }
      }
    }

    // Record event for later export
    if (this.isRecording) {
      this.recordingEvents.push({
        timestamp_ms: Date.now() - this.recordStartTime,
        instrument,
        noteName,
        noteIndex,
        freq,
        params: { ...params },
        sampleKey: hasBuf ? key : null,
      })
    }

    return mode
  }

  /**
   * Mute (damp) a note — stops the active sound source with a quick 30ms
   * fade so it doesn't click.  Works for both sample-based playback and
   * procedural synthesis.  No-op if the note is not currently playing.
   *
   * @param {string} instrument
   * @param {string} noteName
   */
  muteNote(instrument, noteName) {
    const key = `${instrument}/${noteName}`
    const active = this.activeSources[key]
    if (!active) return

    const { gainNode, source, oscillators } = active
    // 30ms exponential fade to silence, then hard stop
    gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01)
    setTimeout(() => {
      // Stop sample source if present
      if (source) {
        try { source.stop() } catch (_) {}
      }
      // Stop procedural oscillators if present
      if (oscillators) {
        for (const osc of oscillators) {
          try { osc.stop() } catch (_) {}
        }
      }
    }, 60)
    delete this.activeSources[key]
  }

  /** Play an AudioBuffer through the context destination with gain scaling.
   *  Returns { source, gainNode } for later muting. */
  _playBuffer(buffer, gainValue = 0.8) {
    const src  = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()
    src.buffer   = buffer
    gain.gain.value = gainValue
    src.connect(gain)
    gain.connect(this.ctx.destination)
    src.start(0)
    return { source: src, gainNode: gain }
  }

  /** Procedural synthesis fallback using Web Audio API oscillators.
   *  Returns { gainNode, oscillators } for muting support. */
  _procedural(instrument, noteIndex, freq, params) {
    switch (instrument) {
      case 'gangsa':
        return _fallback.gangsa(this.ctx, freq, params)
      case 'kendang':
        return _fallback.kendang(this.ctx, freq, params, noteIndex)
      case 'suling':
        return _fallback.suling(this.ctx, freq, params)
      default:
        return _fallback.gangsa(this.ctx, freq, params)
    }
  }

  // ─── Sample upload ────────────────────────────────────────────────────────

  async uploadSample(instrument, noteName, file) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(
      `${API_BASE}/samples/${encodeURIComponent(instrument)}/${encodeURIComponent(noteName)}`,
      { method: 'POST', body: formData }
    )
    if (!res.ok) throw new Error('Upload failed')

    // Immediately decode and cache the uploaded sample for instant playback
    const arrayBuf = await file.arrayBuffer()
    try {
      this.ensureContext()
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf.slice(0))
      this.sampleBuffers[`${instrument}/${noteName}`] = audioBuf
    } catch {
      /* Decode failure is non-fatal; sample still uploaded to backend */
    }

    return await res.json()
  }

  // ─── Recording ────────────────────────────────────────────────────────────

  startRecording() {
    this.ensureContext()
    this.resume()
    this.recordingEvents = []
    this.recordStartTime = Date.now()
    this.isRecording = true
  }

  /**
   * Stop recording and return a downloadable WAV blob mixed from all events.
   * Uses pre-loaded AudioBuffers for events that used samples; uses procedural
   * synthesis for events that used the fallback.
   *
   * @returns {Promise<{url: string, blob: Blob}>}
   */
  async stopRecording() {
    this.isRecording = false

    try {
      const sr     = this.ctx.sampleRate
      const events = this.recordingEvents
      if (!events || events.length === 0) {
        return { url: '', blob: null }
      }

      // Total duration: last event offset + generous tail
      const maxOffset  = Math.max(...events.map(e => e.timestamp_ms)) / 1000
      const bufferSecs = maxOffset + 5.0
      const frameCount = Math.ceil(bufferSecs * sr)
      const mix        = new Float32Array(frameCount)

      for (const ev of events) {
        const startFrame = Math.floor(ev.timestamp_ms / 1000 * sr)

        if (ev.sampleKey && this.sampleBuffers[ev.sampleKey]) {
          // Use the pre-loaded AudioBuffer
          const buf = this.sampleBuffers[ev.sampleKey]
          const eventData = buf.getChannelData(0)
          const gain = ev.params?.gain ?? 0.8
          for (let i = 0; i < eventData.length; i++) {
            const dest = startFrame + i
            if (dest < frameCount) mix[dest] += eventData[i] * gain
          }
        } else {
          // Procedural approximation for the recording mix
          this._mixProcedural(mix, startFrame, ev, sr)
        }
      }

      // Normalise to prevent clipping
      let peak = 0
      for (let i = 0; i < frameCount; i++) peak = Math.max(peak, Math.abs(mix[i]))
      if (peak > 1) for (let i = 0; i < frameCount; i++) mix[i] /= peak

      const wavBlob = this._float32ToWav(mix, sr)
      const url = URL.createObjectURL(wavBlob)
      return { url, blob: wavBlob }
    } catch (err) {
      console.error('[AudioEngine] Recording export error:', err)
      return { url: '', blob: null }
    }
  }

  /** Procedural note mixing for the recording export. */
  _mixProcedural(mix, startFrame, ev, sr) {
    const { instrument, noteIndex, freq, params } = ev
    const isTung  = noteIndex % 2 === 0
    const durSecs = instrument === 'kendang' ? (isTung ? 0.5 : 0.15) : 0.8
    const frames  = Math.ceil(durSecs * sr)
    const gain    = params?.gain ?? 0.8

    for (let i = 0; i < frames; i++) {
      const t   = i / sr
      const dest = startFrame + i
      if (dest >= mix.length) break

      let sample = 0
      if (instrument === 'gangsa') {
        const env = Math.exp(-t * 1.5)
        sample = Math.sin(2 * Math.PI * freq * t) * env
        // Inharmonic 2nd partial
        sample += 0.45 * Math.sin(2 * Math.PI * freq * 2.756 * t) * env
      } else if (instrument === 'kendang') {
        const env = Math.exp(-t * (isTung ? 8 : 40))
        const f   = freq * Math.exp(-t * (isTung ? 4 : 12))
        sample = Math.sin(2 * Math.PI * f * t) * env
      } else {
        const attackF = (params.attack_ms ?? 90) / 1000
        const att = Math.min(t / attackF, 1.0)
        const env = att * Math.exp(-t * 0.5)
        sample = Math.sin(2 * Math.PI * freq * t) * env
      }

      mix[dest] += sample * gain
    }
  }

  // ─── WAV encoder ─────────────────────────────────────────────────────────

  _float32ToWav(samples, sampleRate) {
    const length = samples.length
    const buf    = new ArrayBuffer(44 + length * 2)
    const view   = new DataView(buf)
    const write  = (off, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
    }
    write(0, 'RIFF')
    view.setUint32(4,  36 + length * 2, true)
    write(8, 'WAVE')
    write(12, 'fmt ')
    view.setUint32(16, 16,         true)
    view.setUint16(20, 1,          true)   // PCM
    view.setUint16(22, 1,          true)   // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2,          true)
    view.setUint16(34, 16,         true)
    write(36, 'data')
    view.setUint32(40, length * 2, true)
    let off = 44
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      off += 2
    }
    return new Blob([buf], { type: 'audio/wav' })
  }

  // ─── Misc ────────────────────────────────────────────────────────────────

  getRecordingElapsed() {
    return this.recordStartTime ? (Date.now() - this.recordStartTime) / 1000 : 0
  }

  clearRecording() {
    this.recordedChunks  = []
    this.recordingEvents = []
    this.recordStartTime = 0
  }

  async getInstruments() {
    try {
      const res = await fetch(`${API_BASE}/instruments`)
      if (!res.ok) throw new Error('fetch failed')
      return await res.json()
    } catch {
      return {}
    }
  }
}
