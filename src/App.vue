<template>
  <div class="app" :style="{ '--accent': accentColor, '--accent-dim': accentDim }">

    <!-- Thin loading bar while samples are fetching -->
    <div v-if="!samplesReady" class="sample-loading-bar">
      <div
        class="sample-loading-fill"
        :style="{ width: `${sampleProgress}%` }"
      />
      <span class="sample-loading-label">
        {{ sampleProgress < 100
          ? `Memuat sampel… ${samplesLoaded}/${samplesTotal}`
          : 'Sampel siap' }}
      </span>
    </div>

    <Header
      :currentInstrument="currentInstrument"
      :lastNote="lastNote"
      :synthMode="lastSynthMode"
      :samplesReady="samplesReady"
    />
    <Sidebar
      :instruments="instruments"
      :activeInstrument="currentInstrument"
      @select="selectInstrument"
    />
    <main class="app-main">
      <InstrumentPanel
        :instrument="instruments[currentInstrument]"
        @play-note="playNote"
      />
    </main>
    <aside class="app-right">
      <SettingsPanel
        :instrument="instruments[currentInstrument]"
        :params="params[currentInstrument]"
        @update="updateParam"
      />
      <RecordingPanel
        @record-start="startRecording"
        @record-stop="onRecordingStop"
      />
      <SampleUpload :instruments="instruments" @sample-loaded="onSampleLoaded" />
    </aside>
  </div>
</template>

<script>
import { ref, computed, reactive, onMounted } from 'vue'
import { INSTRUMENTS } from './instruments'
import { AudioEngine } from './audio'
import Header from './components/Header.vue'
import Sidebar from './components/Sidebar.vue'
import InstrumentPanel from './components/InstrumentPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import RecordingPanel from './components/RecordingPanel.vue'
import SampleUpload from './components/SampleUpload.vue'

export default {
  components: {
    Header, Sidebar, InstrumentPanel, SettingsPanel, RecordingPanel, SampleUpload,
  },
  setup() {
    const instruments        = INSTRUMENTS
    const currentInstrument  = ref('gangsa')
    const lastNote           = ref(null)
    const lastSynthMode      = ref('synth')   // 'sample' | 'synth'
    const samplesReady       = ref(false)
    const samplesLoaded      = ref(0)
    const samplesTotal       = ref(0)
    const sampleProgress     = ref(0)

    const audioEngine = new AudioEngine()

    const params = reactive({
      gangsa:  { resonance: 0.5, gain: 0.8, ombak: 6, release_ms: 2000 },
      kendang: { resonance: 0.4, gain: 0.8, depth: 0.6, dryness: 0.7, release_ms: 160 },
      suling:  { resonance: 0.4, gain: 0.8, breath: 0.2, attack_ms: 90, release_ms: 600 },
    })

    const accentColor = computed(() => instruments[currentInstrument.value].color)
    const accentDim   = computed(() => instruments[currentInstrument.value].colorDim)

    // ── Pre-load samples on mount ──────────────────────────────────────────
    onMounted(async () => {
      // Fetch sample count first so the progress bar has a denominator
      try {
        const res  = await fetch('/api/samples')
        const data = await res.json()
        samplesTotal.value = data.count ?? 0
      } catch { /* backend not running locally is fine */ }

      if (samplesTotal.value === 0) {
        samplesReady.value = true
        return
      }

      await audioEngine.loadSamples((loaded, total) => {
        samplesLoaded.value  = loaded
        samplesTotal.value   = total
        sampleProgress.value = Math.round((loaded / total) * 100)
      })

      sampleProgress.value = 100
      samplesReady.value   = true
    })

    // ── Instrument selection ───────────────────────────────────────────────
    const selectInstrument = (key) => { currentInstrument.value = key }

    // ── Note playback ──────────────────────────────────────────────────────
    const playNote = ({ noteIndex, noteName, freq }) => {
      lastNote.value = noteName
      const mode = audioEngine.playNote(
        currentInstrument.value, noteIndex, noteName, freq,
        params[currentInstrument.value]
      )
      // playNote returns 'sample' or 'synth'
      if (mode === 'sample' || mode === 'synth') lastSynthMode.value = mode
    }

    // ── Parameter update ───────────────────────────────────────────────────
    const updateParam = (paramName, value) => {
      params[currentInstrument.value][paramName] = value
    }

    // ── Recording ──────────────────────────────────────────────────────────
    const startRecording = () => audioEngine.startRecording()

    const onRecordingStop = (callback) => {
      audioEngine.stopRecording().then(callback)
    }

    // ── Sample upload ──────────────────────────────────────────────────────
    const onSampleLoaded = async (instrument, noteName, arrayBuffer) => {
      try {
        const file = new File([arrayBuffer], `${noteName}.wav`, { type: 'audio/wav' })
        await audioEngine.uploadSample(instrument, noteName, file)
      } catch (err) {
        console.error('Sample upload failed:', err)
      }
    }

    return {
      instruments, currentInstrument, lastNote, lastSynthMode,
      samplesReady, samplesLoaded, samplesTotal, sampleProgress,
      params, accentColor, accentDim,
      selectInstrument, playNote, updateParam, startRecording,
      onSampleLoaded, onRecordingStop,
    }
  },
}
</script>
