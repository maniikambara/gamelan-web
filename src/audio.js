/**
 * audio.js - Frontend API client for Gamelan Backend Synthesizer
 * All synthesis happens on backend API (api/index.py)
 */

const API_BASE = '/api'

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.mediaRecorder = null
    this.recordedChunks = []
    this.recordStartTime = 0
    this.recordingEvents = [] // Track synthesis events during recording
  }

  /**
   * Initialize Web Audio context for recording and playback only
   */
  ensureContext() {
    if (this.ctx) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
  }

  resume() {
    this.ensureContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  /**
   * Play synthesized note via backend API
   * Sends synthesis request to backend and plays returned WAV audio
   */
  async synthNote(instrument, noteIndex, noteName, freq, params) {
    try {
      const response = await fetch(`${API_BASE}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument,
          note_index: noteIndex,
          note_name: noteName,
          freq,
          params,
        }),
      })

      if (!response.ok) throw new Error(`Synthesis failed: ${response.statusText}`)
      const data = await response.json()
      
      // Record event if recording
      if (this.mediaRecorder?.state === 'recording') {
        this.recordingEvents.push({
          timestamp_ms: Date.now() - this.recordStartTime,
          audio_b64: data.audio_b64,
        })
      }

      // Play audio via Web Audio API
      return this._playAudioData(data.audio_b64)
    } catch (error) {
      console.error('Synthesis error:', error)
    }
  }

  /**
   * Decode base64 WAV and play via Web Audio
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
