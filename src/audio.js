/**
 * audio.js — Gamelan Bali Synthesizer · Audio Engine
 *
 * Fully procedural synthetic audio engine using Web Audio API.
 * Uses analyzed acoustic parameters (harmonics, ombak, envelopes)
 * fetched from the backend to generate realistic synthesis without
 * needing to download large audio files.
 *
 * Public API:
 *   await engine.loadSynthesisParams()     — fetch analysis data
 *   engine.playNote(...)                   — play synthetic note
 *   engine.startRecording()
 *   await engine.stopRecording()           → { url, blob }
 */

const API_BASE = '/api'

// ─── Procedural synthesizers (Web Audio API) ─────────────────────────────────

const _synthesizers = {
  gangsa(ctx, baseFreq, noteParams, userParams) {
    const now = ctx.currentTime
    // Note params from analysis (if available)
    const adsr = noteParams?.adsr || { attack_ms: 10, decay_ms: 5, sustain: 0.9, release_ms: 3000 }
    const ratios = noteParams?.synth_ratios || [1.0, 2.756, 5.404, 8.933]
    const amps = noteParams?.synth_amps || [1.0, 0.55, 0.28, 0.14]
    const ombak = noteParams?.ombak_hz || 6
    const f0 = noteParams?.f0_hz || baseFreq

    // Override with user settings
    const relMs = userParams.release_ms || adsr.release_ms
    const dur = relMs / 1000 + (adsr.attack_ms / 1000)

    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    const attackSec = Math.max(0.005, adsr.attack_ms / 1000)
    master.gain.linearRampToValueAtTime((userParams.gain || 0.8), now + attackSec)
    // Release
    master.gain.setTargetAtTime(0, now + attackSec + 0.05, dur / 4)
    master.connect(ctx.destination)

    const oscs = []

    ratios.forEach((r, i) => {
      const amp = amps[i] || 0
      if (amp < 0.001) return

      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f0 * r
      g.gain.value = amp
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + dur + 0.5)
      oscs.push(osc)

      // Ombak detuned copy for main partials
      if (i < 3) {
        const osc2 = ctx.createOscillator()
        const g2 = ctx.createGain()
        osc2.type = 'sine'
        // Apply ombak. Detuning by the analyzed ombak Hz
        osc2.frequency.value = f0 * r + ombak
        g2.gain.value = amp * 0.45
        osc2.connect(g2); g2.connect(master)
        osc2.start(now); osc2.stop(now + dur + 0.5)
        oscs.push(osc2)
      }
    })
    return { gainNode: master, oscillators: oscs }
  },

  kendang(ctx, baseFreq, noteParams, userParams, noteIndex) {
    const now = ctx.currentTime
    const f0 = noteParams?.f0_hz || baseFreq
    const adsr = noteParams?.adsr || { attack_ms: 5, decay_ms: 30, sustain: 0.4, release_ms: 500 }
    
    const isTung = noteIndex % 2 === 0
    const dur = (adsr.attack_ms + adsr.decay_ms + adsr.release_ms) / 1000

    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, now)
    osc.frequency.exponentialRampToValueAtTime(f0 * (isTung ? 0.7 : 0.5), now + dur * 0.8)

    if (isTung) {
      filter.type = 'lowpass'
      filter.frequency.value = f0 * 3
      filter.Q.value = 2
    } else {
      filter.type = 'highpass'
      filter.frequency.value = f0 * 1.2
      filter.Q.value = (userParams.resonance || 0.4) * 8
    }

    const attackSec = Math.max(0.005, adsr.attack_ms / 1000)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(userParams.gain || 0.8, now + attackSec)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
    osc.start(now); osc.stop(now + dur + 0.5)
    return { gainNode: gain, oscillators: [osc] }
  },

  suling(ctx, baseFreq, noteParams, userParams) {
    const now = ctx.currentTime
    const f0 = noteParams?.f0_hz || baseFreq
    const adsr = noteParams?.adsr || { attack_ms: 90, decay_ms: 10, sustain: 0.9, release_ms: 600 }
    const dur = (adsr.release_ms / 1000) + 0.5

    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    const attackSec = Math.max(0.005, adsr.attack_ms / 1000)
    master.gain.linearRampToValueAtTime(userParams.gain || 0.7, now + attackSec)
    master.gain.setTargetAtTime(0, now + dur * 0.8, dur * 0.15)
    master.connect(ctx.destination)
    
    const oscs = []
    const ratios = noteParams?.synth_ratios || [1.0, 2.0]
    const amps = noteParams?.synth_amps || [1.0, 0.22]

    ratios.forEach((r, i) => {
      const amp = amps[i] || 0
      if (amp < 0.001) return
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f0 * r
      g.gain.value = amp
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + dur + 0.5)
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

    /** Analyzed synthesis parameters from backend */
    this.synthParams = {}

    /** Active sources for muting: key → { gainNode, oscillators } */
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

  // ─── Synthesis Parameters Loading ─────────────────────────────────────────

  /**
   * Fetch acoustic analysis parameters to drive the synthesis engine.
   */
  async loadSynthesisParams() {
    this.ensureContext()

    try {
      const res = await fetch(`${API_BASE}/analysis`)
      if (!res.ok) return false
      const data = await res.json()
      if (data.available && data.instruments) {
        this.synthParams = data.instruments
        console.info(`[AudioEngine] Loaded synthesis parameters for ${Object.keys(data.instruments).length} instruments.`)
        return true
      }
    } catch (err) {
      console.warn(`[AudioEngine] Could not load synthesis parameters:`, err)
    }
    return false
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  /**
   * Play a single synthetic note. Returns 'synth'.
   *
   * @param {string} instrument
   * @param {number} noteIndex
   * @param {string} noteName
   * @param {number} freq
   * @param {object} params
   * @returns {string} 'synth'
   */
  playNote(instrument, noteIndex, noteName, freq, params) {
    this.resume()
    const key = `${instrument}/${noteName}`
    
    // Look up specific note parameters if available
    const noteParams = this.synthParams[instrument]?.[noteName]

    const result = this._procedural(instrument, noteIndex, freq, params, noteParams)
    
    if (result) {
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

    // Record event for later export
    if (this.isRecording) {
      this.recordingEvents.push({
        timestamp_ms: Date.now() - this.recordStartTime,
        instrument,
        noteName,
        noteIndex,
        freq,
        params: { ...params },
        noteParams: noteParams || null
      })
    }

    return 'synth'
  }

  /**
   * Mute (damp) a note — stops the active sound source with a quick 30ms
   * fade so it doesn't click.
   *
   * @param {string} instrument
   * @param {string} noteName
   */
  muteNote(instrument, noteName) {
    const key = `${instrument}/${noteName}`
    const active = this.activeSources[key]
    if (!active) return

    const { gainNode, oscillators } = active
    // exponential fade to silence, then hard stop
    gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01)
    setTimeout(() => {
      if (oscillators) {
        for (const osc of oscillators) {
          try { osc.stop() } catch (_) {}
        }
      }
    }, 60)
    delete this.activeSources[key]
  }

  /** Route to specific synthesis function. */
  _procedural(instrument, noteIndex, freq, params, noteParams) {
    switch (instrument) {
      case 'gangsa':
        return _synthesizers.gangsa(this.ctx, freq, noteParams, params)
      case 'kendang':
        return _synthesizers.kendang(this.ctx, freq, noteParams, params, noteIndex)
      case 'suling':
        return _synthesizers.suling(this.ctx, freq, noteParams, params)
      default:
        return _synthesizers.gangsa(this.ctx, freq, noteParams, params)
    }
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
   * Stop recording and return a downloadable WAV blob mixed from all events
   * using offline procedural rendering.
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

      const maxOffset  = Math.max(...events.map(e => e.timestamp_ms)) / 1000
      const bufferSecs = maxOffset + 5.0
      const frameCount = Math.ceil(bufferSecs * sr)
      const mix        = new Float32Array(frameCount)

      for (const ev of events) {
        const startFrame = Math.floor(ev.timestamp_ms / 1000 * sr)
        this._mixProcedural(mix, startFrame, ev, sr)
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
    const { instrument, noteIndex, freq, params, noteParams } = ev
    
    const adsr = noteParams?.adsr || { attack_ms: 10, decay_ms: 5, sustain: 0.9, release_ms: 3000 }
    const f0 = noteParams?.f0_hz || freq
    
    const isTung  = noteIndex % 2 === 0
    const durSecs = instrument === 'kendang' ? (isTung ? 0.5 : 0.15) : (adsr.release_ms / 1000 + 0.5)
    const frames  = Math.ceil(durSecs * sr)
    const gain    = params?.gain ?? 0.8
    const attackSec = Math.max(0.005, adsr.attack_ms / 1000)

    for (let i = 0; i < frames; i++) {
      const t   = i / sr
      const dest = startFrame + i
      if (dest >= mix.length) break

      let sample = 0
      
      // Simple envelope
      const att = Math.min(t / attackSec, 1.0)
      
      if (instrument === 'gangsa') {
        const env = att * Math.exp(-t * 1.5)
        const ratios = noteParams?.synth_ratios || [1.0, 2.756, 5.404]
        const amps = noteParams?.synth_amps || [1.0, 0.55, 0.28]
        const ombak = noteParams?.ombak_hz || 6
        
        for (let j = 0; j < ratios.length; j++) {
          sample += amps[j] * Math.sin(2 * Math.PI * f0 * ratios[j] * t) * env
          if (j < 3) {
            sample += (amps[j] * 0.45) * Math.sin(2 * Math.PI * (f0 * ratios[j] + ombak) * t) * env
          }
        }
      } else if (instrument === 'kendang') {
        const env = att * Math.exp(-t * (isTung ? 8 : 40))
        const f   = f0 * Math.exp(-t * (isTung ? 4 : 12))
        sample = Math.sin(2 * Math.PI * f * t) * env
      } else {
        const env = att * Math.exp(-t * 0.5)
        const ratios = noteParams?.synth_ratios || [1.0, 2.0]
        const amps = noteParams?.synth_amps || [1.0, 0.22]
        for (let j = 0; j < ratios.length; j++) {
          sample += amps[j] * Math.sin(2 * Math.PI * f0 * ratios[j] * t) * env
        }
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
