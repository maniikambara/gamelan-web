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
  gangsa(ctx, baseFreq, noteParams, userParams, noteIndex = 0) {
    const now = ctx.currentTime
    // Note params from analysis (if available)
    const adsr = noteParams?.adsr || { attack_ms: 10, decay_ms: 5, sustain: 0.9, release_ms: 3000 }
    const isNadaKecil = noteIndex >= 5
    const defaultRatios = isNadaKecil ? [1.0, 2.61, 4.80] : [1.0, 2.76, 5.18]
    const defaultAmps   = isNadaKecil ? [1.0, 0.50, 0.25] : [1.0, 0.55, 0.28]
    const ratios = noteParams?.synth_ratios || defaultRatios
    const amps   = noteParams?.synth_amps   || defaultAmps
    const ombak = userParams.ombak ?? noteParams?.ombak_hz ?? 8
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

    // Resonance: peaking EQ centered at f0; gain and Q scale with the slider
    const resonance = userParams.resonance ?? 0.5
    if (resonance > 0.01) {
      const peakEq = ctx.createBiquadFilter()
      peakEq.type = 'peaking'
      peakEq.frequency.value = f0
      peakEq.gain.value = resonance * 10       // up to +10 dB at f0
      peakEq.Q.value = 1 + resonance * 9       // Q 1–10: sharper with more resonance
      master.connect(peakEq)
      peakEq.connect(ctx.destination)
    } else {
      master.connect(ctx.destination)
    }

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
    const f0  = noteParams?.f0_hz || baseFreq
    const masterGain = userParams.gain || 0.8

    // Resonance: peaking EQ centered at the membrane's fundamental — models the
    // drum shell/body resonance. Shared across all four strokes.
    const resonance = userParams.resonance ?? 0.4
    const connectResonant = (master, centerFreq) => {
      if (resonance > 0.01) {
        const peakEq = ctx.createBiquadFilter()
        peakEq.type = 'peaking'
        peakEq.frequency.value = centerFreq
        peakEq.gain.value = resonance * 8
        peakEq.Q.value = 1 + resonance * 6
        master.connect(peakEq)
        peakEq.connect(ctx.destination)
      } else {
        master.connect(ctx.destination)
      }
    }

    // Tut: kepala lanang muka tengah — tonal + bandpass noise, ADSR 3/50/8%/180
    if (noteIndex === 0) {
      const adsr   = noteParams?.adsr || { attack_ms: 3, decay_ms: 50, sustain: 0.08, release_ms: 180 }
      const relMs  = userParams.release_ms ?? adsr.release_ms
      const dur    = (adsr.attack_ms + adsr.decay_ms + relMs) / 1000
      const depth  = userParams.depth ?? 0.6
      const master = ctx.createGain()
      master.gain.setValueAtTime(0, now)
      master.gain.linearRampToValueAtTime(masterGain, now + adsr.attack_ms / 1000)
      master.gain.exponentialRampToValueAtTime(0.001, now + dur)
      connectResonant(master, f0)

      const osc1 = ctx.createOscillator(); const g1 = ctx.createGain()
      osc1.type = 'sine'; osc1.frequency.value = f0
      g1.gain.value = 0.7 * depth
      osc1.connect(g1); g1.connect(master)
      osc1.start(now); osc1.stop(now + dur + 0.1)

      const osc2 = ctx.createOscillator(); const g2 = ctx.createGain()
      osc2.type = 'sine'; osc2.frequency.value = f0 * 1.5
      g2.gain.value = 0.28 * depth
      osc2.connect(g2); g2.connect(master)
      osc2.start(now); osc2.stop(now + dur + 0.1)

      const oscs = [osc1, osc2]
      if (depth < 0.99) {
        const nFrames = Math.ceil(dur * ctx.sampleRate)
        const noiseBuf = ctx.createBuffer(1, nFrames, ctx.sampleRate)
        const nd = noiseBuf.getChannelData(0)
        for (let i = 0; i < nFrames; i++) nd[i] = Math.random() * 2 - 1
        const ns = ctx.createBufferSource()
        ns.buffer = noiseBuf
        const bpf = ctx.createBiquadFilter()
        bpf.type = 'bandpass'; bpf.frequency.value = f0 * 1.3; bpf.Q.value = 1.0
        const ng = ctx.createGain()
        ng.gain.value = (1 - depth) * 0.4
        ns.connect(bpf); bpf.connect(ng); ng.connect(master)
        ns.start(now); ns.stop(now + dur + 0.1)
        oscs.push(ns)
      }
      return { gainNode: master, oscillators: oscs }
    }

    // Pak: kepala lanang muka tepi — impulsif tajam, ADSR 2/18/2%/80
    if (noteIndex === 1) {
      const adsr    = noteParams?.adsr || { attack_ms: 2, decay_ms: 18, sustain: 0.02, release_ms: 80 }
      const relMs   = userParams.release_ms ?? adsr.release_ms
      const dur     = (adsr.attack_ms + adsr.decay_ms + relMs) / 1000
      const dryness = userParams.dryness ?? 0.7
      const master = ctx.createGain()
      master.gain.setValueAtTime(0, now)
      master.gain.linearRampToValueAtTime(masterGain, now + adsr.attack_ms / 1000)
      master.gain.exponentialRampToValueAtTime(0.001, now + dur)
      connectResonant(master, f0)

      const bufSize = ctx.sampleRate * dur
      const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1)
      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = noiseBuffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'; filter.frequency.value = f0 * 1.8; filter.Q.value = 0.8
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = dryness
      noiseSource.connect(filter); filter.connect(noiseGain); noiseGain.connect(master)
      noiseSource.start(now); noiseSource.stop(now + dur + 0.1)

      // Click component (transient tone): weighted by (1 - dryness)
      const clickDur = Math.min(dur, 0.06)
      const clickOsc = ctx.createOscillator()
      clickOsc.type = 'sine'; clickOsc.frequency.value = f0 * 2
      const clickGain = ctx.createGain()
      clickGain.gain.setValueAtTime((1 - dryness) * 0.9, now)
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickDur)
      clickOsc.connect(clickGain); clickGain.connect(master)
      clickOsc.start(now); clickOsc.stop(now + clickDur + 0.01)
      return { gainNode: master, oscillators: [noiseSource, clickOsc] }
    }

    // Dag: kepala wadon belakang terbuka — pitch-glide menurun resonan, ADSR 5/60/12%/200
    if (noteIndex === 2) {
      const adsr = noteParams?.adsr || { attack_ms: 5, decay_ms: 60, sustain: 0.12, release_ms: 200 }
      const dur  = (adsr.attack_ms + adsr.decay_ms + (userParams.release_ms ?? adsr.release_ms)) / 1000
      const master = ctx.createGain()
      master.gain.setValueAtTime(0, now)
      master.gain.linearRampToValueAtTime(masterGain, now + adsr.attack_ms / 1000)
      master.gain.exponentialRampToValueAtTime(0.001, now + dur)
      connectResonant(master, f0)

      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f0, now)
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.6, now + dur * 0.85)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'; filter.frequency.value = f0 * 4; filter.Q.value = 1.5
      osc.connect(filter); filter.connect(master)
      osc.start(now); osc.stop(now + dur + 0.1)
      return { gainNode: master, oscillators: [osc] }
    }

    // Dug: kepala wadon belakang dalam — pitch-glide menurun bass, ADSR 4/40/5%/120
    const adsr = noteParams?.adsr || { attack_ms: 4, decay_ms: 40, sustain: 0.05, release_ms: 120 }
    const dur  = (adsr.attack_ms + adsr.decay_ms + (userParams.release_ms ?? adsr.release_ms)) / 1000
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    master.gain.linearRampToValueAtTime(masterGain, now + adsr.attack_ms / 1000)
    master.gain.exponentialRampToValueAtTime(0.001, now + dur)
    connectResonant(master, f0)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, now)
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, now + dur * 0.8)
    osc.connect(master)
    osc.start(now); osc.stop(now + dur + 0.1)
    return { gainNode: master, oscillators: [osc] }
  },

  suling(ctx, baseFreq, noteParams, userParams) {
    const now = ctx.currentTime
    const f0  = noteParams?.f0_hz || baseFreq
    const adsr = noteParams?.adsr || { attack_ms: 100, decay_ms: 80, sustain: 0.88, release_ms: 600 }
    
    // Gunakan durasi sampel asli (sekitar 4-6 detik), atau default ke 5 detik jika tidak ada
    const dur  = noteParams?.duration_s || 5.0
    const breath = (userParams.breath ?? 0.18) * Math.sqrt(f0 / 558.0)

    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    
    // Slow, breathy attack typical for suling
    const attackSec = Math.max(0.05, (userParams.attack_ms ?? adsr.attack_ms) / 1000)
    master.gain.linearRampToValueAtTime(userParams.gain || 0.7, now + attackSec)
    
    // Sustain, then release over user-controlled release time before the sample ends
    const releaseSec = Math.max(0.05, (userParams.release_ms ?? adsr.release_ms) / 1000)
    master.gain.setTargetAtTime(0, now + Math.max(attackSec, dur - releaseSec), releaseSec / 3)

    // Resonance: lowpass filter sculpts the harmonic texture; higher resonance = darker, rounder tone
    const resonance = userParams.resonance ?? 0.4
    if (resonance > 0.01) {
      const lpFilter = ctx.createBiquadFilter()
      lpFilter.type = 'lowpass'
      lpFilter.frequency.value = Math.max(f0 * 2, f0 * (4 - resonance * 2))
      lpFilter.Q.value = 1 + resonance * 4
      master.connect(lpFilter)
      lpFilter.connect(ctx.destination)
    } else {
      master.connect(ctx.destination)
    }

    const oscs = []
    const ratios = noteParams?.synth_ratios || [1.0, 2.0, 3.0]
    const amps   = noteParams?.synth_amps   || [1.0, 0.22, 0.05]

    // Vibrato (Suling Bali has very strong, expressive vibrato)
    const vibratoOsc = ctx.createOscillator()
    vibratoOsc.type = 'sine'
    vibratoOsc.frequency.value = 5.5 // ~5.5 Hz rate
    const vibratoGain = ctx.createGain()
    vibratoGain.gain.value = f0 * 0.012 // ~1.2% depth
    vibratoOsc.connect(vibratoGain)
    vibratoOsc.start(now)
    vibratoOsc.stop(now + dur + 0.5)
    oscs.push(vibratoOsc)

    ratios.forEach((r, i) => {
      const amp = amps[i] || 0
      if (amp < 0.001) return
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.type = 'sine'; 
      osc.frequency.value = f0 * r
      
      // Connect vibrato to each harmonic, scaled by its ratio so it stays in tune
      const harmonicVibGain = ctx.createGain()
      harmonicVibGain.gain.value = r
      vibratoGain.connect(harmonicVibGain)
      harmonicVibGain.connect(osc.frequency)

      g.gain.value = amp
      osc.connect(g); g.connect(master)
      osc.start(now); osc.stop(now + dur + 0.5)
      oscs.push(osc)
    })

    // Noise hembusan napas — sigma 0.18, bandpass 0.7f to min(4f, 8000 Hz)
    if (breath > 0.01) {
      const noiseFrames = Math.ceil((dur + 0.5) * ctx.sampleRate)
      const noiseBuffer = ctx.createBuffer(1, noiseFrames, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      // Box-Muller approximation for Gaussian noise with sigma 0.18
      for (let i = 0; i < noiseFrames; i += 2) {
        const u1 = Math.random() || 1e-10
        const u2 = Math.random()
        const mag = 0.18 * Math.sqrt(-2.0 * Math.log(u1))
        data[i]     = mag * Math.cos(2.0 * Math.PI * u2)
        if (i + 1 < noiseFrames) data[i + 1] = mag * Math.sin(2.0 * Math.PI * u2)
      }
      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = noiseBuffer
      const bpFilter = ctx.createBiquadFilter()
      bpFilter.type = 'bandpass'
      const bpCenter = f0 * 2.35  // geometric mean of 0.7f and min(4f,8000)
      bpFilter.frequency.value = Math.min(bpCenter, 4000)
      bpFilter.Q.value = 0.6
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = breath
      noiseSource.connect(bpFilter); bpFilter.connect(noiseGain); noiseGain.connect(master)
      noiseSource.start(now); noiseSource.stop(now + dur + 0.5)
      oscs.push(noiseSource)
    }

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
    
    // Suling is monophonic: mute any currently playing suling note
    if (instrument === 'suling') {
      for (const activeKey in this.activeSources) {
        if (activeKey.startsWith('suling/')) {
          const prevNoteName = activeKey.split('/')[1]
          this.muteNote('suling', prevNoteName)
        }
      }
    }

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
        return _synthesizers.gangsa(this.ctx, freq, noteParams, params, noteIndex)
      case 'kendang':
        return _synthesizers.kendang(this.ctx, freq, noteParams, params, noteIndex)
      case 'suling':
        return _synthesizers.suling(this.ctx, freq, noteParams, params)
      default:
        return _synthesizers.gangsa(this.ctx, freq, noteParams, params, noteIndex)
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
    let durSecs
    if (instrument === 'kendang') {
      // 0=Tut: tonal medium, 1=Pak: impulsive slap, 2=Dag: resonant bass, 3=Dug: deep bass
      const KENDANG_DUR = [0.5, 0.15, 0.5, 0.4]
      durSecs = KENDANG_DUR[noteIndex] ?? 0.5
    } else if (instrument === 'suling') {
      durSecs = ev.noteParams?.duration_s ?? 5.0
    } else {
      durSecs = adsr.release_ms / 1000 + 0.5
    }
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
      } else if (instrument === 'suling') {
        const sAttack = Math.max(0.05, adsr.attack_ms / 1000)
        const sSus    = durSecs - sAttack - 0.2
        let env = 0
        if (t < sAttack) {
          env = t / sAttack
        } else if (sSus > 0 && t < sAttack + sSus) {
          env = 0.88
        } else {
          const relT = t - Math.max(sAttack, sAttack + sSus)
          env = 0.88 * Math.exp(-relT / 0.15)
        }
        const ratios = noteParams?.synth_ratios || [1.0, 2.0, 3.0]
        const amps   = noteParams?.synth_amps   || [1.0, 0.22, 0.05]
        for (let j = 0; j < ratios.length; j++) {
          sample += amps[j] * Math.sin(2 * Math.PI * f0 * ratios[j] * t) * env
        }
      } else {
        const env = att * Math.exp(-t * 0.5)
        const ratios = noteParams?.synth_ratios || [1.0, 2.0, 3.0]
        const amps   = noteParams?.synth_amps   || [1.0, 0.22, 0.05]
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
