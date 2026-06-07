<template>
  <div class="app" :style="{ '--accent': accentColor, '--accent-dim': accentDim }">

    <!-- Loading bar while analysis parameters are fetching -->
    <div v-if="!paramsReady" class="sample-loading-bar">
      <div
        class="sample-loading-fill"
        :style="{ width: '100%', animation: 'pulse 1.5s infinite' }"
      />
      <span class="sample-loading-label">Memuat parameter sintesis...</span>
    </div>

    <Header
      :currentInstrument="currentInstrument"
      :lastNote="lastNote"
      :synthMode="lastSynthMode"
      :samplesReady="paramsReady"
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
        @mute-note="muteNote"
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
export default {
  components: {
    Header, Sidebar, InstrumentPanel, SettingsPanel, RecordingPanel,
  },
  setup() {
    const instruments        = INSTRUMENTS
    const currentInstrument  = ref('gangsa')
    const lastNote           = ref(null)
    const lastSynthMode      = ref('synth')
    const paramsReady        = ref(false)

    const audioEngine = new AudioEngine()

    const params = reactive({
      gangsa:  { resonance: 0.5, gain: 0.8, ombak: 8, release_ms: 2000 },
      kendang: { resonance: 0.4, gain: 0.8, depth: 0.6, dryness: 0.7, release_ms: 160 },
      suling:  { resonance: 0.4, gain: 0.8, breath: 0.2, attack_ms: 90, release_ms: 600 },
    })

    const accentColor = computed(() => instruments[currentInstrument.value].color)
    const accentDim   = computed(() => instruments[currentInstrument.value].colorDim)

    // ── Pre-load synthesis parameters on mount ─────────────────────────────
    onMounted(async () => {
      await audioEngine.loadSynthesisParams()
      paramsReady.value = true
    })

    // ── Instrument selection ───────────────────────────────────────────────
    const selectInstrument = (key) => { currentInstrument.value = key }

    // ── Note playback ──────────────────────────────────────────────────────
    const playNote = ({ noteIndex, noteName, freq, positionGain }) => {
      lastNote.value = noteName
      const noteParams = { ...params[currentInstrument.value] }
      if (positionGain !== undefined) {
        noteParams.gain = (noteParams.gain || 0.8) * positionGain
      }
      const mode = audioEngine.playNote(
        currentInstrument.value, noteIndex, noteName, freq,
        noteParams
      )
      lastSynthMode.value = mode
    }

    const muteNote = ({ noteName }) => {
      audioEngine.muteNote(currentInstrument.value, noteName)
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

    return {
      instruments, currentInstrument, lastNote, lastSynthMode,
      paramsReady,
      params, accentColor, accentDim,
      selectInstrument, playNote, muteNote, updateParam, startRecording,
      onRecordingStop,
    }
  },
}
</script>

