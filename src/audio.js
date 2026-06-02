/**
 * audio.js - Frontend Gamelan Synthesizer
 * INSTANT synthesis using Web Audio API - NO SERVER DELAY
 */

const API_BASE = '/api'

// Simple synthesizer functions for each instrument
const synth = {
  gangsa: (ctx, freq, params, duration = 0.6) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    
    osc.type = 'sine'
    osc.frequency.value = freq
    filter.type = 'lowpass'
    filter.frequency.value = freq * 2 + (params.resonance || 0.5) * 2000
    filter.Q.value = 5
    
    gain.gain.setValueAtTime(params.gain || 0.8, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    
    osc.start(now)
    osc.stop(now + duration)
  },

  kendang: (ctx, freq, params, duration = 0.15) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.05)
    
    filter.type = 'highpass'
    filter.frequency.value = freq * 0.8
    filter.Q.value = (params.resonance || 0.4) * 10
    
    gain.gain.setValueAtTime(params.gain || 0.8, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    
    osc.start(now)
    osc.stop(now + duration)
  },

  suling: (ctx, freq, params, duration = 0.5) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    
    // Flute-like: sine with slight formant filter
    osc.type = 'sine'
    osc.frequency.value = freq
    
    filter.type = 'peaking'
    filter.frequency.value = freq * 1.2
    filter.gain.value = 5
    filter.Q.value = 2
    
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(params.gain || 0.7, now + 0.08) // breath attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    
    osc.start(now)
    osc.stop(now + duration)
  }
}

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.mediaRecorder = null
    this.recordedChunks = []
    this.recordStartTime = 0
    this.recordingEvents = []
    this.synthCache = {} // Cache synthesized notes
  }

  ensureContext() {
    if (this.ctx) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
  }

  resume() {
    this.ensureContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  /**
   * INSTANT client-side synthesis - NO API DELAY
   */
  async synthNote(instrument, noteIndex, noteName, freq, params) {
    try {
      this.ensureContext()
      
      // Use appropriate synth engine for instrument
      const synthFn = synth[instrument] || synth.gangsa
      const duration = instrument === 'kendang' ? 0.15 : 0.6
      
      // Synthesize instantly in browser
      synthFn(this.ctx, freq, params, duration)
      
      // Record if recording
      if (this.mediaRecorder?.state === 'recording') {
        this.recordingEvents.push({
          timestamp_ms: Date.now() - this.recordStartTime,
          instrument,
          noteName,
          freq,
          params: { ...params }
        })
      }
      
      return true
    } catch (error) {
      console.error('Synthesis error:', error)
    }
  }

  /**
   * Decode base64 WAV and play via Web Audio (for uploaded samples)
   */
  async _playAudioData(audio_b64) {
    this.ensureContext()
    try {
      const binary = atob(audio_b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }

      const audioBuffer = await this.ctx.decodeAudioData(bytes.buffer)
      const source = this.ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.ctx.destination)
      source.start(0)
    } catch (error) {
      console.error('Audio playback error:', error)
    }
  }

  /**
   * Play a note - calls backend synthesis
   */
  playNote(instrument, noteIndex, noteName, freq, params) {
    this.resume()
    return this.synthNote(instrument, noteIndex, noteName, freq, params)
  }

  /**
   * Start recording session
   */
  startRecording() {
    this.ensureContext()
    this.resume()
    this.recordedChunks = []
    this.recordingEvents = []
    this.recordStartTime = Date.now()

    // Create a silent media stream for MediaRecorder to track timing
    const dest = this.ctx.createMediaStreamAudioDestination()
    this.mediaRecorder = new MediaRecorder(dest.stream)
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data)
    }
    this.mediaRecorder.start()
  }

  /**
   * Stop recording and export WAV from backend
   * Returns { url: blob URL, blob: audio/wav Blob }
   */
  async stopRecording() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        try {
          // Send all synthesis events to backend for mixing
          const response = await fetch(`${API_BASE}/export-recording`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: this.recordingEvents }),
          })

          if (!response.ok) throw new Error('Export failed')
          const wavBlob = await response.blob()
          const url = URL.createObjectURL(wavBlob)

          resolve({ url, blob: wavBlob })
        } catch (error) {
          console.error('Recording export error:', error)
          resolve({ url: '', blob: null })
        }
      }

      this.mediaRecorder.stop()
    })
  }

  /**
   * Upload custom audio sample for a note
   */
  async uploadSample(instrument, noteName, file) {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE}/samples/${instrument}/${noteName}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Upload failed')
      return await response.json()
    } catch (error) {
      console.error('Sample upload error:', error)
      throw error
    }
  }

  /**
   * Get available instruments from backend
   */
  async getInstruments() {
    try {
      const response = await fetch(`${API_BASE}/instruments`)
      if (!response.ok) throw new Error('Failed to fetch instruments')
      return await response.json()
    } catch (error) {
      console.error('Failed to get instruments:', error)
      return {}
    }
  }

  /**
   * Get recording elapsed time in seconds
   */
  getRecordingElapsed() {
    if (!this.mediaRecorder || !this.recordStartTime) return 0
    return (Date.now() - this.recordStartTime) / 1000
  }

  /**
   * Clear recording data
   */
  clearRecording() {
    this.recordedChunks = []
    this.recordingEvents = []
    this.recordStartTime = 0
  }
}
