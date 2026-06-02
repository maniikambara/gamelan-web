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
   * Stop recording and export WAV - INSTANT client-side mixing (NO SERVER DELAY)
   * Returns { url: blob URL, blob: audio/wav Blob }
   */
  async stopRecording() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        try {
          // Client-side mixing: render all recorded notes
          const maxDuration = Math.max(
            ...this.recordingEvents.map(e => e.timestamp_ms / 1000),
            1
          ) + 0.7 // Add buffer for last note
          
          const sampleRate = this.ctx.sampleRate
          const channels = 1
          const frameCount = Math.ceil(maxDuration * sampleRate)
          const audioBuffer = this.ctx.createBuffer(channels, frameCount, sampleRate)
          const data = audioBuffer.getChannelData(0)
          
          // Synthesize and mix each recorded note into buffer
          for (const event of this.recordingEvents) {
            const startFrame = Math.floor(event.timestamp_ms / 1000 * sampleRate)
            const synthFn = synth[event.instrument] || synth.gangsa
            const duration = event.instrument === 'kendang' ? 0.15 : 0.6
            const endFrame = Math.min(startFrame + Math.ceil(duration * sampleRate), frameCount)
            
            // Generate synth audio for this event
            const eventBuffer = this.ctx.createBuffer(1, endFrame - startFrame, sampleRate)
            const eventData = eventBuffer.getChannelData(0)
            
            // Simulate oscillator output for this note
            const freq = event.freq
            const params = event.params
            const gain = params.gain || (event.instrument === 'gangsa' ? 0.8 : 0.7)
            
            for (let i = 0; i < eventData.length; i++) {
              const t = i / sampleRate
              const envelope = Math.exp(-t / duration * 3) // decay
              
              if (event.instrument === 'kendang') {
                // Pitched drum decay
                const f = freq * Math.exp(-t / 0.15 * 2)
                eventData[i] = Math.sin(2 * Math.PI * f * t) * envelope * gain * 0.8
              } else if (event.instrument === 'suling') {
                // Flute with slow attack
                const attack = Math.min(t / 0.08, 1)
                eventData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * gain * attack
              } else {
                // Gangsa: sustained sine decay
                eventData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * gain
              }
            }
            
            // Mix into main buffer
            for (let i = startFrame; i < endFrame; i++) {
              data[i] += eventData[i - startFrame]
            }
          }
          
          // Normalize to prevent clipping
          let max = 0
          for (let i = 0; i < frameCount; i++) {
            max = Math.max(max, Math.abs(data[i]))
          }
          if (max > 1) {
            for (let i = 0; i < frameCount; i++) {
              data[i] /= max
            }
          }
          
          // Convert AudioBuffer to WAV blob
          const wavBlob = this._audioBufferToWav(audioBuffer)
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
   * Convert AudioBuffer to WAV Blob for download
   */
  _audioBufferToWav(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate
    const channelData = audioBuffer.getChannelData(0)
    const wav = new Uint8Array(44 + channelData.length * 2)
    const view = new DataView(wav.buffer)
    
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + channelData.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // subchunk1size
    view.setUint16(20, 1, true) // audio format (PCM)
    view.setUint16(22, 1, true) // num channels
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample
    writeString(36, 'data')
    view.setUint32(40, channelData.length * 2, true)
    
    let offset = 44
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      offset += 2
    }
    
    return new Blob([wav], { type: 'audio/wav' })
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
