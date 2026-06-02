<template>
  <div class="app" :style="{ '--accent': accentColor, '--accent-dim': accentDim }">
    <Header :currentInstrument="currentInstrument" :lastNote="lastNote" />
    <Sidebar :instruments="instruments" :activeInstrument="currentInstrument" @select="selectInstrument" />
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
import { ref, computed, reactive } from 'vue'
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
    Header,
    Sidebar,
    InstrumentPanel,
    SettingsPanel,
    RecordingPanel,
    SampleUpload,
  },
  setup() {
    const instruments = INSTRUMENTS
    const currentInstrument = ref('gangsa')
    const lastNote = ref(null)
    const audioEngine = new AudioEngine()

    const params = reactive({
      gangsa: { resonance: 0.5, gain: 0.8, ombak: 6, release_ms: 2000 },
      kendang: { resonance: 0.4, gain: 0.8, depth: 0.6, dryness: 0.7, release_ms: 160 },
      suling: { resonance: 0.4, gain: 0.8, breath: 0.2, attack_ms: 90, release_ms: 600 },
    })

    const accentColor = computed(() => instruments[currentInstrument.value].color)
    const accentDim = computed(() => instruments[currentInstrument.value].colorDim)

    const selectInstrument = (key) => {
      currentInstrument.value = key
    }

    const playNote = async ({ noteIndex, noteName, freq }) => {
      lastNote.value = noteName
      await audioEngine.playNote(currentInstrument.value, noteIndex, noteName, freq, params[currentInstrument.value])
    }

    const updateParam = (paramName, value) => {
      params[currentInstrument.value][paramName] = value
    }

    const startRecording = () => {
      audioEngine.startRecording()
    }

    const stopRecording = async () => {
      const result = await audioEngine.stopRecording()
      return result
    }

    const onRecordingStop = (callback) => {
      stopRecording().then(callback)
    }

    const onSampleLoaded = async (instrument, noteName, arrayBuffer) => {
      try {
        const file = new File([arrayBuffer], `${noteName}.wav`, { type: 'audio/wav' })
        await audioEngine.uploadSample(instrument, noteName, file)
      } catch (error) {
        console.error('Sample upload failed:', error)
      }
    }

    return {
      instruments,
      currentInstrument,
      lastNote,
      params,
      accentColor,
      accentDim,
      selectInstrument,
      playNote,
      updateParam,
      startRecording,
      onSampleLoaded,
      onRecordingStop,
    }
  },
}
</script>
